import React from 'react';
import { Wrench, Clock, ShieldCheck } from 'lucide-react';

const MaintenanceView: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl p-8 text-center border border-slate-100">
                <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Wrench size={40} className="text-brand-600" />
                </div>

                <h1 className="text-3xl font-bold text-slate-900 mb-4">System Under Maintenance</h1>

                <p className="text-slate-500 text-lg mb-8 leading-relaxed">
                    The TNG Procurement System is currently undergoing scheduled maintenance and upgrades to serve you better.
                </p>

                <div className="bg-slate-50 rounded-xl p-6 mb-8 text-left space-y-4">
                    <div className="flex items-start gap-3">
                        <Clock size={20} className="text-brand-600 mt-0.5 shrink-0" />
                        <div>
                            <h3 className="font-semibold text-slate-900">Expected Duration</h3>
                            <p className="text-slate-500 text-sm">We expect to be back online shortly.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <ShieldCheck size={20} className="text-brand-600 mt-0.5 shrink-0" />
                        <div>
                            <h3 className="font-semibold text-slate-900">Data Security</h3>
                            <p className="text-slate-500 text-sm">Your data is safe and secure during this process.</p>
                        </div>
                    </div>
                </div>

                <div className="text-xs text-slate-400">
                    For urgent concerns, please contact the IT Department.
                </div>
            </div>

            <p className="mt-8 text-slate-400 text-sm">
                &copy; {new Date().getFullYear()} The Next Generation Procurement
            </p>
        </div>
    );
};

export default MaintenanceView;
