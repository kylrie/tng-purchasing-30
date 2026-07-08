import React, { useState, useEffect } from 'react';
import type { POSTable, RunningBill } from '../types/pos.types';
import { POSTableService } from '../services/pos-table.service';
import { RunningBillService } from '../services/running-bill.service';
import { TableItem } from './TableItem';
import { RefreshCcw } from 'lucide-react';

interface TableFloorViewProps {
    businessUnitId: string;
    onSelectTable: (table: POSTable, bill: RunningBill | null) => void;
    onCounterOrder: () => void;
}

export const TableFloorView: React.FC<TableFloorViewProps> = ({ businessUnitId, onSelectTable, onCounterOrder }) => {
    const [tables, setTables] = useState<POSTable[]>([]);
    const [openBills, setOpenBills] = useState<RunningBill[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedTables, fetchedBills] = await Promise.all([
                POSTableService.getTables(businessUnitId),
                RunningBillService.getOpenBills(businessUnitId)
            ]);
            setTables(fetchedTables);
            setOpenBills(fetchedBills);
        } catch (error) {
            console.error("Error loading table floor data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (businessUnitId) {
            loadData();
        }
    }, [businessUnitId]);

    const handleSelectTable = (table: POSTable) => {
        const bill = openBills.find(b => b.tableId === table.id) || null;
        onSelectTable(table, bill);
    };

    const getBillAmount = (tableId: string): number | undefined => {
        const bill = openBills.find(b => b.tableId === tableId);
        return bill?.totalAmount;
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden relative">
            <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
                <div className="flex gap-4 px-4 py-2.5 bg-white rounded-xl border-2 border-slate-200">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <span className="text-xs font-bold text-slate-600">Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                        <span className="text-xs font-bold text-slate-600">Occupied</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                        <span className="text-xs font-bold text-slate-600">Reserved</span>
                    </div>
                </div>
                <button
                    onClick={onCounterOrder}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors font-black"
                >
                    Takeout / Counter Order
                </button>
                <button
                    onClick={loadData}
                    className="p-2.5 bg-white hover:border-slate-400 text-slate-600 rounded-xl border-2 border-slate-200 transition-colors"
                    title="Refresh Status"
                >
                    <RefreshCcw className="w-5 h-5" />
                </button>
            </div>

            <div
                className="flex-1 relative overflow-auto"
                style={{
                    backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    minWidth: '800px',
                    minHeight: '600px'
                }}
            >
                {tables.map(table => (
                    <TableItem
                        key={table.id}
                        table={table}
                        isSelected={false}
                        billAmount={getBillAmount(table.id)}
                        onSelect={() => handleSelectTable(table)}
                        onDragEnd={() => {}} // Disabled dragging in order view
                    />
                ))}

                {tables.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center px-4">
                        <div className="text-center bg-white border-2 border-slate-200 rounded-xl px-8 py-6">
                            <p className="text-xl font-black text-slate-900 mb-2">No Tables Setup</p>
                            <p className="text-sm text-slate-500">Go to POS Settings to configure tables for this branch.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
