import React, { useState, useEffect } from 'react';
import type { Requisition } from '../../procurement/types';
import Card from '../../../shared/components/Card';
import { CheckCircle, FileText, ExternalLink, Edit3 } from 'lucide-react';

interface ReleaseFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (chequeNumber: string, chequeImageUrl: string) => void;
  requisition: Requisition;
}

type InputMode = 'existing' | 'manual';

const ReleaseFundModal: React.FC<ReleaseFundModalProps> = ({ isOpen, onClose, onConfirm, requisition }) => {
  // Determine if existing check info is available
  const hasExistingCheckInfo = !!requisition.chequeNumber;

  // Default to 'existing' if check info exists, otherwise 'manual'
  const [mode, setMode] = useState<InputMode>(hasExistingCheckInfo ? 'existing' : 'manual');

  // Manual input fields
  const [manualChequeNumber, setManualChequeNumber] = useState('');
  const [manualChequeImageUrl, setManualChequeImageUrl] = useState('');

  // Reset state when modal opens/closes or requisition changes
  useEffect(() => {
    if (isOpen) {
      setMode(hasExistingCheckInfo ? 'existing' : 'manual');
      setManualChequeNumber('');
      setManualChequeImageUrl('');
    }
  }, [isOpen, hasExistingCheckInfo]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (mode === 'existing') {
      if (!requisition.chequeNumber) {
        alert('No check information available. Please use manual entry.');
        return;
      }
      onConfirm(requisition.chequeNumber, requisition.chequeImageUrl || '');
    } else {
      // Manual mode
      if (!manualChequeNumber.trim()) {
        alert('Please enter a check number.');
        return;
      }
      onConfirm(manualChequeNumber.trim(), manualChequeImageUrl.trim());
    }
  };

  const canConfirm = mode === 'existing'
    ? !!requisition.chequeNumber
    : !!manualChequeNumber.trim();

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

        {/* Mode Toggle - Only show if existing check info is available */}
        {hasExistingCheckInfo && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('existing')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${mode === 'existing'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
            >
              Use Check Prep Info
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${mode === 'manual'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
            >
              <Edit3 size={14} />
              Enter Manually
            </button>
          </div>
        )}

        {/* Existing Check Info Display */}
        {mode === 'existing' && hasExistingCheckInfo && (
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
              <FileText className="text-amber-400" size={20} />
              <div>
                <p className="text-xs text-slate-500 uppercase">Check Number</p>
                <p className="text-white font-mono font-medium">{requisition.chequeNumber}</p>
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
        )}

        {/* Manual Input Fields */}
        {mode === 'manual' && (
          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="chequeNumber" className="block text-sm font-medium text-slate-300 mb-2">
                Check Number <span className="text-red-400">*</span>
              </label>
              <input
                id="chequeNumber"
                type="text"
                value={manualChequeNumber}
                onChange={(e) => setManualChequeNumber(e.target.value)}
                placeholder="Enter check number"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="chequeImageUrl" className="block text-sm font-medium text-slate-300 mb-2">
                Check Image URL <span className="text-slate-500">(optional)</span>
              </label>
              <input
                id="chequeImageUrl"
                type="text"
                value={manualChequeImageUrl}
                onChange={(e) => setManualChequeImageUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">
                Paste a Google Drive link to the check image
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
          <button onClick={onClose} className="px-6 py-2 text-slate-300 font-medium hover:bg-slate-700 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
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
