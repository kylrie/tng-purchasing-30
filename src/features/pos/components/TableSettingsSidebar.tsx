import React from 'react';
import type { POSTable } from '../types/pos.types';
import { QRCodeSVG } from 'qrcode.react';
import { X, Trash2, QrCode } from 'lucide-react';

interface TableSettingsSidebarProps {
    table: POSTable | null;
    onClose: () => void;
    onUpdate: (updates: Partial<POSTable>) => void;
    onDelete: (tableId: string) => void;
}

export const TableSettingsSidebar: React.FC<TableSettingsSidebarProps> = ({ table, onClose, onUpdate, onDelete }) => {
    if (!table) return null;

    const handleSaveQr = () => {
        const svg = document.getElementById(`qr-${table.id}`);
        if (!svg) return;
        
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL('image/png');
            
            const downloadLink = document.createElement('a');
            downloadLink.download = `Table-${table.name}-QR.png`;
            downloadLink.href = `${pngFile}`;
            downloadLink.click();
        };
        
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    return (
        <div className="w-80 bg-slate-800 border-l border-slate-700 h-full flex flex-col shadow-2xl absolute right-0 top-0 z-20 transition-transform">
            <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
                <h3 className="font-bold text-white text-lg">Table Settings</h3>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700">
                    <X size={20} />
                </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Table Name</label>
                    <input
                        type="text"
                        value={table.name}
                        onChange={(e) => onUpdate({ name: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. Table 1"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Seats</label>
                    <input
                        type="number"
                        min="1"
                        value={table.seats}
                        onChange={(e) => onUpdate({ seats: parseInt(e.target.value) || 1 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Shape</label>
                    <select
                        value={table.shape}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onChange={(e) => onUpdate({ shape: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="rectangle">Rectangle</option>
                        <option value="circle">Circle</option>
                    </select>
                </div>

                <div className="pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-medium text-slate-300">Enable QR Ordering</label>
                        <button
                            onClick={() => onUpdate({ qrEnabled: !table.qrEnabled })}
                            className={`w-12 h-6 rounded-full transition-colors relative ${table.qrEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                        >
                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${table.qrEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {table.qrEnabled && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">QR Destination URL</label>
                                <input
                                    type="text"
                                    value={table.qrUrl || `https://tng-systems.web.app/order?table=${table.id}`}
                                    onChange={(e) => onUpdate({ qrUrl: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            
                            <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center">
                                <QRCodeSVG 
                                    id={`qr-${table.id}`}
                                    value={table.qrUrl || `https://tng-systems.web.app/order?table=${table.id}`} 
                                    size={150} 
                                    level="H"
                                    includeMargin={true}
                                />
                                <button
                                    onClick={handleSaveQr}
                                    className="mt-4 flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-700"
                                >
                                    <QrCode size={18} />
                                    Download QR
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-slate-700">
                <button
                    onClick={() => {
                        if (confirm('Are you sure you want to delete this table?')) {
                            onDelete(table.id);
                        }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl font-semibold transition-colors"
                >
                    <Trash2 size={18} />
                    Delete Table
                </button>
            </div>
        </div>
    );
};
