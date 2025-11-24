import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, X, Check, Save, Edit2, Printer, Link as LinkIcon, Search } from 'lucide-react';
import BURFPrintModal from '../components/BURFPrintModal';
import type { Requisition, RequisitionItem, RequisitionHistory } from '../types';
import { RequisitionStatus, hasGlobalAccess } from '../types';
import type { User, Business } from '../../../shared/types';
import { UserRole } from '../../auth/types';

interface BurfViewProps {
    currentUser: User;
    requisitions: Requisition[];
    setRequisitions: React.Dispatch<React.SetStateAction<Requisition[]>>;
    visibleRequisitions: Requisition[];
    allUsers: User[];
    handleReject: (id: string, comment?: string) => void;
    handleManagerApproveBURF: (id: string, comment?: string) => void;
    handleCICApproveBURF: (id: string, comment?: string) => void;
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    onCreateRequisition?: (req: Requisition) => void;
    onUpdateRequisition?: (req: Requisition) => void;
    businesses: Business[];
}

const TrackingModal = ({ req, onClose }: { req: Requisition; onClose: () => void }) => {
    // Combine real history with the creation event if history is empty or sparse
    const history: RequisitionHistory[] = req.history && req.history.length > 0
        ? req.history
        : [{
            date: req.dateCreated,
            actorId: req.requesterId,
            actorName: 'Requester',
            action: 'CREATED',
            stage: RequisitionStatus.DRAFT
        }];

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:hidden">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Requisition History</h3>
                        <p className="text-xs text-slate-500">ID: {req.id}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                    {history.map((step, idx) => (
                        <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className={`flex items-center justify-center w-5 h-5 rounded-full border border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${step.action.includes('REJECTED') ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
                                <div className="w-2 h-2 bg-current rounded-full" />
                            </div>
                            <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1rem)] p-4 rounded border border-slate-200 bg-white shadow-sm">
                                <div className="flex items-center justify-between space-x-2 mb-1">
                                    <div className="font-bold text-slate-900 text-sm">{step.action}</div>
                                    <time className="font-mono italic text-[10px] text-slate-500">{new Date(step.date).toLocaleDateString()}</time>
                                </div>
                                <div className="text-xs text-slate-600 mb-1">by <span className="font-medium">{step.actorName || step.actorId}</span></div>
                                {step.comments && (
                                    <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-700 italic border border-slate-100">
                                        "{step.comments}"
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-medium">Close</button>
                </div>
            </div>
        </div>
    );
};

export const BurfView: React.FC<BurfViewProps> = ({
    currentUser,
    requisitions,
    setRequisitions,
    visibleRequisitions,
    allUsers,
    handleReject,
    handleManagerApproveBURF,
    handleCICApproveBURF,
    getStatusBadge,
    onCreateRequisition,
    onUpdateRequisition,
    businesses
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [printReq, setPrintReq] = useState<Requisition | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('all');

    // Requisition Form State
    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');
    const [attachmentLink, setAttachmentLink] = useState(''); // New: Single link input for simplicity in this demo
    const [newItems, setNewItems] = useState<RequisitionItem[]>([]);
    const [tempItem, setTempItem] = useState<Partial<RequisitionItem>>({ name: '', quantity: 1, uom: 'pcs', remarks: '' });

    // Collapsible state
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    // Modal States
    const [trackingReq, setTrackingReq] = useState<Requisition | null>(null);
    const [actionModal, setActionModal] = useState<{ id: string, type: 'APPROVE' | 'REJECT', role: 'MANAGER' | 'CIC' } | null>(null);
    const [actionComment, setActionComment] = useState('');

    const UOM_OPTIONS = ['pcs', 'box', 'pack', 'kg', 'g', 'l', 'm', 'set', 'roll', 'pad', 'ream'];

    // Filter requisitions based on role and business unit
    const filteredRequisitions = useMemo(() => {
        const userHasGlobalAccess = hasGlobalAccess(currentUser.role);

        return visibleRequisitions
            .filter(req => {
                // Business unit filtering based on role
                if (userHasGlobalAccess) {
                    // Global users can filter by selected business unit
                    if (selectedBusinessUnit !== 'all' && req.businessId !== selectedBusinessUnit) {
                        return false;
                    }
                } else {
                    // Restricted users only see their business unit
                    if (req.businessId !== currentUser.businessId) {
                        return false;
                    }
                }

                // Search term filtering
                if (searchTerm) {
                    const searchLower = searchTerm.toLowerCase();
                    const requester = allUsers.find(u => u.id === req.requesterId);
                    const business = businesses.find(b => b.id === req.businessId);

                    const matches = (
                        (req.id || '').toLowerCase().includes(searchLower) ||
                        (req.description || '').toLowerCase().includes(searchLower) ||
                        (requester?.name || '').toLowerCase().includes(searchLower) ||
                        (business?.name || '').toLowerCase().includes(searchLower)
                    );

                    if (!matches) return false;
                }

                return true;
            });
    }, [visibleRequisitions, searchTerm, allUsers, businesses, currentUser.role, currentUser.businessId, selectedBusinessUnit]);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const resetForm = () => {
        setDescription('');
        setRemarks('');
        setAttachmentLink('');
        setNewItems([]);
        setTempItem({ name: '', quantity: 1, uom: 'pcs', remarks: '' });
        setEditingId(null);
        setIsCreating(false);
    };

    const handleEditDraft = (req: Requisition) => {
        setEditingId(req.id);
        setDescription(req.description);
        setRemarks(req.remarks || '');
        setAttachmentLink(req.attachments?.[0] || '');
        setNewItems(req.items);
        setIsCreating(true);
    };

    const addItem = () => {
        if (tempItem.name && tempItem.quantity) {
            setNewItems([...newItems, {
                itemId: `temp-${Date.now()}`,
                name: tempItem.name,
                quantity: tempItem.quantity,
                uom: tempItem.uom || 'pcs',
                stockOnHand: 0,
                price: 0, // Default to 0 since we removed estimation
                remarks: tempItem.remarks
            } as RequisitionItem]);
            setTempItem({ name: '', quantity: 1, uom: 'pcs', remarks: '' });
        }
    };

    const removeItem = (idx: number) => {
        setNewItems(newItems.filter((_, i) => i !== idx));
    };

    const saveRequisition = (isFinalSubmission: boolean) => {
        const status = isFinalSubmission ? RequisitionStatus.BURF_PENDING_MANAGER : RequisitionStatus.DRAFT;

        const attachments = attachmentLink ? [attachmentLink] : [];

        const baseReq = {
            requesterId: currentUser.id,
            businessId: currentUser.businessId,
            items: newItems,
            totalAmount: 0, // No initial amount estimation
            status: status,
            dateCreated: new Date().toISOString().split('T')[0],
            description,
            remarks,
            attachments
        };

        if (editingId) {
            if (onUpdateRequisition) {
                const updatedReq = { ...baseReq, id: editingId } as Requisition;
                onUpdateRequisition(updatedReq);
            }
        } else {
            const newReq = {
                ...baseReq,
                id: `REQ-${Math.floor(1000 + Math.random() * 9000)}`
            } as Requisition;

            if (onCreateRequisition) {
                onCreateRequisition(newReq);
            } else {
                setRequisitions([newReq, ...requisitions]);
            }
        }
        resetForm();
    };

    const confirmAction = () => {
        if (!actionModal) return;
        const { id, type, role } = actionModal;

        if (type === 'REJECT') {
            handleReject(id, actionComment);
        } else {
            // Approve
            if (role === 'MANAGER') handleManagerApproveBURF(id, actionComment);
            if (role === 'CIC') handleCICApproveBURF(id, actionComment);
        }
        setActionModal(null);
        setActionComment('');
    };

    const openActionModal = (id: string, type: 'APPROVE' | 'REJECT', role: 'MANAGER' | 'CIC') => {
        setActionModal({ id, type, role });
        setActionComment('');
    };

    if (isCreating) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-4">
                    <button onClick={resetForm} className="text-slate-500 hover:text-slate-800 text-sm font-medium">Cancel</button>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {editingId ? 'Edit Requisition (Draft)' : 'New Requisition (BURF)'}
                    </h1>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Description / Purpose</label>
                            <input className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded-md" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Monthly Office Supplies" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Google Drive Link (Attachments)</label>
                            <div className="flex items-center gap-2">
                                <LinkIcon size={16} className="text-slate-400" />
                                <input className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded-md" value={attachmentLink} onChange={e => setAttachmentLink(e.target.value)} placeholder="https://drive.google.com/..." />
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                            <textarea className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded-md" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Additional justifications..." />
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-6">
                        <h3 className="text-lg font-medium text-slate-900 mb-4">Items Required</h3>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-7">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Item Name</label>
                                <input className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded-md text-sm" value={tempItem.name} onChange={e => setTempItem({ ...tempItem, name: e.target.value })} placeholder="Item description" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>
                                <input type="number" className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded-md text-sm" value={tempItem.quantity} onChange={e => setTempItem({ ...tempItem, quantity: parseFloat(e.target.value) })} />
                            </div>
                            <div className="col-span-3">
                                <label className="block text-xs font-medium text-slate-500 mb-1">UOM</label>
                                <select className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded-md text-sm" value={tempItem.uom} onChange={e => setTempItem({ ...tempItem, uom: e.target.value })}>
                                    {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div className="col-span-12 mt-2">
                                <button type="button" onClick={addItem} disabled={!tempItem.name || !tempItem.quantity} className="w-full h-[38px] bg-slate-900 text-white rounded-md hover:bg-slate-800 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed gap-2"><Plus size={16} /> Add Item</button>
                            </div>
                        </div>

                        {newItems.length > 0 && (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-xs text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2">Item</th>
                                        <th className="px-4 py-2">Qty</th>
                                        <th className="px-4 py-2">Remarks</th>
                                        <th className="px-4 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {newItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-2 font-medium">{item.name}</td>
                                            <td className="px-4 py-2">{item.quantity} {item.uom}</td>
                                            <td className="px-4 py-2 text-slate-500">{item.remarks}</td>
                                            <td className="px-4 py-2"><button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button onClick={resetForm} className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button onClick={() => saveRequisition(false)} disabled={newItems.length === 0 || !description} className="px-6 py-2 border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 flex items-center gap-2 disabled:opacity-50">
                            <Save size={18} /> Save as Draft
                        </button>
                        <button onClick={() => saveRequisition(true)} disabled={newItems.length === 0 || !description} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                            <Check size={18} /> Submit Final
                        </button>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="space-y-6 relative">
            {trackingReq && <TrackingModal req={trackingReq} onClose={() => setTrackingReq(null)} />}

            {printReq && (
                <BURFPrintModal
                    req={printReq}
                    onClose={() => setPrintReq(null)}
                    business={businesses.find(b => b.id === printReq.businessId)}
                    requester={allUsers.find(u => u.id === printReq.requesterId)}
                />
            )}

            {actionModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">
                            {actionModal.type === 'APPROVE' ? 'Confirm Approval' : 'Reject Requisition'}
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            {actionModal.type === 'APPROVE'
                                ? "Are you sure you want to approve this requisition? You can add an optional comment."
                                : "Please provide a reason for rejection."}
                        </p>
                        <textarea
                            className="w-full p-2 border border-slate-300 rounded mb-4 text-sm"
                            rows={3}
                            placeholder={actionModal.type === 'APPROVE' ? "Optional comments..." : "Reason for rejection (Required)..."}
                            value={actionComment}
                            onChange={e => setActionComment(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setActionModal(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                            <button
                                onClick={confirmAction}
                                disabled={actionModal.type === 'REJECT' && !actionComment.trim()}
                                className={`px-4 py-2 rounded text-white font-medium ${actionModal.type === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}
                            >
                                {actionModal.type === 'APPROVE' ? 'Approve' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Requisitions (BURF)</h1>
                    <p className="text-sm text-slate-500">Manage initial requests and Business Unit approvals.</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search requisitions..."
                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* Business Unit Filter - Only visible for global roles */}
                    {hasGlobalAccess(currentUser.role) && (
                        <select
                            value={selectedBusinessUnit}
                            onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="all">All Business Units</option>
                            {businesses.map(business => (
                                <option key={business.id} value={business.id}>{business.name}</option>
                            ))}
                        </select>
                    )}
                    <button onClick={() => setIsCreating(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700 font-medium flex items-center gap-2">
                        <Plus size={18} /> New Request
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                        <tr>
                            <th className="px-6 py-4 w-10 print:hidden"></th>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Business Unit</th>
                            <th className="px-6 py-4">Requested By</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right print:hidden">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredRequisitions.map(req => {
                            const requester = allUsers.find(u => u.id === req.requesterId);
                            const business = businesses.find(b => b.id === req.businessId);
                            return (
                                <React.Fragment key={req.id}>
                                    <tr className="hover:bg-slate-50 cursor-pointer print:hover:bg-white" onClick={() => toggleRow(req.id)}>
                                        <td className="px-6 py-4 text-slate-400 print:hidden">
                                            {expandedRows[req.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900">{req.id}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{req.description}</div>
                                            <div className="text-xs text-slate-500">
                                                {req.items.length} items
                                            </div>
                                            {req.attachments && req.attachments.length > 0 && (
                                                <div className="flex items-center gap-1 mt-1 text-blue-600 print:hidden">
                                                    <LinkIcon size={10} /> <span className="text-[10px]">Has Attachments</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700 font-medium text-xs">
                                            {business?.name || requester?.department || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 print:hidden">
                                                    {requester?.name.charAt(0)}
                                                </div>
                                                <span>{requester?.name}</span>
                                            </div>
                                        </td>
                                        <td
                                            className="px-6 py-4 text-blue-600 hover:underline cursor-pointer print:text-slate-900 print:no-underline"
                                            onClick={(e) => { e.stopPropagation(); setTrackingReq(req); }}
                                        >
                                            {req.dateCreated}
                                        </td>
                                        <td
                                            className="px-6 py-4 cursor-pointer hover:opacity-80 print:cursor-default print:opacity-100"
                                            onClick={(e) => { e.stopPropagation(); setTrackingReq(req); }}
                                        >
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="px-6 py-4 text-right print:hidden" onClick={e => e.stopPropagation()}>

                                            {/* Draft Actions */}
                                            {req.status === RequisitionStatus.DRAFT && (currentUser.id === req.requesterId || currentUser.role === UserRole.SUPER_ADMIN) && (
                                                <button onClick={() => handleEditDraft(req)} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 ml-auto">
                                                    <Edit2 size={14} /> Edit Draft
                                                </button>
                                            )}

                                            {/* Manager Actions (Or Super Admin) */}
                                            {((currentUser.role === UserRole.MANAGER && req.status === RequisitionStatus.BURF_PENDING_MANAGER) ||
                                                (currentUser.role === UserRole.SUPER_ADMIN && req.status === RequisitionStatus.BURF_PENDING_MANAGER)) && (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => openActionModal(req.id, 'REJECT', 'MANAGER')} className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-medium hover:bg-red-100"><X size={14} /> Reject</button>
                                                        <button onClick={() => openActionModal(req.id, 'APPROVE', 'MANAGER')} className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100"><Check size={14} /> Approve</button>
                                                    </div>
                                                )}
                                            {/* CIC Actions (Or Super Admin) */}
                                            {((currentUser.role === UserRole.CIC && req.status === RequisitionStatus.BURF_PENDING_CIC) ||
                                                (currentUser.role === UserRole.SUPER_ADMIN && req.status === RequisitionStatus.BURF_PENDING_CIC)) && (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => openActionModal(req.id, 'REJECT', 'CIC')} className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-medium hover:bg-red-100"><X size={14} /> Reject</button>
                                                        <button onClick={() => openActionModal(req.id, 'APPROVE', 'CIC')} className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100"><Check size={14} /> Approve</button>
                                                    </div>
                                                )}
                                            {!((currentUser.role === UserRole.MANAGER && req.status === RequisitionStatus.BURF_PENDING_MANAGER) ||
                                                (currentUser.role === UserRole.CIC && req.status === RequisitionStatus.BURF_PENDING_CIC) ||
                                                (currentUser.role === UserRole.SUPER_ADMIN && [RequisitionStatus.BURF_PENDING_MANAGER, RequisitionStatus.BURF_PENDING_CIC].includes(req.status)) ||
                                                (req.status === RequisitionStatus.DRAFT && (currentUser.id === req.requesterId || currentUser.role === UserRole.SUPER_ADMIN))) && (
                                                    <div className="flex justify-end">
                                                        <button
                                                            onClick={() => setPrintReq(req)}
                                                            className="text-slate-500 hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                                                            title="Print Preview"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                        </td>
                                    </tr>
                                    {expandedRows[req.id] && (
                                        <tr className="bg-slate-50 print:bg-white">
                                            <td colSpan={8} className="px-6 py-4">
                                                <div className="ml-10">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Item Details</h4>
                                                        {req.attachments && req.attachments.length > 0 && (
                                                            <div className="mb-2">
                                                                <h4 className="text-xs font-bold text-slate-500 uppercase">Attachments</h4>
                                                                {req.attachments.map((link, i) => (
                                                                    <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block truncate max-w-[200px]">{link}</a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <table className="w-full text-xs text-slate-600">
                                                        <thead>
                                                            <tr>
                                                                <th className="text-left py-1 font-medium">Item Name</th>
                                                                <th className="text-left py-1 font-medium">Qty</th>
                                                                <th className="text-left py-1 font-medium">UOM</th>
                                                                <th className="text-left py-1 font-medium">Remarks</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {req.items.map((item, i) => (
                                                                <tr key={i}>
                                                                    <td className="py-1">{item.name}</td>
                                                                    <td className="py-1">{item.quantity}</td>
                                                                    <td className="py-1">{item.uom}</td>
                                                                    <td className="py-1 italic">{item.remarks || '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>

                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                        {filteredRequisitions.length === 0 && (
                            <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-500 italic">No requisitions found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BurfView;
