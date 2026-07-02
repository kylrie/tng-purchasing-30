import { doc, collection, runTransaction, getDocs, query, where, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { COLLECTIONS } from '../../../shared/types/firebase.types';
import type { RunningBill, POSOrderCreateInput } from '../types/pos.types';
import { v4 as uuidv4 } from 'uuid';

export class RunningBillService {
    private static COLLECTION = 'pos_running_bills';

    /**
     * Create a new running bill for a table and mark the table as occupied.
     */
    static async openBill(
        tableId: string, 
        tableName: string,
        businessUnitId: string, 
        cashierId: string, 
        cashierName: string,
        guestCount?: number
    ): Promise<RunningBill> {
        const billId = uuidv4();
        const docRef = doc(db, this.COLLECTION, billId);

        const newBill: RunningBill = {
            id: billId,
            businessUnitId,
            tableId,
            tableName,
            cashierId,
            cashierName,
            items: [],
            subtotal: 0,
            taxAmount: 0,
            vatableSales: 0,
            vatExemptSales: 0,
            serviceChargeAmount: 0,
            discountAmount: 0,
            scPwdDiscountAmount: 0,
            manualItemDiscountAmount: 0,
            totalAmount: 0,
            guestCount: guestCount ?? 1,
            status: 'open',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        // We use a transaction to ensure both the bill is created and the table is marked occupied safely
        await runTransaction(db, async (transaction) => {
            const tableRef = doc(db, 'pos_tables', tableId);
            transaction.set(docRef, newBill);
            transaction.update(tableRef, { status: 'occupied', updatedAt: Timestamp.now() });
        });

        return newBill;
    }

    /**
     * Fetch the currently open bill for a specific table.
     */
    static async getOpenBillForTable(tableId: string): Promise<RunningBill | null> {
        const q = query(
            collection(db, this.COLLECTION),
            where('tableId', '==', tableId),
            where('status', '==', 'open')
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        return {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
        } as RunningBill;
    }

    /**
     * Fetch all open bills for a business unit.
     */
    static async getOpenBills(businessUnitId: string): Promise<RunningBill[]> {
        const q = query(
            collection(db, this.COLLECTION),
            where('businessUnitId', '==', businessUnitId),
            where('status', '==', 'open')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as RunningBill[];
    }

    /**
     * Add items to an existing running bill.
     */
    static async updateBillItems(billId: string, updates: Partial<RunningBill>): Promise<void> {
        const docRef = doc(db, this.COLLECTION, billId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    }

    /**
     * Settle a bill, creating a POSOrder and freeing the table.
     */
    static async settleBill(
        billId: string,
        orderInput: POSOrderCreateInput
    ): Promise<void> {
        await runTransaction(db, async (transaction) => {
            const billRef = doc(db, this.COLLECTION, billId);
            const billSnap = await transaction.get(billRef);

            if (!billSnap.exists()) {
                throw new Error("Bill does not exist.");
            }
            
            const billData = billSnap.data() as RunningBill;

            if (billData.status === 'settled') {
                throw new Error("Bill is already settled.");
            }

            const tableRef = doc(db, 'pos_tables', billData.tableId);

            // 1. Create the POSOrder
            const orderRef = doc(collection(db, COLLECTIONS.POS_ORDERS));
            const orderData = {
                ...orderInput,
                orderNumber: `POS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 16777215).toString(16).toUpperCase()}`,
                status: 'COMPLETED',
                tableId: billData.tableId,
                tableName: billData.tableName,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };
            
            transaction.set(orderRef, orderData);

            // 2. Mark Bill as Settled
            transaction.update(billRef, { 
                status: 'settled', 
                updatedAt: Timestamp.now() 
            });

            // 3. Mark Table as Available
            transaction.update(tableRef, { 
                status: 'available', 
                updatedAt: Timestamp.now() 
            });
        });
    }
}
