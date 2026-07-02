import React, { useRef, useEffect } from 'react';
import type { POSTable } from '../types/pos.types';

interface TableItemProps {
    table: POSTable;
    isSelected: boolean;
    billAmount?: number;
    onSelect: (table: POSTable) => void;
    onDragEnd: (tableId: string, position: { x: number, y: number }) => void;
}

export const TableItem: React.FC<TableItemProps> = ({ table, isSelected, billAmount, onSelect, onDragEnd }) => {
    const itemRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent default to avoid text selection during drag
        e.preventDefault();
        e.stopPropagation();

        onSelect(table);

        const el = itemRef.current;
        if (!el || !el.parentElement) return;

        const parentRect = el.parentElement.getBoundingClientRect();
        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const startPosX = table.position.x;
        const startPosY = table.position.y;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startMouseX;
            const dy = moveEvent.clientY - startMouseY;
            
            let newX = startPosX + dx;
            let newY = startPosY + dy;

            // Snap to 10px grid
            newX = Math.round(newX / 10) * 10;
            newY = Math.round(newY / 10) * 10;

            // Constrain
            newX = Math.max(0, Math.min(newX, parentRect.width - el.offsetWidth));
            newY = Math.max(0, Math.min(newY, parentRect.height - el.offsetHeight));

            // Directly update the DOM element for smooth dragging without React re-renders during move
            el.style.left = `${newX}px`;
            el.style.top = `${newY}px`;
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            
            // Save the final position
            const finalX = parseInt(el.style.left || '0', 10);
            const finalY = parseInt(el.style.top || '0', 10);
            
            if (finalX !== startPosX || finalY !== startPosY) {
                onDragEnd(table.id, { x: finalX, y: finalY });
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Ensure style reflects table position when updated externally
    useEffect(() => {
        if (itemRef.current) {
            itemRef.current.style.left = `${table.position.x}px`;
            itemRef.current.style.top = `${table.position.y}px`;
        }
    }, [table.position.x, table.position.y]);

    const getStatusStyles = () => {
        if (isSelected) return 'border-indigo-500 bg-indigo-500/20 text-white shadow-indigo-500/20 ring-2 ring-indigo-400';
        
        switch (table.status) {
            case 'occupied':
                return 'border-amber-500/50 bg-amber-500/10 text-amber-500 hover:border-amber-400';
            case 'reserved':
                return 'border-sky-500/50 bg-sky-500/10 text-sky-400 hover:border-sky-400';
            default: // available
                return 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500';
        }
    };

    return (
        <div
            ref={itemRef}
            onMouseDown={handleMouseDown}
            style={{
                position: 'absolute',
                left: `${table.position.x}px`,
                top: `${table.position.y}px`,
                cursor: 'grab'
            }}
            className={`
                w-24 h-24 flex flex-col items-center justify-center 
                rounded-2xl border-2 transition-all shadow-md active:cursor-grabbing
                ${table.shape === 'circle' ? 'rounded-full' : 'rounded-xl'}
                ${getStatusStyles()}
            `}
        >
            <span className="font-bold text-center text-sm px-1 truncate w-full pointer-events-none">{table.name}</span>
            <span className="text-xs opacity-70 mt-1 pointer-events-none">
                {table.status === 'occupied' ? 'Occupied' : table.status === 'reserved' ? 'Reserved' : `${table.seats} Seats`}
            </span>
            {billAmount !== undefined && table.status === 'occupied' && (
                <span className="text-xs font-bold text-amber-400 mt-1 pointer-events-none">
                    ₱{billAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            )}
            {table.qrEnabled && (
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full border-2 border-slate-900" title="QR Enabled" />
            )}
        </div>
    );
};
