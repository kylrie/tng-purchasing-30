import React, { useState, useEffect } from 'react';
import { X, Check, DollarSign, ArrowLeft } from 'lucide-react';
import type { Requisition, RequisitionItem, Supplier, SupplierDetails } from '../types';

interface PreparePRFModalProps {
    requisition: Requisition;
    suppliers: Supplier[];
    onClose: () => void;
    onSubmit: (requisition: Requisition) => void;
    currentUserId: string;
}

const PreparePRFModal: React.FC<PreparePRFModalProps> = ({
    requisition,
    suppliers,
    onClose,
    onSubmit,
    currentUserId
}) => {
    const [items, setItems] = useState<RequisitionItem[]>(requisition.items.map(item => ({ ...item })));
    const [createNewSupplier, setCreateNewSupplier] = useState(false);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [supplierDetails, setSupplierDetails] = useState<SupplierDetails>({
        name: '',
        tin: '',
        address: '',
        paymentMode: '',
        terms: ''
    });

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Check if form is valid
    const isValid = () => {
        const allPricesFilled = items.every(item => item.price > 0);
        const supplierValid = createNewSupplier
            ? supplierDetails.name && supplierDetails.tin && supplierDetails.address && supplierDetails.paymentMode
            : selectedSupplierId !== '';
        return allPricesFilled && supplierValid;
    };

    // Handle supplier selection
    const handleSupplierSelect = (supplierId: string) => {
        setSelectedSupplierId(supplierId);
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            setSupplierDetails({
                name: supplier.name,
                tin: '',
                address: '',
                paymentMode: '',
                terms: ''
            });
        }
    };

    // Handle item price change
    const handlePriceChange = (index: number, price: number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], price };
        setItems(newItems);
    };

    // Handle submit
    const handleSubmit = () => {
        const updatedRequisition: Requisition = {
            ...requisition,
            items,
            totalAmount,
            prfDetails: {
                supplier: supplierDetails,
                preparedBy: currentUserId,
                datePrepared: new Date().toISOString()
            }
        };
        onSubmit(updatedRequisition);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
            <div className="bg-white rounded-2xl shadow-2xl border border-white/20 max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-5 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
                        >
                            <ArrowLeft size={20} /> Back
                        </button>
                        <h2 className="text-xl font-bold text-slate-900">Prepare Purchase Requisition (PRF)</h2>
                    </div>
                    <div className="text-xs text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200">
                        STAGING - ROLE SIMULATOR ACTIVE (SUPER_ADMIN)
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Item Specification & Costing */}
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Item Specification & Costing</h3>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 w-8">
                                            <input type="checkbox" checked readOnly className="rounded" />
                                        </th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700">ITEM</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700">QTY / UOM</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700">REMARKS</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700">UNIT PRICE</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <input type="checkbox" checked readOnly className="rounded" />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                                            <td className="px-4 py-3 text-slate-600">{item.quantity} {item.uom}</td>
                                            <td className="px-4 py-3 text-slate-600 text-xs">{item.remarks || '-'}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={item.price || ''}
                                                    onChange={(e) => handlePriceChange(index, parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                    className="w-24 px-2 py-1 border border-slate-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                                ₱{(item.price * item.quantity).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-800">
                                            Total Amount (Selected)
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-blue-600 text-lg">
                                            ₱{totalAmount.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Supplier Information */}
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Supplier Information</h3>
                        <div className="space-y-4">
                            {/* Toggle for new supplier */}
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-slate-700">Create new supplier?</span>
                                <button
                                    onClick={() => {
                                        setCreateNewSupplier(!createNewSupplier);
                                        if (!createNewSupplier) {
                                            setSelectedSupplierId('');
                                            setSupplierDetails({ name: '', tin: '', address: '', paymentMode: '', terms: '' });
                                        }
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${createNewSupplier ? 'bg-blue-600' : 'bg-slate-300'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${createNewSupplier ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>

                            {/* Supplier Selection or Input */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name</label>
                                    {createNewSupplier ? (
                                        <input
                                            type="text"
                                            value={supplierDetails.name}
                                            onChange={(e) => setSupplierDetails({ ...supplierDetails, name: e.target.value })}
                                            placeholder="Enter supplier name"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    ) : (
                                        <select
                                            value={selectedSupplierId}
                                            onChange={(e) => handleSupplierSelect(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">-- Choose Supplier --</option>
                                            {suppliers.map(supplier => (
                                                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
                                    <select
                                        value={supplierDetails.paymentMode}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, paymentMode: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select Mode</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Check">Check</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Credit Card">Credit Card</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">TIN</label>
                                    <input
                                        type="text"
                                        value={supplierDetails.tin}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, tin: e.target.value })}
                                        placeholder="000-000-000"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Terms</label>
                                    <input
                                        type="text"
                                        value={supplierDetails.terms || ''}
                                        onChange={(e) => setSupplierDetails({ ...supplierDetails, terms: e.target.value })}
                                        placeholder="e.g. 30 Days, COD"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                                <input
                                    type="text"
                                    value={supplierDetails.address}
                                    onChange={(e) => setSupplierDetails({ ...supplierDetails, address: e.target.value })}
                                    placeholder="Registered Address"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Ready to Submit Section */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <h4 className="font-semibold text-blue-900 mb-1">Ready to Submit?</h4>
                                <p className="text-sm text-blue-700">
                                    Please ensure all costs are final and supplier details are verified. This will be sent to the Business Unit Manager for final approval.
                                </p>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={!isValid()}
                                className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${isValid()
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    }`}
                            >
                                <Check size={18} /> Submit PRF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreparePRFModal;
