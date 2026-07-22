import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';

const db = getFirestore(getApp(), 'tng-systems');

export const checkoutOrder = onCall(async (request: CallableRequest) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to create a POS order.');
    }

    const orderInput = request.data;
    if (!orderInput || !orderInput.businessUnitId || !orderInput.items || !Array.isArray(orderInput.items)) {
        throw new HttpsError('invalid-argument', 'Invalid order payload.');
    }

    // 1. Fetch POS Settings for Tax and SC
    const settingsSnap = await db.collection('settings').doc('pos').get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const vatRate = ((settings?.vatRate as number) || 12) / 100;
    const scRate = ((settings?.serviceChargeRate as number) || 0) / 100;

    // 2. Fetch current prices for all items in the cart
    const itemIds = orderInput.items.map((item: any) => item.menuItemId);
    
    // We fetch items individually or in chunks of 10 if there are many. Usually an order is < 30 distinct items.
    const menuItemsData: Record<string, any> = {};
    if (itemIds.length > 0) {
        // Handle firestore 'in' limit of 30
        for (let i = 0; i < itemIds.length; i += 30) {
            const chunk = itemIds.slice(i, i + 30);
            const itemsQuery = await db.collection('menu_items')
                .where('__name__', 'in', chunk)
                .get();
            itemsQuery.forEach(doc => {
                menuItemsData[doc.id] = doc.data();
            });
        }
    }

    // 3. Recalculate Totals
    let grossSubtotal = 0;
    let totalVatAmount = 0;
    let totalDiscount = 0;
    let totalScPwdDiscount = 0;
    let totalManualDiscount = 0;
    let totalVatableSales = 0;
    let totalVatExemptSales = 0;
    let finalSubtotal = 0;

    const computedItems = orderInput.items.map((clientItem: any) => {
        const serverItem = menuItemsData[clientItem.menuItemId];
        if (!serverItem) {
            throw new HttpsError('not-found', `Menu item ${clientItem.menuItemId} not found.`);
        }

        // Trust the server price
        const unitPrice = serverItem.price || 0;
        const rawSubtotal = unitPrice * clientItem.quantity;
        grossSubtotal += rawSubtotal;

        let itemVat = 0;
        let itemDiscount = 0;
        let itemVatExempt = 0;
        let itemFinalSubtotal = rawSubtotal;

        if (clientItem.isDiscounted) {
            // SC/PWD Logic
            itemVatExempt = rawSubtotal / (1 + vatRate);
            itemDiscount = itemVatExempt * 0.20;
            itemFinalSubtotal = itemVatExempt - itemDiscount;
            totalVatExemptSales += itemFinalSubtotal;
            totalScPwdDiscount += itemDiscount;
        } else if ((clientItem.discountRate || 0) > 0) {
            // Custom Manual Discount
            const isAmount = clientItem.discountType === 'amount';
            itemDiscount = isAmount ? (clientItem.discountRate || 0) : rawSubtotal * ((clientItem.discountRate || 0) / 100);
            const discountedPrice = Math.max(0, rawSubtotal - itemDiscount);
            itemDiscount = rawSubtotal - discountedPrice;
            
            const vatableSales = discountedPrice / (1 + vatRate);
            itemVat = discountedPrice - vatableSales;
            itemFinalSubtotal = discountedPrice;
            totalVatableSales += vatableSales;
            totalManualDiscount += itemDiscount;
        } else {
            // Regular Item
            const vatableSales = rawSubtotal / (1 + vatRate);
            itemVat = rawSubtotal - vatableSales;
            itemFinalSubtotal = rawSubtotal;
            totalVatableSales += vatableSales;
        }

        totalVatAmount += itemVat;
        totalDiscount += itemDiscount;
        finalSubtotal += itemFinalSubtotal;

        return {
            ...clientItem,
            unitPrice,
            subtotal: itemFinalSubtotal,
            vatAmount: itemVat,
            discountAmount: itemDiscount,
            vatExemptAmount: itemVatExempt
        };
    });

    // Check for global discount passed by the client
    let globalDiscountAmount = 0;
    if (orderInput.globalDiscountRate > 0) {
        globalDiscountAmount = finalSubtotal * (orderInput.globalDiscountRate / 100);
        finalSubtotal -= globalDiscountAmount;
        totalDiscount += globalDiscountAmount;
    }

    const serviceChargeAmount = finalSubtotal * scRate;
    const computedTotalAmount = finalSubtotal + serviceChargeAmount;

    // Overwrite the client's values with our server-computed ones.
    const orderData = {
        ...orderInput,
        items: computedItems,
        subtotal: grossSubtotal,
        taxAmount: totalVatAmount,
        vatableSales: totalVatableSales,
        vatExemptSales: totalVatExemptSales,
        serviceChargeAmount: serviceChargeAmount,
        discountAmount: totalDiscount,
        scPwdDiscountAmount: totalScPwdDiscount,
        manualItemDiscountAmount: totalManualDiscount,
        totalAmount: computedTotalAmount,
        // Calculate change
        changeAmount: Math.max(0, (orderInput.amountTendered || 0) - computedTotalAmount),
        
        orderNumber: `POS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 16777215).toString(16).toUpperCase()}`,
        status: 'COMPLETED',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };

    // 4. Save Order
    const orderRef = db.collection('pos_orders').doc();
    await orderRef.set(orderData);

    return {
        success: true,
        orderId: orderRef.id,
        order: {
            ...orderData,
            id: orderRef.id,
            // Convert FieldValue.serverTimestamp() to a standard ISO string or timestamp so the client can read it immediately
            createdAt: Timestamp.now().toDate().toISOString(),
            updatedAt: Timestamp.now().toDate().toISOString()
        }
    };
});
