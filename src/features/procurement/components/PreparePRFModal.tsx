import React, { useState, useMemo } from 'react';
import { Check, ArrowLeft, Loader2, Save, Paperclip, Plus } from 'lucide-react';
import type { Requisition, RequisitionItem, Supplier, SupplierDetails, User } from '../types';
import { RequisitionStatus } from '../types';
import { RequisitionService } from '../services/requisitions.service';
import SearchableDropdown from '../../../shared/components/SearchableDropdown';
import EditableItemTable from './EditableItemTable';
// FIX: Import URL sanitization utility for attachment links
import { sanitizeAttachmentUrl } from '../../../shared/utils/validation';

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
    // Filter out items that have already been converted to PRF (tracked in convertedItemIds)
    const convertedItemIdsSet = new Set(requisition.convertedItemIds || []);
    const availableItems = (requisition.items || []).filter(item => !convertedItemIdsSet.has(item.itemId));

    const [items, setItems] = useState<RequisitionItem[]>(
        availableItems.map(item => ({ ...item, price: item.price ?? 0 }))
    );
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
        new Set(availableItems.map(item => item.itemId))
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

    // VAT/EWT Tax State
    const [applyVat, setApplyVat] = useState(requisition.applyVat ?? false);
    const [vatPercentage, setVatPercentage] = useState(requisition.vatPercentage ?? 12);
    const [applyEwt, setApplyEwt] = useState(requisition.applyEwt ?? false);
    const [ewtPercentage, setEwtPercentage] = useState(requisition.ewtPercentage ?? 2);

    // Remarks state
    const [remarks, setRemarks] = useState(requisition.remarks || '');

    // Attachment link state
    // FIX: Read from both externalLink and attachments array for backward compatibility
    const [attachmentLink, setAttachmentLink] = useState(requisition.externalLink || requisition.attachments?.[0] || '');

    // Submission loading states to prevent double-clicks
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    // FIX: Replace alert() with inline status message
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Determine if this is a BURF→PRF conversion (not a Direct PRF or PRF edit)
    // Includes BURF_PARTIALLY_PROCESSED for multi-batch PRF creation
    const isFromBurf = requisition.status === RequisitionStatus.READY_FOR_PRF ||
        requisition.status === RequisitionStatus.BURF_PARTIALLY_PROCESSED;

    // Filter list of eligible approvers by business unit (STRICT MATCH)
    // For BURF→PRF: Only show BUM (Business Unit Manager) approvers
    const eligibleApprovers = users.filter(u => {
        // 1. Must be an approver
        if (!u.isApprover) return false;

        // 2. Strict Business Unit Match
        const targetBusinessUnitId = requisition.businessId;

        // Check if the user's businessUnitIds (array) includes the target BU
        if (Array.isArray(u.businessUnitIds) && u.businessUnitIds.length > 0) {
            return u.businessUnitIds.includes(targetBusinessUnitId);
        }

        // Fallback: Check legacy single businessId field
        return u.businessId === targetBusinessUnitId;
    });

    // For BURF→PRF: Find the MANAGER for this Business Unit and auto-select
    const bumApprover = useMemo(() => {
        if (!isFromBurf) return null;
        // Look for users with exact role 'MANAGER' in the eligible approvers
        // The MANAGER must be in the same Business Unit as the BURF (already filtered by eligibleApprovers)
        return eligibleApprovers.find(u => u.role === 'MANAGER') || null;
    }, [isFromBurf, eligibleApprovers]);

    // Auto-set BUM as designated approver when converting from BURF
    React.useEffect(() => {
        if (isFromBurf && bumApprover && !designatedApproverId) {
            setDesignatedApproverId(bumApprover.id);
        }
    }, [isFromBurf, bumApprover, designatedApproverId]);



    // Calculate total amount for selected items
    const totalAmount = useMemo(() =>
        items
            .filter(item => selectedItemIds.has(item.itemId))
            .reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0),
        [items, selectedItemIds]
    );

    // Computed tax amounts
    const vatAmount = useMemo(() =>
        applyVat ? totalAmount * (vatPercentage / 100) : 0,
        [totalAmount, applyVat, vatPercentage]
    );

    const ewtAmount = useMemo(() =>
        applyEwt ? totalAmount * (ewtPercentage / 100) : 0,
        [totalAmount, applyEwt, ewtPercentage]
    );

    const netAmount = useMemo(() =>
        totalAmount - ewtAmount,
        [totalAmount, ewtAmount]
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

    // Add new item row handler
    const handleAddRow = () => {
        const newItemId = `new-${Date.now()}`;
        const newItem: RequisitionItem = {
            itemId: newItemId,
            name: '',
            quantity: 1,
            uom: 'pcs',
            stockOnHand: 0,
            price: 0
        };
        setItems(prev => [...prev, newItem]);
        setSelectedItemIds(prev => new Set([...prev, newItemId]));
    };

    // Save as Draft handler - saves work without starting approval
    const handleSaveDraft = async () => {
        if (isSavingDraft || isSubmitting) return;
        setIsSavingDraft(true);

        try {
            const selectedItems = items.filter(item => selectedItemIds.has(item.itemId));
            const preparer = users.find(u => u.id === currentUserId);
            const preparedByName = preparer?.name || 'Unknown';

            // Create draft requisition
            const draftRequisition: Requisition = {
                ...requisition,
                items: selectedItems.length > 0 ? selectedItems : items,
                totalAmount,
                remarks,
                applyVat,
                vatPercentage: applyVat ? vatPercentage : undefined,
                vatAmount: applyVat ? vatAmount : undefined,
                applyEwt,
                ewtPercentage: applyEwt ? ewtPercentage : undefined,
                ewtAmount: applyEwt ? ewtAmount : undefined,
                netAmount: applyEwt ? netAmount : totalAmount,
                // FIX: Sanitize URL (add https:// if missing) before storing
                attachments: attachmentLink ? [sanitizeAttachmentUrl(attachmentLink)] : requisition.attachments || [],
                externalLink: attachmentLink ? sanitizeAttachmentUrl(attachmentLink) : requisition.externalLink,
                prfDetails: supplierDetails.name ? {
                    supplier: supplierDetails,
                    preparedBy: currentUserId,
                    preparedByName: preparedByName,
                    datePrepared: new Date().toISOString(),
                    requisitionId: requisition.prfDetails?.requisitionId || requisition.id,
                    timestamp: new Date().toISOString(),
                    designatedApproverId: designatedApproverId
                } : requisition.prfDetails,
                status: RequisitionStatus.DRAFT, // Keep as draft
                prfIdentifier,
            };

            // Use onSubmit callback but with DRAFT status
            onSubmit(draftRequisition);
            // FIX: Replace alert() with status message
            setStatusMessage({ type: 'success', text: '✅ Draft saved successfully! You can continue editing later.' });
            setTimeout(() => setStatusMessage(null), 4000);
        } catch (error: unknown) {
            // FIX: Replace error: any with unknown and type-safe access
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error saving draft:', error);
            setStatusMessage({ type: 'error', text: `Failed to save draft: ${errorMessage}` });
            setTimeout(() => setStatusMessage(null), 5000);
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleSubmit = async () => {
        // Prevent duplicate submissions
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const selectedItems = items.filter(item => selectedItemIds.has(item.itemId));

            // Get preparer's name from users array for denormalization
            const preparer = users.find(u => u.id === currentUserId);
            const preparedByName = preparer?.name || 'Unknown';

            // BURF-to-PRF Conversion with splitting: Use transactional service
            // Includes BURF_PARTIALLY_PROCESSED for multi-batch PRF creation
            const isBurfConversion = requisition.status === RequisitionStatus.READY_FOR_PRF ||
                requisition.status === RequisitionStatus.BURF_PARTIALLY_PROCESSED;
            if (isBurfConversion) {
                // FIX: Merged redundant branches - use transactional service for all BURF conversions
                // FIX: Now passes VAT/EWT tax fields and attachment link (previously lost during conversion)
                await RequisitionService.createBatchPrfFromBurf({
                    sourceBurfId: requisition.id,
                    sourceBusinessId: requisition.businessId, // Required for query permissions
                    selectedItems: selectedItems,
                    prfDetails: {
                        supplier: supplierDetails,
                        preparedBy: currentUserId,
                        preparedByName: preparedByName,
                        designatedApproverId: designatedApproverId,
                    },
                    // FIX: Include VAT/EWT tax fields
                    taxFields: {
                        applyVat,
                        vatPercentage: applyVat ? vatPercentage : undefined,
                        vatAmount: applyVat ? vatAmount : undefined,
                        applyEwt,
                        ewtPercentage: applyEwt ? ewtPercentage : undefined,
                        ewtAmount: applyEwt ? ewtAmount : undefined,
                        netAmount: applyEwt ? netAmount : totalAmount,
                    },
                    // FIX: Sanitize and include attachment link (add https:// if missing)
                    attachmentLink: attachmentLink ? sanitizeAttachmentUrl(attachmentLink) : undefined,
                    userId: currentUserId,
                    userName: preparedByName,
                });

                // Close modal - parent will refresh from Firestore subscription
                onClose();
            } else {
                // Non-splitting case: Editing existing PRF or direct PRF creation
                const updatedRequisition: Requisition = {
                    ...requisition,
                    items: selectedItems,
                    totalAmount,
                    remarks, // Add remarks to submission
                    // VAT/EWT Tax fields
                    applyVat,
                    vatPercentage: applyVat ? vatPercentage : undefined,
                    vatAmount: applyVat ? vatAmount : undefined,
                    applyEwt,
                    ewtPercentage: applyEwt ? ewtPercentage : undefined,
                    ewtAmount: applyEwt ? ewtAmount : undefined,
                    netAmount: applyEwt ? netAmount : totalAmount,
                    // FIX: Sanitize URL (add https:// if missing) before storing
                    attachments: attachmentLink ? [sanitizeAttachmentUrl(attachmentLink)] : requisition.attachments || [],
                    externalLink: attachmentLink ? sanitizeAttachmentUrl(attachmentLink) : requisition.externalLink,
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
        } catch (error: unknown) {
            // FIX: Replace error: any with unknown and type-safe access
            const errObj = error instanceof Error ? error : { message: 'Unknown error', code: 'UNKNOWN' };
            // Detailed error logging for debugging
            console.error("=== PRF SUBMISSION ERROR ===");
            console.error("Firestore Error Code:", (errObj as { code?: string }).code);
            console.error("Firestore Error Message:", errObj.message);
            console.error("Full Error:", error);
            console.error("===========================");

            // Show user-friendly message with actual error detail
            // FIX: Replace alert() with status message
            setStatusMessage({ type: 'error', text: `Failed to submit PRF: ${errObj.message}` });
            setTimeout(() => setStatusMessage(null), 5000);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Computed values for UI hints (using selectedItemIds)
    const unselectedCount = items.filter(i => !selectedItemIds.has(i.itemId)).length;
    const isBurfStatus = requisition.status === RequisitionStatus.READY_FOR_PRF ||
        requisition.status === RequisitionStatus.BURF_PARTIALLY_PROCESSED;
    const isSplitting = isBurfStatus && unselectedCount > 0;

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
                            <span className="ml-2 text-purple-400 font-mono text-lg">({requisition.id})</span>
                        </h2>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Message Display */}
                    {statusMessage && (
                        <div className={`p-3 rounded-lg text-sm ${statusMessage.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'bg-red-500/20 border border-red-500/40 text-red-300'}`}>
                            {statusMessage.text}
                        </div>
                    )}
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
                            <label className="block text-sm font-medium text-purple-300 mb-1">
                                {isFromBurf && bumApprover ? 'Approver (Manager)' : 'Select Approver'}
                            </label>
                            {eligibleApprovers.length > 0 ? (
                                <select
                                    value={designatedApproverId}
                                    onChange={(e) => setDesignatedApproverId(e.target.value)}
                                    disabled={isFromBurf && !!bumApprover} // Only disable if BURF AND has a manager
                                    className={`w-full px-3 py-2 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white ${isFromBurf && bumApprover
                                        ? 'bg-slate-800 cursor-not-allowed opacity-75'
                                        : 'bg-slate-900/50'
                                        }`}
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
                                {isFromBurf && bumApprover
                                    ? 'BURFs converted to PRF are automatically routed to the Manager.'
                                    : isFromBurf && !bumApprover
                                        ? 'No Manager found for this BU. Please select an approver.'
                                        : 'Designate who will approve this PRF.'
                                }
                            </p>
                        </div>
                    </div>

                    {/* Remarks Section */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Remarks (Optional)</label>
                        <textarea
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Additional notes or justifications..."
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500 resize-none"
                        />
                    </div>

                    {/* Attachment Link Section */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                            <Paperclip size={16} className="text-slate-400" />
                            Attachment Link (Optional)
                        </label>
                        <input
                            type="text"
                            value={attachmentLink}
                            onChange={(e) => setAttachmentLink(e.target.value)}
                            placeholder="https://drive.google.com/..."
                            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">Paste a Google Drive link to supporting documents (quotation, invoice, etc.)</p>
                    </div>

                    {/* Item Specification & Costing */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-white">Item Specification & Costing</h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400">Select items to include in this PRF</span>
                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    <Plus size={16} />
                                    Add Row
                                </button>
                            </div>
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

                    {/* VAT/EWT Tax Section */}
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                        <h3 className="text-lg font-semibold text-white mb-4">Tax Calculations</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* VAT Toggle */}
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <span className="text-sm font-medium text-slate-300">Apply VAT</span>
                                        <p className="text-xs text-slate-500">Value-Added Tax</p>
                                    </div>
                                    <button
                                        onClick={() => setApplyVat(!applyVat)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${applyVat ? 'bg-emerald-600' : 'bg-slate-700'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${applyVat ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                {applyVat && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={vatPercentage}
                                            onChange={(e) => setVatPercentage(parseFloat(e.target.value) || 0)}
                                            min="0"
                                            max="100"
                                            step="0.5"
                                            className="w-20 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                        />
                                        <span className="text-slate-400">%</span>
                                        <span className="ml-auto text-emerald-400 font-medium">₱{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                            </div>

                            {/* EWT Toggle */}
                            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <span className="text-sm font-medium text-slate-300">Apply EWT</span>
                                        <p className="text-xs text-slate-500">Expanded Withholding Tax</p>
                                    </div>
                                    <button
                                        onClick={() => setApplyEwt(!applyEwt)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${applyEwt ? 'bg-amber-600' : 'bg-slate-700'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${applyEwt ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                {applyEwt && (
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={ewtPercentage}
                                            onChange={(e) => setEwtPercentage(parseFloat(e.target.value))}
                                            className="w-20 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                        >
                                            <option value="1">1%</option>
                                            <option value="2">2%</option>
                                            <option value="5">5%</option>
                                            <option value="10">10%</option>
                                            <option value="15">15%</option>
                                        </select>
                                        <span className="text-slate-400">%</span>
                                        <span className="ml-auto text-amber-400 font-medium">₱{ewtAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Summary Row */}
                        {(applyVat || applyEwt) && (
                            <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
                                <div className="text-slate-400 text-sm">
                                    <span>Total: ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    {applyVat && <span className="ml-3">+ VAT: ₱{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                                    {applyEwt && <span className="ml-3">- EWT: ₱{ewtAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-slate-500 block">Net Amount Payable</span>
                                    <span className="text-xl font-bold text-green-400">₱{netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        )}
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
                            <div className="flex items-center gap-3">
                                {/* Save Draft Button - Only show for non-BURF conversions */}
                                {!isFromBurf && (
                                    <button
                                        onClick={handleSaveDraft}
                                        disabled={isSavingDraft || isSubmitting}
                                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${!isSavingDraft && !isSubmitting
                                            ? 'bg-slate-600 text-white hover:bg-slate-500 border border-slate-500'
                                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                            }`}
                                        title="Save your progress without submitting for approval"
                                    >
                                        {isSavingDraft ? (
                                            <><Loader2 size={18} className="animate-spin" /> Saving...</>
                                        ) : (
                                            <><Save size={18} /> Save Draft</>
                                        )}
                                    </button>
                                )}

                                {/* Submit Button */}
                                <button
                                    onClick={handleSubmit}
                                    disabled={!isValid() || isSubmitting || isSavingDraft}
                                    className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${isValid() && !isSubmitting && !isSavingDraft
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
        </div>
    );
};

export default PreparePRFModal;
