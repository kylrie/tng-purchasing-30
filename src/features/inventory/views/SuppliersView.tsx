import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, X, Star, Check, Building2 } from 'lucide-react';
import type { Supplier, BankDetails, Business, User } from '../../procurement/types';
import Card from '../../../shared/components/Card';
import { usePermissions } from '../../../hooks/usePermissions';

// Task 3: TIN Validation Helper
const isValidTIN = (tin: string): boolean => {
    // Allows formats like:
    // 000-000-000
    // 000-000-000-000
    // 000-000-000-00000
    // Strictly numeric or with hyphens? User asked for strict format or length.
    // Let's go with a regex that enforces groups of digits separated by hyphens.
    // Regex: ^\d{3}-\d{3}-\d{3}(-\d{3,5})?$
    const tinRegex = /^\d{3}-\d{3}-\d{3}(-\d{3,5})?$/;
    return tinRegex.test(tin);
};

// Props are updated to handle data persistence via functions
interface SuppliersViewProps {
    suppliers: Supplier[];
    onCreateSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<void> | void;
    onUpdateSupplier: (supplier: Supplier) => Promise<void> | void;
    onDeleteSupplier: (id: string) => void;
    currentUser: User;
    businesses: Business[];
}

interface SupplierModalProps {
    supplier?: Supplier;
    isOpen: boolean;
    onClose: () => void;
    onSave: (supplier: Supplier | Omit<Supplier, 'id'>) => Promise<void>; // Updated to Promise for error handling
    businesses: Business[];
    currentUser: User;
}

// Refactored SupplierModal with dark theme
const SupplierModal: React.FC<SupplierModalProps> = ({ supplier, isOpen, onClose, onSave, businesses, currentUser }) => {
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
                businessUnitIds: [], // Default to empty
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

    // Update form data when modal opens or supplier changes
    useEffect(() => {
        if (isOpen) {
            const initialData = supplier || {
                name: '',
                category: '',
                rating: 5,
                contractEnd: '',
                tin: '',
                address: '',
                paymentMode: '',
                terms: '',
                businessUnitIds: [],
                bankDetails: {
                    bankName: '',
                    accountName: '',
                    accountNumber: '',
                    branch: ''
                }
            };

            const hasBankDetails = !!(initialData.bankDetails?.bankName || initialData.bankDetails?.accountNumber);

            // If creating new, default to current user's business unit
            if (!supplier && currentUser.businessId) {
                initialData.businessUnitIds = [currentUser.businessId];
            }

            setFormData({ ...initialData, hasBankDetails });
        }
    }, [supplier, isOpen, currentUser]);

    // Validation State
    const isTinValid = !formData.tin || isValidTIN(formData.tin);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!isTinValid && formData.tin) {
            setErrorMessage("Invalid TIN Format. Use 000-000-000 or 000-000-000-000");
            return;
        }

        setIsSubmitting(true);
        const dataToSave = {
            name: formData.name || '',
            category: formData.category || '',
            rating: Number(formData.rating) || 5,
            contractEnd: formData.contractEnd || '',
            tin: formData.tin || '',
            address: formData.address || '',
            paymentMode: formData.paymentMode || '',
            terms: formData.terms || '',
            businessUnitIds: formData.businessUnitIds || [],
            // Only save bank details if the toggle is on
            ...(formData.hasBankDetails && {
                bankDetails: {
                    bankName: formData.bankDetails?.bankName || '',
                    accountName: formData.bankDetails?.accountName || '',
                    accountNumber: formData.bankDetails?.accountNumber || '',
                    branch: formData.bankDetails?.branch || ''
                }
            })
        };

        try {
            if (supplier?.id) {
                await onSave({ ...dataToSave, id: supplier.id });
            } else {
                await onSave(dataToSave);
            }
        } catch (error: any) {
            setErrorMessage(error.message || "Failed to save supplier.");
        } finally {
            setIsSubmitting(false);
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

    const toggleBusinessUnit = (bizId: string) => {
        const currentIds = formData.businessUnitIds || [];
        if (currentIds.includes(bizId)) {
            setFormData({ ...formData, businessUnitIds: currentIds.filter(id => id !== bizId) });
        } else {
            setFormData({ ...formData, businessUnitIds: [...currentIds, bizId] });
        }
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
                    {errorMessage && (
                        <div className="p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
                            {errorMessage}
                        </div>
                    )}
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
                                className={`w-full p-2 bg-slate-900/50 border rounded-lg text-white focus:ring-2 focus:outline-none placeholder-slate-500 ${!isTinValid && formData.tin ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-purple-500'}`}
                                value={formData.tin}
                                onChange={e => {
                                    setFormData({ ...formData, tin: e.target.value });
                                    setErrorMessage(null); // Clear error on change
                                }}
                                placeholder="000-000-000"
                            />
                            {!isTinValid && formData.tin && (
                                <p className="text-xs text-red-400 mt-1">Format: 000-000-000 or 000-000-000-000</p>
                            )}
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

                    {/* Business Unit Selection */}
                    <div className="border-t border-slate-700 pt-4">
                        <label className="block text-sm font-medium text-slate-300 mb-2">Assigned Business Units</label>
                        <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-2 h-32 overflow-y-auto custom-scrollbar">
                            {businesses.map(b => {
                                const isSelected = (formData.businessUnitIds || []).includes(b.id);
                                return (
                                    <div
                                        key={b.id}
                                        onClick={() => toggleBusinessUnit(b.id)}
                                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-purple-600/30 text-purple-200' : 'hover:bg-slate-800 text-slate-400'}`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-500'}`}>
                                            {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                        <span className="text-sm">{b.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Select which Business Units can access this supplier.</p>
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
                        <button type="submit" disabled={isSubmitting || !isTinValid} className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {isSubmitting ? 'Saving...' : (supplier ? 'Save Changes' : 'Add Supplier')}
                        </button>
                    </div>
                </form>
            </Card>
        </div >
    );
};


const SuppliersView: React.FC<SuppliersViewProps> = ({ suppliers, onCreateSupplier, onUpdateSupplier, onDeleteSupplier, currentUser, businesses }) => {
    const { hasPermission } = usePermissions();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>(undefined);

    // Show all suppliers - the filter dropdown will handle BU-specific filtering
    const visibleSuppliers = suppliers;

    // Memoized filtering with strict "Empty = Global" rule
    const filteredSuppliers = React.useMemo(() => {
        return visibleSuppliers.filter(supplier => {
            // 1. If filter is ALL, show everything
            if (selectedBusinessUnit === 'all') {
                // Still apply search filter
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    return supplier.name.toLowerCase().includes(term) ||
                        supplier.category.toLowerCase().includes(term);
                }
                return true;
            }

            const tags = supplier.businessUnitIds || [];

            // 2. Logic: Show if Tagged Match OR Tagged Global OR No Tags (Empty)
            const isTaggedForBu = tags.includes(selectedBusinessUnit);
            const isGlobal = tags.includes('GLOBAL');
            const hasNoTags = tags.length === 0;

            const passesBusinessUnitFilter = isTaggedForBu || isGlobal || hasNoTags;

            if (!passesBusinessUnitFilter) return false;

            // Apply search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return supplier.name.toLowerCase().includes(term) ||
                    supplier.category.toLowerCase().includes(term);
            }

            return true;
        });
    }, [visibleSuppliers, selectedBusinessUnit, searchTerm]);

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

    const handleSave = async (data: Supplier | Omit<Supplier, 'id'>) => {
        try {
            if ('id' in data) {
                await onUpdateSupplier(data as Supplier);
            } else {
                await onCreateSupplier(data as Omit<Supplier, 'id'>);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            throw error; // Re-throw so modal can catch it
        }
    };

    return (
        <div className="space-y-6 text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Suppliers</h1>
                    <p className="text-slate-300">Manage vendor relationships</p>
                </div>
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-stretch md:items-center">
                    <div className="relative flex-1 md:flex-none">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            className="pl-10 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm w-full md:w-64 focus:ring-2 focus:ring-purple-500"
                            placeholder="Search suppliers..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* Business Unit Filter - always visible */}
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
                    {hasPermission('supplier:create') && (
                        <button
                            onClick={handleAdd}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Add Supplier
                        </button>
                    )}
                </div>
            </div>

            <Card className="overflow-hidden !p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Business Units</th>
                                <th className="px-6 py-4">Details</th>
                                <th className="px-6 py-4">Rating</th>
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
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {supplier.businessUnitIds && supplier.businessUnitIds.length > 0 ? (
                                                supplier.businessUnitIds.map(id => {
                                                    const biz = businesses.find(b => b.id === id);
                                                    return biz ? (
                                                        <span key={id} className="text-xs bg-purple-900/30 border border-purple-700/50 px-2 py-1 rounded text-purple-300 flex items-center gap-1">
                                                            <Building2 size={12} /> {biz.name}
                                                        </span>
                                                    ) : null;
                                                })
                                            ) : (
                                                <span className="text-xs text-slate-500 italic">All Units</span>
                                            )}
                                        </div>
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
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {hasPermission('supplier:edit') && (
                                                <button
                                                    onClick={() => handleEdit(supplier)}
                                                    className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-slate-700 rounded"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            )}
                                            {hasPermission('supplier:delete') && (
                                                <button
                                                    onClick={() => handleDelete(supplier.id)}
                                                    className="text-red-400 hover:text-red-300 p-1 hover:bg-slate-700 rounded"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredSuppliers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">
                                        No suppliers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <SupplierModal
                isOpen={isModalOpen}
                supplier={editingSupplier}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                businesses={businesses}
                currentUser={currentUser}
            />
        </div>
    );
};

export default SuppliersView;
