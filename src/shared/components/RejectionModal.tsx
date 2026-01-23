import React, { useState, useEffect } from 'react';
import { XCircle } from 'lucide-react';
import Card from './Card';

interface RejectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    title?: string;
}

const RejectionModal: React.FC<RejectionModalProps> = ({ isOpen, onClose, onConfirm, title = "Reject Request" }) => {
    const [reason, setReason] = useState('');

    // FIX: Reset reason when modal opens to prevent stale state
    useEffect(() => {
        if (isOpen && reason !== '') {
            setReason('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-md !p-0 animate-in zoom-in-95 duration-200 bg-slate-800/90 border-slate-700">
                <div className="p-6 border-b border-slate-700">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <XCircle className="text-red-500" size={20} />
                        {title}
                    </h3>
                </div>
                <div className="p-6">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Reason for Rejection</label>
                    <textarea
                        className="w-full p-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:outline-none placeholder-slate-500 resize-none"
                        rows={4}
                        placeholder="Please provide a reason..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(reason)}
                        disabled={!reason.trim()}
                        className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-red-900/20"
                    >
                        Reject
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default RejectionModal;
