import React, { useState } from 'react';
import { Check, ArrowLeft } from 'lucide-react';
import type { Requisition, RequisitionItem, Supplier, SupplierDetails, User } from '../types';
import { RequisitionStatus } from '../types';
import { CounterService } from '../../../shared/services/counter.service';
import SearchableDropdown from '../../../shared/components/SearchableDropdown';

interface PreparePRFModalProps {
    requisition: Requisition;
    suppliers: Supplier[];
    onClose: () => void;
    onSubmit: (prfReq: Requisition, updatedOrigin?: Requisition) => void;
    currentUserId: string;
    users?: User[]; // Add users prop to access approver list
}

const PreparePRFModal: React.FC<PreparePRFModalProps> = ({
    requisition,
    suppliers,
    onClose,
    onSubmit,
    currentUserId,
    users = [] // Default to empty array if not provided
}) => {
    const [items, setItems] = useState<(RequisitionItem & { selected: boolean })[]>(
        requisition.items.map(item => ({ ...item, price: item.price ?? 0, selected: true }))
    );

    const existingSupplier = requisition.prfDetails?.supplier;
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
            terms: '',
            isVatable: false,
            bankDetails: { bankName: '', accountName: '', accountNumber: '', branch: '' }
        }
    );

    const [prfIdentifier, setPrfIdentifier] = useState(requisition.prfIdentifier || '');
    const [designatedApproverId, setDesignatedApproverId] = useState(requisition.prfDetails?.designatedApproverId || '');

    // Filter list of eligible approvers
    const eligibleApprovers = users.filter(u => u.isApprover);

    const totalAmount = items
        .filter(item => item.selected)
        .reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const isValid = () => {
        const selectedItems = items.filter(item => item.selected);
        const hasSelection = selectedItems.length > 0;
        const allPricesFilled = selectedItems.every(item => item.price > 0);

        const supplierValid = createNewSupplier
            ? supplierDetails.name && supplierDetails.tin && supplierDetails.address && supplierDetails.paymentMode
            : selectedSupplierId !== '';

        // Approver is required if there are eligible approvers configured
        const approverValid = eligibleApprovers.length > 0 ? !!designatedApproverId : true;

        return hasSelection && allPricesFilled && supplierValid && approverValid;
    };

    const handleSupplierSelect = (supplierId: string) => {
        setSelectedSupplierId(supplierId);
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            setSupplierDetails({
                name: supplier.name,
                tin: supplier.tin || '',
                address: supplier.address || '',
                paymentMode: supplier.paymentMode || '',
                terms: supplier.terms || '',
                isVatable: supplier.isVatable,
                bankDetails: supplier.bankDetails
            });
        }
    };

    const handlePriceChange = (index: number, price: number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], price };
        setItems(newItems);
    };

    const handleSelectionToggle = (index: number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], selected: !newItems[index].selected };
        setItems(newItems);
    };

    const handleToggleAll = (checked: boolean) => {
        const newItems = items.map(item => ({ ...item, selected: checked }));
        setItems(newItems);
    }

    const handleSubmit = async () => {
        try {
            const selectedItems = items.filter(item => item.selected).map(({ selected, ...item }) => item);
            const unselectedItems = items.filter(item => !item.selected).map(({ selected, ...item }) => item);

            if (requisition.status === RequisitionStatus.READY_FOR_PRF && unselectedItems.length > 0) {
                const newPrf: Requisition = {
                    ...requisition,
                    id: await CounterService.generatePRFId(),
                    items: selectedItems,
                    totalAmount,
                    status: RequisitionStatus.PRF_PENDING_MANAGER,
                    prfDetails: {
                        supplier: supplierDetails,
                        preparedBy: currentUserId,
                        datePrepared: new Date().toISOString(),
                        requisitionId: requisition.id,
                        timestamp: new Date().toISOString(),
                        designatedApproverId: designatedApproverId // Save designated approver
                    },
                    remarks: `${requisition.remarks || ''} (Split from ${requisition.id})`,
                    prfIdentifier
                };

                const updatedBurf: Requisition = {
                    ...requisition,
                    items: unselectedItems,
                    totalAmount: unselectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                    status: RequisitionStatus.READY_FOR_PRF
                };

                console.log('Submitting split PRF:', { newPrf, updatedBurf });
                onSubmit(newPrf, updatedBurf);
            } else {
                const updatedRequisition: Requisition = {
                    ...requisition,
                    items: selectedItems,
                    totalAmount,
                    prfDetails: {
                        supplier: supplierDetails,
                        preparedBy: currentUserId,
                        datePrepared: new Date().toISOString(),
                        requisitionId: requisition.prfDetails?.requisitionId || requisition.id,
                        timestamp: new Date().toISOString(),
                        designatedApproverId: designatedApproverId // Save designated approver
                    },
                    status: RequisitionStatus.PRF_PENDING_MANAGER,
                    prfIdentifier
                };
                console.log('Submitting updated PRF:', updatedRequisition);
                onSubmit(updatedRequisition);
            }
        } catch (error) {
            console.error("Error submitting PRF:", error);
            alert("Failed to submit PRF. Please try again.");
        }
    };

    const allSelected = items.every(i => i.selected);
    const unselectedCount = items.filter(i => !i.selected).length;
    const isSplitting = requisition.status === RequisitionStatus.READY_FOR_PRF && unselectedCount > 0;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
            <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="sticky top-0 bg-slate-800/90 backdrop-blur-md border-b border-slate-700 px-8 py-5 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                        >
                            <ArrowLeft size={20} /> Back
                        </button>
                        <h2 className="text-xl font-bold text-white">
                            {requisition.prfDetails ? 'Edit Purchase Requisition (PRF)' : 'Prepare Purchase Requisition (PRF)'}
                        </h2>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* General Info Row: PRF ID & Approver */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* PRF Identifier Input */}
                        {(isSplitting || requisition.prfDetails) && (
                            <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30">
                                <label className="block text-sm font-medium text-blue-300 mb-1">PRF Identifier</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-300 whitespace-nowrap">{requisition.prfDetails?.requisitionId || requisition.id} - Batch</span>
                                    <input
                                        type="number"
                                        value={prfIdentifier}
                                        onChange={(e) => setPrfIdentifier(e.target.value)}
                                        placeholder="1"
                                        min="1"
                                        className="w-24 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                    />
                                </div>
                                <p className="text-xs text-blue-400 mt-1">
                                    {isSplitting ? 'Enter a batch number to identify this split PRF.' : 'Update the batch number for this PRF.'}
                                </p>
                            </div>
                        )}

                        {/* Approver Selection */}
                        <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-500/30">
                            <label className="block text-sm font-medium text-purple-300 mb-1">Select Approver</label>
                            {eligibleApprovers.length > 0 ? (
                                <select
                                    value={designatedApproverId}
                                    onChange={(e) => setDesignatedApproverId(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                                >
                                    <option value="">-- Choose Approver --</option>
                                    {eligibleApprovers.map(approver => (
                                        <option key={approver.id} value={approver.id}>
                                            {approver.name} ({approver.role.replace(/_/g, ' ')})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="text-sm text-slate-400 italic py-2">
                                    No designated approvers found. Please configure approvers in Settings.
                                </div>
                            )}
                            <p className="text-xs text-purple-400 mt-1">
                                Designate who will approve this PRF.
                            </p>
                        </div>
                    </div>

                    {/* Item Specification & Costing */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-white">Item Specification & Costing</h3>
                            <span className="text-xs text-slate-400">Select items to include in this PRF</span>
                        </div>
                        <div className="border border-slate-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-900/50 border-b border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400 w-8">
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                onChange={(e) => handleToggleAll(e.target.checked)}
                                                className="rounded cursor-pointer bg-slate-800 border-slate-600"
                                            />
                                        </th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">ITEM</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">QTY / UOM</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">REMARKS</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-400">UNIT PRICE</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-400">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {items.map((item, index) => (
                                        <tr key={index} className={`hover:bg-slate-700/30 ${!item.selected ? 'opacity-50 bg-slate-900/30' : ''}`}>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={item.selected}
                                                    onChange={() => handleSelectionToggle(index)}
                                                    className="rounded cursor-pointer bg-slate-800 border-slate-600"
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-200">{item.name}</td>
                                            <td className="px-4 py-3 text-slate-400">{item.quantity} {item.uom}</td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">{item.remarks || '-'}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    disabled={!item.selected}
                                                    value={item.price}
                                                    onChange={(e) => handlePriceChange(index, parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                    className="w-24 px-2 py-1 bg-slate-900/50 border border-slate-600 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-800 text-white placeholder-slate-600"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-200">
                                                ₱{(item.price * item.quantity)?.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-900/50 border-t-2 border-slate-700">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-300">
                                            Total Amount (Selected)
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-blue-400 text-lg">
                                            ₱{totalAmount?.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Supplier Information */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4">Supplier Information</h3>
                        <div className="space-y-4">
                            {/* Toggle for new supplier */}
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-slate-300">Create new supplier?</span>
                                <button
                                    onClick={() => {
                                        setCreateNewSupplier(!createNewSupplier);
                                        if (!createNewSupplier) {
                                            setSelectedSupplierId('');
                                            setSupplierDetails({ name: '', tin: '', address: '', paymentMode: '', terms: '', isVatable: false, bankDetails: { bankName: '', accountName: '', accountNumber: '', branch: '' } });
                                        }
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${createNewSupplier ? 'bg-blue-600' : 'bg-slate-700'
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
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Supplier Name</label>
                                    {createNewSupplier ? (
                                        <input
                                            type="text"
                                            value={supplierDetails.name}
                                            onChange={(e) => setSupplierDetails({ ...supplierDetails, name: e.target.value })}
                                            placeholder="Enter supplier name"
                                            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500"
                                        />
                                    ) : (
                                        <SearchableDropdown
                                            options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                                            value={selectedSupplierId}
                                            onChange={handleSupplierSelect}
                                            placeholder="-- Choose Supplier --"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Payment Mode</label>
                                    <select
                                        value={supplierDetails.paymentMode}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, paymentMode: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
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
                                    <label className="block text-sm font-medium text-slate-300 mb-1">TIN</label>
                                    <input
                                        type="text"
                                        value={supplierDetails.tin}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, tin: e.target.value })}
                                        placeholder="000-000-000"
                                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Terms</label>
                                    <input
                                        type="text"
                                        value={supplierDetails.terms || ''}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, terms: e.target.value })}
                                        placeholder="e.g. 30 Days, COD"
                                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Address</label>
                                <input
                                    type="text"
                                    value={supplierDetails.address}
                                    onChange={(e) => setSupplierDetails({ ...supplierDetails, address: e.target.value })}
                                    placeholder="Registered Address"
                                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Ready to Submit Section */}
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <h4 className="font-semibold text-blue-300 mb-1">Ready to {requisition.prfDetails ? 'Update' : 'Submit'}?</h4>
                                <div className="text-sm text-blue-200">
                                    <p>Please ensure all costs are final and supplier details are verified.</p>
                                    {isSplitting &&
                                        <div className="mt-2 font-medium text-orange-300 bg-orange-900/30 p-2 rounded border border-orange-500/30">
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
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
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