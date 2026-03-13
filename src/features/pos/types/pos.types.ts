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
    taxAmount: number; // For future/potential tax support
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
    taxAmount: number;
    totalAmount: number;
    amountTendered: number;
    changeAmount: number;
    paymentMethod: PaymentMethod;
    notes?: string;
}
