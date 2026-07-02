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
            where('businessUnitId', '==', businessUnitId),
            where('status', '==', 'COMPLETED'),
            where('createdAt', '>=', Timestamp.fromDate(startDate)),
            where('createdAt', '<=', Timestamp.fromDate(endDate))
        );

        const snapshot = await getDocs(q);
        const orders = snapshot.docs.map(doc => doc.data() as POSOrder);

        const report: ShiftReport = {
            businessUnitId,
            shiftStart: startDate,
            shiftEnd: endDate,
            totalTransactions: orders.length,
            
            grossSales: 0,
            netSales: 0,
            
            vatableSales: 0,
            vatAmount: 0,
            vatExemptSales: 0,
            zeroRatedSales: 0,
            
            serviceChargeTotal: 0,
            
            scPwdDiscountTotal: 0,
            manualDiscountTotal: 0,
            totalDiscounts: 0,
            
            cashTotal: 0,
            cardTotal: 0,
            eWalletTotal: 0,
            
            voidedTransactions: 0,
            voidedAmount: 0
        };

        orders.forEach(order => {
            report.grossSales += order.subtotal || 0;
            report.netSales += order.totalAmount || 0;
            
            report.vatableSales += order.vatableSales || 0;
            report.vatAmount += order.taxAmount || 0;
            report.vatExemptSales += order.vatExemptSales || 0;
            
            report.serviceChargeTotal += order.serviceChargeAmount || 0;
            
            report.scPwdDiscountTotal += order.scPwdDiscountAmount || 0;
            report.manualDiscountTotal += order.manualItemDiscountAmount || 0;
            report.totalDiscounts += order.discountAmount || 0;

            if (order.paymentMethod === 'CASH') {
                report.cashTotal += order.totalAmount || 0;
            } else if (order.paymentMethod === 'CARD') {
                report.cardTotal += order.totalAmount || 0;
            } else if (order.paymentMethod === 'E_WALLET') {
                report.eWalletTotal += order.totalAmount || 0;
            }
        });

        return report;
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
