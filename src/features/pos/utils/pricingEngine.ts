import type { POSOrderItem } from '../types/pos.types';
import type { POSSettings } from '../../../shared/services/settings.service';

export interface PricingResult {
    computedItems: POSOrderItem[];
    grossSubtotal: number;
    totalDiscount: number;
    totalScPwdDiscount: number;
    totalManualDiscount: number;
    globalDiscountAmount: number;
    totalVatableSales: number;
    totalVatExemptSales: number;
    totalVatAmount: number;
    finalSubtotal: number;
    serviceChargeAmount: number;
    total: number;
}

/**
 * Calculates all totals, taxes, and discounts for a POS cart.
 * Extracted from React hooks to ensure testability and separation of concerns.
 */
export function calculateCartTotals(
    cartItems: POSOrderItem[],
    posSettings: POSSettings,
    globalDiscountRate: number = 0
): PricingResult {
    const vatRate = (posSettings.vatRate || 12) / 100;
    const scRate = (posSettings.serviceChargeRate || 0) / 100;

    let grossSubtotal = 0;
    let totalVatAmount = 0;
    let totalDiscount = 0;
    let totalScPwdDiscount = 0;
    let totalManualDiscount = 0;
    let totalVatableSales = 0;
    let totalVatExemptSales = 0;
    let finalSubtotal = 0; // After discounts, before SC

    const computedItems = cartItems.map(item => {
        const rawSubtotal = item.unitPrice * item.quantity;
        grossSubtotal += rawSubtotal;

        let itemVat = 0;
        let itemDiscount = 0;
        let itemVatExempt = 0;
        let itemFinalSubtotal = rawSubtotal;

        if (item.isDiscounted) {
            // Remove VAT for SC/PWD
            itemVatExempt = rawSubtotal / (1 + vatRate);
            itemDiscount = itemVatExempt * 0.20;
            itemFinalSubtotal = itemVatExempt - itemDiscount;
            totalVatExemptSales += itemFinalSubtotal;
            totalScPwdDiscount += itemDiscount;
        } else if ((item.discountRate || 0) > 0) {
            // Apply custom discount on the gross amount
            const isAmount = item.discountType === 'amount';
            itemDiscount = isAmount ? (item.discountRate || 0) : rawSubtotal * ((item.discountRate || 0) / 100);
            const discountedPrice = Math.max(0, rawSubtotal - itemDiscount);
            itemDiscount = rawSubtotal - discountedPrice; // ensure discount doesn't exceed price
            const vatableSales = discountedPrice / (1 + vatRate);
            itemVat = discountedPrice - vatableSales;
            itemFinalSubtotal = discountedPrice;
            totalVatableSales += vatableSales;
            totalManualDiscount += itemDiscount;
        } else {
            // Regular item: VAT is embedded in the price
            const vatableSales = rawSubtotal / (1 + vatRate);
            itemVat = rawSubtotal - vatableSales;
            itemFinalSubtotal = rawSubtotal;
            totalVatableSales += vatableSales;
        }

        totalVatAmount += itemVat;
        totalDiscount += itemDiscount;
        finalSubtotal += itemFinalSubtotal;

        return {
            ...item,
            subtotal: itemFinalSubtotal,
            vatAmount: itemVat,
            discountAmount: itemDiscount,
            vatExemptAmount: itemVatExempt
        };
    });

    // Apply global custom discount if any
    let globalDiscountAmount = 0;
    if (globalDiscountRate > 0) {
        globalDiscountAmount = finalSubtotal * (globalDiscountRate / 100);
        finalSubtotal -= globalDiscountAmount;
        totalDiscount += globalDiscountAmount;
    }

    const serviceChargeAmount = finalSubtotal * scRate;
    const total = finalSubtotal + serviceChargeAmount;

    return {
        computedItems,
        grossSubtotal,
        totalDiscount,
        totalScPwdDiscount,
        totalManualDiscount,
        globalDiscountAmount,
        totalVatableSales,
        totalVatExemptSales,
        totalVatAmount,
        finalSubtotal,
        serviceChargeAmount,
        total
    };
}
