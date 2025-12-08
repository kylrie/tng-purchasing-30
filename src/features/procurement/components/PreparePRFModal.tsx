import React, { useState, useMemo } from 'react';
import { Check, ArrowLeft, Loader2 } from 'lucide-react';
import type { Requisition, RequisitionItem, Supplier, SupplierDetails, User } from '../types';
import { RequisitionStatus } from '../types';
import { RequisitionService } from '../services/requisitions.service';
import SearchableDropdown from '../../../shared/components/SearchableDropdown';
import EditableItemTable from './EditableItemTable';

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
    // Items state - store as pure RequisitionItem[] with separate selection Set
    const [items, setItems] = useState<RequisitionItem[]>(
        requisition.items.map(item => ({ ...item, price: item.price ?? 0 }))
    );
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
        new Set(requisition.items.map(item => item.itemId))
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

    // Submission loading state to prevent double-clicks
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter list of eligible approvers
    const eligibleApprovers = users.filter(u => u.isApprover);

    // Calculate total amount for selected items
    const totalAmount = useMemo(() =>
        items
            .filter(item => selectedItemIds.has(item.itemId))
            .reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0),
        [items, selectedItemIds]
    );

    const isValid = () => {
        const selectedItems = items.filter(item => selectedItemIds.has(item.itemId));
        const hasSelection = selectedItems.length > 0;
        const allPricesFilled = selectedItems.every(item => (item.price || 0) > 0);

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

    // Selection handlers for EditableItemTable
    const handleToggleSelection = (itemId: string) => {
        setSelectedItemIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const handleToggleAll = (checked: boolean) => {
        if (checked) {
            setSelectedItemIds(new Set(items.map(item => item.itemId)));
        } else {
            setSelectedItemIds(new Set());
        }
    };

    const handleSubmit = async () => {
        // Prevent duplicate submissions
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const selectedItems = items.filter(item => selectedItemIds.has(item.itemId));
            const unselectedItems = items.filter(item => !selectedItemIds.has(item.itemId));

            // Get preparer's name from users array for denormalization
            const preparer = users.find(u => u.id === currentUserId);
            const preparedByName = preparer?.name || 'Unknown';

            // BURF-to-PRF Conversion with splitting: Use transactional service
            if (requisition.status === RequisitionStatus.READY_FOR_PRF && unselectedItems.length > 0) {
                // Use the new transactional service for atomic PRF creation + BURF update
                const result = await RequisitionService.createBatchPrfFromBurf({
                    sourceBurfId: requisition.id,
                    sourceBusinessId: requisition.businessId, // Required for query permissions
                    selectedItems: selectedItems,
                    prfDetails: {
                        supplier: supplierDetails,
                        preparedBy: currentUserId,
                        preparedByName: preparedByName,
                        designatedApproverId: designatedApproverId,
                    },
                    userId: currentUserId,
                    userName: preparedByName,
                });

                console.log(`PRF ${result.newPrfId} created. BURF status: ${result.sourceBurfNewStatus}, remaining items: ${result.remainingItemsCount}`);

                // Close modal - parent will refresh from Firestore subscription
                onClose();
            } else if (requisition.status === RequisitionStatus.READY_FOR_PRF && unselectedItems.length === 0) {
                // ALL items selected for conversion - use transactional service
                const result = await RequisitionService.createBatchPrfFromBurf({
                    sourceBurfId: requisition.id,
                    sourceBusinessId: requisition.businessId, // Required for query permissions
                    selectedItems: selectedItems,
                    prfDetails: {
                        supplier: supplierDetails,
                        preparedBy: currentUserId,
                        preparedByName: preparedByName,
                        designatedApproverId: designatedApproverId,
                    },
                    userId: currentUserId,
                    userName: preparedByName,
                });

                console.log(`PRF ${result.newPrfId} created (full conversion). BURF status: ${result.sourceBurfNewStatus}`);

                // Close modal - parent will refresh from Firestore subscription
                onClose();
            } else {
                // Non-splitting case: Editing existing PRF or direct PRF creation
                const updatedRequisition: Requisition = {
                    ...requisition,
                    items: selectedItems,
                    totalAmount,
                    prfDetails: {
                        supplier: supplierDetails,
                        preparedBy: currentUserId,
                        preparedByName: preparedByName,
                        datePrepared: new Date().toISOString(),
                        requisitionId: requisition.prfDetails?.requisitionId || requisition.id,
                        timestamp: new Date().toISOString(),
                        designatedApproverId: designatedApproverId
                    },
                    status: RequisitionStatus.PRF_PENDING_MANAGER,
                    prfIdentifier
                };
                onSubmit(updatedRequisition);
            }
        } catch (error: any) {
            // Detailed error logging for debugging
            console.error("=== PRF SUBMISSION ERROR ===");
            console.error("Firestore Error Code:", error?.code);
            console.error("Firestore Error Message:", error?.message);
            console.log("Full Error Object:", error);
            console.error("===========================");

            // Show user-friendly message with actual error detail
            const errorMessage = error?.message || "Unknown error occurred";
            alert(`Failed to submit PRF: ${errorMessage}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Computed values for UI hints (using selectedItemIds)
    const unselectedCount = items.filter(i => !selectedItemIds.has(i.itemId)).length;
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
                        <EditableItemTable
                            items={items}
                            onUpdateItems={setItems}
                            showSelection={true}
                            selectedItemIds={selectedItemIds}
                            onToggleSelection={handleToggleSelection}
                            onToggleAll={handleToggleAll}
                            showDelete={false}
                            readOnly={false}
                        />
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
                                disabled={!isValid() || isSubmitting}
                                className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${isValid() && !isSubmitting
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    }`}
                            >
                                {isSubmitting ? (
                                    <><Loader2 size={18} className="animate-spin" /> Processing...</>
                                ) : (
                                    <><Check size={18} /> {requisition.prfDetails ? 'Update PRF' : 'Submit PRF'}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreparePRFModal;
