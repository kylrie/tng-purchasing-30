import React, { useState } from 'react';
import type { Requisition } from '../../procurement/types';
import { X, Upload, Link as LinkIcon, FileText } from 'lucide-react';

interface CheckPrepModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (bankRefNumber: string, bankRefLink: string) => void;
    requisition: Requisition;
}

const CheckPrepModal: React.FC<CheckPrepModalProps> = ({ isOpen, onClose, onConfirm, requisition }) => {
    const [bankRefNumber, setBankRefNumber] = useState('');
    const [bankRefLink, setBankRefLink] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!bankRefNumber.trim()) {
            alert('Please enter a Bank Ref #.');
            return;
        }
        if (!bankRefLink.trim()) {
            alert('Please enter a Google Drive link for the reference document.');
            return;
        }

        setIsSubmitting(true);
        try {
            await onConfirm(bankRefNumber.trim(), bankRefLink.trim());
            setBankRefNumber('');
            setBankRefLink('');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
                {/* Header */}
                <div className="p-6 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/20 rounded-lg">
                                <FileText className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Bank Reference Entry</h2>
                                <p className="text-sm text-slate-400 font-mono">{requisition.id}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Amount Display */}
                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-sm">Amount</span>
                            <span className="text-emerald-400 font-bold text-xl">
                                ₱{requisition.totalAmount?.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Bank Ref # */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            <Upload className="w-4 h-4 inline mr-2" />
                            Bank Ref # *
                        </label>
                        <input
                            type="text"
                            value={bankRefNumber}
                            onChange={(e) => setBankRefNumber(e.target.value)}
                            placeholder="Enter bank reference number"
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                    </div>

                    {/* Reference Link */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            <LinkIcon className="w-4 h-4 inline mr-2" />
                            Reference Link (Google Drive) *
                        </label>
                        <input
                            type="url"
                            value={bankRefLink}
                            onChange={(e) => setBankRefLink(e.target.value)}
                            placeholder="https://drive.google.com/..."
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Paste a Google Drive link to the reference document
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !bankRefNumber.trim() || !bankRefLink.trim()}
                        className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="animate-spin">⟳</span>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4" />
                                Save Bank Ref
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckPrepModal;
