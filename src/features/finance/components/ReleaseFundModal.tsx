import React from 'react';
import type { Requisition } from '../../procurement/types';
import Card from '../../../shared/components/Card';
import { CheckCircle, FileText, ExternalLink } from 'lucide-react';

interface ReleaseFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  requisition: Requisition;
}

const ReleaseFundModal: React.FC<ReleaseFundModalProps> = ({ isOpen, onClose, onConfirm, requisition }) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!requisition.chequeNumber) {
      alert('Check information is missing. Please complete the Check Preparation step first.');
      return;
    }
    onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Release Funds</h2>
        <p className="text-slate-400 mb-6">
          Confirm fund release for PRF: <span className="font-bold text-purple-400">{requisition.id}</span>
        </p>

        {/* Display Amount */}
        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Amount to Release</span>
            <span className="text-emerald-400 font-bold text-xl">
              ₱{requisition.totalAmount?.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Display Check Info from Check Prep step */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
            <FileText className="text-amber-400" size={20} />
            <div>
              <p className="text-xs text-slate-500 uppercase">Check Number</p>
              <p className="text-white font-mono font-medium">{requisition.chequeNumber || 'Not provided'}</p>
            </div>
          </div>

          {requisition.chequeImageUrl && (
            <a
              href={requisition.chequeImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-blue-500 transition-colors"
            >
              <ExternalLink className="text-blue-400" size={20} />
              <div>
                <p className="text-xs text-slate-500 uppercase">Check Image</p>
                <p className="text-blue-400 text-sm underline">View Check Document</p>
              </div>
            </a>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
          <button onClick={onClose} className="px-6 py-2 text-slate-300 font-medium hover:bg-slate-700 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!requisition.chequeNumber}
            className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CheckCircle size={18} />
            Confirm Release
          </button>
        </div>
      </Card>
    </div>
  );
};

export default ReleaseFundModal;
