import React, { useState } from 'react';
import { UserRole } from '../shared/types/firebase.types';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { ALL_PERMISSIONS } from '../config/permissions';
import { X, Shield, Check } from 'lucide-react';

const RoleSimulator: React.FC = () => {
    const { currentUser, simulateRole } = useAuth();
    const { hasPermission } = usePermissions();
    const [isOpen, setIsOpen] = useState(false);

    if (!currentUser) return null;

    const roles = [
        { value: UserRole.SUPER_ADMIN, label: 'Super Admin' },
        { value: UserRole.ADMIN, label: 'Admin' },
        { value: UserRole.GENERAL_MANAGER, label: 'General Manager' },
        { value: UserRole.BOARD_OF_DIRECTOR, label: 'Board of Director' },
        { value: UserRole.MANAGER, label: 'Manager' },
        { value: UserRole.EMPLOYEE, label: 'Employee' },
        { value: UserRole.CIC, label: 'Inventory Checker (CIC)' },
        { value: UserRole.PURCHASING_OFFICER, label: 'Purchasing Officer' },
        { value: UserRole.FINANCE, label: 'Finance' },
        { value: UserRole.AUDITOR, label: 'Auditor' },
    ];

    const handleRoleChange = (role: UserRole) => {
        simulateRole(role);
        setIsOpen(false);
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110"
                title="Role Simulator"
            >
                <Shield size={24} />
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <Shield className="text-purple-400" size={28} />
                                    Role Simulator
                                </h2>
                                <p className="text-slate-400 text-sm mt-1">
                                    Test permissions by simulating different user roles
                                </p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Role Selection */}
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-4">Select Role</h3>
                                    <div className="space-y-2">
                                        {roles.map((role) => (
                                            <button
                                                key={role.value}
                                                onClick={() => handleRoleChange(role.value)}
                                                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${currentUser.role === role.value
                                                        ? 'bg-purple-600 text-white font-semibold'
                                                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                                                    }`}
                                            >
                                                {role.label}
                                                {currentUser.role === role.value && (
                                                    <span className="ml-2 text-xs bg-purple-500/30 px-2 py-1 rounded">
                                                        Current
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Permissions Display */}
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-4">
                                        Permissions for {currentUser.name}
                                    </h3>
                                    <div className="bg-slate-900/50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                                        <div className="space-y-2">
                                            {ALL_PERMISSIONS.map((permission) => {
                                                const granted = hasPermission(permission);
                                                return (
                                                    <div
                                                        key={permission}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded ${granted
                                                                ? 'bg-green-900/20 text-green-300'
                                                                : 'bg-slate-800/50 text-slate-500'
                                                            }`}
                                                    >
                                                        {granted ? (
                                                            <Check size={16} className="text-green-400 flex-shrink-0" />
                                                        ) : (
                                                            <X size={16} className="text-slate-600 flex-shrink-0" />
                                                        )}
                                                        <span className="text-sm font-mono">{permission}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-700 bg-slate-900/50">
                            <p className="text-xs text-slate-400 text-center">
                                💡 Tip: Changes are temporary and will reset on page refresh
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default RoleSimulator;
