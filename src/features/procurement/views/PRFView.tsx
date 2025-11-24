import React, { useState } from 'react';
import { Search, Plus, Trash2, X, Link as LinkIcon, Check, Printer, Edit, RefreshCw } from 'lucide-react';
import type { Requisition, RequisitionItem, Supplier, SupplierDetails } from '../types';
import { RequisitionStatus } from '../types';
import type { User, Business } from '../../../shared/types';
import { UserRole } from '../../auth/types';
import PreparePRFModal from '../components/PreparePRFModal';
import PRFPrintModal from '../components/PRFPrintModal';

interface PrfViewProps {
    currentUser: User;
    visibleRequisitions: Requisition[];
    setRequisitions: React.Dispatch<React.SetStateAction<Requisition[]>>;
    requisitions: Requisition[];
    handleReject: (id: string) => void;
    handleManagerApprovePRF: (id: string) => void;
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    businesses: Business[];
    allUsers: User[];
    onCreateRequisition?: (req: Requisition) => void;
    suppliers: Supplier[];
}

const UOM_OPTIONS = [
    'pcs', 'unit', 'box', 'set', 'roll', 'pack', 'ream', 'pair',
    'meter', 'liter', 'kg', 'gram', 'bottle', 'can', 'pad', 'bundle', 'tube', 'vial'
];

const TrackingModal = ({ req, onClose }: { req: Requisition; onClose: () => void }) => {
    const history = [
        { status: 'Created', date: req.dateCreated, user: 'Requester', notes: 'Initial request created' },
    ];

    if (req.status !== RequisitionStatus.DRAFT) {
        history.push({ status: 'Submitted', date: req.dateCreated, user: 'Requester', notes: 'Submitted for approval' });
    }

    const getStepLabel = (status: RequisitionStatus) => {
        switch (status) {
            case RequisitionStatus.BURF_PENDING_MANAGER: return 'Pending Manager Approval';
            case RequisitionStatus.BURF_PENDING_CIC: return 'Pending Inventory Check';
            case RequisitionStatus.READY_FOR_PRF: return 'Ready for PRF';
            case RequisitionStatus.PRF_PENDING_MANAGER: return 'Pending Final Approval';
            case RequisitionStatus.APPROVED_FOR_PAYMENT: return 'Approved for Payment';
            case RequisitionStatus.FUNDS_RELEASED: return 'Funds Released';
            case RequisitionStatus.REJECTED: return 'Rejected';
            default: return status;
        }
    };

    if (req.status !== RequisitionStatus.DRAFT) {
        history.push({
            status: getStepLabel(req.status),
            date: new Date().toISOString().split('T')[0],
            user: 'System',
            notes: 'Current Status'
        });
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Requisition Tracking</h3>
                        <p className="text-xs text-slate-500">ID: {req.id}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                    {history.map((step, idx) => (
                        <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-blue-600 text-slate-500 group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                <div className="w-2 h-2 bg-current rounded-full" />
                            </div>
                            <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1rem)] p-4 rounded border border-slate-200 bg-white shadow-sm">
                                <div className="flex items-center justify-between space-x-2 mb-1">
                                    <div className="font-bold text-slate-900 text-sm">{step.status}</div>
                                    <time className="font-mono italic text-xs text-slate-500">{new Date(step.date).toLocaleDateString()}</time>
                                </div>
                                <div className="text-xs text-slate-500">{step.notes}</div>
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

const DirectPrfModal = ({ onCancel, currentUser, requisitions, setRequisitions, onCreateRequisition, suppliers }: {
    onCancel: () => void;
    currentUser: User;
    requisitions: Requisition[];
    setRequisitions: React.Dispatch<React.SetStateAction<Requisition[]>>;
    onCreateRequisition?: (req: Requisition) => void;
    suppliers: Supplier[];
}) => {
    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');
    const [attachmentLink, setAttachmentLink] = useState('');
    const [newItems, setNewItems] = useState<RequisitionItem[]>([]);
    const [tempItem, setTempItem] = useState<Partial<RequisitionItem>>({ name: '', quantity: 1, uom: 'pcs', remarks: '', price: 0 });

    // Supplier State
    const [createSupplier, setCreateSupplier] = useState(false);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [newSupplier, setNewSupplier] = useState<Partial<SupplierDetails>>({
        name: '', tin: '', address: '', paymentMode: '', terms: ''
    });

    const addItem = () => {
        if (tempItem.name && tempItem.quantity && tempItem.price !== undefined) {
            setNewItems([...newItems, {
                itemId: `temp-${Date.now()}`,
                name: tempItem.name,
                quantity: tempItem.quantity,
                uom: tempItem.uom || 'pcs',
                stockOnHand: 0,
                price: tempItem.price,
                remarks: tempItem.remarks
            } as RequisitionItem]);
            setTempItem({ name: '', quantity: 1, uom: 'pcs', remarks: '', price: 0 });
        }
    };

    const removeItem = (idx: number) => {
        setNewItems(newItems.filter((_, i) => i !== idx));
    };

    const handleSubmit = () => {
        let supplierDetails: SupplierDetails;

        if (createSupplier) {
            supplierDetails = newSupplier as SupplierDetails;
        } else {
            const sup = suppliers.find(s => s.id === selectedSupplierId);
            if (!sup) return;
            supplierDetails = {
                name: sup.name,
                tin: sup.tin || '',
                address: sup.address || '',
                paymentMode: sup.paymentMode || '',
                terms: sup.terms || ''
            };
        }

        const newReq: Requisition = {
            id: `PRF-${Math.floor(1000 + Math.random() * 9000)}`,
            requesterId: currentUser.id,
            businessId: currentUser.businessId,
            items: newItems,
            totalAmount: newItems.reduce((sum, item) => sum + (item.quantity * item.price), 0),
            status: RequisitionStatus.PRF_PENDING_MANAGER,
            dateCreated: new Date().toISOString().split('T')[0],
            description,
            remarks,
            attachments: attachmentLink ? [attachmentLink] : [],
            prfDetails: {
                supplier: supplierDetails,
                preparedBy: currentUser.id,
                datePrepared: new Date().toISOString().split('T')[0]
            }
        };

        if (onCreateRequisition) {
            onCreateRequisition(newReq);
        } else {
            setRequisitions([newReq, ...requisitions]);
        }
        onCancel();
    };

    const totalAmount = newItems.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8 animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Create Purchase Requisition (Direct)</h2>
                        <p className="text-sm text-slate-500">Create a new PRF directly without a BURF.</p>
                    </div>
                    <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* General Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Description / Purpose</label>
                            <input className="w-full p-2 border border-slate-300 rounded-md" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Urgent IT Equipment" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Google Drive Link (Attachments)</label>
                            <div className="flex items-center gap-2">
                                <LinkIcon size={16} className="text-slate-400" />
                                <input className="w-full p-2 border border-slate-300 rounded-md" value={attachmentLink} onChange={e => setAttachmentLink(e.target.value)} placeholder="https://drive.google.com/..." />
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                            <textarea className="w-full p-2 border border-slate-300 rounded-md" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Additional justifications..." />
                        </div>
                    </div>

                    {/* Supplier Info */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-medium text-slate-900">Supplier Information</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600">Create new supplier?</span>
                                <button
                                    onClick={() => setCreateSupplier(!createSupplier)}
                                    className={`w-10 h-6 rounded-full transition-colors relative ${createSupplier ? 'bg-blue-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${createSupplier ? 'left-5' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>

                        {!createSupplier ? (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Select Supplier</label>
                                <select
                                    className="w-full p-2 border border-slate-300 rounded-md"
                                    value={selectedSupplierId}
                                    onChange={e => setSelectedSupplierId(e.target.value)}
                                >
                                    <option value="">-- Choose Supplier --</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Supplier Name</label>
                                    <input className="w-full p-2 border border-slate-300 rounded-md text-sm" value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">TIN</label>
                                    <input className="w-full p-2 border border-slate-300 rounded-md text-sm" value={newSupplier.tin} onChange={e => setNewSupplier({ ...newSupplier, tin: e.target.value })} placeholder="000-000-000" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                                    <input className="w-full p-2 border border-slate-300 rounded-md text-sm" value={newSupplier.address} onChange={e => setNewSupplier({ ...newSupplier, address: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Payment Mode</label>
                                    <select className="w-full p-2 border border-slate-300 rounded-md text-sm" value={newSupplier.paymentMode} onChange={e => setNewSupplier({ ...newSupplier, paymentMode: e.target.value })}>
                                        <option value="">Select Mode</option>
                                        <option value="Check">Check</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Terms</label>
                                    <input className="w-full p-2 border border-slate-300 rounded-md text-sm" value={newSupplier.terms} onChange={e => setNewSupplier({ ...newSupplier, terms: e.target.value })} placeholder="e.g. 30 Days" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Items */}
                    <div>
                        <h3 className="font-medium text-slate-900 mb-4">Items & Costing</h3>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-4">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Item Name</label>
                                <input className="w-full p-2 border border-slate-300 rounded-md text-sm" value={tempItem.name} onChange={e => setTempItem({ ...tempItem, name: e.target.value })} placeholder="Item description" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>
                                <input type="number" className="w-full p-2 border border-slate-300 rounded-md text-sm" value={tempItem.quantity} onChange={e => setTempItem({ ...tempItem, quantity: parseFloat(e.target.value) })} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">UOM</label>
                                <select className="w-full p-2 border border-slate-300 rounded-md text-sm" value={tempItem.uom} onChange={e => setTempItem({ ...tempItem, uom: e.target.value })}>
                                    {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Unit Price</label>
                                <input type="number" className="w-full p-2 border border-slate-300 rounded-md text-sm" value={tempItem.price} onChange={e => setTempItem({ ...tempItem, price: parseFloat(e.target.value) })} />
                            </div>
                            <div className="col-span-2">
                                <button type="button" onClick={addItem} disabled={!tempItem.name || !tempItem.quantity} className="w-full h-[38px] bg-slate-900 text-white rounded-md hover:bg-slate-800 flex justify-center items-center disabled:opacity-50 gap-2"><Plus size={16} /> Add</button>
                            </div>
                        </div>

                        {newItems.length > 0 && (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-xs text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2">Item</th>
                                        <th className="px-4 py-2 text-center">Qty</th>
                                        <th className="px-4 py-2 text-right">Unit Price</th>
                                        <th className="px-4 py-2 text-right">Total</th>
                                        <th className="px-4 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {newItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-2 font-medium">{item.name}</td>
                                            <td className="px-4 py-2 text-center">{item.quantity} {item.uom}</td>
                                            <td className="px-4 py-2 text-right">₱{item.price.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right font-medium">₱{(item.quantity * item.price).toLocaleString()}</td>
                                            <td className="px-4 py-2"><button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 font-bold">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-2 text-right">Total Amount:</td>
                                        <td className="px-4 py-2 text-right text-blue-600">₱{totalAmount.toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-xl">
                    <button onClick={onCancel} className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={newItems.length === 0 || !description || (!selectedSupplierId && !createSupplier) || (createSupplier && !newSupplier.name)}
                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Check size={18} /> Create PRF
                    </button>
                </div>
            </div>
        </div>
    );
};

export const PrfView: React.FC<PrfViewProps> = ({
    currentUser,
    visibleRequisitions,
    setRequisitions,
    requisitions,
    handleReject,
    handleManagerApprovePRF,
    getStatusBadge,
    businesses,
    allUsers,
    onCreateRequisition,
    suppliers
}) => {
    const [isDirectOpen, setIsDirectOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Tracking Modal State
    const [trackingReq, setTrackingReq] = useState<Requisition | null>(null);

    // Prepare PRF Modal State (Also used for Editing)
    const [preparePRFReq, setPreparePRFReq] = useState<Requisition | null>(null);
    const [printReq, setPrintReq] = useState<Requisition | null>(null);

    // Handle PRF Submit from modal
    const handlePreparePRFSubmit = (prfReq: Requisition, updatedOrigin?: Requisition) => {
        setRequisitions(prev => {
            let nextState = [...prev];

            // 1. If we have an updated origin (split BURF), update it in the list
            if (updatedOrigin) {
                nextState = nextState.map(r => r.id === updatedOrigin.id ? updatedOrigin : r);
            }

            // 2. Handle the PRF request
            // Check if it already exists (editing) or is new (splitting)
            const exists = nextState.some(r => r.id === prfReq.id);
            
            if (exists) {
                // Update existing
                nextState = nextState.map(r => 
                    r.id === prfReq.id ? { ...prfReq, status: RequisitionStatus.PRF_PENDING_MANAGER } : r
                );
            } else {
                // Add new PRF
                nextState = [prfReq, ...nextState];
            }

            return nextState;
        });

        setPreparePRFReq(null);
        alert(updatedOrigin 
            ? `PRF ${prfReq.id} created (Split). Original request updated.` 
            : `PRF ${prfReq.id} submitted for Manager approval`
        );
    };

    // Filter and Sort
    const filteredAndSortedReqs = visibleRequisitions
        .filter(r => [RequisitionStatus.READY_FOR_PRF, RequisitionStatus.PRF_PENDING_MANAGER, RequisitionStatus.APPROVED_FOR_PAYMENT, RequisitionStatus.FUNDS_RELEASED, RequisitionStatus.REJECTED].includes(r.status))
        .filter(r => 
            // Include rejected items only if they have PRF details (meaning they were rejected at PRF stage)
            r.status !== RequisitionStatus.REJECTED || r.prfDetails
        )
        .filter(r =>
            r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.projectName || r.description).toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

    return (
        <div className="space-y-6 relative">
            {isDirectOpen && <DirectPrfModal onCancel={() => setIsDirectOpen(false)} currentUser={currentUser} requisitions={requisitions} setRequisitions={setRequisitions} onCreateRequisition={onCreateRequisition} suppliers={suppliers} />}
            {trackingReq && <TrackingModal req={trackingReq} onClose={() => setTrackingReq(null)} />}

            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">PRF Management</h1>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            className="pl-10 p-2 border border-slate-300 rounded-lg text-sm w-64"
                            placeholder="Search PRF..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {(currentUser.role === UserRole.PURCHASING_OFFICER || currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.SUPER_ADMIN) && (
                        <div className="flex gap-2">
                            <button onClick={() => setIsDirectOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700">
                                <Plus size={16} /> Create PRF
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Business Unit</th>
                            <th className="px-6 py-4">Project</th>
                            <th className="px-6 py-4">Items</th>
                            <th className="px-6 py-4">Date & Time</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredAndSortedReqs.map(req => {
                            const requester = allUsers.find(u => u.id === req.requesterId);
                            const business = businesses.find(b => b.id === req.businessId);

                            return (
                                <tr key={req.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium">{req.id}</td>
                                    <td className="px-6 py-4 text-slate-700 font-medium text-xs">
                                        {business?.name || requester?.department || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4">{req.projectName || req.description}</td>
                                    <td className="px-6 py-4 text-slate-500">{req.items.length} items</td>
                                    <td
                                        className="px-6 py-4 text-blue-600 hover:underline cursor-pointer text-xs"
                                        onClick={() => setTrackingReq(req)}
                                    >
                                        {new Date(req.dateCreated).toLocaleDateString()}
                                        <br />
                                        <span className="text-slate-500 no-underline">{new Date(req.dateCreated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </td>
                                    <td
                                        className="px-6 py-4 cursor-pointer hover:opacity-80"
                                        onClick={() => setTrackingReq(req)}
                                    >
                                        {getStatusBadge(req.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        {req.status === RequisitionStatus.READY_FOR_PRF && (currentUser.role === UserRole.PURCHASING_OFFICER || currentUser.role === UserRole.SUPER_ADMIN) && (
                                            <button
                                                onClick={() => setPreparePRFReq(req)}
                                                className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 font-medium"
                                            >
                                                Prepare PRF
                                            </button>
                                        )}
                                        {req.status === RequisitionStatus.PRF_PENDING_MANAGER && (currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.SUPER_ADMIN) && (
                                            <div className="flex gap-2">
                                                <button onClick={() => setPreparePRFReq(req)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs border border-blue-200 flex items-center gap-1">
                                                    <Edit size={12} /> Edit
                                                </button>
                                                <button onClick={() => handleReject(req.id)} className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs border border-red-200">Reject</button>
                                                <button onClick={() => handleManagerApprovePRF(req.id)} className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs border border-green-200">Approve</button>
                                            </div>
                                        )}
                                        {req.status === RequisitionStatus.REJECTED && req.prfDetails && (currentUser.role === UserRole.PURCHASING_OFFICER || currentUser.role === UserRole.SUPER_ADMIN) && (
                                            <button 
                                                onClick={() => setPreparePRFReq(req)} 
                                                className="text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs border border-orange-200 flex items-center gap-1"
                                            >
                                                <RefreshCw size={12} /> Retry / Edit
                                            </button>
                                        )}
                                        {req.prfDetails && req.status !== RequisitionStatus.REJECTED && (
                                            <button onClick={() => setPrintReq(req)} className="text-slate-600 bg-slate-100 px-2 py-1 rounded text-xs flex items-center gap-1"><Printer size={12} /> Print</button>
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
            </div>

            {/* Prepare PRF Modal - Used for Preparation and Editing */}
            {preparePRFReq && (
                <PreparePRFModal
                    requisition={preparePRFReq}
                    suppliers={suppliers}
                    onClose={() => setPreparePRFReq(null)}
                    onSubmit={handlePreparePRFSubmit}
                    currentUserId={currentUser.id}
                />
            )}
            {printReq && (
                <PRFPrintModal
                    req={printReq}
                    onClose={() => setPrintReq(null)}
                    business={businesses.find(b => b.id === printReq.businessId)}
                    requester={allUsers.find(u => u.id === printReq.requesterId)}
                    preparedBy={allUsers.find(u => u.id === printReq.prfDetails?.preparedBy)}
                />
            )}
        </div>
    );
};

export default PrfView;
