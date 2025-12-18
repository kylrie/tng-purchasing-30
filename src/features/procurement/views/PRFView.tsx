import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Printer, RefreshCw, Ban, ExternalLink, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, X, Save, Paperclip, Pencil, Loader2 } from 'lucide-react';
import type { Requisition, RequisitionItem, Supplier, SupplierDetails } from '../types';
import { RequisitionStatus, isSuperAdmin } from '../types';
import type { User, Business } from '../../../shared/types';
import { executeWorkflowAction } from '../services/workflowService';
import { usePermissions } from '../../../hooks/usePermissions';
import PreparePRFModal from '../components/PreparePRFModal';
import PRFPrintModal from '../components/PRFPrintModal';
import PCFPrintModal from '../../finance/components/PCFPrintModal';
import { PCFService, type PCFLiquidation } from '../../finance/services/pcf.service';
import EditableItemTable from '../components/EditableItemTable';
import RequisitionDrawer from '../../../shared/components/RequisitionDrawer';
import Card from '../../../shared/components/Card';
import { CounterService } from '../../../shared/services/counter.service';
import SearchableDropdown from '../../../shared/components/SearchableDropdown';
import { RequisitionService, calculateExpenseAllocation } from '../services/requisitions.service';
// FIX C6: Import sanitization utility to prevent XSS/injection attacks
import { sanitizeText, sanitizeItems } from '../../../shared/utils/sanitize';

// FIX BUG 8: URL validation utility to prevent malicious URLs (javascript:, data:, etc.)
const isValidUrl = (url: string): boolean => {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
};

interface PrfViewProps {
    currentUser: User;
    visibleRequisitions: Requisition[];
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    businesses: Business[];
    allUsers: User[];
    onCreateRequisition: (req: Omit<Requisition, 'id'>) => void;
    onUpdateRequisition: (req: Requisition) => void;
    suppliers: Supplier[];
    uomOptions: string[];
}

const DirectPrfModal = ({ onCancel, currentUser, onCreateRequisition, onUpdate, suppliers, businesses, initialData, uomOptions, users = [] }: {
    onCancel: () => void;
    currentUser: User;
    onCreateRequisition?: (req: Omit<Requisition, 'id'>) => void;
    onUpdate?: (req: Requisition) => void;
    suppliers: Supplier[];
    businesses: Business[];
    initialData?: Requisition;
    uomOptions: string[];
    users?: User[];
}) => {
    const { hasPermission } = usePermissions();
    const [newItems, setNewItems] = useState<RequisitionItem[]>(initialData?.items || []);
    const [tempItem, setTempItem] = useState<Partial<RequisitionItem>>({ name: '', quantity: 1, uom: 'pcs', price: 0 });

    const existingSupplier = initialData?.prfDetails?.supplier;
    const knownSupplierId = existingSupplier
        ? suppliers.find(s => s.name === existingSupplier.name)?.id || ''
        : '';

    const [createNewSupplier, setCreateNewSupplier] = useState(!!existingSupplier && !knownSupplierId);
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>(knownSupplierId);

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

    const [designatedApproverId, setDesignatedApproverId] = useState(initialData?.prfDetails?.designatedApproverId || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [remarks, setRemarks] = useState(initialData?.remarks || '');
    const [attachmentLink, setAttachmentLink] = useState(initialData?.externalLink || initialData?.attachments?.[0] || '');
    const [customId, setCustomId] = useState('');

    // VAT/EWT Tax State
    const [applyVat, setApplyVat] = useState(initialData?.applyVat ?? false);
    const [vatPercentage, setVatPercentage] = useState(initialData?.vatPercentage ?? 12);
    const [applyEwt, setApplyEwt] = useState(initialData?.applyEwt ?? false);
    const [ewtPercentage, setEwtPercentage] = useState(initialData?.ewtPercentage ?? 2);

    // Submission loading state to prevent double-clicks
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ========== BUSINESS UNIT FILTERING LOGIC ==========
    // Determine accessible business units based on user role
    // NOTE: requisition:view:all is for VIEWING - not for CREATING in any BU
    const accessibleBusinessUnits = useMemo(() => {
        // Users with global access can create PRF in any BU
        if (hasPermission('requisition:view:all')) {
            return businesses;
        }

        // COMBINE Primary BU (businessId) + Additional BUs (businessUnitIds)
        // Use Set to deduplicate in case primary is also in the array
        const userBuIds = new Set<string>();

        // Add primary business unit
        if (currentUser.businessId) {
            userBuIds.add(currentUser.businessId);
        }

        // Add additional accessible business units
        if (Array.isArray(currentUser.businessUnitIds)) {
            currentUser.businessUnitIds.forEach(id => userBuIds.add(id));
        }

        return businesses.filter(bu => userBuIds.has(bu.id));
    }, [businesses, currentUser]);

    // Determine if user can change business unit selection
    const hasGlobalAccess = hasPermission('requisition:view:all');
    const canSelectBusiness = hasGlobalAccess || accessibleBusinessUnits.length > 1;

    // Validate and set default business ID
    const getValidBusinessId = () => {
        // If editing, use existing businessId
        if (initialData?.businessId && businesses.some(b => b.id === initialData.businessId)) {
            return initialData.businessId;
        }
        // Use first accessible BU
        if (accessibleBusinessUnits.length > 0) {
            return accessibleBusinessUnits[0].id;
        }
        // Fallback to user's primary businessId
        return currentUser.businessId || '';
    };

    const [selectedBusinessId, setSelectedBusinessId] = useState<string>(getValidBusinessId());

    // Auto-select business unit if user has only one
    useEffect(() => {
        if (accessibleBusinessUnits.length === 1 && !initialData) {
            setSelectedBusinessId(accessibleBusinessUnits[0].id);
        }
    }, [accessibleBusinessUnits, initialData]);


    // Filter list of eligible approvers by business unit (STRICT MATCH)
    const eligibleApprovers = users.filter(u => {
        // 1. Must be an approver
        if (!u.isApprover) return false;

        // 2. Strict Business Unit Match
        // Check if the user's businessUnitIds (array) includes the selected BU
        if (Array.isArray(u.businessUnitIds) && u.businessUnitIds.length > 0) {
            return u.businessUnitIds.includes(selectedBusinessId);
        }

        // Fallback: Check legacy single businessId field
        return u.businessId === selectedBusinessId;
    });


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

    const addItem = () => {
        if (tempItem.name && tempItem.quantity && tempItem.price !== undefined) {
            setNewItems([...newItems, { itemId: `temp-${Date.now()}`, ...tempItem, stockOnHand: 0 } as RequisitionItem]);
            setTempItem({ name: '', quantity: 1, uom: 'pcs', price: 0 });
        }
    };

    // Computed total amount
    const totalAmount = useMemo(() =>
        newItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0),
        [newItems]
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

    // removeItem is now handled by EditableItemTable component

    const handleSubmit = async (isDraft: boolean = false) => {
        // Validation is only enforced for final submissions, not drafts
        if (!isDraft) {
            const supplierValid = createNewSupplier
                ? supplierDetails.name && supplierDetails.paymentMode
                : selectedSupplierId !== '';

            if (!supplierValid) {
                alert("Please provide valid supplier details.");
                return;
            }

            // Validate approver if there are eligible approvers
            if (eligibleApprovers.length > 0 && !designatedApproverId) {
                alert("Please select a designated approver.");
                return;
            }

            // Require at least one item for final submission
            if (newItems.length === 0) {
                alert("Please add at least one item.");
                return;
            }
        }

        // Prevent duplicate submissions
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {

            const prfId = initialData?.id || customId || await CounterService.generatePRFId();

            // FIX C6: Sanitize all user-generated content before saving to Firestore
            const sanitizedSupplierDetails: SupplierDetails = {
                name: sanitizeText(supplierDetails.name),
                tin: sanitizeText(supplierDetails.tin),
                address: sanitizeText(supplierDetails.address),
                paymentMode: supplierDetails.paymentMode, // From dropdown, safe
                terms: sanitizeText(supplierDetails.terms),
                isVatable: supplierDetails.isVatable,
                bankDetails: supplierDetails.bankDetails
            };

            // Calculate expense allocation for corporate expense sharing
            const costAllocation = await calculateExpenseAllocation(selectedBusinessId, totalAmount);

            // Set status based on isDraft flag
            const status = isDraft ? RequisitionStatus.DRAFT : RequisitionStatus.PRF_PENDING_MANAGER;

            const baseReq: any = {
                id: prfId,
                requesterId: currentUser.id,
                // Denormalized user info - stored directly for fast reading without lookups
                requesterName: currentUser.name,
                requesterPhotoUrl: currentUser.avatar || '',
                businessId: selectedBusinessId,
                externalLink: attachmentLink && isValidUrl(attachmentLink) ? attachmentLink : undefined, // Store as dedicated field
                items: sanitizeItems(newItems), // FIX C6: Sanitize item names/remarks
                totalAmount, // Use computed value
                // VAT/EWT Tax fields
                applyVat,
                vatPercentage: applyVat ? vatPercentage : undefined,
                vatAmount: applyVat ? vatAmount : undefined,
                applyEwt,
                ewtPercentage: applyEwt ? ewtPercentage : undefined,
                ewtAmount: applyEwt ? ewtAmount : undefined,
                netAmount: applyEwt ? netAmount : totalAmount,
                status: status,
                dateCreated: new Date().toISOString().split('T')[0],
                description: sanitizeText(description), // FIX C6: Sanitize
                remarks: sanitizeText(remarks), // FIX C6: Sanitize
                // FIX BUG 8: Validate URL before storing to prevent malicious links
                attachments: attachmentLink && isValidUrl(attachmentLink) ? [attachmentLink] : [],
                prfDetails: {
                    supplier: sanitizedSupplierDetails, // FIX C6: Use sanitized supplier
                    preparedBy: currentUser.id,
                    preparedByName: currentUser.name, // Denormalized for display
                    datePrepared: new Date().toISOString(),
                    timestamp: new Date().toISOString(),
                    designatedApproverId: designatedApproverId
                },
                timestamp: new Date().toISOString(),
                // Corporate expense sharing (if applicable)
                costAllocation: costAllocation || undefined,
            };

            if (initialData && onUpdate) {
                await onUpdate({ ...initialData, ...baseReq });
            } else if (onCreateRequisition) {
                await onCreateRequisition(baseReq);
            }
            onCancel();
        } catch (error: any) {
            console.error('Error saving PRF:', error);
            alert(`Failed to save PRF: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-3xl animate-in zoom-in-95 duration-200 !p-0 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-700">
                    <h3 className="text-lg font-bold text-white">{initialData ? 'Edit PRF' : 'Create Direct PRF'}</h3>
                    <button onClick={onCancel} className="text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Business Unit</label>
                            {canSelectBusiness ? (
                                <select
                                    className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    value={selectedBusinessId}
                                    onChange={(e) => setSelectedBusinessId(e.target.value)}
                                >
                                    {accessibleBusinessUnits.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="w-full p-2 bg-slate-800/50 border border-slate-600 rounded text-slate-300 cursor-not-allowed">
                                    {businesses.find(b => b.id === selectedBusinessId)?.name || `Unknown Business Unit${import.meta.env.DEV ? ` (ID: ${selectedBusinessId})` : ''}`}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Custom PRF ID (Optional)</label>
                            <input
                                type="text"
                                className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-500"
                                value={customId}
                                onChange={(e) => setCustomId(e.target.value)}
                                placeholder="Auto-generated if empty"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm text-slate-400 mb-1">Description</label>
                            <input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Purchase of materials" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm text-slate-400 mb-1">Remarks (Optional)</label>
                            <textarea
                                className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-500 resize-none"
                                rows={2}
                                value={remarks}
                                onChange={e => setRemarks(e.target.value)}
                                placeholder="Additional notes or justifications..."
                            />
                        </div>
                        <div className="col-span-2">
                            <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-500/30 mb-4">
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
                                        No designated approvers found for this Business Unit.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="col-span-2 space-y-4 border-t border-slate-700 pt-4 mt-2">
                            <h4 className="text-sm font-bold text-slate-300">Supplier Information</h4>

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
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${createNewSupplier ? 'bg-blue-600' : 'bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${createNewSupplier ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Supplier Name</label>
                                    {createNewSupplier ? (
                                        <input
                                            type="text"
                                            value={supplierDetails.name}
                                            onChange={(e) => setSupplierDetails({ ...supplierDetails, name: e.target.value })}
                                            placeholder="Enter supplier name"
                                            className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
                                        />
                                    ) : (
                                        <SearchableDropdown
                                            options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                                            value={selectedSupplierId}
                                            onChange={handleSupplierSelect}
                                            placeholder="Select Supplier"
                                            className="z-20"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Payment Mode</label>
                                    <select
                                        value={supplierDetails.paymentMode}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, paymentMode: e.target.value })}
                                        className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
                                    >
                                        <option value="">Select Mode</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Check">Check</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Credit Card">Credit Card</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">TIN</label>
                                    <input
                                        type="text"
                                        value={supplierDetails.tin}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, tin: e.target.value })}
                                        placeholder="000-000-000"
                                        className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Terms</label>
                                    <input
                                        type="text"
                                        value={supplierDetails.terms || ''}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, terms: e.target.value })}
                                        placeholder="e.g. 30 Days"
                                        className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm text-slate-400 mb-1">Address</label>
                                    <input
                                        type="text"
                                        value={supplierDetails.address}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, address: e.target.value })}
                                        placeholder="Registered Address"
                                        className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Attachments (Link)</label>
                            <input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={attachmentLink} onChange={e => setAttachmentLink(e.target.value)} placeholder="https://..." />
                        </div>
                    </div>

                    <div className="border-t border-slate-700 pt-4">
                        <h4 className="text-sm font-bold text-slate-300 mb-2">Items</h4>
                        <div className="flex gap-2 items-end mb-2">
                            <div className="flex-1">
                                <label className="block text-xs text-slate-400 mb-1">Item Name</label>
                                <input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" placeholder="Item Name" value={tempItem.name} onChange={e => setTempItem({ ...tempItem, name: e.target.value })} />
                            </div>
                            <div className="w-20">
                                <label className="block text-xs text-slate-400 mb-1">Qty</label>
                                {/* FIX BUG 5: Handle empty string by defaulting to 0 or keeping undefined */}
                                <input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" type="number" placeholder="Qty" value={tempItem.quantity} onChange={e => {
                                    const val = e.target.value;
                                    setTempItem({ ...tempItem, quantity: val === '' ? 0 : parseFloat(val) || 0 });
                                }} />
                            </div>
                            <div className="w-24">
                                <label className="block text-xs text-slate-400 mb-1">Price</label>
                                {/* FIX BUG 5: Handle empty string by defaulting to 0 */}
                                <input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" placeholder="Price" type="number" value={tempItem.price} onChange={e => {
                                    const val = e.target.value;
                                    setTempItem({ ...tempItem, price: val === '' ? 0 : parseFloat(val) || 0 });
                                }} />
                            </div>
                            <div className="w-24">
                                <label className="block text-xs text-slate-400 mb-1">UOM</label>
                                <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" value={tempItem.uom} onChange={e => setTempItem({ ...tempItem, uom: e.target.value })}>
                                    {uomOptions.map((u: string) => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <button onClick={addItem} className="bg-purple-600 text-white p-2 rounded hover:bg-purple-700 mb-[1px]"><Plus size={16} /></button>
                        </div>

                        <EditableItemTable
                            items={newItems}
                            onUpdateItems={setNewItems}
                            showSelection={false}
                            showDelete={true}
                            readOnly={false}
                        />

                        {/* VAT/EWT Tax Section */}
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 mt-4">
                            <h4 className="text-sm font-bold text-slate-300 mb-3">Tax Calculations</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* VAT Toggle */}
                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600">
                                    <div className="flex items-center justify-between mb-2">
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
                                                className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                            />
                                            <span className="text-slate-400 text-sm">%</span>
                                            <span className="ml-auto text-emerald-400 font-medium text-sm">₱{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>

                                {/* EWT Toggle */}
                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600">
                                    <div className="flex items-center justify-between mb-2">
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
                                                className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                            >
                                                <option value="1">1%</option>
                                                <option value="2">2%</option>
                                                <option value="5">5%</option>
                                                <option value="10">10%</option>
                                                <option value="15">15%</option>
                                            </select>
                                            <span className="text-slate-400 text-sm">%</span>
                                            <span className="ml-auto text-amber-400 font-medium text-sm">₱{ewtAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Summary Row */}
                            {(applyVat || applyEwt) && (
                                <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between items-center">
                                    <div className="text-slate-400 text-xs">
                                        <span>Total: ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        {applyVat && <span className="ml-2">+ VAT: ₱{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                                        {applyEwt && <span className="ml-2">- EWT: ₱{ewtAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-slate-500 block">Net Payable</span>
                                        <span className="text-lg font-bold text-green-400">₱{netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>

                    {/* Save as Draft button - no validation required */}
                    <button
                        onClick={() => handleSubmit(true)}
                        disabled={isSubmitting}
                        className="border border-slate-600 text-slate-300 px-4 py-2 rounded font-medium hover:bg-slate-700 hover:text-white flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isSubmitting ? 'Saving...' : 'Save as Draft'}
                    </button>

                    {/* Submit for Approval button - full validation enforced */}
                    <button
                        onClick={() => handleSubmit(false)}
                        disabled={(createNewSupplier ? !supplierDetails.name || !supplierDetails.paymentMode : !selectedSupplierId) || newItems.length === 0 || isSubmitting}
                        className="bg-purple-600 text-white px-4 py-2 rounded font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isSubmitting ? 'Processing...' : (initialData ? 'Update PRF' : 'Submit for Approval')}
                    </button>
                </div>
            </Card >
        </div >
    );
};

type SortField = 'id' | 'description' | 'businessId' | 'dateCreated' | 'status';
type SortDirection = 'asc' | 'desc';

export const PrfView: React.FC<PrfViewProps> = ({
    currentUser,
    visibleRequisitions,
    getStatusBadge,
    businesses,
    allUsers,
    onCreateRequisition,
    onUpdateRequisition,
    suppliers,
    uomOptions
}) => {
    const [isDirectOpen, setIsDirectOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('all');
    const [activeTab, setActiveTab] = useState<'drafts' | 'processing' | 'liquidation' | 'history'>('processing');
    const [preparePRFReq, setPreparePRFReq] = useState<Requisition | null>(null);
    const [printReq, setPrintReq] = useState<Requisition | null>(null);
    const [pcfPrintData, setPcfPrintData] = useState<PCFLiquidation | null>(null);
    const [editingPrf, setEditingPrf] = useState<Requisition | null>(null);
    const [selectedReq, setSelectedReq] = useState<Requisition | null>(null); // Quick Peek drawer state
    const [drawerLoading, setDrawerLoading] = useState(false);
    const { hasPermission } = usePermissions();

    // Handle print - fetch PCF data if it's a PCF Replenishment
    const handlePrint = async (req: Requisition) => {
        if (req.linkedPcfId) {
            // It's a PCF Replenishment - fetch the linked PCF data
            try {
                const pcfData = await PCFService.getLiquidationById(req.linkedPcfId);
                if (pcfData) {
                    setPcfPrintData(pcfData);
                    setPrintReq(req);
                } else {
                    // Fallback to regular PRF modal if PCF not found
                    setPrintReq(req);
                }
            } catch (error) {
                console.error('Error fetching PCF data:', error);
                // Fallback to regular PRF modal
                setPrintReq(req);
            }
        } else {
            // Regular PRF - use PRF print modal
            setPrintReq(req);
        }
    };

    // Close print modal
    const closePrintModal = () => {
        setPrintReq(null);
        setPcfPrintData(null);
    };

    // PRF Drawer Approval Handlers
    const handleDrawerApprove = async () => {
        if (!selectedReq) return;
        setDrawerLoading(true);
        try {
            await RequisitionService.approveRequisition(
                selectedReq.id,
                currentUser.id,
                currentUser.name,
                'Approved via Quick Peek'
            );
            setSelectedReq(null);
            // Note: Real-time listener will update the list
        } catch (error: any) {
            console.error('Error approving:', error);
            alert(`Failed to approve: ${error.message}`);
        } finally {
            setDrawerLoading(false);
        }
    };

    const handleDrawerReject = async () => {
        if (!selectedReq) return;
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason?.trim()) {
            alert('Rejection reason is required.');
            return;
        }
        setDrawerLoading(true);
        try {
            await RequisitionService.rejectRequisition(
                selectedReq.id,
                currentUser.id,
                currentUser.name,
                reason.trim()
            );
            setSelectedReq(null);
        } catch (error: any) {
            console.error('Error rejecting:', error);
            alert(`Failed to reject: ${error.message}`);
        } finally {
            setDrawerLoading(false);
        }
    };

    // Check if current user can approve selected PRF
    const canApproveSelectedPrf = selectedReq && (
        selectedReq.status === RequisitionStatus.PRF_PENDING_MANAGER &&
        hasPermission('approval:manager:prf')
    );

    // Check if current user can submit liquidation
    const canSubmitLiquidation = selectedReq && (
        selectedReq.status === RequisitionStatus.FUNDS_RELEASED &&
        (selectedReq.requesterId === currentUser.id || hasPermission('requisition:view:all'))
    );

    // Handle liquidation submission from drawer
    const handleDrawerSubmitLiquidation = async (payload: any) => {
        if (!selectedReq) return;
        setDrawerLoading(true);
        try {
            await RequisitionService.submitLiquidation(
                selectedReq.id,
                currentUser.id,
                currentUser.name,
                payload
            );
            alert('Liquidation submitted successfully!');
            setSelectedReq(null);
        } catch (error: any) {
            console.error('Error submitting liquidation:', error);
            alert(`Failed to submit liquidation: ${error.message}`);
        } finally {
            setDrawerLoading(false);
        }
    };

    // SuperAdmin Cancel Handler
    const handleDrawerCancel = async () => {
        if (!selectedReq) return;
        if (!confirm(`Are you sure you want to CANCEL ${selectedReq.id}? This action cannot be undone.`)) return;

        setDrawerLoading(true);
        try {
            await executeWorkflowAction({
                requisitionId: selectedReq.id,
                action: 'CANCEL',
                user: {
                    uid: currentUser.id,
                    displayName: currentUser.name,
                    email: currentUser.email
                },
                reason: 'Cancelled by SuperAdmin'
            });
            setSelectedReq(null);
        } catch (error: any) {
            console.error('Error cancelling requisition:', error);
            alert(`Failed to cancel: ${error.message || 'Unknown error'}`);
        } finally {
            setDrawerLoading(false);
        }
    };

    // Sorting state
    const [sortField, setSortField] = useState<SortField>('dateCreated');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Calculate liquidation deadline status for 5-day deadline enforcement
    const getLiquidationDeadline = (req: Requisition): { daysLeft: number; isLate: boolean; daysOverdue: number } => {
        // Try fundReleaseDate first, fallback to history
        const releaseDate = req.fundReleaseDate
            || req.history?.find(h => h.stage === RequisitionStatus.FUNDS_RELEASED)?.date;

        if (!releaseDate) return { daysLeft: 5, isLate: false, daysOverdue: 0 };

        const diffTime = Math.abs(new Date().getTime() - new Date(releaseDate).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
            daysLeft: Math.max(5 - diffDays, 0),
            isLate: diffDays > 5,
            daysOverdue: diffDays > 5 ? diffDays - 5 : 0
        };
    };

    const handlePreparePRFSubmit = (prfReq: Requisition, updatedOrigin?: Requisition) => {
        if (updatedOrigin) {
            onUpdateRequisition(updatedOrigin);
        }

        const exists = visibleRequisitions.some(r => r.id === prfReq.id);

        if (exists) {
            onUpdateRequisition({ ...prfReq, status: RequisitionStatus.PRF_PENDING_MANAGER });
        } else {
            // Pass the full object including the ID
            onCreateRequisition(prfReq);
        }

        setPreparePRFReq(null);
    };

    // FIX #3 cleanup: Removed handleRefileSubmit - refile now handled by DirectPrfModal with onUpdate

    const handleCancel = (id: string) => {
        if (confirm("Are you sure you want to cancel this PRF? This action cannot be undone.")) {
            const req = visibleRequisitions.find(r => r.id === id);
            if (req) {
                onUpdateRequisition({ ...req, status: RequisitionStatus.CANCELLED });
            }
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) return <ArrowUpDown size={14} className="text-slate-600 ml-1" />;
        return sortDirection === 'asc'
            ? <ArrowUp size={14} className="text-purple-400 ml-1" />
            : <ArrowDown size={14} className="text-purple-400 ml-1" />;
    };

    // ============================================================================
    // FILTER LOGIC: 4 Workflow Tab Buckets
    // ============================================================================

    // Tab 0: "Drafts" - Saved drafts not yet submitted
    const draftReqs = useMemo(() => {
        return visibleRequisitions.filter(r =>
            r.status === RequisitionStatus.DRAFT
        );
    }, [visibleRequisitions]);

    // Tab 1: "For Processing" - Parent BURFs waiting to become PRFs
    // Includes BURF_PARTIALLY_PROCESSED for multi-batch PRF creation
    const processingReqs = useMemo(() => {
        return visibleRequisitions.filter(r =>
            (r.status === RequisitionStatus.READY_FOR_PRF ||
                r.status === RequisitionStatus.BURF_PARTIALLY_PROCESSED) &&
            !r.id.includes('-Batch') // Exclude child batches
        );
    }, [visibleRequisitions]);

    // Tab 2: "For Liquidation" - Funds released, awaiting liquidation docs
    // PCF Replenishments (identified by linkedPcfId) are EXCLUDED - they don't need liquidation
    const liquidationReqs = useMemo(() => {
        return visibleRequisitions.filter(r =>
            r.status === RequisitionStatus.FUNDS_RELEASED &&
            r.prfDetails && // Only PRFs
            !r.linkedPcfId // Exclude PCF Replenishments - they go straight to History
        );
    }, [visibleRequisitions]);

    // Tab 3: "History" - Completed/Rejected/Liquidated items
    const historyStatuses = [
        RequisitionStatus.LIQUIDATION_FILED,
        RequisitionStatus.AUDITED_CLEARED,
        RequisitionStatus.LIQUIDATION_REJECTED,
        RequisitionStatus.REJECTED,
        RequisitionStatus.CANCELLED,
    ];
    const historyReqs = useMemo(() => {
        return visibleRequisitions.filter(r =>
            historyStatuses.includes(r.status) &&
            (r.prfDetails || r.status === RequisitionStatus.REJECTED) // PRFs or rejected items
        );
    }, [visibleRequisitions]);

    // Get current tab's data
    const getTabData = () => {
        switch (activeTab) {
            case 'drafts': return draftReqs;
            case 'processing': return processingReqs;
            case 'liquidation': return liquidationReqs;
            case 'history': return historyReqs;
            default: return [];
        }
    };

    const filteredAndSortedReqs = getTabData()
        .filter(r => {
            if (selectedBusinessUnit !== 'all' && r.businessId !== selectedBusinessUnit) {
                return false;
            }
            return true;
        })
        .filter(r =>
            (r.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.description || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            let aValue: any = a[sortField];
            let bValue: any = b[sortField];

            if (sortField === 'businessId') {
                aValue = businesses.find(biz => biz.id === a.businessId)?.name || '';
                bValue = businesses.find(biz => biz.id === b.businessId)?.name || '';
            } else if (sortField === 'dateCreated') {
                return sortDirection === 'asc'
                    ? new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
                    : new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

    // Calculate overdue liquidations for current user (for alert banner)
    // TARGETED LOGIC: Only show alert to the person responsible for the transaction
    const overdueCount = useMemo(() => {
        return liquidationReqs.filter(req => {
            const deadline = getLiquidationDeadline(req);

            // Must be overdue (> 5 days since fund release)
            if (!deadline.isLate) return false;

            // Exclude PCF Replenishments - they don't need liquidation
            if (req.linkedPcfId) return false;

            // OWNERSHIP TARGETING:
            // - BURF-converted PRF (has parentBurfId): Target the PROCESSOR (preparedBy)
            // - Direct PRF (no parentBurfId): Target the REQUESTER (requesterId)
            const isFromBurf = !!req.parentBurfId;
            const isMyResponsibility = isFromBurf
                ? req.prfDetails?.preparedBy === currentUser.id  // Processor is responsible
                : req.requesterId === currentUser.id;            // Requester is responsible

            return isMyResponsibility;
        }).length;
    }, [liquidationReqs, currentUser.id]);

    return (
        <div className="space-y-6 text-white">
            {/* Late Liquidation Alert Banner */}
            {overdueCount > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
                    <AlertTriangle className="text-red-400 flex-shrink-0" size={24} />
                    <div>
                        <p className="font-bold text-red-400">Action Required</p>
                        <p className="text-sm text-red-300">
                            You have {overdueCount} overdue liquidation{overdueCount > 1 ? 's' : ''}. Please file them immediately.
                        </p>
                    </div>
                </div>
            )}
            {isDirectOpen && <DirectPrfModal onCancel={() => setIsDirectOpen(false)} currentUser={currentUser} onCreateRequisition={onCreateRequisition} suppliers={suppliers} businesses={businesses} uomOptions={uomOptions} users={allUsers} />}
            {editingPrf && <DirectPrfModal onCancel={() => setEditingPrf(null)} currentUser={currentUser} onUpdate={onUpdateRequisition} suppliers={suppliers} businesses={businesses} initialData={editingPrf} uomOptions={uomOptions} users={allUsers} />}



            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">PRF Management</h1>
                        <p className="text-slate-300">Prepare, approve, and manage Purchase Requisition Forms.</p>
                    </div>
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                className="pl-10 p-2 border border-slate-700 rounded-lg text-sm w-full md:w-64 bg-slate-800 focus:ring-purple-500"
                                placeholder="Search PRF..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {(hasPermission('requisition:view:all') || (currentUser.businessUnitIds && currentUser.businessUnitIds.length > 1)) && (
                            <select
                                value={selectedBusinessUnit}
                                onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                                className="px-4 py-2 border border-slate-700 rounded-lg text-sm bg-slate-800 focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="all">{hasPermission('requisition:view:all') ? 'All Business Units' : 'All My Business Units'}</option>
                                {hasPermission('requisition:view:all') ? (
                                    businesses.map(business => (
                                        <option key={business.id} value={business.id}>{business.name}</option>
                                    ))
                                ) : (
                                    currentUser.businessUnitIds?.map(buId => {
                                        const bu = businesses.find(b => b.id === buId);
                                        return bu ? <option key={bu.id} value={bu.id}>{bu.name}</option> : null;
                                    })
                                )}
                            </select>
                        )}
                        {hasPermission('requisition:create:prf') && (
                            <button onClick={() => setIsDirectOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-purple-700 font-medium">
                                <Plus size={16} /> Create PRF
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Workflow Tab Navigation */}
            <div className="flex border-b border-slate-700 mb-4 overflow-x-auto">
                <button
                    className={`py-2 px-4 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${activeTab === 'drafts'
                        ? 'border-b-2 border-amber-500 text-amber-400'
                        : 'text-slate-400 hover:text-slate-300'
                        }`}
                    onClick={() => setActiveTab('drafts')}
                >
                    Drafts
                    {draftReqs.length > 0 && (
                        <span className="px-2 py-0.5 bg-amber-900/50 text-amber-300 rounded-full text-xs">{draftReqs.length}</span>
                    )}
                </button>
                <button
                    className={`py-2 px-4 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${activeTab === 'processing'
                        ? 'border-b-2 border-purple-500 text-purple-400'
                        : 'text-slate-400 hover:text-slate-300'
                        }`}
                    onClick={() => setActiveTab('processing')}
                >
                    For Processing
                    <span className="px-2 py-0.5 bg-slate-700 rounded-full text-xs">{processingReqs.length}</span>
                </button>
                <button
                    className={`py-2 px-4 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${activeTab === 'liquidation'
                        ? 'border-b-2 border-emerald-500 text-emerald-400'
                        : 'text-slate-400 hover:text-slate-300'
                        }`}
                    onClick={() => setActiveTab('liquidation')}
                >
                    For Liquidation
                    <span className="px-2 py-0.5 bg-emerald-900/50 text-emerald-300 rounded-full text-xs">{liquidationReqs.length}</span>
                </button>
                <button
                    className={`py-2 px-4 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${activeTab === 'history'
                        ? 'border-b-2 border-slate-500 text-slate-300'
                        : 'text-slate-400 hover:text-slate-300'
                        }`}
                    onClick={() => setActiveTab('history')}
                >
                    History
                    <span className="px-2 py-0.5 bg-slate-700 rounded-full text-xs">{historyReqs.length}</span>
                </button>
            </div>

            <Card className="overflow-hidden !p-0">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                            <tr>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-purple-400 transition-colors"
                                    onClick={() => handleSort('id')}
                                >
                                    <div className="flex items-center">
                                        ID {renderSortIcon('id')}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-purple-400 transition-colors"
                                    onClick={() => handleSort('businessId')}
                                >
                                    <div className="flex items-center">
                                        Business Unit {renderSortIcon('businessId')}
                                    </div>
                                </th>
                                <th className="px-6 py-4">Requested By</th>
                                <th className="px-6 py-4">Processed By</th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-purple-400 transition-colors"
                                    onClick={() => handleSort('description')}
                                >
                                    <div className="flex items-center">
                                        Description {renderSortIcon('description')}
                                    </div>
                                </th>
                                <th className="px-6 py-4">Items</th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-purple-400 transition-colors"
                                    onClick={() => handleSort('dateCreated')}
                                >
                                    <div className="flex items-center">
                                        Date Needed {renderSortIcon('dateCreated')}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-purple-400 transition-colors"
                                    onClick={() => handleSort('status')}
                                >
                                    <div className="flex items-center">
                                        Status {renderSortIcon('status')}
                                    </div>
                                </th>
                                <th className="px-6 py-4">Deadline</th>
                                <th className="px-6 py-4">Link</th>
                                <th className="px-6 py-4">Rejection Reason</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {filteredAndSortedReqs.map(req => {
                                const business = businesses.find(b => b.id === req.businessId);
                                // Use denormalized requesterName, fallback to lookup for legacy data
                                const requesterName = req.requesterName || allUsers.find(u => u.id === req.requesterId)?.name || 'Unknown';
                                // Processed By - the admin who prepared the PRF (with safe fallback)
                                const preparedByName = req.prfDetails?.preparedByName
                                    || allUsers.find(u => u.id === req.prfDetails?.preparedBy)?.name
                                    || (req.prfDetails?.preparedBy ? 'Unknown' : '-');
                                const isOwner = req.prfDetails?.preparedBy === currentUser.id || req.requesterId === currentUser.id || hasPermission('requisition:view:all');
                                // Allow editing for DRAFT (owner) or REJECTED (owner/preparer)
                                const canEdit = (req.status === RequisitionStatus.DRAFT || req.status === RequisitionStatus.REJECTED) && isOwner;

                                // Safe date formatting - handles Firestore Timestamps and ISO strings
                                const formatSafeDate = (dateValue: any): string => {
                                    if (!dateValue) return '-';
                                    // Firestore Timestamp object
                                    if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
                                        return dateValue.toDate().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                                    }
                                    // ISO string or Date
                                    const parsed = new Date(dateValue);
                                    return isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                                };

                                return (
                                    <tr
                                        key={req.id}
                                        className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                                        onClick={(e) => {
                                            // Don't open drawer if clicking action buttons
                                            if ((e.target as HTMLElement).closest('button, a')) return;
                                            setSelectedReq(req);
                                        }}
                                    >
                                        <td className="px-6 py-4 font-medium text-slate-200 whitespace-nowrap">{req.id}</td>
                                        <td className="px-6 py-4 text-slate-300 text-xs">{business?.name || 'N/A'}</td>
                                        {/* Requested By - using denormalized name, fallback to lookup for legacy data */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 overflow-hidden">
                                                    {req.requesterPhotoUrl ? (
                                                        <img src={req.requesterPhotoUrl} alt={requesterName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        requesterName.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <span className="text-slate-200">{requesterName}</span>
                                            </div>
                                        </td>
                                        {/* Processed By - the admin who prepared the PRF */}
                                        <td className="px-6 py-4">
                                            {preparedByName !== '-' ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-purple-700 flex items-center justify-center text-xs font-bold text-purple-200">
                                                        {preparedByName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-slate-300 text-xs">{preparedByName}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-600">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-200 max-w-[200px] truncate\" title={req.description}>{req.description || '-'}</td>
                                        <td className="px-6 py-4 text-slate-400">{req.items.length} items</td>
                                        {/* Date Needed - safe formatting handles Timestamps and ISO strings */}
                                        <td className="px-6 py-4 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="text-purple-400">
                                                    {formatSafeDate(req.dateNeeded) !== '-'
                                                        ? formatSafeDate(req.dateNeeded)
                                                        : formatSafeDate(req.dateCreated)}
                                                </span>
                                                {(req.isUrgent || req.priority === 'URGENT') && (
                                                    <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded-full uppercase">Urgent</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {getStatusBadge(req.status)}

                                                {/* Show Released status explicitly for liquidation/history tabs */}
                                                {req.fundReleaseDate && (activeTab === 'liquidation' || activeTab === 'history') && (
                                                    <span className="text-[10px] text-emerald-400">Funds Released: {new Date(req.fundReleaseDate).toLocaleDateString()}</span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Liquidation Deadline Column */}
                                        <td className="px-6 py-4">
                                            {activeTab === 'liquidation' ? (() => {
                                                const deadline = getLiquidationDeadline(req);
                                                if (deadline.isLate) {
                                                    return (
                                                        <span className="px-2 py-1 text-xs font-bold rounded bg-red-500/20 text-red-400 whitespace-nowrap">
                                                            🔴 LATE (+{deadline.daysOverdue} days)
                                                        </span>
                                                    );
                                                } else {
                                                    return (
                                                        <span className="px-2 py-1 text-xs font-bold rounded bg-amber-500/20 text-amber-400 whitespace-nowrap">
                                                            ⚠️ {deadline.daysLeft} days left
                                                        </span>
                                                    );
                                                }
                                            })() : <span className="text-slate-600">-</span>}
                                        </td>
                                        {/* External Link - paperclip icon that opens externalLink or first attachment */}
                                        <td className="px-6 py-4">
                                            {(req.externalLink || req.attachments?.[0]) ? (
                                                <a
                                                    href={req.externalLink || req.attachments?.[0]}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-400 hover:text-blue-300 p-1"
                                                    title="Open Reference Link"
                                                >
                                                    <Paperclip size={16} />
                                                </a>
                                            ) : (
                                                <span className="text-slate-600">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-red-400">
                                            {req.status === RequisitionStatus.REJECTED && req.remarks ? (
                                                <span className="flex items-center gap-1">
                                                    <AlertTriangle size={14} />
                                                    {req.remarks.split('[REJECTED]:').pop()?.trim() || 'No reason provided'}
                                                </span>
                                            ) : (
                                                <span className="text-slate-600">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 items-center">
                                                {/* Cancel Button for Admin/Super Admin */}
                                                {hasPermission('requisition:cancel') &&
                                                    req.status !== RequisitionStatus.CANCELLED &&
                                                    req.status !== RequisitionStatus.REJECTED &&
                                                    !req.fundReleaseDate && (
                                                        <button
                                                            onClick={() => handleCancel(req.id)}
                                                            className="text-slate-500 hover:text-red-400 p-1"
                                                            title="Cancel PRF"
                                                        >
                                                            <Ban size={16} />
                                                        </button>
                                                    )}

                                                {canEdit && (
                                                    <button
                                                        onClick={() => setEditingPrf(req)}
                                                        className="text-blue-400 hover:text-blue-300 p-1"
                                                        title={req.status === RequisitionStatus.DRAFT ? 'Edit Draft' : 'Re-file / Edit'}
                                                    >
                                                        {req.status === RequisitionStatus.DRAFT ? <Pencil size={16} /> : <RefreshCw size={16} />}
                                                    </button>
                                                )}

                                                {(req.status === RequisitionStatus.READY_FOR_PRF || req.status === RequisitionStatus.BURF_PARTIALLY_PROCESSED) && hasPermission('requisition:prepare:prf') && (
                                                    <button onClick={() => setPreparePRFReq(req)} className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 font-medium">Prepare PRF</button>
                                                )}

                                                {req.prfDetails && (
                                                    <div className="flex items-center gap-2">
                                                        {req.chequeImageUrl && (
                                                            <a
                                                                href={req.chequeImageUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-400 hover:text-blue-300 p-1"
                                                                title="View Cheque"
                                                            >
                                                                <ExternalLink size={16} />
                                                            </a>
                                                        )}
                                                        <button onClick={() => handlePrint(req)} className="text-slate-400 p-1 hover:text-white" title="Print PRF"><Printer size={16} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {/* ColSpan matches 11 columns (ID, Business Unit, Requested By, Processed By, Description, Items, Date Needed, Status, Deadline, Link, Rejection Reason, Actions) */}
                            {filteredAndSortedReqs.length === 0 && (
                                <tr><td colSpan={12} className="px-6 py-8 text-center text-slate-500 italic">No PRF found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {preparePRFReq && <PreparePRFModal requisition={preparePRFReq} suppliers={suppliers} onClose={() => setPreparePRFReq(null)} onSubmit={handlePreparePRFSubmit} currentUserId={currentUser.id} users={allUsers} />}
            {/* FIX #3: Removed duplicate modal - editingPrf is already handled by DirectPrfModal at line 558 */}
            {/* Print Modal - Use PCFPrintModal for PCF Replenishments, PRFPrintModal for regular PRFs */}
            {printReq && (
                pcfPrintData ? (
                    <PCFPrintModal
                        liquidation={pcfPrintData}
                        onClose={closePrintModal}
                        business={businesses.find(b => b.id === printReq.businessId)}
                    />
                ) : (
                    <PRFPrintModal
                        req={printReq}
                        onClose={closePrintModal}
                        business={businesses.find(b => b.id === printReq.businessId)}
                        requester={allUsers.find(u => u.id === printReq.requesterId)}
                        preparedBy={allUsers.find(u => u.id === printReq.prfDetails?.preparedBy)}
                    />
                )
            )}

            {/* Quick Peek Drawer */}
            <RequisitionDrawer
                requisition={selectedReq}
                isOpen={!!selectedReq}
                onClose={() => setSelectedReq(null)}
                variant="PRF"
                businesses={businesses}
                getStatusBadge={getStatusBadge}
                onApprove={handleDrawerApprove}
                onReject={handleDrawerReject}
                onCancel={handleDrawerCancel}
                onSubmitLiquidation={handleDrawerSubmitLiquidation}
                canApprove={!!canApproveSelectedPrf}
                canReject={!!canApproveSelectedPrf}
                canCancel={!!selectedReq && isSuperAdmin(currentUser.role) && selectedReq.status !== RequisitionStatus.CANCELLED}
                canSubmitLiquidation={!!canSubmitLiquidation}
                isLoading={drawerLoading}
            />
        </div>
    );
};

export default PrfView;

