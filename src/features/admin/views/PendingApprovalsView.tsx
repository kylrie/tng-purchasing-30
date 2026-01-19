import React from 'react';
import type { User } from '../../../shared/types/firebase.types';
import Card from '../../../shared/components/Card';
import { Check, X } from 'lucide-react';
import { getAvatarWithFallback } from '../../../shared/utils/avatarUtils';

interface PendingApprovalsViewProps {
  pendingUsers: User[];
  onApproveUser: (userId: string) => void;
  onRejectUser: (userId: string) => void;
  loadingUserId: string | null;
}

export const PendingApprovalsView: React.FC<PendingApprovalsViewProps> = ({ pendingUsers, onApproveUser, onRejectUser, loadingUserId }) => {
  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <Card>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white mb-6">Pending User Approvals</h1>
          {pendingUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">No pending approvals at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingUsers.map((user) => (
                <div key={user.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img src={getAvatarWithFallback(user.avatar, user.name)} alt={user.name} className="w-12 h-12 rounded-full border-2 border-slate-600" />
                    <div>
                      <h3 className="font-semibold text-white">{user.name}</h3>
                      <p className="text-sm text-slate-400">{user.email}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Requested Role: <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400">{user.role}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-center">
                    <button
                      onClick={() => onApproveUser(user.id)}
                      disabled={!!loadingUserId}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      {loadingUserId === user.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => onRejectUser(user.id)}
                      disabled={!!loadingUserId}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      {loadingUserId === user.id ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default PendingApprovalsView;
