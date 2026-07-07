import React, { useState, useEffect } from 'react';
import { POSTableService } from '../services/pos-table.service';
import type { POSTable } from '../types/pos.types';
import { TableCanvas } from '../components/TableCanvas';
import { TableSettingsSidebar } from '../components/TableSettingsSidebar';
import { Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TableManagementViewProps {
    businessUnitId: string;
    onClose?: () => void;
}

export const TableManagementView: React.FC<TableManagementViewProps> = ({ businessUnitId, onClose }) => {
    const navigate = useNavigate();
    const [tables, setTables] = useState<POSTable[]>([]);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!businessUnitId) return;

        const loadTables = async () => {
            setIsLoading(true);
            try {
                const data = await POSTableService.getTables(businessUnitId);
                setTables(data);
            } catch (error) {
                console.error("Failed to load tables:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadTables();
    }, [businessUnitId]);

    const handleAddTable = async () => {
        if (!businessUnitId) return;
        
        const newTableData = {
            name: `Table ${tables.length + 1}`,
            position: { x: 50 + (tables.length * 30), y: 50 + (tables.length * 30) },
            seats: 4,
            shape: 'rectangle' as const
        };

        try {
            const newTable = await POSTableService.addTable(businessUnitId, newTableData);
            setTables([...tables, newTable]);
            setSelectedTableId(newTable.id);
        } catch (error) {
            console.error("Error adding table", error);
        }
    };

    const handleUpdateTablePosition = async (tableId: string, position: { x: number, y: number }) => {
        // Optimistic update
        setTables(prev => prev.map(t => t.id === tableId ? { ...t, position } : t));

        try {
            await POSTableService.updateTable(tableId, { position });
        } catch (error) {
            console.error("Error updating table position", error);
        }
    };

    const handleUpdateTableSettings = async (updates: Partial<POSTable>) => {
        if (!selectedTableId) return;

        // Optimistic update
        setTables(prev => prev.map(t => t.id === selectedTableId ? { ...t, ...updates } : t));

        try {
            await POSTableService.updateTable(selectedTableId, updates);
        } catch (error) {
            console.error("Error updating table settings", error);
        }
    };

    const handleDeleteTable = async (tableId: string) => {
        setTables(prev => prev.filter(t => t.id !== tableId));
        if (selectedTableId === tableId) {
            setSelectedTableId(null);
        }

        try {
            await POSTableService.deleteTable(tableId);
        } catch (error) {
            console.error("Error deleting table", error);
        }
    };

    const selectedTable = tables.find(t => t.id === selectedTableId) || null;

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
    }

    return (
        <div className="flex flex-col h-screen w-screen bg-slate-900 overflow-hidden relative">
            <div className="h-16 flex items-center justify-between px-6 bg-slate-800 border-b border-slate-700 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => onClose ? onClose() : navigate('/pos')}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white">Table Management</h1>
                        <p className="text-xs text-slate-400">Design your floor plan</p>
                    </div>
                </div>
                <div>
                    <button
                        onClick={handleAddTable}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
                    >
                        <Plus size={18} />
                        Add Table
                    </button>
                </div>
            </div>

            <div className="flex flex-1 relative overflow-hidden">
                <TableCanvas
                    tables={tables}
                    selectedTableId={selectedTableId}
                    onSelectTable={(table) => setSelectedTableId(table?.id || null)}
                    onUpdateTablePosition={handleUpdateTablePosition}
                />
                
                <div className={`transition-all duration-300 ${selectedTableId ? 'w-80' : 'w-0'}`}>
                    <TableSettingsSidebar
                        table={selectedTable}
                        onClose={() => setSelectedTableId(null)}
                        onUpdate={handleUpdateTableSettings}
                        onDelete={handleDeleteTable}
                    />
                </div>
            </div>
        </div>
    );
};
