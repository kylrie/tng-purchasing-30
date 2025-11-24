import React, { useState } from 'react';
import { Search, Plus, Edit2, Trash2, X, Star, Calendar, Printer } from 'lucide-react';
import type { Supplier } from '../../procurement/types';

interface SuppliersViewProps {
    suppliers: Supplier[];
    setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
}

interface SupplierModalProps {
    supplier?: Supplier;
    isOpen: boolean;
    onClose: () => void;
    onSave: (supplier: Supplier) => void;
}

const SupplierModal: React.FC<SupplierModalProps> = ({ supplier, isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<Supplier>>(
        supplier || {
            name: '',
            category: '',
            rating: 5,
            contractEnd: '',
            tin: '',
            address: '',
            paymentMode: '',
            terms: ''
        }
    );

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: supplier?.id || `sup-${Date.now()}`,
            name: formData.name || '',
            category: formData.category || '',
            rating: formData.rating || 0,
            contractEnd: formData.contractEnd || '',
            tin: formData.tin || '',
            address: formData.address || '',
            paymentMode: formData.paymentMode || '',
            terms: formData.terms || ''
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:hidden">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">
                        {supplier ? 'Edit Supplier' : 'Add New Supplier'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Grid Layout matching the requested template */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                            <input
                                required
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. ABC Office Supplies"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                            <select
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={formData.paymentMode}
                                onChange={e => setFormData({ ...formData, paymentMode: e.target.value })}
                            >
                                <option value="">Select Mode</option>
                                <option value="Check">Check</option>
                                <option value="Cash">Cash</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Credit Card">Credit Card</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">TIN</label>
                            <input
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={formData.tin}
                                onChange={e => setFormData({ ...formData, tin: e.target.value })}
                                placeholder="000-000-000"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
                            <input
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={formData.terms}
                                onChange={e => setFormData({ ...formData, terms: e.target.value })}
                                placeholder="e.g. 30 Days, COD"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <input
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            placeholder="Registered Business Address"
                        />
                    </div>

                    {/* Additional Fields */}
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <select
                                required
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            >
                                <option value="">Select Category</option>
                                <option value="Office Supplies">Office Supplies</option>
                                <option value="IT Equipment">IT Equipment</option>
                                <option value="Furniture">Furniture</option>
                                <option value="Services">Services</option>
                                <option value="Consumables">Consumables</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5)</label>
                            <input
                                type="number"
                                min="1"
                                max="5"
                                step="0.1"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={formData.rating}
                                onChange={e => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contract End</label>
                            <input
                                type="date"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={formData.contractEnd}
                                onChange={e => setFormData({ ...formData, contractEnd: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium"
                        >
                            {supplier ? 'Save Changes' : 'Add Supplier'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SuppliersPrintModal = ({ suppliers, onClose }: { suppliers: Supplier[], onClose: () => void }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
            <div className="p-8 max-w-[210mm] mx-auto min-h-screen relative">
                {/* Print Controls - Hidden when printing */}
                <div className="fixed top-4 right-4 flex gap-2 print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Printer size={18} /> Print
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-200"
                    >
                        Close
                    </button>
                </div>

                {/* Header */}
                <div className="text-center mb-8 border-b-2 border-slate-900 pb-4">
                    <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wide mb-1">Accredited Suppliers List</h1>
                    <p className="text-slate-500 font-medium">Procurement Department - Master List</p>
                </div>

                {/* Meta Info */}
                <div className="flex justify-between text-sm mb-6">
                    <div>
                        <span className="font-bold text-slate-700">Date Generated:</span> {new Date().toLocaleDateString()}
                    </div>
                    <div>
                        <span className="font-bold text-slate-700">Total Suppliers:</span> {suppliers.length}
                    </div>
                </div>

                {/* Table */}
                <div className="border border-slate-900 mb-8">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 text-slate-900 uppercase font-bold text-xs">
                            <tr>
                                <th className="border-r border-b border-slate-900 px-2 py-2 text-left w-1/4">Supplier Name</th>
                                <th className="border-r border-b border-slate-900 px-2 py-2 text-center">Category</th>
                                <th className="border-r border-b border-slate-900 px-2 py-2 text-center">TIN</th>
                                <th className="border-r border-b border-slate-900 px-2 py-2 text-center">Payment Terms</th>
                                <th className="border-b border-slate-900 px-2 py-2 text-right">Contract End</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.map((supplier) => (
                                <tr key={supplier.id} className="text-slate-800">
                                    <td className="border-r border-b border-slate-900 px-2 py-2 font-medium">{supplier.name}</td>
                                    <td className="border-r border-b border-slate-900 px-2 py-2 text-center">{supplier.category}</td>
                                    <td className="border-r border-b border-slate-900 px-2 py-2 text-center font-mono text-xs">{supplier.tin || '-'}</td>
                                    <td className="border-r border-b border-slate-900 px-2 py-2 text-center text-xs">
                                        {supplier.paymentMode} {supplier.terms ? `(${supplier.terms})` : ''}
                                    </td>
                                    <td className="border-b border-slate-900 px-2 py-2 text-right">
                                        {supplier.contractEnd ? new Date(supplier.contractEnd).toLocaleDateString() : 'N/A'}
                                    </td>
                                </tr>
                            ))}
                            {/* Empty Rows to fill space if needed */}
                            {suppliers.length < 5 && Array.from({ length: 5 - suppliers.length }).map((_, i) => (
                                <tr key={`empty-${i}`}>
                                    <td className="border-r border-b border-slate-900 px-2 py-4">&nbsp;</td>
                                    <td className="border-r border-b border-slate-900 px-2 py-4">&nbsp;</td>
                                    <td className="border-r border-b border-slate-900 px-2 py-4">&nbsp;</td>
                                    <td className="border-r border-b border-slate-900 px-2 py-4">&nbsp;</td>
                                    <td className="border-b border-slate-900 px-2 py-4">&nbsp;</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer / Reminders (Template Style) */}
                <div className="flex border border-slate-900 mb-8 break-inside-avoid">
                    <div className="w-2/3 p-3 border-r border-slate-900">
                        <div className="font-bold underline mb-2 text-xs">NOTES:</div>
                        <ul className="list-disc pl-4 text-[10px] space-y-1">
                            <li>All suppliers listed herein are accredited and active.</li>
                            <li>Contract renewals must be processed 30 days prior to expiration.</li>
                            <li>Performance ratings are updated quarterly based on delivery performance.</li>
                        </ul>
                    </div>
                    <div className="w-1/3 p-3">
                        <div className="font-bold underline mb-2 text-xs">VERIFIED BY:</div>
                        <div className="h-12 border-b border-slate-900 mb-1"></div>
                        <div className="text-[10px] text-center uppercase">Purchasing Manager</div>
                    </div>
                </div>

                <div className="text-[10px] text-slate-400 text-center">
                    System Generated Document • {new Date().toLocaleString()}
                </div>
            </div>
        </div>
    );
};

const SuppliersView: React.FC<SuppliersViewProps> = ({ suppliers, setSuppliers }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPrintOpen, setIsPrintOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>(undefined);

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAdd = () => {
        setEditingSupplier(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this supplier?')) {
            setSuppliers(prev => prev.filter(s => s.id !== id));
        }
    };

    const handleSave = (supplier: Supplier) => {
        if (editingSupplier) {
            setSuppliers(prev => prev.map(s => s.id === supplier.id ? supplier : s));
        } else {
            setSuppliers(prev => [...prev, supplier]);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Suppliers</h1>
                    <p className="text-slate-500">Manage vendor relationships</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            className="pl-10 p-2 border border-slate-300 rounded-lg text-sm w-64"
                            placeholder="Search suppliers..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setIsPrintOpen(true)}
                        className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                        <Printer size={18} /> Print List
                    </button>
                    <button
                        onClick={handleAdd}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                        <Plus size={18} /> Add Supplier
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                        <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Details</th>
                            <th className="px-6 py-4">Rating</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredSuppliers.map(supplier => (
                            <tr key={supplier.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-slate-900">{supplier.name}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">
                                        {supplier.category}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-500">
                                    {supplier.tin && <div>TIN: {supplier.tin}</div>}
                                    {supplier.address && <div className="truncate max-w-[150px]">{supplier.address}</div>}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1 text-amber-500">
                                        <Star size={14} fill="currentColor" />
                                        <span className="text-slate-700 font-medium">{supplier.rating}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => handleEdit(supplier)}
                                            className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(supplier.id)}
                                            className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredSuppliers.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">
                                    No suppliers found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <SupplierModal
                isOpen={isModalOpen}
                supplier={editingSupplier}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
            />
            
            {isPrintOpen && (
                <SuppliersPrintModal 
                    suppliers={filteredSuppliers} 
                    onClose={() => setIsPrintOpen(false)} 
                />
            )}
        </div>
    );
};

export default SuppliersView;
