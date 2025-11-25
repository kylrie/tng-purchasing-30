import React, { useState } from 'react';
import type { Requisition } from '../../procurement/types';
import Card from '../../../shared/components/Card';

interface ReleaseFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (chequeNumber: string) => void;
  requisition: Requisition;
}

const ReleaseFundModal: React.FC<ReleaseFundModalProps> = ({ isOpen, onClose, onConfirm, requisition }) => {
  const [chequeNumber, setChequeNumber] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (chequeNumber.trim()) {
      onConfirm(chequeNumber.trim());
    } else {
      alert('Please enter a cheque number.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Release Funds</h2>
        <p className="text-slate-400 mb-6">
          Releasing funds for PRF: <span className="font-bold text-purple-400">{requisition.id}</span>
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="chequeNumber" className="block text-sm font-medium text-slate-300 mb-2">
              Cheque Number
            </label>
            <input
              id="chequeNumber"
              type="text"
              value={chequeNumber}
              onChange={(e) => setChequeNumber(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
              placeholder="Enter cheque number"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={onClose} className="px-6 py-2 text-slate-300 font-medium hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              Confirm Release
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ReleaseFundModal;
