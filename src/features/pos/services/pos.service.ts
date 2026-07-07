import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../config/firebase';
import { COLLECTIONS } from '../../../shared/types/firebase.types';
import type { POSOrder, POSOrderCreateInput } from '../types/pos.types';

export class POSService {
    /**
     * Create a new POS order using the secure checkoutOrder cloud function
     */
    static async createOrder(orderInput: POSOrderCreateInput): Promise<POSOrder> {
        try {
            const checkoutOrderFn = httpsCallable<POSOrderCreateInput, { success: boolean, orderId: string, order: POSOrder }>(functions, 'checkoutOrder');
            const result = await checkoutOrderFn(orderInput);
            
            if (!result.data.success) {
                throw new Error('Server rejected order creation');
            }
            
            // The server returns a serialized Timestamp as string, parse it if necessary
            // For the frontend to continue using it as a Timestamp:
            const returnOrder = result.data.order;
            if (typeof returnOrder.createdAt === 'string') {
                returnOrder.createdAt = Timestamp.fromDate(new Date(returnOrder.createdAt as unknown as string));
                returnOrder.updatedAt = Timestamp.fromDate(new Date(returnOrder.updatedAt as unknown as string));
            }
            
            return returnOrder;
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
                ...doc.data(),
                id: doc.id,
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
                ...doc.data(),
                id: doc.id,
            })) as POSOrder[];
            return orders.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        } catch (error) {
            console.error('Error fetching orders by date range:', error);
            return [];
        }
    }
}
