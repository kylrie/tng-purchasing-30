import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { Business, RoleType } from '../../procurement/types';
import { COLLECTIONS } from '../../../shared/types/firebase.types';
import { useRoleOptions } from '../../../hooks/useRoleOptions';
import { AlertCircle, ArrowRight } from 'lucide-react';

interface RegistrationModalProps {
  onRegister: (role: RoleType, businessId: string, password?: string) => void;
  loading: boolean;
  isGoogleSignIn: boolean;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ onRegister, loading, isGoogleSignIn }) => {
  const { roleOptions, defaultRole, isLoading: rolesLoading } = useRoleOptions();
  const [role, setRole] = useState<string>(defaultRole);
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
        setError('Could not load operational entities.');
      }
    };
    fetchBusinesses();
  }, []);

  const handleSubmit = () => {
    setError('');
    if (isGoogleSignIn && (!password || password.length < 6)) {
      setError("Security Protocol: Password must be at least 6 characters.");
      return;
    }
    if (isGoogleSignIn && password !== confirmPassword) {
      setError("Security Protocol: Passwords do not match.");
      return;
    }
    if (!selectedBusinessId) {
      setError("Configuration: Please select a Operational Entity.");
      return;
    }
    onRegister(role, selectedBusinessId, password);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-[60px] flex items-center justify-center z-[200] p-4 animate-in fade-in duration-1000">
      <div className="relative max-w-[520px] w-full animate-in zoom-in-up duration-1000 scale-[1.02]">
        {/* Cinematic Backdrop Glows */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] animate-pulse-slow delay-1000"></div>

        <div className="relative glass-cinematic rounded-[40px] shadow-[0_0_120px_-30px_rgba(0,0,0,1)] border border-white/10 overflow-hidden p-12">
          {/* Progress Indication */}
          <div className="flex justify-center mb-10">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 rounded-full border border-cyan-500/20">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400/80">Calibration Required</span>
            </div>
          </div>

          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-white tracking-[-0.05em] mb-4">Finalize Orchestration</h2>
            <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-sm mx-auto">
              Configure your operational role and operational entity to initialize the TES Cinematic Ecosystem.
            </p>
          </div>

          <div className="space-y-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">Integrated Role</label>
              <div className="relative group">
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  disabled={rolesLoading}
                  className="w-full px-6 py-5 bg-white/[0.03] border border-white/5 rounded-2xl text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-500 appearance-none cursor-pointer font-bold text-sm tracking-wide"
                >
                  {rolesLoading ? (
                    <option className="bg-[#0A0A0A]">Syncing Roles...</option>
                  ) : (
                    roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#111] border-none">
                        {opt.label}
                      </option>
                    ))
                  )}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-700 group-hover:text-cyan-400 transition-colors">
                  <ArrowRight className="w-5 h-5 rotate-90" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">Entity Mapping</label>
              <div className="relative group">
                <select
                  value={selectedBusinessId}
                  onChange={e => setSelectedBusinessId(e.target.value)}
                  className="w-full px-6 py-5 bg-white/[0.03] border border-white/5 rounded-2xl text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-500 appearance-none cursor-pointer font-bold text-sm tracking-wide"
                >
                  <option value="" className="bg-[#0A0A0A]">Select Operational Entity...</option>
                  {businesses.map(b => (
                    <option key={b.id} value={b.id} className="bg-[#111]">
                      {b.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-700 group-hover:text-cyan-400 transition-colors">
                  <ArrowRight className="w-5 h-5 rotate-90" />
                </div>
              </div>
            </div>

            {isGoogleSignIn && (
              <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)]">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">Establish Security Key</label>
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-6 py-5 bg-white/[0.03] border border-white/5 rounded-2xl text-white placeholder-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-500 font-bold tracking-widest"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">Verify Security Key</label>
                  <input
                    type="password"
                    placeholder="Verify characters"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-6 py-5 bg-white/[0.03] border border-white/5 rounded-2xl text-white placeholder-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-500 font-bold tracking-widest"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-5 bg-red-500/5 border border-red-500/10 rounded-2xl text-red-200 text-[10px] font-black flex items-center gap-4 animate-shake uppercase tracking-[0.1em]">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Protocol Alert: {error}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || rolesLoading}
              className="w-full relative group h-16 bg-white text-black hover:bg-slate-50 rounded-2xl font-black transition-all duration-500 disabled:opacity-50 overflow-hidden mt-6 shadow-[0_20px_40px_-10px_rgba(255,255,255,0.1)] flex items-center justify-center gap-4 uppercase tracking-[0.2em] text-[14px]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                  <span>Syndicating...</span>
                </div>
              ) : (
                <>
                  <span>Initialize Ecosystem</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationModal;
