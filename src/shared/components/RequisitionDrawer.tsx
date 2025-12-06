import React, { useState } from 'react';
import { X, Clock, CheckCircle2, XCircle, ChevronRight, User, DollarSign, Package, History, Paperclip, ExternalLink, Building2, FileText, Receipt } from 'lucide-react';
import type { Requisition, RequisitionHistory, RequisitionItem } from '../../features/procurement/types';
import { RequisitionStatus } from '../../features/procurement/types';
import LiquidationForm from '../../features/procurement/components/LiquidationForm';
import Card from './Card';

// Variant types for different contexts
export type DrawerVariant = 'BURF' | 'PRF' | 'FINANCE';

interface RequisitionDrawerProps {
    requisition: Requisition | null;
    isOpen: boolean;
    onClose: () => void;
    variant: DrawerVariant;
    // Action callbacks based on variant
    onApprove?: () => void;
    onReject?: () => void;
    onReleaseFund?: () => void;
    onPreparePrf?: () => void; // BURF only - when status is READY_FOR_PRF
    onSubmitLiquidation?: (payload: any) => Promise<void>; // Liquidation callback
    // Permission flags
    canApprove?: boolean;
    canReject?: boolean;
    canReleaseFund?: boolean;
    canPreparePrf?: boolean; // BURF only
    canSubmitLiquidation?: boolean; // For liquidation tab
    isLoading?: boolean;
    // Optional: status badge renderer
    getStatusBadge?: (status: RequisitionStatus) => React.ReactNode;
}

// Helper: Format currency
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
    }).format(amount);
};

// Helper: Format date nicely
const formatDate = (dateValue: string | Date | any): string => {
    if (!dateValue) return '-';
    if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

// Helper: Get timeline icon based on action
const getTimelineIcon = (action: string, stage: RequisitionStatus) => {
    if (action.toLowerCase().includes('approve') || stage.toString().includes('APPROVED')) {
        return <CheckCircle2 size={16} className="text-green-400" />;
    }
    if (action.toLowerCase().includes('reject')) {
        return <XCircle size={16} className="text-red-400" />;
    }
    if (action.toLowerCase().includes('created') || action.toLowerCase().includes('submit')) {
        return <Clock size={16} className="text-blue-400" />;
    }
    if (action.toLowerCase().includes('release') || action.toLowerCase().includes('fund')) {
        return <DollarSign size={16} className="text-emerald-400" />;
    }
    return <ChevronRight size={16} className="text-slate-400" />;
};

// Tab type - Supplier only for PRF, Liquidation for FUNDS_RELEASED
type TabType = 'items' | 'supplier' | 'liquidation' | 'history' | 'attachments';

const RequisitionDrawer: React.FC<RequisitionDrawerProps> = ({
    requisition,
    isOpen,
    onClose,
    variant,
    onApprove,
    onReject,
    onReleaseFund,
    onPreparePrf,
    onSubmitLiquidation,
    canApprove = false,
    canReject = false,
    canReleaseFund = false,
    canPreparePrf = false,
    canSubmitLiquidation = false,
    isLoading = false,
    getStatusBadge,
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('items');

    if (!isOpen || !requisition) return null;

    const totalAmount = requisition.items.reduce((sum: number, item: RequisitionItem) => {
        return sum + ((item.price || 0) * (item.quantity || 0));
    }, 0);

    // Determine variant-specific styling
    const variantColors = {
        BURF: { accent: 'purple', bgAccent: 'bg-purple-900/30', borderAccent: 'border-purple-700/50', textAccent: 'text-purple-300' },
        PRF: { accent: 'cyan', bgAccent: 'bg-cyan-900/30', borderAccent: 'border-cyan-700/50', textAccent: 'text-cyan-300' },
        FINANCE: { accent: 'emerald', bgAccent: 'bg-emerald-900/30', borderAccent: 'border-emerald-700/50', textAccent: 'text-emerald-300' },
    };
    const colors = variantColors[variant];

    // Get variant title
    const getTitle = () => {
        switch (variant) {
            case 'BURF': return 'BURF Details';
            case 'PRF': return 'PRF Details';
            case 'FINANCE': return 'Fund Release';
            default: return 'Details';
        }
    };

    // Check if any actions should be shown
    const showActions = (variant === 'BURF' && (canApprove || canReject || canPreparePrf)) ||
        (variant === 'PRF' && (canApprove || canReject)) ||
        (variant === 'FINANCE' && canReleaseFund);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-white truncate">{requisition.id}</h2>
                            {getStatusBadge && getStatusBadge(requisition.status)}
                        </div>
                        <p className="text-sm text-slate-400 mt-1 truncate">{requisition.description || 'No description'}</p>
                        <p className="text-xs text-slate-500 mt-1">{getTitle()}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-4"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700 overflow-x-auto">
                    <button
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'items'
                            ? 'border-b-2 border-purple-500 text-purple-400'
                            : 'text-slate-400 hover:text-slate-300'
                            }`}
                        onClick={() => setActiveTab('items')}
                    >
                        <Package size={16} /> Items
                    </button>
                    {/* Supplier Tab - PRF Only */}
                    {variant === 'PRF' && (
                        <button
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'supplier'
                                ? 'border-b-2 border-purple-500 text-purple-400'
                                : 'text-slate-400 hover:text-slate-300'
                                }`}
                            onClick={() => setActiveTab('supplier')}
                        >
                            <Building2 size={16} /> Supplier
                        </button>
                    )}
                    {/* Liquidation Tab - Show for FUNDS_RELEASED or if already has liquidation details */}
                    {(requisition.status === RequisitionStatus.FUNDS_RELEASED || requisition.liquidationDetails) && (
                        <button
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'liquidation'
                                ? 'border-b-2 border-emerald-500 text-emerald-400'
                                : 'text-slate-400 hover:text-slate-300'
                                }`}
                            onClick={() => setActiveTab('liquidation')}
                        >
                            <Receipt size={16} /> Liquidation
                        </button>
                    )}
                    <button
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'history'
                            ? 'border-b-2 border-purple-500 text-purple-400'
                            : 'text-slate-400 hover:text-slate-300'
                            }`}
                        onClick={() => setActiveTab('history')}
                    >
                        <History size={16} /> History
                    </button>
                    <button
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'attachments'
                            ? 'border-b-2 border-purple-500 text-purple-400'
                            : 'text-slate-400 hover:text-slate-300'
                            }`}
                        onClick={() => setActiveTab('attachments')}
                    >
                        <Paperclip size={16} /> Attachments
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Items Tab */}
                    {activeTab === 'items' && (
                        <div className="space-y-6">
                            {/* Supplier Info (PRF only) */}
                            {variant === 'PRF' && requisition.prfDetails?.supplier && (
                                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                    <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wider">Supplier</h3>
                                    <p className="text-white font-medium">{requisition.prfDetails.supplier.name}</p>
                                    <p className="text-sm text-slate-400">{requisition.prfDetails.supplier.address || 'No address'}</p>
                                    {requisition.prfDetails.supplier.tin && (
                                        <p className="text-xs text-slate-500 mt-1">TIN: {requisition.prfDetails.supplier.tin}</p>
                                    )}
                                </div>
                            )}

                            {/* Items Table */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Items ({requisition.items.length})</h3>
                                <Card className="!p-0 overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-800/80 text-xs uppercase text-slate-400">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Item</th>
                                                <th className="px-4 py-3 text-center">Qty</th>
                                                <th className="px-4 py-3 text-right">Price</th>
                                                <th className="px-4 py-3 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {requisition.items.map((item: RequisitionItem, index: number) => (
                                                <tr key={item.itemId || index} className="hover:bg-slate-800/40">
                                                    <td className="px-4 py-3 text-slate-200">{item.name}</td>
                                                    <td className="px-4 py-3 text-center text-slate-400">{item.quantity} {item.uom}</td>
                                                    <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(item.price || 0)}</td>
                                                    <td className="px-4 py-3 text-right text-white font-medium">
                                                        {formatCurrency((item.price || 0) * (item.quantity || 0))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className={`${colors.bgAccent} border-t ${colors.borderAccent}`}>
                                            <tr>
                                                <td colSpan={3} className={`px-4 py-3 text-right ${colors.textAccent} font-semibold`}>Total Amount</td>
                                                <td className="px-4 py-3 text-right text-white font-bold text-lg">
                                                    {formatCurrency(totalAmount)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* Supplier Tab - PRF Only */}
                    {activeTab === 'supplier' && variant === 'PRF' && (
                        <div>
                            {requisition.prfDetails?.supplier ? (
                                <div className="space-y-4">
                                    {/* Supplier Name & Basic Info */}
                                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-full bg-cyan-900/50 flex items-center justify-center">
                                                <Building2 size={24} className="text-cyan-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">{requisition.prfDetails.supplier.name}</h3>
                                                <p className="text-sm text-slate-400">
                                                    {requisition.prfDetails.supplier.isVatable ? 'VAT Registered' : 'Non-VAT'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {/* TIN */}
                                            <div className="bg-slate-900/50 rounded-lg p-3">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">TIN</p>
                                                <p className="text-white font-medium">{requisition.prfDetails.supplier.tin || '-'}</p>
                                            </div>
                                            {/* Payment Mode */}
                                            <div className="bg-slate-900/50 rounded-lg p-3">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Payment Mode</p>
                                                <p className="text-white font-medium">{requisition.prfDetails.supplier.paymentMode || '-'}</p>
                                            </div>
                                            {/* Terms */}
                                            <div className="bg-slate-900/50 rounded-lg p-3">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Terms</p>
                                                <p className="text-white font-medium">{requisition.prfDetails.supplier.terms || '-'}</p>
                                            </div>
                                            {/* VAT Status */}
                                            <div className="bg-slate-900/50 rounded-lg p-3">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">VAT Status</p>
                                                <p className="text-white font-medium">{requisition.prfDetails.supplier.isVatable ? 'VAT Registered' : 'Non-VAT'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Address</p>
                                        <p className="text-white">{requisition.prfDetails.supplier.address || 'No address on file'}</p>
                                    </div>

                                    {/* Bank Details */}
                                    {requisition.prfDetails.supplier.bankDetails && (
                                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                            <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Bank Details</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-900/50 rounded-lg p-3">
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Bank Name</p>
                                                    <p className="text-white font-medium">{requisition.prfDetails.supplier.bankDetails.bankName || '-'}</p>
                                                </div>
                                                <div className="bg-slate-900/50 rounded-lg p-3">
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Account Number</p>
                                                    <p className="text-white font-mono">{requisition.prfDetails.supplier.bankDetails.accountNumber || '-'}</p>
                                                </div>
                                                <div className="col-span-2 bg-slate-900/50 rounded-lg p-3">
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Account Name</p>
                                                    <p className="text-white font-medium">{requisition.prfDetails.supplier.bankDetails.accountName || '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Building2 size={48} className="mx-auto text-slate-600 mb-3" />
                                    <p className="text-slate-500">No supplier information available</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Liquidation Tab */}
                    {activeTab === 'liquidation' && (
                        <LiquidationForm
                            requisition={requisition}
                            onSubmit={async (payload) => {
                                if (onSubmitLiquidation) {
                                    await onSubmitLiquidation(payload);
                                }
                            }}
                            isLoading={isLoading}
                            readOnly={!canSubmitLiquidation || requisition.status !== RequisitionStatus.FUNDS_RELEASED}
                        />
                    )}

                    {/* History Tab */}
                    {activeTab === 'history' && (
                        <div>
                            {requisition.history && requisition.history.length > 0 ? (
                                <div className="relative pl-6">
                                    {/* Timeline line */}
                                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-700" />

                                    <div className="space-y-4">
                                        {requisition.history.map((entry: RequisitionHistory, index: number) => (
                                            <div key={index} className="relative">
                                                {/* Timeline dot */}
                                                <div className="absolute -left-4 mt-1 p-1 bg-slate-900 rounded-full border border-slate-700">
                                                    {getTimelineIcon(entry.action, entry.stage)}
                                                </div>

                                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-medium text-white">{entry.action}</span>
                                                        <span className="text-xs text-slate-500">{formatDate(entry.date)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                                        <User size={12} />
                                                        <span>{entry.actorName || 'System'}</span>
                                                    </div>
                                                    {entry.comments && (
                                                        <p className="text-xs text-slate-500 mt-2 italic">"{entry.comments}"</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <History size={48} className="mx-auto text-slate-600 mb-3" />
                                    <p className="text-slate-500">No history available</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Attachments Tab */}
                    {activeTab === 'attachments' && (
                        <div>
                            {(requisition.externalLink || (requisition.attachments && requisition.attachments.length > 0)) ? (
                                <div className="space-y-3">
                                    {requisition.externalLink && (
                                        <a
                                            href={requisition.externalLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-colors group"
                                        >
                                            <ExternalLink size={20} className="text-blue-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white group-hover:text-blue-400 truncate">External Reference</p>
                                                <p className="text-xs text-slate-500 truncate">{requisition.externalLink}</p>
                                            </div>
                                        </a>
                                    )}
                                    {requisition.attachments?.map((url: string, index: number) => (
                                        <a
                                            key={index}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-colors group"
                                        >
                                            <Paperclip size={20} className="text-slate-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-white group-hover:text-blue-400 truncate">Attachment {index + 1}</p>
                                                <p className="text-xs text-slate-500 truncate">{url}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Paperclip size={48} className="mx-auto text-slate-600 mb-3" />
                                    <p className="text-slate-500">No attachments</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions Footer */}
                {showActions && (
                    <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                        {/* BURF / PRF: Reject Button */}
                        {(variant === 'BURF' || variant === 'PRF') && canReject && (
                            <button
                                onClick={onReject}
                                disabled={isLoading}
                                className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/50 rounded-lg font-medium hover:bg-red-600/30 disabled:opacity-50 flex items-center gap-2"
                            >
                                <XCircle size={16} /> Reject
                            </button>
                        )}

                        {/* BURF / PRF: Approve Button */}
                        {(variant === 'BURF' || variant === 'PRF') && canApprove && (
                            <button
                                onClick={onApprove}
                                disabled={isLoading}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                <CheckCircle2 size={16} /> Approve
                            </button>
                        )}

                        {/* FINANCE: Release Fund Button */}
                        {variant === 'FINANCE' && canReleaseFund && (
                            <button
                                onClick={onReleaseFund}
                                disabled={isLoading}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                <DollarSign size={16} /> Release Fund
                            </button>
                        )}

                        {/* BURF Only: Prepare PRF Button */}
                        {variant === 'BURF' && canPreparePrf && (
                            <button
                                onClick={onPreparePrf}
                                disabled={isLoading}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                <FileText size={16} /> Prepare PRF
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default RequisitionDrawer;
