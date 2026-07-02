import { Timestamp } from 'firebase/firestore';
import type { MenuItem } from '../../menu/types/menu.types';

export type PaymentMethod = 'CASH' | 'CARD' | 'E_WALLET';

export type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface POSOrderItem {
    menuItemId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes?: string;
    category: string;
    
    // Discount and Tax Fields
    isDiscounted?: boolean;        // True if SC/PWD discount is applied
    discountType?: 'percentage' | 'amount'; // Type of manual discount
    discountRate?: number;         // Value of discount applied (either % or exact amount)
    discountReason?: string;       // Reason for manual discount
    vatExemptAmount?: number;      // Amount exempted from VAT
    discountAmount?: number;       // Actual discount amount applied (e.g., 20%)
    vatAmount?: number;            // VAT portion of this item (0 if exempted)

    // Keeping a reference to the original menu item for metadata if needed
    menuItemData?: MenuItem;
}

export interface POSOrder {
    id: string; // The Firestore document ID
    orderNumber: string; // Generated sequential/readable order number
    businessUnitId: string;
    cashierId: string;
    cashierName: string;
    items: POSOrderItem[];
    subtotal: number;
    taxAmount?: number;
    vatableSales?: number;
    vatExemptSales?: number; // Sum of VAT portions
    serviceChargeAmount?: number; // Service Charge computed
    discountAmount?: number; // Total discount amount
    scPwdDiscountAmount?: number; // SC/PWD specific total
    manualItemDiscountAmount?: number; // Manual per-item specific total
    totalAmount: number;
    amountTendered?: number;
    changeAmount?: number;
    paymentMethod: PaymentMethod;
    status: OrderStatus;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    notes?: string;
}

export interface POSOrderCreateInput {
    businessUnitId: string;
    cashierId: string;
    cashierName: string;
    items: Omit<POSOrderItem, 'menuItemData'>[];
    subtotal: number;
    taxAmount?: number;
    vatableSales?: number;
    vatExemptSales?: number;
    serviceChargeAmount?: number;
    discountAmount?: number;
    scPwdDiscountAmount?: number;
    manualItemDiscountAmount?: number;
    totalAmount: number;
    amountTendered: number;
    changeAmount: number;
    paymentMethod: PaymentMethod;
    notes?: string;
}

export interface POSTable {
    id: string;
    businessUnitId: string;
    name: string;
    position: {
        x: number;
        y: number;
    };
    shape: 'rectangle' | 'circle';
    seats: number;
    status: 'available' | 'occupied' | 'reserved';
    qrEnabled: boolean;
    qrUrl?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}
