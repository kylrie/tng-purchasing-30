import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Mail, Sparkles, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { ThemeToggle } from '../../../shared/components/ThemeToggle';
import { useAuth } from '../../../contexts/useAuth';
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
  const { currentUser, loginWithEmail, loginWithGoogle, completeNewUserRegistration, isNewUser, loading, error, setError } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleFlow, setIsGoogleFlow] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Race-proof post-login redirect: once authentication resolves (currentUser
  // set by onAuthStateChanged after its Firestore read), leave /login for the
  // page the user originally requested. Reading `from` HERE — where it reliably
  // exists — avoids the imperative-navigate race that previously bounced deep
  // links (e.g. /qr-hub) back to '/'. Declared after all hooks (Rules of Hooks).
  if (currentUser) {
    const from = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
    // Preserve the FULL original location (query + hash), not just the pathname —
    // deep links carry state there (e.g. the QR admin's ?bu=<businessUnitId>, which
    // must survive the login round-trip or the page reopens with no business).
    const target = from?.pathname && from.pathname !== '/login'
      ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
      : '/';
    return <Navigate to={target} replace />;
  }

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

  const handleMouseMove = (e: React.MouseEvent) => {
    // Disable parallax on mobile/touch devices for performance
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

    // Throttle slightly using requestAnimationFrame would be better, but basic check helps
    const { clientX, clientY } = e;
    const moveX = (clientX - window.innerWidth / 2) / 30;
    const moveY = (clientY - window.innerHeight / 2) / 30;
    setMousePos({ x: moveX, y: moveY });
  };

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-[#020202] text-slate-900 dark:text-white overflow-hidden font-sans selection:bg-cyan-500/30 cursor-default transition-colors duration-500"
      onMouseMove={handleMouseMove}
    >
      {isNewUser && <RegistrationModal onRegister={handleRegistrationSubmit} loading={loading} isGoogleSignIn={isGoogleFlow} />}

      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-700 delay-500">
        <ThemeToggle />
      </div>

      {/* Cinematic Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-opacity duration-700">
        {/* Deep Background Asset (Dark Only) */}
        <div
          className="absolute inset-[-10%] transition-transform duration-[1.5s] ease-[cubic-bezier(0.22,1,0.36,1)] saturate-[1.5] brightness-[0.4] blur-[2px] opacity-0 dark:opacity-100"
          style={{
            backgroundImage: 'url("/login-bg.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: `translate3d(${mousePos.x * 0.2}px, ${mousePos.y * 0.2}px, 0) scale(1.1)`
          }}
        />

        {/* Light Mode Soft Gradient (Light Only) */}
        <div
          className="absolute inset-0 bg-slate-50 opacity-100 dark:opacity-0 transition-opacity duration-700"
        />

        {/* Dynamic Light Blobs */}
        {/* Dynamic Light Blobs (Adaptive) */}
        <div
          className="absolute top-[20%] left-[30%] w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slow bg-purple-300/30 dark:bg-purple-600/10 mix-blend-multiply dark:mix-blend-normal"
          style={{ transform: `translate3d(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px, 0)` }}
        ></div>
        <div
          className="absolute bottom-[10%] right-[20%] w-[600px] h-[600px] rounded-full blur-[130px] animate-pulse-slow delay-1000 bg-cyan-300/30 dark:bg-cyan-600/10 mix-blend-multiply dark:mix-blend-normal"
          style={{ transform: `translate3d(${mousePos.x * -0.3}px, ${mousePos.y * -0.3}px, 0)` }}
        ></div>

        {/* Cinematic Vignette */}
        {/* Cinematic Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-transparent to-[#020202] opacity-0 dark:opacity-80 transition-opacity duration-700"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#020202] via-transparent to-[#020202] opacity-0 dark:opacity-80 transition-opacity duration-700"></div>
      </div>

      {/* Content Layer: Unified Stage */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6 lg:p-12 animate-cinematic-bloom">

        {/* Logo & Platform Identity */}
        <div className="flex flex-col items-center mb-10 lg:mb-16 text-center animate-in fade-in zoom-in-up duration-1000">
          <div className="relative w-20 h-20 mb-8 group">
            <div className="absolute inset-0 bg-cyan-500/40 rounded-[24px] blur-2xl group-hover:bg-purple-500/40 transition-colors duration-700"></div>
            <div className="relative w-20 h-20 bg-black/40 backdrop-blur-md rounded-[24px] border border-white/10 flex items-center justify-center overflow-hidden rotate-[-3deg] group-hover:rotate-[3deg] transition-transform duration-700 shadow-2xl">
              <ShoppingCart className="w-10 h-10 text-white" strokeWidth={1.5} />
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-purple-500/20"></div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-200 dark:border-white/5 mb-6 bg-white/50 dark:bg-white/5 backdrop-blur-sm shadow-sm dark:shadow-none">
            <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-white/50">Next Experience Integrated</span>
          </div>

          <h1 className="text-[80px] lg:text-[120px] font-black tracking-[-0.08em] leading-[0.8] text-slate-900 dark:text-white mb-6 drop-shadow-sm dark:drop-shadow-none">
            TES<span className="text-cyan-600 dark:text-cyan-500">.</span>
          </h1>
          <p className="text-[12px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-[0.5em] mb-4">Thenextperience ERP System</p>
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/20 to-transparent"></div>
        </div>

        {/* Cinematic Login Stage */}
        <div className="w-full max-w-[440px] relative group delay-300">
          {/* Moving Light Trail Border Animation */}
          <div className="absolute -inset-[1px] rounded-[32px] overflow-hidden pointer-events-none opacity-50">
            <div className="light-trail"></div>
          </div>

          <div className="glass-cinematic bg-white/80 dark:bg-white/5 rounded-[32px] p-8 lg:p-12 shadow-2xl dark:shadow-[0_0_100px_-20px_rgba(0,0,0,1)] border border-white/20 dark:border-white/10 backdrop-blur-xl">
            <div className="mb-10">
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-2">Initialize Session</h2>
              <p className="text-sm text-slate-500 font-medium">Verify your organizational credentials.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.2em] ml-1">Identity Access</label>
                <div className="relative group/input">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="professional@thenextperience.com"
                    className="w-full px-6 py-4 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-500 font-medium text-sm shadow-sm dark:shadow-none"
                    required
                  />
                  <Mail className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-700 group-focus-within/input:text-cyan-600 dark:group-focus-within/input:text-cyan-400 transition-colors" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.2em]">Security Protocol</label>
                  <button type="button" className="text-[9px] font-black text-slate-400 dark:text-white/30 hover:text-cyan-600 dark:hover:text-cyan-400 uppercase tracking-widest transition-colors">Reset Key</button>
                </div>
                <div className="relative group/input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-6 py-5 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-500 font-medium text-sm tracking-[0.3em] shadow-sm dark:shadow-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-slate-400 dark:text-slate-700 hover:text-slate-600 dark:hover:text-white transition-colors duration-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/10 rounded-2xl text-red-100 text-[10px] font-black flex items-center gap-3 animate-shake uppercase tracking-widest">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Security Alert: {error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group h-16 bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-50 rounded-2xl font-black transition-all duration-500 disabled:opacity-50 overflow-hidden flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-[13px] shadow-xl dark:shadow-[0_20px_40px_-10px_rgba(255,255,255,0.1)] active:scale-[0.98]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                    <span>Syndicating...</span>
                  </div>
                ) : (
                  <>
                    <span>Access Platform</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="my-8 flex items-center gap-4 opacity-30">
              <div className="flex-1 h-px bg-slate-300 dark:bg-white/20"></div>
              <span className="text-[8px] font-black text-slate-400 dark:text-white uppercase tracking-[0.4em]">Integrated Auth</span>
              <div className="flex-1 h-px bg-slate-300 dark:bg-white/20"></div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 h-14 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-700 dark:text-white font-bold transition-all duration-500 disabled:opacity-50 group hover:border-cyan-500/30 shadow-sm dark:shadow-none"
            >
              <GoogleIcon />
              <span className="text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors text-[12px] font-black uppercase tracking-widest">Connect Workspace</span>
            </button>
          </div>
        </div>

        {/* Global ERP Positioning Footer */}
        <div className="mt-16 lg:mt-24 flex flex-col items-center gap-8 animate-in fade-in delay-1000">
          <div className="hidden lg:flex gap-12 text-[10px] font-black text-slate-400 dark:text-white/20 uppercase tracking-[0.4em]">
            <span className="hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer transition-colors duration-500">Finance Control</span>
            <span className="hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer transition-colors duration-500">Global Supply</span>
            <span className="hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer transition-colors duration-500">HR Orchestration</span>
            <span className="hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer transition-colors duration-500">Asset Mgmt</span>
          </div>

          <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400 dark:text-slate-700 italic">
            <span>Thenextperience Cinematic Ecosystem v3.0</span>
            <div className="w-1 h-1 bg-slate-400 dark:bg-slate-800 rounded-full"></div>
            <span>End-to-End Encryption Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
