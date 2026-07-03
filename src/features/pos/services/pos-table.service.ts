import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { POSTable } from '../types/pos.types';
import { v4 as uuidv4 } from 'uuid';

export class POSTableService {
    private static COLLECTION = 'pos_tables';

    static async getTables(businessUnitId: string): Promise<POSTable[]> {
        const q = query(
            collection(db, this.COLLECTION),
            where('businessUnitId', '==', businessUnitId)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as POSTable[];
    }

    static async addTable(businessUnitId: string, tableData: Partial<POSTable>): Promise<POSTable> {
        const tableId = uuidv4();
        const docRef = doc(db, this.COLLECTION, tableId);
        
        const newTable: POSTable = {
            id: tableId,
            businessUnitId,
            name: tableData.name || 'New Table',
            position: tableData.position || { x: 50, y: 50 },
            shape: tableData.shape || 'rectangle',
            seats: tableData.seats || 4,
            status: 'available',
            qrEnabled: tableData.qrEnabled || false,
            qrUrl: tableData.qrUrl || '',
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            createdAt: serverTimestamp() as any,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            updatedAt: serverTimestamp() as any
        };

        await setDoc(docRef, newTable);
        return newTable;
    }

    static async updateTable(tableId: string, updates: Partial<POSTable>): Promise<void> {
        const docRef = doc(db, this.COLLECTION, tableId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    }

    static async updateTableStatus(tableId: string, status: 'available' | 'occupied' | 'reserved'): Promise<void> {
        const docRef = doc(db, this.COLLECTION, tableId);
        await updateDoc(docRef, {
            status,
            updatedAt: serverTimestamp()
        });
    }

    static async deleteTable(tableId: string): Promise<void> {
        const docRef = doc(db, this.COLLECTION, tableId);
        await deleteDoc(docRef);
    }
}
