import React, { useState } from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';
import type { Requisition, RequisitionItem, SupplierDetails } from '../types';

interface PRFFormViewProps {
    requisitionId: string;
    onCancel: () => void;
    requisitions: Requisition[];
    handleSubmitPRF: (id: string, details: SupplierDetails, updatedItems: RequisitionItem[]) => void;
}

export const PRFFormView: React.FC<PRFFormViewProps> = ({ requisitionId, onCancel, requisitions, handleSubmitPRF }) => {
    // FIX: Find requisition first (used for initialization, but hooks MUST come before returns)
    const req = requisitions.find(r => r.id === requisitionId);

    // FIX: All useState hooks MUST be called before any conditional returns (React Rules of Hooks)
    // Use useMemo-style inline defaults that handle undefined req gracefully
    const [supplier, setSupplier] = useState<SupplierDetails>(() => 
        req?.prfDetails?.supplier || { name: '', tin: '', address: '', paymentMode: '', terms: '' }
    );

    // Initialize items with lazy initializer to handle undefined req
    const [items, setItems] = useState<RequisitionItem[]>(() => 
        req?.items.map(i => ({ ...i, price: i.price || 0 })) || []
    );

    // Selection State: Default all selected
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>(() => 
        req?.items.map(i => i.itemId) || []
    );

    // Confirmation Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // FIX: NOW we can safely do the conditional return AFTER all hooks are declared
    if (!req) {
        return (
            <div className="p-8 text-center">
                <div className="text-red-500 font-medium">Requisition not found</div>
                <button 
                    onClick={onCancel} 
                    className="mt-4 px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const handleItemChange = (index: number, field: keyof RequisitionItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const toggleSelection = (itemId: string) => {
        setSelectedItemIds(prev =>
            prev.includes(itemId)
                ? prev.filter(id => id !== itemId)
                : [...prev, itemId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedItemIds.length === items.length) {
            setSelectedItemIds([]);
        } else {
            setSelectedItemIds(items.map(i => i.itemId));
        }
    };

    // Derived state for selected items
    const selectedItems = items.filter(i => selectedItemIds.includes(i.itemId));
    const totalAmount = selectedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    const handlePreSubmit = () => {
        if (selectedItems.length === 0) {
            alert("Please select at least one item.");
            return;
        }

        if (selectedItems.length < items.length) {
            setShowConfirmModal(true);
            return;
        }

        handleSubmitPRF(requisitionId, supplier, selectedItems);
    };

    const confirmSplitSubmit = () => {
        handleSubmitPRF(requisitionId, supplier, selectedItems);
        setShowConfirmModal(false);
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 relative">
            {/* Custom Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 text-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-700 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start gap-4">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    Confirm Split Requisition
                                </h3>
                                <p className="text-slate-300 text-sm mb-4">
                                    You have selected <span className="font-bold text-white">{selectedItems.length}</span> out of {items.length} items.
                                </p>
                                <p className="text-slate-300 text-sm mb-6">
                                    A new requisition will be created for the remaining <span className="font-bold text-white">{items.length - selectedItems.length}</span> items.
                                    <br /><br />
                                    Proceed with splitting this request?
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowConfirmModal(false)}
                                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmSplitSubmit}
                                        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors shadow-lg shadow-green-900/20"
                                    >
                                        OK
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4">
                <button onClick={onCancel} className="text-slate-500 hover:text-slate-800 flex items-center gap-1">
                    <ArrowRight size={16} className="rotate-180" /> Back
                </button>
                <h1 className="text-2xl font-bold text-slate-900">Prepare Purchase Requisition (PRF)</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Items Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Item Specification & Costing</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-xs uppercase font-medium text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 w-10">
                                            <input
                                                type="checkbox"
                                                checked={selectedItemIds.length === items.length && items.length > 0}
                                                onChange={toggleSelectAll}
                                                className="rounded border-slate-300"
                                            />
                                        </th>
                                        <th className="px-4 py-2">Item</th>
                                        <th className="px-4 py-2">Qty / UOM</th>
                                        <th className="px-4 py-2">Remarks</th>
                                        <th className="px-4 py-2 w-32">Unit Price</th>
                                        <th className="px-4 py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item, idx) => (
                                        <tr key={item.itemId} className={!selectedItemIds.includes(item.itemId) ? 'opacity-50 bg-slate-50' : ''}>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItemIds.includes(item.itemId)}
                                                    onChange={() => toggleSelection(item.itemId)}
                                                    className="rounded border-slate-300"
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-medium">{item.name}</td>
                                            <td className="px-4 py-3">{item.quantity} <span className="text-slate-500 text-xs">{item.uom}</span></td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">{item.remarks}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    disabled={!selectedItemIds.includes(item.itemId)}
                                                    className="w-full p-1 border border-slate-300 rounded text-right text-sm disabled:bg-slate-100"
                                                    value={item.price}
                                                    onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">
                                                ₱{(item.quantity * item.price)?.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 font-bold">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-right">Total Amount (Selected)</td>
                                        <td className="px-4 py-3 text-right">₱{totalAmount?.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Supplier Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Supplier Name</label>
                                <input className="w-full p-2 border border-slate-300 rounded-md text-sm" value={supplier.name} onChange={e => setSupplier({ ...supplier, name: e.target.value })} placeholder="Official Business Name" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">TIN</label>
                                <input className="w-full p-2 border border-slate-300 rounded-md text-sm" value={supplier.tin} onChange={e => setSupplier({ ...supplier, tin: e.target.value })} placeholder="000-000-000" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Payment Mode</label>
                                <select className="w-full p-2 border border-slate-300 rounded-md text-sm" value={supplier.paymentMode} onChange={e => setSupplier({ ...supplier, paymentMode: e.target.value })}>
                                    <option value="">Select Mode</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Check">Check</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                                <input className="w-full p-2 border border-slate-300 rounded-md text-sm" value={supplier.address} onChange={e => setSupplier({ ...supplier, address: e.target.value })} placeholder="Registered Address" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Terms</label>
                                <input className="w-full p-2 border border-slate-300 rounded-md text-sm" value={supplier.terms} onChange={e => setSupplier({ ...supplier, terms: e.target.value })} placeholder="e.g. 30 Days, COD" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                        <h4 className="text-indigo-900 font-bold mb-2">Ready to Submit?</h4>
                        <p className="text-sm text-indigo-700 mb-4">
                            {selectedItems.length < items.length
                                ? `Note: You are creating a PRF for ${selectedItems.length} item(s). The remaining items will be moved to a new requisition.`
                                : "Please ensure all costs are final and supplier details are verified. This will be sent to the Business Unit Manager for final approval."
                            }
                        </p>
                        <button
                            onClick={handlePreSubmit}
                            disabled={!supplier.name || totalAmount === 0 || selectedItems.length === 0}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            <CheckCircle size={18} /> Submit PRF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
