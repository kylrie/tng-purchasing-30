import React, { useState, useEffect } from 'react';
import { X, Check, DollarSign, ArrowLeft } from 'lucide-react';
import type { Requisition, RequisitionItem, Supplier, SupplierDetails } from '../types';
import { RequisitionStatus } from '../types';

interface PreparePRFModalProps {
    requisition: Requisition;
    suppliers: Supplier[];
    onClose: () => void;
    onSubmit: (prfReq: Requisition, updatedOrigin?: Requisition) => void;
    currentUserId: string;
}

const PreparePRFModal: React.FC<PreparePRFModalProps> = ({
    requisition,
    suppliers,
    onClose,
    onSubmit,
    currentUserId
}) => {
    // Initialize items from requisition with a selected flag
    const [items, setItems] = useState<(RequisitionItem & { selected: boolean })[]>(
        requisition.items.map(item => ({ ...item, selected: true }))
    );

    // Check if we are editing an existing PRF
    const existingSupplier = requisition.prfDetails?.supplier;

    // Find if the existing supplier matches a known supplier ID
    const knownSupplierId = existingSupplier
        ? suppliers.find(s => s.name === existingSupplier.name)?.id || ''
        : '';

    const [createNewSupplier, setCreateNewSupplier] = useState(!!existingSupplier && !knownSupplierId);
    const [selectedSupplierId, setSelectedSupplierId] = useState(knownSupplierId);

    const [supplierDetails, setSupplierDetails] = useState<SupplierDetails>(
        existingSupplier || {
            name: '',
            tin: '',
            address: '',
            paymentMode: '',
            terms: ''
        }
    );

    // PRF Identifier State
    const [prfIdentifier, setPrfIdentifier] = useState(requisition.prfIdentifier || '');

    // Calculate total amount based on SELECTED items
    const totalAmount = items
        .filter(item => item.selected)
        .reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Check if form is valid
    const isValid = () => {
        // Only check prices for selected items
        const selectedItems = items.filter(item => item.selected);
        const hasSelection = selectedItems.length > 0;
        const allPricesFilled = selectedItems.every(item => item.price > 0);

        const supplierValid = createNewSupplier
            ? supplierDetails.name && supplierDetails.tin && supplierDetails.address && supplierDetails.paymentMode
            : selectedSupplierId !== '';

        return hasSelection && allPricesFilled && supplierValid;
    };

    // Handle supplier selection
    const handleSupplierSelect = (supplierId: string) => {
        setSelectedSupplierId(supplierId);
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            setSupplierDetails({
                name: supplier.name,
                tin: supplier.tin || '',
                address: supplier.address || '',
                paymentMode: supplier.paymentMode || '',
                terms: supplier.terms || ''
            });
        }
    };

    // Handle item price change
    const handlePriceChange = (index: number, price: number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], price };
        setItems(newItems);
    };

    // Handle item selection toggle
    const handleSelectionToggle = (index: number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], selected: !newItems[index].selected };
        setItems(newItems);
    };

    // Handle toggle all
    const handleToggleAll = (checked: boolean) => {
        const newItems = items.map(item => ({ ...item, selected: checked }));
        setItems(newItems);
    }

    // Handle submit
    const handleSubmit = () => {
        // Filter items
        const selectedItems = items.filter(item => item.selected).map(({ selected, ...item }) => item);
        const unselectedItems = items.filter(item => !item.selected).map(({ selected, ...item }) => item);

        // Check if we are converting a BURF to PRF (Split logic)
        // If status is READY_FOR_PRF, we are creating a PRF from a BURF.
        if (requisition.status === RequisitionStatus.READY_FOR_PRF && unselectedItems.length > 0) {
            // 1. Create NEW PRF with selected items
            const newPrf: Requisition = {
                ...requisition,
                id: `PRF-${Math.floor(10000 + Math.random() * 90000)}`, // New ID
                items: selectedItems,
                totalAmount,
                status: RequisitionStatus.PRF_PENDING_MANAGER,
                prfDetails: {
                    supplier: supplierDetails,
                    preparedBy: currentUserId,
                    datePrepared: new Date().toISOString(),
                    requisitionId: requisition.id, // Store original BURF ID
                    timestamp: new Date().toISOString()
                },

                remarks: `${requisition.remarks || ''} (Split from ${requisition.id})`,
                prfIdentifier // Add identifier
            };

            // 2. Update ORIGINAL BURF with remaining items
            const updatedBurf: Requisition = {
                ...requisition,
                items: unselectedItems,
                // Reset total amount for BURF logic (assuming BURF usually doesn't have prices or just sums them)
                // If prices were entered during preparation but item unselected, we might want to keep them or reset.
                // Here we keep the price if entered, but user can change later.
                totalAmount: unselectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                status: RequisitionStatus.READY_FOR_PRF // Remains ready for next PRF
            };

            onSubmit(newPrf, updatedBurf);
        } else {
            // Standard Flow: Update the existing requisition (either converting full BURF or editing PRF)
            const updatedRequisition: Requisition = {
                ...requisition,
                items: selectedItems,
                totalAmount,
                prfDetails: {
                    supplier: supplierDetails,
                    preparedBy: currentUserId,
                    datePrepared: new Date().toISOString(),
                    requisitionId: requisition.prfDetails?.requisitionId || requisition.id, // Preserve or set original BURF ID
                    timestamp: new Date().toISOString()
                },
                status: RequisitionStatus.PRF_PENDING_MANAGER,
                prfIdentifier // Add identifier
            };
            onSubmit(updatedRequisition);
        }
    };

    const allSelected = items.every(i => i.selected);
    const unselectedCount = items.filter(i => !i.selected).length;
    const isSplitting = requisition.status === RequisitionStatus.READY_FOR_PRF && unselectedCount > 0;

    return (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
            <div className="bg-white rounded-2xl shadow-2xl border border-white/20 max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-5 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
                        >
                            <ArrowLeft size={20} /> Back
                        </button>
                        <h2 className="text-xl font-bold text-slate-900">
                            {requisition.prfDetails ? 'Edit Purchase Requisition (PRF)' : 'Prepare Purchase Requisition (PRF)'}
                        </h2>
                    </div>

                </div>


                <div className="p-6 space-y-6">
                    {/* PRF Identifier Input */}
                    {(isSplitting || requisition.prfDetails) && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <label className="block text-sm font-medium text-blue-900 mb-1">PRF Identifier</label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-700 whitespace-nowrap">{requisition.prfDetails?.requisitionId || requisition.id} - Batch</span>
                                <input
                                    type="number"
                                    value={prfIdentifier}
                                    onChange={(e) => setPrfIdentifier(e.target.value)}
                                    placeholder="1"
                                    min="1"
                                    className="w-24 px-3 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                />
                            </div>
                            <p className="text-xs text-blue-600 mt-1">
                                {isSplitting ? 'Enter a batch number to identify this split PRF.' : 'Update the batch number for this PRF.'}
                            </p>
                        </div>
                    )}

                    {/* Item Specification & Costing */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">Item Specification & Costing</h3>
                            <span className="text-xs text-slate-500">Select items to include in this PRF</span>
                        </div>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 w-8">
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                onChange={(e) => handleToggleAll(e.target.checked)}
                                                className="rounded cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700">ITEM</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700">QTY / UOM</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700">REMARKS</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700">UNIT PRICE</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item, index) => (
                                        <tr key={index} className={`hover:bg-slate-50 ${!item.selected ? 'opacity-50 bg-slate-50' : ''}`}>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={item.selected}
                                                    onChange={() => handleSelectionToggle(index)}
                                                    className="rounded cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                                            <td className="px-4 py-3 text-slate-600">{item.quantity} {item.uom}</td>
                                            <td className="px-4 py-3 text-slate-600 text-xs">{item.remarks || '-'}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    disabled={!item.selected}
                                                    value={item.price || ''}
                                                    onChange={(e) => handlePriceChange(index, parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                                ₱{(item.price * item.quantity).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-800">
                                            Total Amount (Selected)
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-blue-600 text-lg">
                                            ₱{totalAmount.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Supplier Information */}
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Supplier Information</h3>
                        <div className="space-y-4">
                            {/* Toggle for new supplier */}
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-slate-700">Create new supplier?</span>
                                <button
                                    onClick={() => {
                                        setCreateNewSupplier(!createNewSupplier);
                                        if (!createNewSupplier) {
                                            setSelectedSupplierId('');
                                            setSupplierDetails({ name: '', tin: '', address: '', paymentMode: '', terms: '' });
                                        }
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${createNewSupplier ? 'bg-blue-600' : 'bg-slate-300'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${createNewSupplier ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>

                            {/* Supplier Selection or Input */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name</label>
                                    {createNewSupplier ? (
                                        <input
                                            type="text"
                                            value={supplierDetails.name}
                                            onChange={(e) => setSupplierDetails({ ...supplierDetails, name: e.target.value })}
                                            placeholder="Enter supplier name"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    ) : (
                                        <select
                                            value={selectedSupplierId}
                                            onChange={(e) => handleSupplierSelect(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">-- Choose Supplier --</option>
                                            {suppliers.map(supplier => (
                                                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
                                    <select
                                        value={supplierDetails.paymentMode}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, paymentMode: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select Mode</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Check">Check</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Credit Card">Credit Card</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">TIN</label>
                                    <input
                                        type="text"
                                        value={supplierDetails.tin}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, tin: e.target.value })}
                                        placeholder="000-000-000"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Terms</label>
                                    <input
                                        type="text"
                                        value={supplierDetails.terms || ''}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, terms: e.target.value })}
                                        placeholder="e.g. 30 Days, COD"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                                <input
                                    type="text"
                                    value={supplierDetails.address}
                                    onChange={(e) => setSupplierDetails({ ...supplierDetails, address: e.target.value })}
                                    placeholder="Registered Address"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Ready to Submit Section */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <h4 className="font-semibold text-blue-900 mb-1">Ready to {requisition.prfDetails ? 'Update' : 'Submit'}?</h4>
                                <div className="text-sm text-blue-700">
                                    <p>Please ensure all costs are final and supplier details are verified.</p>
                                    {isSplitting &&
                                        <div className="mt-2 font-medium text-orange-700 bg-orange-100 p-2 rounded border border-orange-200">
                                            Splitting Request: You selected {items.length - unselectedCount} of {items.length} items.
                                            <br />
                                            • A NEW PRF will be created for the selected items.
                                            <br />
                                            • The original request will remain as BURF with the {unselectedCount} remaining items.
                                        </div>
                                    }
                                </div>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={!isValid()}
                                className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${isValid()
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    }`}
                            >
                                <Check size={18} /> {requisition.prfDetails ? 'Update PRF' : 'Submit PRF'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreparePRFModal;
