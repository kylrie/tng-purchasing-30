import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { UserRole } from '../../../shared/types/firebase.types';
import type { Business } from '../../procurement/types';
import { COLLECTIONS } from '../../../shared/types/firebase.types';

interface RegistrationModalProps {
  onRegister: (role: UserRole, businessId: string, password?: string) => void;
  loading: boolean;
  isGoogleSignIn: boolean;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ onRegister, loading, isGoogleSignIn }) => {
  const [role, setRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, COLLECTIONS.BUSINESSES));
        const businessesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
        setBusinesses(businessesData);
        if (businessesData.length > 0) {
          setSelectedBusinessId(businessesData[0].id);
        }
      } catch (err) {
        console.error("Error fetching businesses: ", err);
        setError('Could not load business units.');
      }
    };
    fetchBusinesses();
  }, []);

  const handleSubmit = () => {
    setError('');
    if (isGoogleSignIn && (!password || password.length < 6)) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (isGoogleSignIn && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!selectedBusinessId) {
        setError("Please select a Business Unit.");
        return;
    }
    onRegister(role, selectedBusinessId, password);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-sm w-full relative">
        <h2 className="text-2xl font-bold text-white mb-4">Complete Registration</h2>
        <p className="text-slate-400 mb-6">Welcome! To complete your sign-up, please provide the following details.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Select your Role</label>
            <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500">
                <option value={UserRole.EMPLOYEE}>Employee</option>
                <option value={UserRole.MANAGER}>Manager</option>
                <option value={UserRole.PURCHASING_OFFICER}>Purchasing Officer</option>
                <option value={UserRole.FINANCE}>Finance</option>
                <option value={UserRole.CIC}>Inventory Checker</option>
                <option value={UserRole.GENERAL_MANAGER}>General Manager</option>
                <option value={UserRole.BOARD_OF_DIRECTOR}>Board of Director</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Select your Business Unit</label>
            <select value={selectedBusinessId} onChange={e => setSelectedBusinessId(e.target.value)} className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500">
                <option value="">Choose a business unit...</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {isGoogleSignIn && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Create a Password</label>
                <input
                  type="password"
                  placeholder="Enter a new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button onClick={handleSubmit} disabled={loading} className="w-full flex justify-center items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold disabled:opacity-50">
            {loading ? 'Registering...' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationModal;
