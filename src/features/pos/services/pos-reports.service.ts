import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { POSOrder } from '../types/pos.types';

export interface ShiftReport {
    businessUnitId: string;
    shiftStart: Date;
    shiftEnd: Date;
    
    totalTransactions: number;
    
    // Sales Totals
    grossSales: number; // Subtotal before any discounts/taxes
    netSales: number;   // Total collected after everything
    
    // Taxes & Exemptions
    vatableSales: number;
    vatAmount: number;
    vatExemptSales: number;
    zeroRatedSales: number; // Usually 0 for this type of business, but needed for BIR
    
    // Service Charge
    serviceChargeTotal: number;
    
    // Discounts
    scPwdDiscountTotal: number;
    manualDiscountTotal: number;
    totalDiscounts: number;
    
    // Tender Breakdown
    cashTotal: number;
    cardTotal: number;
    eWalletTotal: number;
    
    // Voids / Refunds (Placeholder for future)
    voidedTransactions: number;
    voidedAmount: number;
}

export class POSReportsService {
    /**
     * Generates a shift report (X-Reading or Z-Reading) based on a date range.
     * X-Reading is usually generated for the current day up to NOW.
     * Z-Reading is generated at end of day and usually triggers a shift reset in backend.
     */
    static async generateShiftReport(businessUnitId: string, startDate: Date, endDate: Date): Promise<ShiftReport> {
        const q = query(
            collection(db, 'pos_orders'),
            where('businessUnitId', '==', businessUnitId)
        );

        const snapshot = await getDocs(q);
        
        let grossSales = 0;
        let netSales = 0;
        let vatableSales = 0;
        let vatAmount = 0;
        let vatExemptSales = 0;
        let zeroRatedSales = 0;
        let serviceChargeTotal = 0;
        let scPwdDiscountTotal = 0;
        let manualDiscountTotal = 0;
        let totalDiscounts = 0;
        let cashTotal = 0;
        let cardTotal = 0;
        let eWalletTotal = 0;
        let totalTransactions = 0;

        snapshot.docs.forEach(doc => {
            const order = doc.data() as POSOrder;
            if (order.status !== 'COMPLETED') return;
            
            const orderDate = order.createdAt instanceof Timestamp ? order.createdAt.toDate() : new Date(order.createdAt);
            if (orderDate < startDate || orderDate > endDate) return;

            totalTransactions++;
            grossSales += order.subtotal || 0;
            netSales += order.totalAmount || 0;
            
            vatableSales += order.vatableSales || 0;
            vatAmount += order.taxAmount || 0;
            vatExemptSales += order.vatExemptSales || 0;
            
            serviceChargeTotal += order.serviceChargeAmount || 0;
            
            scPwdDiscountTotal += order.scPwdDiscountAmount || 0;
            manualDiscountTotal += order.manualItemDiscountAmount || 0;
            totalDiscounts += order.discountAmount || 0;

            if (order.paymentMethod === 'CASH') {
                cashTotal += order.totalAmount || 0;
            } else if (order.paymentMethod === 'CARD') {
                cardTotal += order.totalAmount || 0;
            } else if (order.paymentMethod === 'E_WALLET') {
                eWalletTotal += order.totalAmount || 0;
            }
        });

        return {
            businessUnitId,
            shiftStart: startDate,
            shiftEnd: endDate,
            totalTransactions,
            
            grossSales,
            netSales,
            
            vatableSales,
            vatAmount,
            vatExemptSales,
            zeroRatedSales,
            
            serviceChargeTotal,
            
            scPwdDiscountTotal,
            manualDiscountTotal,
            totalDiscounts,
            
            cashTotal,
            cardTotal,
            eWalletTotal,
            
            voidedTransactions: 0,
            voidedAmount: 0
        };
    }

    /**
     * Helper to get today's start and end dates
     */
    static getTodayRange(): { start: Date, end: Date } {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        
        return { start, end };
    }
}
