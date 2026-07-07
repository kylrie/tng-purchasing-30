import React, { useState } from 'react';
import type { User } from '../../../shared/types';
import { X, KeyRound, Loader2 } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';

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
    const [isVerifying, setIsVerifying] = useState(false);

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

    const handleVerify = async () => {
        if (!pin) {
            setError('Please enter a PIN');
            return;
        }

        setIsVerifying(true);
        setError('');

        try {
            const functions = getFunctions();
            const verifyPosPin = httpsCallable(functions, 'verifyPosPin');

            // Fallback for locally cached plaintext Super Admin PIN
            if (superAdminPin && pin === superAdminPin) {
                setPin('');
                setIsVerifying(false);
                onSuccess();
                return;
            }

            const result = await verifyPosPin({ pin });
            const data = result.data as any;

            if (data.success) {
                if (data.role === 'SUPER_ADMIN') {
                    setPin('');
                    onSuccess();
                    return;
                }

                if (data.user) {
                    const u = data.user;
                    if (['MANAGER', 'SUPER_ADMIN'].includes(u.role) && 
                        (u.businessId === businessUnitId || u.businessUnitIds?.includes(businessUnitId))) {
                        setPin('');
                        onSuccess();
                        return;
                    } else {
                        setError('User is not authorized as a Manager for this location');
                        setPin('');
                        return;
                    }
                }
            }
            
            setError('Invalid Manager PIN');
            setPin('');
        } catch (err: any) {
            console.error('Manager PIN verification failed:', err);
            
            // Offline fallback
            const manager = users.find(u => 
                u.posPin === pin && 
                ['MANAGER', 'SUPER_ADMIN'].includes(u.role) &&
                (u.businessId === businessUnitId || u.businessUnitIds?.includes(businessUnitId))
            );

            if (manager) {
                setPin('');
                onSuccess();
            } else {
                setError(err.message || 'Verification failed');
                setPin('');
            }
        } finally {
            setIsVerifying(false);
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
                    <div className="mb-4 text-center text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-3 gap-3 mb-6">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
                        <button
                            key={btn}
                            onClick={() => {
                                if (btn === 'C') handleClear();
                                else if (btn === '⌫') handleDelete();
                                else handleNumberClick(btn);
                            }}
                            disabled={isVerifying}
                            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition-colors text-xl border border-slate-600"
                        >
                            {btn}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleVerify}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all text-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    disabled={pin.length === 0 || isVerifying}
                >
                    {isVerifying ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Verify'}
                </button>
            </div>
        </div>
    );
};
