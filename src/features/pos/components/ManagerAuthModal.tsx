import React, { useState } from 'react';
import type { User } from '../../../shared/types';
import { X, KeyRound } from 'lucide-react';

interface ManagerAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    users: User[];
    superAdminPin?: string;
    businessUnitId: string;
}

export const ManagerAuthModal: React.FC<ManagerAuthModalProps> = ({ 
    isOpen, 
    onClose, 
    onSuccess,
    users,
    superAdminPin,
    businessUnitId
}) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleNumberClick = (num: string) => {
        if (pin.length < 6) {
            setPin(prev => prev + num);
            setError('');
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
        setError('');
    };

    const handleClear = () => {
        setPin('');
        setError('');
    };

    const handleVerify = () => {
        if (!pin) {
            setError('Please enter a PIN');
            return;
        }

        // Check Super Admin
        if (superAdminPin && pin === superAdminPin) {
            setPin('');
            onSuccess();
            return;
        }

        // Check Manager in Users
        const manager = users.find(u => 
            u.posPin === pin && 
            ['MANAGER', 'SUPER_ADMIN'].includes(u.role) &&
            (u.businessId === businessUnitId || u.businessUnitIds?.includes(businessUnitId))
        );

        if (manager) {
            setPin('');
            onSuccess();
        } else {
            setError('Invalid Manager PIN');
            setPin('');
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full relative border border-slate-700 animate-in fade-in zoom-in duration-200">
                <button
                    onClick={() => {
                        setPin('');
                        setError('');
                        onClose();
                    }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                        <KeyRound className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Manager Authorization</h2>
                    <p className="text-slate-400 text-sm">Please enter a Manager PIN to proceed</p>
                </div>

                <div className="mb-6 flex justify-center gap-3">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                        <div
                            key={index}
                            className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                                pin.length > index
                                    ? 'bg-indigo-500 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                                    : 'bg-slate-900 border-slate-700'
                            }`}
                        />
                    ))}
                </div>

                {error && (
                    <div className="mb-4 text-red-400 text-sm text-center font-medium bg-red-500/10 py-2 rounded-lg">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                            key={num}
                            onClick={() => handleNumberClick(num.toString())}
                            className="aspect-square bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-2xl font-bold rounded-xl transition-colors"
                        >
                            {num}
                        </button>
                    ))}
                    <button
                        onClick={handleClear}
                        className="aspect-square bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-400 font-bold rounded-xl transition-colors uppercase tracking-wider text-sm"
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => handleNumberClick('0')}
                        className="aspect-square bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-2xl font-bold rounded-xl transition-colors"
                    >
                        0
                    </button>
                    <button
                        onClick={handleDelete}
                        className="aspect-square bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center"
                    >
                        <X className="w-8 h-8" />
                    </button>
                </div>

                <button
                    onClick={handleVerify}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all text-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={pin.length === 0}
                >
                    Verify
                </button>
            </div>
        </div>
    );
};
