import React, { useState } from 'react';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import Card from '../../../shared/components/Card';
import ReleaseFundModal from '../components/ReleaseFundModal'; // Import the new modal
import { hasGlobalAccess } from '../../procurement/types';

interface LiquidationViewProps {
  currentUser: User;
  requisitions: Requisition[];
  getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
  handleReleaseFunds: (id: string, chequeNumber: string) => void; // Update to accept chequeNumber
  businesses: Business[];
}

export const LiquidationView: React.FC<LiquidationViewProps> = ({
  currentUser,
  requisitions,
  getStatusBadge,
  handleReleaseFunds,
  businesses,
}) => {
  const [isReleaseModalOpen, setReleaseModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);

  const canView = hasGlobalAccess(currentUser.role);

  if (!canView) {
    return (
      <div className="text-center text-slate-400">You do not have permission to view this page.</div>
    );
  }

  const handleRelease = (req: Requisition) => {
    setSelectedReq(req);
    setReleaseModalOpen(true);
  };

  const confirmRelease = (chequeNumber: string) => {
    if (selectedReq) {
      handleReleaseFunds(selectedReq.id, chequeNumber);
      setReleaseModalOpen(false);
      setSelectedReq(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Finance & Liquidation</h1>
        <Card className="!p-0">
          <table className="w-full text-left text-sm text-white">
            <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
              <tr>
                <th className="px-6 py-4">PRF ID</th>
                <th className="px-6 py-4">Business Unit</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Cheque No.</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {requisitions.map(req => (
                <tr key={req.id} className="hover:bg-slate-800/60">
                  <td className="px-6 py-4 font-medium">{req.id}</td>
                  <td className="px-6 py-4 text-slate-300">
                    {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4">₱{req.totalAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-purple-400 font-medium">{req.chequeNumber || '-'}</td>
                  <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                  <td className="px-6 py-4 text-right">
                    {req.status === RequisitionStatus.APPROVED_FOR_PAYMENT && (
                      <button onClick={() => handleRelease(req)} className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 font-medium">
                        Release Fund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      {selectedReq && (
        <ReleaseFundModal
          isOpen={isReleaseModalOpen}
          onClose={() => setReleaseModalOpen(false)}
          onConfirm={confirmRelease}
          requisition={selectedReq}
        />
      )}
    </>
  );
};

export default LiquidationView;
