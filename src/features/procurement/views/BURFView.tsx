import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Check, Save, Link as LinkIcon, Search, AlertTriangle, Printer, Edit, RefreshCw } from 'lucide-react';
import type { Requisition, RequisitionItem } from '../types';
import { RequisitionStatus, hasGlobalAccess } from '../types';
import type { User, Business } from '../../../shared/types';
import { UserRole } from '../../auth/types';
import Card from '../../../shared/components/Card'; 
import BURFPrintModal from '../components/BURFPrintModal';
import RejectionModal from '../../../shared/components/RejectionModal';

interface BurfViewProps {
    currentUser: User;
    visibleRequisitions: Requisition[];
    allUsers: User[];
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    onCreateRequisition: (req: Omit<Requisition, 'id'>) => void;
    onUpdateRequisition: (req: Requisition) => void;
    businesses: Business[];
}

export const BurfView: React.FC<BurfViewProps> = ({
    currentUser,
    visibleRequisitions,
    allUsers,
    getStatusBadge,
    onCreateRequisition,
    onUpdateRequisition,
    businesses
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [printReq, setPrintReq] = useState<Requisition | null>(null);
    const [rejectingReq, setRejectingReq] = useState<Requisition | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('all');

    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');
    const [dateNeeded, setDateNeeded] = useState(''); 
    const [attachmentLink, setAttachmentLink] = useState('');
    const [newItems, setNewItems] = useState<RequisitionItem[]>([]);
    const [tempItem, setTempItem] = useState<Partial<RequisitionItem>>({ name: '', quantity: 1, uom: 'pcs', remarks: '' });

    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const UOM_OPTIONS = ['pcs', 'box', 'pack', 'kg', 'g', 'l', 'm', 'set', 'roll', 'pad', 'ream'];

    const isUrgent = useMemo(() => {
        if (!dateNeeded) return false;
        const today = new Date();
        const needed = new Date(dateNeeded);
        const diffTime = needed.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays < 3;
    }, [dateNeeded]);

    const filteredRequisitions = useMemo(() => {
        const userHasGlobalAccess = hasGlobalAccess(currentUser.role);

        return visibleRequisitions
            .filter(req => {
                if (userHasGlobalAccess) {
                    if (selectedBusinessUnit !== 'all' && req.businessId !== selectedBusinessUnit) {
                        return false;
                    }
                } else {
                    if (req.businessId !== currentUser.businessId) {
                        return false;
                    }
                }
                if (searchTerm) {
                    const searchLower = searchTerm.toLowerCase();
                    const requester = allUsers.find(u => u.id === req.requesterId);
                    const business = businesses.find(b => b.id === req.businessId);
                    return (
                        (req.id || '').toLowerCase().includes(searchLower) ||
                        (req.description || '').toLowerCase().includes(searchLower) ||
                        (requester?.name || '').toLowerCase().includes(searchLower) ||
                        (business?.name || '').toLowerCase().includes(searchLower)
                    );
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
        setDateNeeded('');
        setAttachmentLink('');
        setNewItems([]);
        setTempItem({ name: '', quantity: 1, uom: 'pcs', remarks: '' });
        setEditingId(null);
        setIsCreating(false);
    };

    const editRequisition = (req: Requisition) => {
        setDescription(req.description);
        setRemarks(req.remarks || '');
        setDateNeeded(req.dateNeeded || '');
        setAttachmentLink(req.attachments?.[0] || '');
        setNewItems(req.items);
        setEditingId(req.id);
        setIsCreating(true);
    };

    const addItem = () => {
        if (tempItem.name && tempItem.quantity) {
            setNewItems([...newItems, { ...tempItem, itemId: `temp-${Date.now()}` } as RequisitionItem]);
            setTempItem({ name: '', quantity: 1, uom: 'pcs', remarks: '' });
        }
    };

    const removeItem = (idx: number) => {
        setNewItems(newItems.filter((_, i) => i !== idx));
    };

    const saveRequisition = (isFinalSubmission: boolean) => {
        const status = isFinalSubmission ? RequisitionStatus.BURF_PENDING_MANAGER : RequisitionStatus.DRAFT;
        const attachments = attachmentLink ? [attachmentLink] : [];
        const baseReq: any = {
            requesterId: currentUser.id,
            businessId: currentUser.businessId,
            items: newItems,
            totalAmount: 0,
            status: status,
            dateCreated: new Date().toISOString().split('T')[0],
            description,
            remarks,
            dateNeeded,
            priority: isUrgent ? 'URGENT' : 'NORMAL',
            attachments,
            timestamp: new Date().toISOString()
        };

        if (editingId) {
            const original = visibleRequisitions.find(r => r.id === editingId);
            onUpdateRequisition({ ...original, ...baseReq, id: editingId });
        } else {
            onCreateRequisition(baseReq);
        }
        resetForm();
    };

    const updateStatus = (req: Requisition, newStatus: RequisitionStatus) => {
        onUpdateRequisition({ ...req, status: newStatus });
    };

    const handleRejectConfirm = (reason: string) => {
        if (rejectingReq) {
            const newRemarks = rejectingReq.remarks 
                ? `${rejectingReq.remarks}\n\n[REJECTED]: ${reason}` 
                : `[REJECTED]: ${reason}`;
            
            onUpdateRequisition({ ...rejectingReq, status: RequisitionStatus.REJECTED, remarks: newRemarks });
            setRejectingReq(null);
        }
    };
    
    if (isCreating) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 text-white">
                <div className="flex items-center gap-4">
                    <button onClick={resetForm} className="text-slate-300 hover:text-white text-sm font-medium">Cancel</button>
                    <h1 className="text-2xl font-bold">
                        {editingId ? 'Edit Requisition' : 'New Requisition (BURF)'}
                    </h1>
                </div>

                <Card className="!p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Description / Purpose</label>
                            <input className="w-full p-2 border border-slate-700 bg-slate-800 rounded-md" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Monthly Office Supplies" />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Date Needed</label>
                            <input 
                                type="date" 
                                className={`w-full p-2 border ${isUrgent ? 'border-orange-500' : 'border-slate-700'} bg-slate-800 rounded-md`} 
                                value={dateNeeded} 
                                onChange={e => setDateNeeded(e.target.value)} 
                            />
                            {isUrgent && (
                                <div className="flex items-center gap-1 text-orange-400 text-xs mt-1">
                                    <AlertTriangle size={12} />
                                    <span>Date is less than 3 days. Marked as URGENT.</span>
                                </div>
                            )}
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Google Drive Link (Attachments)</label>
                            <div className="flex items-center gap-2">
                                <LinkIcon size={16} className="text-slate-500" />
                                <input className="w-full p-2 border border-slate-700 bg-slate-800 rounded-md" value={attachmentLink} onChange={e => setAttachmentLink(e.target.value)} placeholder="https://drive.google.com/..." />
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Remarks</label>
                            <textarea className="w-full p-2 border border-slate-700 bg-slate-800 rounded-md" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Additional justifications..." />
                        </div>
                    </div>

                    <div className="border-t border-slate-700 pt-6">
                        <h3 className="text-lg font-medium text-white mb-4">Items Required</h3>
                        <Card className="!p-4 !bg-slate-900/70 mb-4 grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-7">
                                <label className="block text-xs font-medium text-slate-400 mb-1">Item Name</label>
                                <input className="w-full p-2 border border-slate-600 bg-slate-800 rounded-md text-sm" value={tempItem.name} onChange={e => setTempItem({ ...tempItem, name: e.target.value })} placeholder="Item description" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-400 mb-1">Qty</label>
                                <input type="number" className="w-full p-2 border border-slate-600 bg-slate-800 rounded-md text-sm" value={tempItem.quantity} onChange={e => setTempItem({ ...tempItem, quantity: parseFloat(e.target.value) })} />
                            </div>
                            <div className="col-span-3">
                                <label className="block text-xs font-medium text-slate-400 mb-1">UOM</label>
                                <select className="w-full p-2 border border-slate-600 bg-slate-800 rounded-md text-sm" value={tempItem.uom} onChange={e => setTempItem({ ...tempItem, uom: e.target.value })}>
                                    {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div className="col-span-12 mt-2">
                                <button type="button" onClick={addItem} disabled={!tempItem.name || !tempItem.quantity} className="w-full h-[38px] bg-purple-600 text-white rounded-md hover:bg-purple-700 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed gap-2"><Plus size={16} /> Add Item</button>
                            </div>
                        </Card>

                        {newItems.length > 0 && (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-900/50 text-xs text-slate-400">
                                    <tr>
                                        <th className="px-4 py-2">Item</th>
                                        <th className="px-4 py-2">Qty</th>
                                        <th className="px-4 py-2">Remarks</th>
                                        <th className="px-4 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {newItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-2 font-medium text-slate-200">{item.name}</td>
                                            <td className="px-4 py-2 text-slate-300">{item.quantity} {item.uom}</td>
                                            <td className="px-4 py-2 text-slate-400">{item.remarks}</td>
                                            <td className="px-4 py-2"><button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                        <button onClick={resetForm} className="px-6 py-2 text-slate-300 font-medium hover:bg-slate-700 rounded-lg">Cancel</button>
                        <button onClick={() => saveRequisition(false)} disabled={newItems.length === 0 || !description || !dateNeeded} className="px-6 py-2 border border-purple-500 text-purple-400 font-medium rounded-lg hover:bg-purple-900/50 flex items-center gap-2 disabled:opacity-50">
                            <Save size={18} /> Save as Draft
                        </button>
                        <button onClick={() => saveRequisition(true)} disabled={newItems.length === 0 || !description || !dateNeeded} className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                            <Check size={18} /> {editingId ? 'Re-Submit' : 'Submit Final'}
                        </button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-white">
            <div className="flex justify-between items-center print:hidden">
                <div>
                    <h1 className="text-2xl font-bold">Requisitions (BURF)</h1>
                    <p className="text-sm text-slate-300">Manage initial requests and Business Unit approvals.</p>
                </div>
                <div className="flex gap-2">
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search requisitions..."
                            className="pl-10 pr-4 py-2 border border-slate-700 rounded-lg text-sm bg-slate-800 w-64 focus:ring-2 focus:ring-purple-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {hasGlobalAccess(currentUser.role) && (
                        <select
                            value={selectedBusinessUnit}
                            onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                            className="px-4 py-2 border border-slate-700 rounded-lg text-sm bg-slate-800 focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="all">All Business Units</option>
                            {businesses.map(business => (
                                <option key={business.id} value={business.id}>{business.name}</option>
                            ))}
                        </select>
                    )}
                    <button onClick={() => setIsCreating(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-purple-700 font-medium flex items-center gap-2">
                        <Plus size={18} /> New Request
                    </button>
                </div>
            </div>

            <Card className="overflow-hidden !p-0">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
                        <tr>
                            <th className="px-6 py-4 w-10"></th>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Business Unit</th>
                            <th className="px-6 py-4">Requested By</th>
                            <th className="px-6 py-4">Date Needed</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {filteredRequisitions.map(req => {
                            const requester = allUsers.find(u => u.id === req.requesterId);
                            const business = businesses.find(b => b.id === req.businessId);
                            const isOwner = req.requesterId === currentUser.id;
                            const canEdit = (isOwner && (req.status === RequisitionStatus.DRAFT || req.status === RequisitionStatus.REJECTED));

                            return (
                                <React.Fragment key={req.id}>
                                    <tr className="hover:bg-slate-800/60 cursor-pointer" onClick={() => toggleRow(req.id)}>
                                        <td className="px-6 py-4 text-slate-500">
                                            {expandedRows[req.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-200">{req.id}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-200">{req.description}</div>
                                            <div className="text-xs text-slate-400">{req.items.length} items</div>
                                            {req.priority === 'URGENT' && (
                                                <span className="text-[10px] text-orange-400 font-bold border border-orange-400 px-1 rounded">URGENT</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-300 font-medium text-xs">{business?.name || 'N/A'}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                                    {(requester?.name || '?').charAt(0)}
                                                </div>
                                                <span className="text-slate-200">{requester?.name || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300 text-xs">
                                            {req.dateNeeded ? new Date(req.dateNeeded).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 cursor-pointer hover:opacity-80" onClick={(e) => { e.stopPropagation(); /* setTrackingReq(req) */ }}>
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-end gap-2 items-center">
                                                <button onClick={() => setPrintReq(req)} className="text-slate-400 hover:text-white p-1" title="Print BURF">
                                                    <Printer size={16} />
                                                </button>

                                                {canEdit && (
                                                    <button 
                                                        onClick={() => editRequisition(req)} 
                                                        className="text-blue-400 hover:text-blue-300 p-1"
                                                        title={req.status === RequisitionStatus.REJECTED ? "Re-file" : "Edit"}
                                                    >
                                                        {req.status === RequisitionStatus.REJECTED ? <RefreshCw size={16} /> : <Edit size={16} />}
                                                    </button>
                                                )}

                                                {req.status === RequisitionStatus.BURF_PENDING_MANAGER && (currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.SUPER_ADMIN) && (
                                                     <>
                                                        <button onClick={() => setRejectingReq(req)} className="text-red-400 hover:text-red-300 text-xs font-medium px-2 py-1 border border-red-500/50 rounded">Reject</button>
                                                        <button onClick={() => updateStatus(req, RequisitionStatus.BURF_PENDING_CIC)} className="text-green-400 hover:text-green-300 text-xs font-medium px-2 py-1 border border-green-500/50 rounded">Approve</button>
                                                     </>
                                                )}
                                                
                                                {req.status === RequisitionStatus.BURF_PENDING_CIC && (currentUser.role === UserRole.CIC || currentUser.role === UserRole.SUPER_ADMIN) && (
                                                     <button onClick={() => updateStatus(req, RequisitionStatus.READY_FOR_PRF)} className="text-emerald-400 hover:text-emerald-300 text-xs font-medium px-2 py-1 border border-emerald-500/50 rounded">Verify & Proceed</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedRows[req.id] && (
                                        <tr className="bg-slate-900/50">
                                            <td colSpan={8} className="p-4">
                                                 <div className="p-4 bg-slate-800 rounded-lg">
                                                    <h4 className="text-sm font-bold text-white mb-2">Item Details</h4>
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="text-slate-500 border-b border-slate-700">
                                                            <tr>
                                                                <th className="pb-2">Item</th>
                                                                <th className="pb-2">Qty</th>
                                                                <th className="pb-2">UOM</th>
                                                                <th className="pb-2">Remarks</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-700/50">
                                                            {req.items.map((item, idx) => (
                                                                <tr key={idx}>
                                                                    <td className="py-2 text-slate-300">{item.name}</td>
                                                                    <td className="py-2 text-slate-400">{item.quantity}</td>
                                                                    <td className="py-2 text-slate-400">{item.uom}</td>
                                                                    <td className="py-2 text-slate-500">{item.remarks || '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {req.remarks && (
                                                        <div className="mt-4 text-xs text-slate-400">
                                                            <span className="font-bold text-slate-300">Remarks:</span> {req.remarks}
                                                        </div>
                                                    )}
                                                 </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                         {filteredRequisitions.length === 0 && (
                            <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400 italic">No requisitions found.</td></tr>
                        )}
                    </tbody>
                </table>
            </Card>

            {printReq && <BURFPrintModal req={printReq} onClose={() => setPrintReq(null)} business={businesses.find(b => b.id === printReq.businessId)} requester={allUsers.find(u => u.id === printReq.requesterId)} />}
            
            <RejectionModal 
                isOpen={!!rejectingReq} 
                onClose={() => setRejectingReq(null)} 
                onConfirm={handleRejectConfirm}
                title="Reject BURF Requisition"
            />
        </div>
    );
};

export default BurfView;
