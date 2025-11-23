import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, Users, Lock, ArrowRight } from 'lucide-react';

const LoginView = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = (role: string) => {
    setLoading(true);
    // Simulate login delay
    setTimeout(() => {
      // Map role string to proper User object
      let user;
      if (role === 'Admin') {
        user = {
          id: 'admin-1',
          name: 'Admin User',
          role: 'SUPER_ADMIN',
          avatar: '',
          email: 'admin@example.com',
          businessId: 'biz-1'
        };
      } else if (role === 'Approver') {
        user = {
          id: 'manager-1',
          name: 'Manager User',
          role: 'MANAGER',
          avatar: '',
          email: 'manager@example.com',
          businessId: 'biz-1'
        };
      } else {
        user = {
          id: 'employee-1',
          name: 'Employee User',
          role: 'EMPLOYEE',
          avatar: '',
          email: 'employee@example.com',
          businessId: 'biz-1'
        };
      }

      console.log(`Logged in as ${role}`, user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      setLoading(false);
      navigate('/');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 text-center bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">ProcureFlow</h1>
          <p className="text-blue-100">Secure Purchasing Management System</p>
        </div>

        <div className="p-8">
          <div className="mb-8 text-center">
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Staging Role Simulator</h2>
            <p className="text-slate-500 text-sm">Select a role to simulate the user experience</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handleLogin('Employee')}
              disabled={loading}
              className="w-full group relative flex items-center p-4 border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all duration-200 text-left"
            >
              <div className="bg-blue-50 p-3 rounded-lg mr-4 group-hover:bg-blue-100 transition-colors">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800">Employee</h3>
                <p className="text-xs text-slate-500">Standard access for requests</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => handleLogin('Approver')}
              disabled={loading}
              className="w-full group relative flex items-center p-4 border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all duration-200 text-left"
            >
              <div className="bg-indigo-50 p-3 rounded-lg mr-4 group-hover:bg-indigo-100 transition-colors">
                <Shield className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800">Approver</h3>
                <p className="text-xs text-slate-500">Review and approve requests</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => handleLogin('Admin')}
              disabled={loading}
              className="w-full group relative flex items-center p-4 border border-slate-200 rounded-xl hover:border-purple-500 hover:shadow-md transition-all duration-200 text-left"
            >
              <div className="bg-purple-50 p-3 rounded-lg mr-4 group-hover:bg-purple-100 transition-colors">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800">Admin</h3>
                <p className="text-xs text-slate-500">Full system configuration</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 transform group-hover:translate-x-1 transition-all" />
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              {loading ? 'Authenticating...' : 'Protected by enterprise-grade security'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
