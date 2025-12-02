import React, { useState } from 'react';
import { Plus, Search, Printer, RefreshCw, Ban, ExternalLink, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, X, Save } from 'lucide-react';
import type { Requisition, RequisitionItem, Supplier, SupplierDetails } from '../types';
import { RequisitionStatus } from '../types';
import type { User, Business } from '../../../shared/types';
import { usePermissions } from '../../../hooks/usePermissions';
import PreparePRFModal from '../components/PreparePRFModal';
import PRFPrintModal from '../components/PRFPrintModal';
import Card from '../../../shared/components/Card';
import { CounterService } from '../../../shared/services/counter.service';
import { RequisitionService } from '../services/requisitions.service';
import SearchableDropdown from '../../../shared/components/SearchableDropdown';

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
    const [remarks] = useState(initialData?.remarks || '');
    const [attachmentLink, setAttachmentLink] = useState(initialData?.attachments?.[0] || '');
    const [customId, setCustomId] = useState('');
    const { hasPermission } = usePermissions();

    // Allow business unit selection if user has global access OR multiple business units
    const userBusinessUnits = currentUser.businessUnitIds || [];
    const hasMultipleBusinessUnits = userBusinessUnits.length > 1;
    const canSelectBusiness = hasPermission('requisition:view:all') || hasMultipleBusinessUnits;

    const [selectedBusinessId, setSelectedBusinessId] = useState<string>(initialData?.businessId || currentUser.businessId);

    // Filter list of eligible approvers by business unit
    const eligibleApprovers = users.filter(u => {
        // Must be an approver
        if (!u.isApprover) return false;

        // Check if approver has access to this requisition's business unit
        const approverBUs = u.businessUnitIds || [];
        // Use selectedBusinessId for the check
        return approverBUs.includes(selectedBusinessId) || approverBUs.length === 0;
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

    const removeItem = (index: number) => {
        setNewItems(newItems.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
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

        const prfId = customId || await CounterService.generatePRFId();

        const baseReq: any = {
            id: prfId,
            requesterId: currentUser.id,
            businessId: selectedBusinessId,
            items: newItems,
            totalAmount: newItems.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
            status: RequisitionStatus.PRF_PENDING_MANAGER, // Re-submit to manager
            dateCreated: new Date().toISOString().split('T')[0],
            description,
            remarks,
            attachments: attachmentLink ? [attachmentLink] : [],
            prfDetails: {
                supplier: supplierDetails,
                preparedBy: currentUser.id,
                datePrepared: new Date().toISOString(),
                timestamp: new Date().toISOString(),
                designatedApproverId: designatedApproverId // Save designated approver
            },
            timestamp: new Date().toISOString(),
        };

        if (initialData && onUpdate) {
            onUpdate({ ...initialData, ...baseReq });
        } else if (onCreateRequisition) {
            onCreateRequisition(baseReq);
        }
        onCancel();
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
                                    {(hasPermission('requisition:view:all') ? businesses : businesses.filter(b => userBusinessUnits.includes(b.id))).map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="w-full p-2 bg-slate-800/50 border border-slate-600 rounded text-slate-300 cursor-not-allowed">
                                    {businesses.find(b => b.id === selectedBusinessId)?.name || 'Unknown Business Unit'}
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
                                <input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" type="number" placeholder="Qty" value={tempItem.quantity} onChange={e => setTempItem({ ...tempItem, quantity: parseFloat(e.target.value) })} />
                            </div>
                            <div className="w-24">
                                <label className="block text-xs text-slate-400 mb-1">Price</label>
                                <input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" placeholder="Price" type="number" value={tempItem.price} onChange={e => setTempItem({ ...tempItem, price: parseFloat(e.target.value) })} />
                            </div>
                            <div className="w-24">
                                <label className="block text-xs text-slate-400 mb-1">UOM</label>
                                <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" value={tempItem.uom} onChange={e => setTempItem({ ...tempItem, uom: e.target.value })}>
                                    {uomOptions.map((u: string) => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <button onClick={addItem} className="bg-purple-600 text-white p-2 rounded hover:bg-purple-700 mb-[1px]"><Plus size={16} /></button>
                        </div>

                        <div className="border border-slate-700 rounded overflow-hidden">
                            <table className="w-full text-sm text-left text-slate-300">
                                <thead className="bg-slate-800 text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-2">Item</th>
                                        <th className="px-4 py-2">Qty</th>
                                        <th className="px-4 py-2">Price</th>
                                        <th className="px-4 py-2">Total</th>
                                        <th className="px-4 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {newItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-2">{item.name}</td>
                                            <td className="px-4 py-2">{item.quantity} {item.uom}</td>
                                            <td className="px-4 py-2">₱{item.price?.toLocaleString()}</td>
                                            <td className="px-4 py-2">₱{(item.quantity * item.price)?.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right">
                                                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300"><X size={14} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
                    <button onClick={handleSubmit} disabled={!selectedSupplierId || newItems.length === 0} className="bg-purple-600 text-white px-4 py-2 rounded font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                        <Save size={16} /> {initialData ? 'Update PRF' : 'Create PRF'}
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
    const [activeTab, setActiveTab] = useState<'pending' | 'flowed'>('pending');
    const [preparePRFReq, setPreparePRFReq] = useState<Requisition | null>(null);
    const [printReq, setPrintReq] = useState<Requisition | null>(null);
    const [editingPrf, setEditingPrf] = useState<Requisition | null>(null);
    const { hasPermission } = usePermissions();

    // Sorting state
    const [sortField, setSortField] = useState<SortField>('dateCreated');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

    const handleRefileSubmit = async (prfReq: Requisition) => {
        try {
            // Use the refile service method
            await RequisitionService.reFileRequisition(
                prfReq.id,
                currentUser.id,
                currentUser.name,
                prfReq
            );
            setEditingPrf(null);
        } catch (error: any) {
            console.error('Error refiling PRF:', error);
            alert(`Failed to refile PRF: ${error.message || 'Unknown error'}`);
        }
    };

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

    // Filter Logic
    const pendingStatuses = [
        RequisitionStatus.READY_FOR_PRF,
        RequisitionStatus.PRF_PENDING_MANAGER,
        RequisitionStatus.APPROVED_FOR_PAYMENT,
        RequisitionStatus.REJECTED,
        RequisitionStatus.CANCELLED
    ];

    const flowedStatuses = [
        RequisitionStatus.FUNDS_RELEASED,
        RequisitionStatus.LIQUIDATION_FILED,
        RequisitionStatus.LIQUIDATION_REJECTED,
        RequisitionStatus.AUDITED_CLEARED
    ];

    const targetStatuses = activeTab === 'pending' ? pendingStatuses : flowedStatuses;

    const filteredAndSortedReqs = visibleRequisitions
        .filter(r => targetStatuses.includes(r.status))
        .filter(r => r.status !== RequisitionStatus.REJECTED || r.prfDetails) // Only show rejected PRFs, not rejected BURFs
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

    return (
        <div className="space-y-6 text-white">
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

            <div className="flex border-b border-slate-700 mb-4">
                <button
                    className={`py-2 px-4 text-sm font-medium ${activeTab === 'pending'
                        ? 'border-b-2 border-purple-500 text-purple-400'
                        : 'text-slate-400 hover:text-slate-300'
                        }`}
                    onClick={() => setActiveTab('pending')}
                >
                    Pending Approval
                </button>
                <button
                    className={`py-2 px-4 text-sm font-medium ${activeTab === 'flowed'
                        ? 'border-b-2 border-purple-500 text-purple-400'
                        : 'text-slate-400 hover:text-slate-300'
                        }`}
                    onClick={() => setActiveTab('flowed')}
                >
                    Flowed Requests (Fund Released)
                </button>
            </div>

            <Card className="overflow-hidden !p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
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
                                        Date & Time {renderSortIcon('dateCreated')}
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
                                <th className="px-6 py-4">Rejection Reason</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {filteredAndSortedReqs.map(req => {
                                const business = businesses.find(b => b.id === req.businessId);
                                const isOwner = req.prfDetails?.preparedBy === currentUser.id || hasPermission('requisition:view:all');
                                const canEdit = req.status === RequisitionStatus.REJECTED && isOwner;

                                return (
                                    <tr key={req.id} className="hover:bg-slate-800/60">
                                        <td className="px-6 py-4 font-medium text-slate-200">{req.id}</td>
                                        <td className="px-6 py-4 text-slate-300 text-xs">{business?.name || 'N/A'}</td>
                                        <td className="px-6 py-4 text-slate-200">{req.description}</td>
                                        <td className="px-6 py-4 text-slate-400">{req.items.length} items</td>
                                        <td className="px-6 py-4 text-purple-400 text-xs">{new Date(req.dateCreated).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {getStatusBadge(req.status)}

                                                {/* Show Released status explicitly if status is beyond FUNDS_RELEASED */}
                                                {req.fundReleaseDate && activeTab === 'flowed' && (
                                                    <span className="text-[10px] text-emerald-400">Funds Released: {new Date(req.fundReleaseDate).toLocaleDateString()}</span>
                                                )}
                                            </div>
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
                                                        title="Re-file / Edit"
                                                    >
                                                        <RefreshCw size={16} />
                                                    </button>
                                                )}

                                                {req.status === RequisitionStatus.READY_FOR_PRF && hasPermission('requisition:create:prf') && (
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
                                                        <button onClick={() => setPrintReq(req)} className="text-slate-400 p-1 hover:text-white" title="Print PRF"><Printer size={16} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredAndSortedReqs.length === 0 && (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">No PRF found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card >

            {preparePRFReq && <PreparePRFModal requisition={preparePRFReq} suppliers={suppliers} onClose={() => setPreparePRFReq(null)} onSubmit={handlePreparePRFSubmit} currentUserId={currentUser.id} users={allUsers} />}
            {editingPrf && <PreparePRFModal requisition={editingPrf} suppliers={suppliers} onClose={() => setEditingPrf(null)} onSubmit={handleRefileSubmit} currentUserId={currentUser.id} users={allUsers} />}
            {printReq && <PRFPrintModal req={printReq} onClose={() => setPrintReq(null)} business={businesses.find(b => b.id === printReq.businessId)} requester={allUsers.find(u => u.id === printReq.requesterId)} preparedBy={allUsers.find(u => u.id === printReq.prfDetails?.preparedBy)} />}
        </div >
    );
};

export default PrfView;
