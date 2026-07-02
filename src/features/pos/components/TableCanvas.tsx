import React, { useRef } from 'react';
import type { POSTable } from '../types/pos.types';
import { TableItem } from './TableItem';

interface TableCanvasProps {
    tables: POSTable[];
    selectedTableId: string | null;
    onSelectTable: (table: POSTable | null) => void;
    onUpdateTablePosition: (tableId: string, position: { x: number, y: number }) => void;
}

export const TableCanvas: React.FC<TableCanvasProps> = ({ tables, selectedTableId, onSelectTable, onUpdateTablePosition }) => {
    const canvasRef = useRef<HTMLDivElement>(null);

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Deselect if clicking on the background
        if (e.target === canvasRef.current) {
            onSelectTable(null);
        }
    };

    return (
        <div 
            ref={canvasRef}
            className="flex-1 relative bg-slate-900 overflow-auto"
            onClick={handleCanvasClick}
            style={{
                backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                minWidth: '800px',
                minHeight: '600px'
            }}
        >
            {tables.map(table => (
                <TableItem
                    key={table.id}
                    table={table}
                    isSelected={selectedTableId === table.id}
                    onSelect={onSelectTable}
                    onDragEnd={onUpdateTablePosition}
                />
            ))}
        </div>
    );
};
