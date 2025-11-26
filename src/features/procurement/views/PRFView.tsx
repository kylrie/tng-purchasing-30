import React, { useState } from 'react';
import { Search, Plus, Printer, X, Save, Ban, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Requisition, RequisitionItem, Supplier, SupplierDetails } from '../types';
import { RequisitionStatus, hasGlobalAccess } from '../types';
import type { User, Business } from '../../../shared/types';
import { UserRole } from '../../auth/types';
import PreparePRFModal from '../components/PreparePRFModal';
import PRFPrintModal from '../components/PRFPrintModal';
import Card from '../../../shared/components/Card';
import { CounterService } from '../../../shared/services/counter.service';

interface PrfViewProps {
    currentUser: User;
    visibleRequisitions: Requisition[];
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    businesses: Business[];
    allUsers: User[];
    onCreateRequisition: (req: Omit<Requisition, 'id'>) => void;
    onUpdateRequisition: (req: Requisition) => void;
    suppliers: Supplier[];
}

const DirectPrfModal = ({ onCancel, currentUser, onCreateRequisition, onUpdate, suppliers, businesses, initialData }: {
    onCancel: () => void;
    currentUser: User;
    onCreateRequisition?: (req: Omit<Requisition, 'id'>) => void;
    onUpdate?: (req: Requisition) => void;
    suppliers: Supplier[];
    businesses: Business[];
    initialData?: Requisition;
}) => {
    const [newItems, setNewItems] = useState<RequisitionItem[]>(initialData?.items || []);
    const [tempItem, setTempItem] = useState<Partial<RequisitionItem>>({ name: '', quantity: 1, uom: 'pcs', price: 0 });
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
        initialData?.prfDetails?.supplier
            ? suppliers.find(s => s.name === initialData.prfDetails?.supplier.name)?.id || ''
            : ''
    );
    const [description, setDescription] = useState(initialData?.description || '');
    const [remarks] = useState(initialData?.remarks || '');
    const [attachmentLink, setAttachmentLink] = useState(initialData?.attachments?.[0] || '');
    const [customId, setCustomId] = useState('');

    const canSelectBusiness = [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
        UserRole.PURCHASING_OFFICER,
        UserRole.FINANCE,
        UserRole.AUDITOR
    ].includes(currentUser.role);

    const [selectedBusinessId, setSelectedBusinessId] = useState<string>(initialData?.businessId || currentUser.businessId);

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
        if (!selectedSupplierId) {
            alert("Please select a supplier.");
            return;
        }
        const sup = suppliers.find(s => s.id === selectedSupplierId);
        if (!sup) {
            alert("Please select a supplier.");
            return;
        }

        const supplierDetails: SupplierDetails = {
            name: sup.name, tin: sup.tin || '', address: sup.address || '',
            paymentMode: sup.paymentMode || '', terms: sup.terms || ''
        };

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
                                    {businesses.map(b => (
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
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Supplier</label>
                            <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}>
                                <option value="">Select Supplier</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
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
                                            <td className="px-4 py-2">₱{item.price.toLocaleString()}</td>
                                            <td className="px-4 py-2">₱{(item.quantity * item.price).toLocaleString()}</td>
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
    suppliers
}) => {
    const [isDirectOpen, setIsDirectOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('all');
    const [preparePRFReq, setPreparePRFReq] = useState<Requisition | null>(null);
    const [printReq, setPrintReq] = useState<Requisition | null>(null);
    const [editingPrf, setEditingPrf] = useState<Requisition | null>(null);

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
            const { id, ...newPrfData } = prfReq;
            onCreateRequisition(newPrfData as Omit<Requisition, 'id'>);
        }

        setPreparePRFReq(null);
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

    const filteredAndSortedReqs = visibleRequisitions
        .filter(r =>
            [RequisitionStatus.READY_FOR_PRF, RequisitionStatus.PRF_PENDING_MANAGER,
            RequisitionStatus.APPROVED_FOR_PAYMENT, RequisitionStatus.FUNDS_RELEASED,
            RequisitionStatus.REJECTED, RequisitionStatus.CANCELLED].includes(r.status)
        )
        .filter(r => r.status !== RequisitionStatus.REJECTED || r.prfDetails)
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
            {isDirectOpen && <DirectPrfModal onCancel={() => setIsDirectOpen(false)} currentUser={currentUser} onCreateRequisition={onCreateRequisition} suppliers={suppliers} businesses={businesses} />}

            {editingPrf && <DirectPrfModal onCancel={() => setEditingPrf(null)} currentUser={currentUser} onUpdate={onUpdateRequisition} suppliers={suppliers} businesses={businesses} initialData={editingPrf} />}

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">PRF Management</h1>
                    <p className="text-slate-300">Prepare, approve, and manage Purchase Requisition Forms.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            className="pl-10 p-2 border border-slate-700 rounded-lg text-sm w-64 bg-slate-800 focus:ring-purple-500"
                            placeholder="Search PRF..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
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
                    {(currentUser.role === UserRole.PURCHASING_OFFICER || hasGlobalAccess(currentUser.role)) && (
                        <button onClick={() => setIsDirectOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 font-medium">
                            <Plus size={16} /> Create PRF
                        </button>
                    )}
                </div>
            </div>

            <Card className="overflow-hidden !p-0">
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
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {filteredAndSortedReqs.map(req => {
                            const business = businesses.find(b => b.id === req.businessId);
                            const isOwner = req.prfDetails?.preparedBy === currentUser.id || currentUser.role === UserRole.SUPER_ADMIN;
                            const canEdit = req.status === RequisitionStatus.REJECTED && isOwner;

                            return (
                                <tr key={req.id} className="hover:bg-slate-800/60">
                                    <td className="px-6 py-4 font-medium text-slate-200">{req.id}</td>
                                    <td className="px-6 py-4 text-slate-300 text-xs">{business?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 text-slate-200">{req.description}</td>
                                    <td className="px-6 py-4 text-slate-400">{req.items.length} items</td>
                                    <td className="px-6 py-4 text-purple-400 text-xs">{new Date(req.dateCreated).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(req.status)}
                                        {req.status === RequisitionStatus.REJECTED && (
                                            <div className="text-[10px] text-red-400 italic mt-1 truncate w-32" title={req.remarks}>
                                                {req.remarks}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2 items-center">
                                        {/* Cancel Button for Admin/Super Admin */}
                                        {(currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN) &&
                                            req.status !== RequisitionStatus.CANCELLED &&
                                            req.status !== RequisitionStatus.REJECTED && (
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

                                        {req.status === RequisitionStatus.READY_FOR_PRF && (currentUser.role === UserRole.PURCHASING_OFFICER || hasGlobalAccess(currentUser.role)) && (
                                            <button onClick={() => setPreparePRFReq(req)} className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 font-medium">Prepare PRF</button>
                                        )}
                                        
                                        {req.prfDetails && (
                                            <button onClick={() => setPrintReq(req)} className="text-slate-400 p-1 hover:text-white"><Printer size={16} /></button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        {filteredAndSortedReqs.length === 0 && (
                            <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">No PRF found.</td></tr>
                        )}
                    </tbody>
                </table>
            </Card>

            {preparePRFReq && <PreparePRFModal requisition={preparePRFReq} suppliers={suppliers} onClose={() => setPreparePRFReq(null)} onSubmit={handlePreparePRFSubmit} currentUserId={currentUser.id} />}
            {printReq && <PRFPrintModal req={printReq} onClose={() => setPrintReq(null)} business={businesses.find(b => b.id === printReq.businessId)} requester={allUsers.find(u => u.id === printReq.requesterId)} preparedBy={allUsers.find(u => u.id === printReq.prfDetails?.preparedBy)} />}
        </div>
    );
};

export default PrfView;
