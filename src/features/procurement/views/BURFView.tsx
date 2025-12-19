import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Check, Save, Link as LinkIcon, Search, AlertTriangle, Printer, Edit, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Paperclip, Loader2, ArrowRightCircle } from 'lucide-react';
import type { Requisition, RequisitionItem } from '../types';
import { RequisitionStatus, isSuperAdmin } from '../types';
import type { User, Business } from '../../../shared/types';
import { usePermissions } from '../../../hooks/usePermissions';
import Card from '../../../shared/components/Card';
import BURFPrintModal from '../components/BURFPrintModal';
import RequisitionDrawer from '../../../shared/components/RequisitionDrawer';
import { CounterService } from '../../../shared/services/counter.service';
import { executeWorkflowAction } from '../services/workflowService';
// FIX C6: Import sanitization utility to prevent XSS/injection
import { sanitizeText, sanitizeItems } from '../../../shared/utils/sanitize';

interface BurfViewProps {
    currentUser: User;
    visibleRequisitions: Requisition[];
    allUsers: User[];
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    onCreateRequisition: (req: Omit<Requisition, 'id'>) => void;
    onUpdateRequisition: (req: Requisition) => void;
    businesses: Business[];
    uomOptions: string[];
}

type SortField = 'id' | 'description' | 'businessId' | 'requesterId' | 'dateNeeded' | 'status';
type SortDirection = 'asc' | 'desc';

export const BurfView: React.FC<BurfViewProps> = ({
    currentUser,
    visibleRequisitions,
    allUsers,
    getStatusBadge,
    onCreateRequisition,
    onUpdateRequisition,
    businesses,
    uomOptions
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [printReq, setPrintReq] = useState<Requisition | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('all');
    const { hasPermission } = usePermissions();

    // Sorting state
    const [sortField, setSortField] = useState<SortField>('id');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');
    const [dateNeeded, setDateNeeded] = useState('');
    const [attachmentLink, setAttachmentLink] = useState('');
    const [newItems, setNewItems] = useState<RequisitionItem[]>([]);
    const [tempItem, setTempItem] = useState<Partial<RequisitionItem>>({ name: '', quantity: 1, uom: 'pcs', remarks: '' });

    const [selectedBurf, setSelectedBurf] = useState<Requisition | null>(null);
    // FIX L2: Added error state to replace browser alert() with inline messages
    const [saveError, setSaveError] = useState<string | null>(null);
    // Submission loading state to prevent double-clicks
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Tab state for Active vs Completed
    const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

    const isUrgent = useMemo(() => {
        if (!dateNeeded) return false;
        const today = new Date();
        const needed = new Date(dateNeeded);
        const diffTime = needed.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays < 5;
    }, [dateNeeded]);

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

    const filteredRequisitions = useMemo(() => {
        const userHasGlobalAccess = hasPermission('requisition:view:all');

        const filtered = visibleRequisitions
            .filter(req => {
                // FIX: Only show root BURF records in BURF view
                // - ID must start with "BURF-" (excludes PRF-xxxx, etc.)
                // - ID must NOT contain "-Batch" (excludes child batch records like BURF-0019-Batch01)
                if (!req.id.startsWith('BURF-') || req.id.includes('-Batch')) {
                    return false;
                }

                // Filter out specific statuses as requested
                if ([
                    RequisitionStatus.FUNDS_RELEASED,
                    RequisitionStatus.LIQUIDATION_FILED,
                    RequisitionStatus.LIQUIDATION_REJECTED,
                    RequisitionStatus.AUDITED_CLEARED
                ].includes(req.status)) {
                    return false;
                }

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

        // Secondary sort: prioritize URGENT items first, then apply user-selected sort
        return filtered.sort((a, b) => {
            // First, prioritize urgent items at the top
            const aIsUrgent = a.priority === 'URGENT' ? 1 : 0;
            const bIsUrgent = b.priority === 'URGENT' ? 1 : 0;
            if (bIsUrgent !== aIsUrgent) {
                return bIsUrgent - aIsUrgent; // Urgent items first
            }

            // Then apply user-selected sort
            let aValue: any = a[sortField];
            let bValue: any = b[sortField];

            if (sortField === 'businessId') {
                aValue = businesses.find(biz => biz.id === a.businessId)?.name || '';
                bValue = businesses.find(biz => biz.id === b.businessId)?.name || '';
            } else if (sortField === 'requesterId') {
                aValue = allUsers.find(u => u.id === a.requesterId)?.name || '';
                bValue = allUsers.find(u => u.id === b.requesterId)?.name || '';
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [visibleRequisitions, searchTerm, allUsers, businesses, currentUser.role, currentUser.businessId, selectedBusinessUnit, sortField, sortDirection, hasPermission]);

    // Tab-based filtering: Active vs Completed
    const tabbedRequisitions = useMemo(() => {
        return filteredRequisitions.filter(req => {
            if (activeTab === 'active') {
                return req.status !== RequisitionStatus.BURF_COMPLETED;
            }
            if (activeTab === 'completed') {
                return req.status === RequisitionStatus.BURF_COMPLETED;
            }
            return true;
        });
    }, [filteredRequisitions, activeTab]);

    // Count for badge display
    const activeCount = filteredRequisitions.filter(r => r.status !== RequisitionStatus.BURF_COMPLETED).length;
    const completedCount = filteredRequisitions.filter(r => r.status === RequisitionStatus.BURF_COMPLETED).length;

    const openDrawer = (req: Requisition) => {
        setSelectedBurf(req);
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
        setAttachmentLink(req.externalLink || req.attachments?.[0] || '');
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

    const saveRequisition = async (isFinalSubmission: boolean) => {
        // Prevent duplicate submissions
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const status = isFinalSubmission ? RequisitionStatus.BURF_PENDING_MANAGER : RequisitionStatus.DRAFT;
            const attachments = attachmentLink ? [attachmentLink] : [];

            let reqId = editingId;
            if (!reqId) {
                reqId = await CounterService.generateBURFId();
            }

            // FIX C6: Sanitize all user-generated content before saving to Firestore
            const nowISO = new Date().toISOString();
            const baseReq: any = {
                id: reqId,
                requesterId: currentUser.id,
                // Denormalized user info - stored directly for fast reading without lookups
                requesterName: currentUser.name,
                requesterPhotoUrl: currentUser.avatar || '',
                businessId: currentUser.businessId,
                externalLink: attachmentLink || undefined, // Store as dedicated field
                items: sanitizeItems(newItems), // Sanitize item names and remarks
                totalAmount: 0,
                status: status,
                dateCreated: nowISO.split('T')[0],
                description: sanitizeText(description), // Sanitize user input
                remarks: sanitizeText(remarks), // Sanitize user input
                dateNeeded,
                isUrgent, // Persist urgency flag for querying/filtering
                priority: isUrgent ? 'URGENT' : 'NORMAL',
                attachments,
                timestamp: nowISO,
                // Add initial history entry for creation
                history: [{
                    date: nowISO.split('T')[0],
                    timestamp: nowISO,
                    actorId: currentUser.id,
                    actorName: currentUser.name,
                    action: isFinalSubmission ? 'BURF Created & Submitted' : 'BURF Draft Created',
                    stage: status,
                    comments: `Created by ${currentUser.name}`
                }]
            };

            if (editingId) {
                const original = visibleRequisitions.find(r => r.id === editingId);
                onUpdateRequisition({ ...original, ...baseReq, id: editingId });
            } else {
                onCreateRequisition(baseReq);
            }
            resetForm();
        } catch (error) {
            console.error("Error saving requisition:", error);
            // FIX L2: Replaced browser alert() with error state for better UX
            setSaveError("Failed to save requisition. Please try again.");
            // Clear error after 5 seconds
            setTimeout(() => setSaveError(null), 5000);
        } finally {
            setIsSubmitting(false);
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
                                    <span>Date is less than 5 days. Marked as URGENT.</span>
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
                                    {uomOptions.map((u: string) => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div className="col-span-12 mt-2">
                                <button type="button" onClick={addItem} disabled={!tempItem.name || !tempItem.quantity} className="w-full h-[38px] bg-purple-600 text-white rounded-md hover:bg-purple-700 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed gap-2"><Plus size={16} /> Add Item</button>
                            </div>
                        </Card>

                        {newItems.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-900/80 text-xs text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
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
                            </div>
                        )}
                    </div>

                    {/* FIX L2: Inline error display replacing browser alert() */}
                    {saveError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                            <AlertTriangle size={16} />
                            {saveError}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                        <button onClick={resetForm} className="px-6 py-2 text-slate-300 font-medium hover:bg-slate-700 rounded-lg">Cancel</button>
                        <button
                            onClick={() => saveRequisition(false)}
                            disabled={newItems.length === 0 || !description || !dateNeeded || isSubmitting}
                            className="px-6 py-2 border border-purple-500 text-purple-400 font-medium rounded-lg hover:bg-purple-900/50 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {isSubmitting ? 'Saving...' : 'Save as Draft'}
                        </button>
                        <button
                            onClick={() => saveRequisition(true)}
                            disabled={newItems.length === 0 || !description || !dateNeeded || isSubmitting}
                            className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                            {isSubmitting ? 'Processing...' : (editingId ? 'Re-Submit' : 'Submit Final')}
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
                    <h1 className="text-2xl font-bold">BURF Management</h1>
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
                    <button onClick={() => setIsCreating(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-purple-700 font-medium flex items-center gap-2">
                        <Plus size={18} /> New Request
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 border-b border-slate-700">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${activeTab === 'active'
                        ? 'text-purple-400 border-b-2 border-purple-500 -mb-px'
                        : 'text-slate-400 hover:text-slate-200'
                        }`}
                >
                    Active Requests
                    {activeCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-full">
                            {activeCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${activeTab === 'completed'
                        ? 'text-sky-400 border-b-2 border-sky-500 -mb-px'
                        : 'text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <ArrowRightCircle size={14} />
                    Converted to PRF
                    {completedCount > 0 && (
                        <span className="ml-1 px-2 py-0.5 text-xs bg-sky-500/20 text-sky-300 rounded-full">
                            {completedCount}
                        </span>
                    )}
                </button>
            </div>

            <Card className="overflow-hidden !p-0">
                <div className="max-h-[600px] overflow-y-auto">
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
                                    onClick={() => handleSort('description')}
                                >
                                    <div className="flex items-center">
                                        Description {renderSortIcon('description')}
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
                                    onClick={() => handleSort('requesterId')}
                                >
                                    <div className="flex items-center">
                                        Requested By {renderSortIcon('requesterId')}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-purple-400 transition-colors"
                                    onClick={() => handleSort('dateNeeded')}
                                >
                                    <div className="flex items-center">
                                        Date Needed {renderSortIcon('dateNeeded')}
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
                                <th className="px-6 py-4">Link</th>
                                <th className="px-6 py-4">Rejection Reason</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {tabbedRequisitions.map(req => {
                                // Use denormalized requesterName, fallback to lookup for legacy data
                                const requesterName = req.requesterName || allUsers.find(u => u.id === req.requesterId)?.name || 'Unknown';
                                const business = businesses.find(b => b.id === req.businessId);
                                const isOwner = req.requesterId === currentUser.id;
                                const canEdit = (isOwner && (req.status === RequisitionStatus.DRAFT || req.status === RequisitionStatus.REJECTED));

                                return (
                                    <tr
                                        key={req.id}
                                        className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                                        onClick={(e) => {
                                            // Don't open drawer if clicking action buttons
                                            if ((e.target as HTMLElement).closest('button, a')) return;
                                            openDrawer(req);
                                        }}
                                    >
                                        <td className="px-6 py-4 font-medium text-slate-200">{req.id}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-200">{req.description}</div>
                                            <div className="text-xs text-slate-400">{req.items.length} items</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300 font-medium text-xs">{business?.name || 'N/A'}</td>
                                        {/* FIXED: Use denormalized requesterName directly */}
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
                                        <td className="px-6 py-4 text-slate-300 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span>{req.dateNeeded ? new Date(req.dateNeeded).toLocaleDateString() : '-'}</span>
                                                {req.priority === 'URGENT' && (
                                                    <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded-full uppercase">Urgent</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 cursor-pointer hover:opacity-80" onClick={(e) => { e.stopPropagation(); /* setTrackingReq(req) */ }}>
                                            {getStatusBadge(req.status)}
                                        </td>
                                        {/* External Link - paperclip icon that opens externalLink or first attachment */}
                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
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
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {tabbedRequisitions.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center">
                                        {activeTab === 'completed' ? (
                                            <div className="flex flex-col items-center gap-2 text-slate-500">
                                                <ArrowRightCircle size={32} className="text-slate-600" />
                                                <p className="text-sm">No BURFs converted to PRF yet.</p>
                                                <p className="text-xs">BURFs appear here once all items have been converted to PRFs.</p>
                                            </div>
                                        ) : (
                                            <p className="text-slate-400 italic">No active requisitions found.</p>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {printReq && <BURFPrintModal req={printReq} onClose={() => setPrintReq(null)} business={businesses.find(b => b.id === printReq.businessId)} requester={allUsers.find(u => u.id === printReq.requesterId)} />}

            {/* Quick Peek Drawer */}
            <RequisitionDrawer
                requisition={selectedBurf}
                isOpen={!!selectedBurf}
                onClose={() => setSelectedBurf(null)}
                variant="BURF"
                businesses={businesses}
                allUsers={allUsers}
                getStatusBadge={getStatusBadge}
                onCancel={async () => {
                    if (selectedBurf && confirm(`Are you sure you want to CANCEL ${selectedBurf.id}? This action cannot be undone.`)) {
                        try {
                            await executeWorkflowAction({
                                requisitionId: selectedBurf.id,
                                action: 'CANCEL',
                                user: {
                                    uid: currentUser.id,
                                    displayName: currentUser.name,
                                    email: currentUser.email
                                },
                                reason: 'Cancelled by SuperAdmin'
                            });
                            setSelectedBurf(null);
                        } catch (error: any) {
                            console.error('Error cancelling:', error);
                            alert(`Failed to cancel: ${error.message || 'Unknown error'}`);
                        }
                    }
                }}
                canCancel={!!selectedBurf && isSuperAdmin(currentUser.role) && selectedBurf.status !== RequisitionStatus.CANCELLED}
            />
        </div>
    );
};

export default BurfView;
