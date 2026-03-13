import React, { useState } from 'react';
import type { User } from '../../../shared/types';
import { UserStatus } from '../../../features/procurement/types';
import { Lock } from 'lucide-react';

interface POSLoginProps {
    users: User[];
    onLogin: (user: User) => void;
    superAdminPin?: string;
}

const POSLogin: React.FC<POSLoginProps> = ({ users, onLogin, superAdminPin }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const handleNumberClick = (num: string) => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
            setError('');
        }
    };

    const handleClear = () => {
        setPin('');
        setError('');
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
        setError('');
    };

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();

        if (pin.length !== 4) {
            setError('PIN must be 4 digits');
            return;
        }

        // Check super admin pin first
        if (superAdminPin && pin === superAdminPin) {
            const superAdminUser: User = {
                id: 'super-admin',
                name: 'Super Admin',
                email: 'admin@pos.system',
                role: 'ADMIN',
                businessUnitIds: [],
                businessId: '',
                avatar: '',
                status: UserStatus.ACTIVE,
                posPin: superAdminPin,
            };
            onLogin(superAdminUser);
            setPin('');
            return;
        }

        const matchedUser = users.find(u => u.posPin === pin);

        if (matchedUser) {
            onLogin(matchedUser);
            setPin('');
        } else {
            setError('Invalid PIN');
            setPin('');
        }
    };

    // Add keyboard support
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key >= '0' && e.key <= '9') {
                handleNumberClick(e.key);
            } else if (e.key === 'Backspace') {
                handleDelete();
            } else if (e.key === 'Enter') {
                handleSubmit();
            } else if (e.key === 'Escape') {
                handleClear();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pin]);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-700">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-8 h-8 text-indigo-400" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">POS Login</h2>
                    <p className="text-slate-400 mb-8">Enter your 4-digit Cashier PIN</p>

                    <form onSubmit={handleSubmit}>
                        {/* PIN Display */}
                        <div className="flex justify-center gap-4 mb-8">
                            {[0, 1, 2, 3].map((index) => (
                                <div
                                    key={index}
                                    className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl
                    ${pin.length > index
                                            ? 'border-indigo-500 bg-indigo-500/10 text-white'
                                            : 'border-slate-600 bg-slate-700 text-transparent'
                                        }
                  `}
                                >
                                    {pin.length > index ? '•' : ''}
                                </div>
                            ))}
                        </div>

                        {error && (
                            <div className="text-red-400 text-sm mb-6 bg-red-400/10 py-2 rounded-lg">
                                {error}
                            </div>
                        )}

                        {/* Numpad */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => handleNumberClick(num.toString())}
                                    className="h-16 text-2xl font-semibold text-white bg-slate-700 rounded-xl hover:bg-slate-600 active:bg-slate-500 transition-colors"
                                >
                                    {num}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={handleClear}
                                className="h-16 text-lg font-medium text-slate-300 bg-slate-700/50 rounded-xl hover:bg-slate-600 active:bg-slate-500 transition-colors"
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={() => handleNumberClick('0')}
                                className="h-16 text-2xl font-semibold text-white bg-slate-700 rounded-xl hover:bg-slate-600 active:bg-slate-500 transition-colors"
                            >
                                0
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="h-16 text-lg font-medium text-slate-300 bg-slate-700/50 rounded-xl hover:bg-slate-600 active:bg-slate-500 transition-colors"
                            >
                                Del
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={pin.length !== 4}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors"
                        >
                            Login
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default POSLogin;
