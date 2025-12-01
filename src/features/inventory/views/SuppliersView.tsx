import React, { useState } from 'react';
import { Search, Plus, Edit2, Trash2, X, Star } from 'lucide-react';
import type { Supplier, BankDetails } from '../../procurement/types';
import Card from '../../../shared/components/Card';

// Props are updated to handle data persistence via functions
interface SuppliersViewProps {
    suppliers: Supplier[];
    onCreateSupplier: (supplier: Omit<Supplier, 'id'>) => void;
    onUpdateSupplier: (supplier: Supplier) => void;
    onDeleteSupplier: (id: string) => void;
}

interface SupplierModalProps {
    supplier?: Supplier;
    isOpen: boolean;
    onClose: () => void;
    onSave: (supplier: Supplier | Omit<Supplier, 'id'>) => void;
}

// Refactored SupplierModal with dark theme
const SupplierModal: React.FC<SupplierModalProps> = ({ supplier, isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<Supplier> & { hasBankDetails: boolean }>(
        () => {
            const initialData = supplier || {
                name: '',
                category: '',
                rating: 5,
                contractEnd: '',
                tin: '',
                address: '',
                paymentMode: '',
                terms: '',
                isVatable: false,
                bankDetails: {
                    bankName: '',
                    accountName: '',
                    accountNumber: '',
                    branch: ''
                }
            };
            // Check if bank details are actually populated
            const hasBankDetails = !!(initialData.bankDetails?.bankName || initialData.bankDetails?.accountNumber);
            return { ...initialData, hasBankDetails };
        }
    );

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSave = {
            name: formData.name || '',
            category: formData.category || '',
            rating: Number(formData.rating) || 5,
            contractEnd: formData.contractEnd || '',
            tin: formData.tin || '',
            address: formData.address || '',
            paymentMode: formData.paymentMode || '',
            terms: formData.terms || '',
            isVatable: formData.isVatable || false,
            // Only save bank details if the toggle is on
            bankDetails: formData.hasBankDetails ? {
                bankName: formData.bankDetails?.bankName || '',
                accountName: formData.bankDetails?.accountName || '',
                accountNumber: formData.bankDetails?.accountNumber || '',
                branch: formData.bankDetails?.branch || ''
            } : undefined // Or empty object depending on preference, undefined cleans it up
        };

        if (supplier?.id) {
            onSave({ ...dataToSave, id: supplier.id });
        } else {
            onSave(dataToSave);
        }
    };

    const handleBankDetailChange = (field: keyof BankDetails, value: string) => {
        setFormData(prev => ({
            ...prev,
            bankDetails: {
                bankName: prev.bankDetails?.bankName || '',
                accountName: prev.bankDetails?.accountName || '',
                accountNumber: prev.bankDetails?.accountNumber || '',
                branch: prev.bankDetails?.branch || '',
                [field]: value
            }
        }));
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <Card className="w-full max-w-3xl animate-in zoom-in-95 duration-200 !p-0 bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-700">
                    <h3 className="text-lg font-bold text-white">
                        {supplier ? 'Edit Supplier' : 'Add New Supplier'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Supplier Name</label>
                            <input
                                required
                                className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. ABC Office Supplies"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Payment Mode</label>
                            <input
                                className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                                value={formData.paymentMode}
                                onChange={e => setFormData({ ...formData, paymentMode: e.target.value })}
                                placeholder="e.g. Check, Cash, Bank Transfer"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">TIN</label>
                            <input
                                className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                                value={formData.tin}
                                onChange={e => setFormData({ ...formData, tin: e.target.value })}
                                placeholder="000-000-000"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Terms</label>
                            <input
                                className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                                value={formData.terms}
                                onChange={e => setFormData({ ...formData, terms: e.target.value })}
                                placeholder="e.g. 30 Days"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Address</label>
                        <input
                            className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            placeholder="Full business address"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                            <input
                                className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                placeholder="e.g. Electronics"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Rating (1-5)</label>
                            <input
                                type="number"
                                min="1"
                                max="5"
                                className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                                value={formData.rating}
                                onChange={e => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Contract End</label>
                            <input
                                type="date"
                                className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                                value={formData.contractEnd}
                                onChange={e => setFormData({ ...formData, contractEnd: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* New Section: Tax Information */}
                    <div className="border-t border-slate-700 pt-4">
                        <h4 className="text-md font-semibold text-white mb-3">Tax Information</h4>
                        <div className="flex items-center gap-3">
                            <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                <input
                                    type="checkbox"
                                    name="isVatable"
                                    id="isVatable"
                                    className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                    checked={formData.isVatable}
                                    onChange={e => setFormData({ ...formData, isVatable: e.target.checked })}
                                    style={{
                                        right: formData.isVatable ? '0' : 'auto',
                                        left: formData.isVatable ? 'auto' : '0',
                                        borderColor: formData.isVatable ? '#9333ea' : '#4b5563'
                                    }}
                                />
                                <label
                                    htmlFor="isVatable"
                                    className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${formData.isVatable ? 'bg-purple-600' : 'bg-slate-600'}`}
                                ></label>
                            </div>
                            <label htmlFor="isVatable" className="text-sm text-slate-300 cursor-pointer">
                                Is Supplier Vatable?
                            </label>
                        </div>
                    </div>

                    {/* New Section: Bank Details with Switch */}
                    <div className="border-t border-slate-700 pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-md font-semibold text-white">Bank Details</h4>
                            <div className="flex items-center gap-3">
                                <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input
                                        type="checkbox"
                                        name="hasBankDetails"
                                        id="hasBankDetails"
                                        className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                        checked={formData.hasBankDetails}
                                        onChange={e => setFormData({ ...formData, hasBankDetails: e.target.checked })}
                                        style={{
                                            right: formData.hasBankDetails ? '0' : 'auto',
                                            left: formData.hasBankDetails ? 'auto' : '0',
                                            borderColor: formData.hasBankDetails ? '#9333ea' : '#4b5563'
                                        }}
                                    />
                                    <label
                                        htmlFor="hasBankDetails"
                                        className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${formData.hasBankDetails ? 'bg-purple-600' : 'bg-slate-600'}`}
                                    ></label>
                                </div>
                                <label htmlFor="hasBankDetails" className="text-sm text-slate-300 cursor-pointer">
                                    Include Bank Details
                                </label>
                            </div>
                        </div>

                        {formData.hasBankDetails && (
                            <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Bank Name</label>
                                    <input
                                        className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                                        value={formData.bankDetails?.bankName}
                                        onChange={e => handleBankDetailChange('bankName', e.target.value)}
                                        placeholder="e.g. BDO, BPI"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Account Name</label>
                                    <input
                                        className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                                        value={formData.bankDetails?.accountName}
                                        onChange={e => handleBankDetailChange('accountName', e.target.value)}
                                        placeholder="Account Holder Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Account Number</label>
                                    <input
                                        className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                                        value={formData.bankDetails?.accountNumber}
                                        onChange={e => handleBankDetailChange('accountNumber', e.target.value)}
                                        placeholder="Account Number"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Branch (Optional)</label>
                                    <input
                                        className="w-full p-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                                        value={formData.bankDetails?.branch}
                                        onChange={e => handleBankDetailChange('branch', e.target.value)}
                                        placeholder="Branch Name"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-700">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg font-medium transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg font-medium transition-colors">
                            {supplier ? 'Save Changes' : 'Add Supplier'}
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};


const SuppliersView: React.FC<SuppliersViewProps> = ({ suppliers, onCreateSupplier, onUpdateSupplier, onDeleteSupplier }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
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
            onDeleteSupplier(id); // Use onDeleteSupplier prop
        }
    };

    const handleSave = (data: Supplier | Omit<Supplier, 'id'>) => {
        if ('id' in data) {
            onUpdateSupplier(data as Supplier); // Use onUpdateSupplier prop
        } else {
            onCreateSupplier(data as Omit<Supplier, 'id'>); // Use onCreateSupplier prop
        }
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-6 text-white">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Suppliers</h1>
                    <p className="text-slate-300">Manage vendor relationships</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            className="pl-10 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm w-64 focus:ring-2 focus:ring-purple-500"
                            placeholder="Search suppliers..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                    >
                        <Plus size={18} /> Add Supplier
                    </button>
                </div>
            </div>

            <Card className="overflow-hidden !p-0">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
                        <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Details</th>
                            <th className="px-6 py-4">Rating</th>
                            <th className="px-6 py-4">VAT</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {filteredSuppliers.map(supplier => (
                            <tr key={supplier.id} className="hover:bg-slate-800/60">
                                <td className="px-6 py-4 font-medium text-slate-200">{supplier.name}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs font-medium">
                                        {supplier.category}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-400">
                                    {supplier.tin && <div>TIN: {supplier.tin}</div>}
                                    {supplier.address && <div className="truncate max-w-[150px]">{supplier.address}</div>}
                                    {supplier.bankDetails?.bankName && (
                                        <div className="text-slate-500 mt-1">
                                            Bank: {supplier.bankDetails.bankName} - {supplier.bankDetails.accountNumber}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1 text-amber-400">
                                        <Star size={14} fill="currentColor" />
                                        <span className="text-slate-300 font-medium">{supplier.rating}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${supplier.isVatable ? 'bg-green-900/50 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                                        {supplier.isVatable ? 'Vatable' : 'Non-Vat'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => handleEdit(supplier)}
                                            className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-slate-700 rounded"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(supplier.id)}
                                            className="text-red-400 hover:text-red-300 p-1 hover:bg-slate-700 rounded"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredSuppliers.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">
                                    No suppliers found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>

            <SupplierModal
                isOpen={isModalOpen}
                supplier={editingSupplier}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
            />
        </div>
    );
};

export default SuppliersView;
