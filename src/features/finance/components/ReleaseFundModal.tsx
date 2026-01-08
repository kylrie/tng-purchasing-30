import React, { useState, useEffect } from 'react';
import type { Requisition } from '../../procurement/types';
import Card from '../../../shared/components/Card';
import { CheckCircle, FileText, ExternalLink, Hash, Link as LinkIcon } from 'lucide-react';

interface ReleaseFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (checkVoucherNumber: string, checkVoucherLink: string) => void;
  requisition: Requisition;
}

const ReleaseFundModal: React.FC<ReleaseFundModalProps> = ({ isOpen, onClose, onConfirm, requisition }) => {
  // Check Voucher input fields
  const [checkVoucherNumber, setCheckVoucherNumber] = useState('');
  const [checkVoucherLink, setCheckVoucherLink] = useState('');
  // FIX: Replace alert() with inline validation state
  const [validationError, setValidationError] = useState<string | null>(null);

  // Helper to ensure URL is absolute (starts with http:// or https://)
  const ensureAbsoluteUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  };

  // Get Bank Ref info from Check Prep step (new fields or fallback to legacy)
  const bankRefNumber = requisition.bankRefNumber || requisition.chequeNumber;
  const rawBankRefLink = requisition.bankRefLink || requisition.chequeImageUrl;
  const bankRefLink = ensureAbsoluteUrl(rawBankRefLink || '');
  const hasBankRefInfo = !!bankRefNumber;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCheckVoucherNumber('');
      setCheckVoucherLink('');
      setValidationError(null); // FIX: Also reset validation error
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    // FIX: Replace alert() with inline validation
    if (!checkVoucherNumber.trim()) {
      setValidationError('Please enter a Check Voucher #.');
      return;
    }
    setValidationError(null);
    onConfirm(checkVoucherNumber.trim(), checkVoucherLink.trim());
  };

  const canConfirm = !!checkVoucherNumber.trim();

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

        {/* Validation Error Display */}
        {validationError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
            {validationError}
          </div>
        )}

        {/* Bank Reference Info from Check Prep */}
        {hasBankRefInfo && (
          <div className="mb-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-500 uppercase mb-2 font-medium">From Check Prep</p>
            <div className="flex items-center gap-3 mb-2">
              <FileText className="text-amber-400" size={18} />
              <div>
                <p className="text-xs text-slate-500">Bank Ref #</p>
                <p className="text-white font-mono font-medium">{bankRefNumber}</p>
              </div>
            </div>
            {bankRefLink && (
              <a
                href={bankRefLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                <ExternalLink size={14} />
                View Reference Document
              </a>
            )}
          </div>
        )}

        {/* Check Voucher Input Section */}
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="checkVoucherNumber" className="block text-sm font-medium text-slate-300 mb-2">
              <Hash className="w-4 h-4 inline mr-2" />
              Check Voucher # <span className="text-red-400">*</span>
            </label>
            <input
              id="checkVoucherNumber"
              type="text"
              value={checkVoucherNumber}
              onChange={(e) => setCheckVoucherNumber(e.target.value)}
              placeholder="Enter check voucher number"
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="checkVoucherLink" className="block text-sm font-medium text-slate-300 mb-2">
              <LinkIcon className="w-4 h-4 inline mr-2" />
              Voucher Link <span className="text-slate-500">(optional)</span>
            </label>
            <input
              id="checkVoucherLink"
              type="text"
              value={checkVoucherLink}
              onChange={(e) => setCheckVoucherLink(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              Paste a Google Drive link to the voucher document
            </p>
          </div>
        </div>

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
