import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { COLLECTIONS } from '../../../shared/types/firebase.types';
import type { POSOrder, POSOrderCreateInput } from '../types/pos.types';

export class POSService {
    /**
     * Create a new POS order
     */
    static async createOrder(orderInput: POSOrderCreateInput): Promise<POSOrder> {
        try {
            const orderData = {
                ...orderInput,
                // Generate a readable order number: POS-YYYYMMDD-RandomHex
                orderNumber: `POS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 16777215).toString(16).toUpperCase()}`,
                status: 'COMPLETED',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            const docRef = await addDoc(collection(db, COLLECTIONS.POS_ORDERS), orderData);

            return {
                id: docRef.id,
                ...orderData
            } as POSOrder;
        } catch (error) {
            console.error('Error creating POS order:', error);
            throw new Error('Failed to create POS order');
        }
    }

    /**
     * Get all POS orders for a specific business unit for today
     */
    static async getTodayOrders(businessUnitId: string): Promise<POSOrder[]> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const q = query(
                collection(db, COLLECTIONS.POS_ORDERS),
                where('businessUnitId', '==', businessUnitId),
                where('createdAt', '>=', Timestamp.fromDate(today))
            );

            const snapshot = await getDocs(q);
            const orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as POSOrder[];
            return orders.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        } catch (error) {
            console.error('Error fetching today\'s orders:', error);
            throw new Error('Failed to fetch orders');
        }
    }

    /**
     * Get POS orders for a business unit within a date range
     */
    static async getOrdersByDateRange(
        businessUnitId: string,
        startDate: Date,
        endDate: Date
    ): Promise<POSOrder[]> {
        try {
            const q = query(
                collection(db, COLLECTIONS.POS_ORDERS),
                where('businessUnitId', '==', businessUnitId),
                where('createdAt', '>=', Timestamp.fromDate(startDate)),
                where('createdAt', '<=', Timestamp.fromDate(endDate))
            );

            const snapshot = await getDocs(q);
            const orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as POSOrder[];
            return orders.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        } catch (error) {
            console.error('Error fetching orders by date range:', error);
            return [];
        }
    }
}
