import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Mail, Lock, Sparkles, ArrowRight, Eye, EyeOff } from 'lucide-react';

const LoginView = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate authentication
    setTimeout(() => {
      // Simple demo authentication - map emails to roles
      let user;
      if (email.includes('admin')) {
        user = {
          id: 'admin-1',
          name: 'Admin User',
          role: 'SUPER_ADMIN',
          avatar: '',
          email: email,
          businessId: 'biz-1'
        };
      } else if (email.includes('manager')) {
        user = {
          id: 'manager-1',
          name: 'Manager User',
          role: 'MANAGER',
          avatar: '',
          email: email,
          businessId: 'biz-1'
        };
      } else {
        user = {
          id: 'employee-1',
          name: 'Employee User',
          role: 'EMPLOYEE',
          avatar: '',
          email: email,
          businessId: 'biz-1'
        };
      }

      localStorage.setItem('currentUser', JSON.stringify(user));
      setLoading(false);
      navigate('/');
    }, 1000);
  };

  // Quick login for demo
  const quickLogin = (role: string) => {
    setLoading(true);
    let user;
    if (role === 'admin') {
      user = {
        id: 'admin-1',
        name: 'Admin User',
        role: 'SUPER_ADMIN',
        avatar: '',
        email: 'admin@procureflow.com',
        businessId: 'biz-1'
      };
    } else if (role === 'manager') {
      user = {
        id: 'manager-1',
        name: 'Manager User',
        role: 'MANAGER',
        avatar: '',
        email: 'manager@procureflow.com',
        businessId: 'biz-1'
      };
    } else {
      user = {
        id: 'employee-1',
        name: 'Employee User',
        role: 'EMPLOYEE',
        avatar: '',
        email: 'employee@procureflow.com',
        businessId: 'biz-1'
      };
    }

    localStorage.setItem('currentUser', JSON.stringify(user));
    setTimeout(() => {
      setLoading(false);
      navigate('/');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      {/* Login container */}
      <div className="relative max-w-md w-full">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-3xl blur-xl"></div>

        {/* Main card */}
        <div className="relative bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 overflow-hidden">
          {/* Header with icon */}
          <div className="p-8 text-center relative">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500"></div>

            {/* Cart icon with glow */}
            <div className="relative mx-auto w-20 h-20 mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl blur-lg opacity-60 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-purple-600 to-cyan-600 w-20 h-20 rounded-2xl flex items-center justify-center transform hover:scale-110 transition-transform duration-300">
                <ShoppingCart className="w-10 h-10 text-white" strokeWidth={2.5} />
              </div>
            </div>

            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">
              ProcureFlow
            </h1>
            <p className="text-slate-400 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              Next-Gen Purchasing System
            </p>
          </div>

          {/* Form */}
          <div className="p-8 pt-0">
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full group relative px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-xl font-semibold overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Quick Demo</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
            </div>

            {/* Quick login buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => quickLogin('employee')}
                disabled={loading}
                className="px-3 py-2 bg-slate-900/50 hover:bg-slate-900 border border-slate-700 hover:border-blue-500/50 rounded-lg text-xs text-slate-300 hover:text-white transition-all disabled:opacity-50"
              >
                Employee
              </button>
              <button
                onClick={() => quickLogin('manager')}
                disabled={loading}
                className="px-3 py-2 bg-slate-900/50 hover:bg-slate-900 border border-slate-700 hover:border-purple-500/50 rounded-lg text-xs text-slate-300 hover:text-white transition-all disabled:opacity-50"
              >
                Manager
              </button>
              <button
                onClick={() => quickLogin('admin')}
                disabled={loading}
                className="px-3 py-2 bg-slate-900/50 hover:bg-slate-900 border border-slate-700 hover:border-cyan-500/50 rounded-lg text-xs text-slate-300 hover:text-white transition-all disabled:opacity-50"
              >
                Admin
              </button>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-slate-700/50 text-center">
              <p className="text-xs text-slate-500">
                🔒 Secured by enterprise-grade encryption
              </p>
            </div>
          </div>
        </div>

        {/* Bottom glow accent */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-2 bg-gradient-to-r from-purple-500/0 via-cyan-500/50 to-purple-500/0 blur-xl"></div>
      </div>
    </div>
  );
};

export default LoginView;
