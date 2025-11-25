import React, { useState } from 'react';
import { UserRole } from '../../../shared/types/firebase.types';

interface RegistrationModalProps {
  onRegister: (role: UserRole, password?: string) => void;
  loading: boolean;
  isGoogleSignIn: boolean;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ onRegister, loading, isGoogleSignIn }) => {
  const [role, setRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = () => {
    if (isGoogleSignIn && password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    onRegister(role, password);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-sm w-full relative">
        <h2 className="text-2xl font-bold text-white mb-4">Complete Registration</h2>
        <p className="text-slate-400 mb-6">Welcome! Since this is your first time, please select your role and set a password.</p>

        <div className="space-y-4">
          <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500">
            <option value={UserRole.EMPLOYEE}>Employee</option>
            <option value={UserRole.MANAGER}>Manager</option>
            <option value={UserRole.PURCHASING_OFFICER}>Purchasing Officer</option>
            <option value={UserRole.FINANCE}>Finance</option>
            <option value={UserRole.CIC}>Inventory Checker</option>
          </select>

          {isGoogleSignIn && (
            <>
              <input
                type="password"
                placeholder="Create Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
              />
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
              />
            </>
          )}

          <button onClick={handleSubmit} disabled={loading} className="w-full flex justify-center items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold disabled:opacity-50">
            {loading ? 'Registering...' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationModal;
