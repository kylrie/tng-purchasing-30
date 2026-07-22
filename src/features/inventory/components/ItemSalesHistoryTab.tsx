import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { Loader2, Receipt } from 'lucide-react';
import { PosImportService } from '../../pos/services/pos-import.service';
import type { InventoryItem } from '../types/InventoryItem';
import type { PosImportMappedRow, SimulatedDeduction } from '../../pos/types/pos-import.types';
import { PosImportPreviewModal } from '../../pos/components/PosImportPreviewModal';

export const ItemSalesHistoryTab: React.FC<{ item: InventoryItem & { id: string } }> = ({ item }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [simulatedDeductions, setSimulatedDeductions] = useState<SimulatedDeduction[]>([]);
    const [isSimulating, setIsSimulating] = useState(false);

    useEffect(() => {
        const fetchSales = async () => {
            try {
                const q = query(
                    collection(db, 'pos_sales'),
                    where('inventoryItemId', '==', item.id),
                    limit(50)
                );
                const snap = await getDocs(q);
                const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort client-side to avoid needing an index immediately
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                results.sort((a: any, b: any) => {
                    const tsA = a.importedAt?.seconds || 0;
                    const tsB = b.importedAt?.seconds || 0;
                    return tsB - tsA;
                });
                setSales(results);
            } catch (err) {
                console.error('Failed to fetch item sales:', err);
            } finally {
                setLoading(false);
            }
        };

        if (item.id) {
            fetchSales();
        }
    }, [item.id]);

    const handleViewDeductions = async (batchId: string) => {
        setIsSimulating(true);
        setIsPreviewOpen(true);
        setSimulatedDeductions([]);

        try {
            // 1. Fetch sales for this batch
            const batchSales = await PosImportService.getSalesByBatchId(batchId);
            
            // 2. Fetch inventory items
            const itemsQuery = query(
                collection(db, 'inventory_items'),
                where('businessUnitId', '==', item.businessUnitId),
                where('isActive', '==', true)
            );
            const itemsSnap = await getDocs(itemsQuery);
            const itemsMap = new Map<string, InventoryItem & { id: string }>();
            itemsSnap.forEach(d => {
                itemsMap.set(d.id, { id: d.id, ...d.data() } as InventoryItem & { id: string });
            });

            // 3. Convert sales to fake mapped rows
            const fakeMappedRows: PosImportMappedRow[] = batchSales.map((sale, i) => ({
                rowIndex: i,
                matchedItemId: sale.inventoryItemId,
                matchedItemName: sale.inventoryItemName,
                matchStatus: 'MATCHED',
                currentStock: 0,
                negativeStockFlag: false,
                category: sale.category,
                itemName: sale.inventoryItemName,
                qtySold: sale.qtySold,
                qtyFoc: sale.qtyFoc,
                discount: sale.discount,
                isDirectSale: sale.isDirectSale,
                amount: sale.amount,
                costs: sale.costs,
                profit: sale.profit
            }));

            // 4. Simulate POS import to get the theoretical deduction tree
            const deductions = await PosImportService.simulatePosImport(fakeMappedRows, itemsMap);
            setSimulatedDeductions(deductions);

        } catch (error) {
            console.error('Failed to view deductions:', error);
            alert('Failed to load deductions for this batch.');
            setIsPreviewOpen(false);
        } finally {
            setIsSimulating(false);
        }
    };


    if (loading) {
        return <div className="p-8 flex justify-center text-slate-500"><Loader2 className="animate-spin" /></div>;
    }

    if (sales.length === 0) {
        return <div className="p-8 text-center text-slate-500 dark:text-slate-400">No sales deductions found for this item.</div>;
    }

    return (
        <div className="p-4 space-y-3">
            <p className="text-sm text-slate-500 mb-4">Recent POS Sales deducting this item.</p>
            {sales.map(sale => (
                <div 
                    key={sale.id} 
                    onClick={() => handleViewDeductions(sale.batchId)}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center group cursor-pointer hover:border-purple-300 dark:hover:border-purple-500/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400">
                            <Receipt size={16} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                Batch {sale.batchId?.slice(-6).toUpperCase()}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {sale.importedAt ? new Date(sale.importedAt.seconds * 1000).toLocaleString() : 'Unknown date'}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">-{sale.qtySold} sold</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">₱{sale.amount}</p>
                    </div>
                </div>
            ))}

            {isPreviewOpen && (
                <PosImportPreviewModal
                    isOpen={isPreviewOpen}
                    onCancel={() => setIsPreviewOpen(false)}
                    simulatedDeductions={simulatedDeductions}
                    isSubmitting={isSimulating}
                    onConfirm={async () => {}}
                    readOnly={true}
                />
            )}
        </div>
    );
};
