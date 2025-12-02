import React, { useState } from 'react';
import { ShoppingCart, Mail, Lock, Sparkles, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import RegistrationModal from './RegistrationModal';
import { UserRole } from '../../../shared/types/firebase.types';

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.222 0-9.618-3.66-11.283-8.598l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.015 35.938 44 30.338 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

const LoginView = () => {
  const { loginWithEmail, loginWithGoogle, completeNewUserRegistration, isNewUser, loading, error, setError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleFlow, setIsGoogleFlow] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsGoogleFlow(false);
    await loginWithEmail(email, password);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleFlow(true);
    await loginWithGoogle();
  };

  const handleRegistrationSubmit = async (role: UserRole, businessId: string, password?: string) => {
    await completeNewUserRegistration(role, businessId, password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {isNewUser && <RegistrationModal onRegister={handleRegistrationSubmit} loading={loading} isGoogleSignIn={isGoogleFlow} />}

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative max-w-md w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-3xl blur-xl"></div>
        <div className="relative bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 overflow-hidden">
          <div className="p-8 text-center relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500"></div>
            <div className="relative mx-auto w-20 h-20 mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl blur-lg opacity-60 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-purple-600 to-cyan-600 w-20 h-20 rounded-2xl flex items-center justify-center transform hover:scale-110 transition-transform duration-300">
                <ShoppingCart className="w-10 h-10 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">TES</h1>
            <p className="text-slate-400 flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> TNG ERP System</p>
          </div>

          <div className="p-8 pt-0">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2"><Mail className="w-4 h-4" /> Email Address</label>
                <div className="relative">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500" required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2"><Lock className="w-4 h-4" /> Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 pr-12" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full group relative px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-xl font-semibold overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50">
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Authenticating...</>) : (<>Sign In <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>)}
                </span>
              </button>
            </form>

            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-slate-700/50"></div>
              <span className="text-xs text-slate-500">OR</span>
              <div className="flex-1 h-px bg-slate-700/50"></div>
            </div>

            <button onClick={handleGoogleSignIn} disabled={loading} className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-700 rounded-xl text-white font-semibold transition-all duration-300 disabled:opacity-50">
              <GoogleIcon />
              Sign in with Google
            </button>

            <div className="mt-6 pt-6 border-t border-slate-700/50 text-center">
              <p className="text-xs text-slate-500">🔒 Secured by enterprise-grade encryption</p>
            </div>
          </div>
        </div>

        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-2 bg-gradient-to-r from-purple-500/0 via-cyan-500/50 to-purple-500/0 blur-xl"></div>
      </div>
    </div>
  );
};

export default LoginView;
