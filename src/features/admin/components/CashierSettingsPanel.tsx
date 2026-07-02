import React, { useState, useEffect } from 'react';
import type { User, Business } from '../../../shared/types';
import { Store, KeyRound, Eye, EyeOff, Save, Loader2, AlertCircle, Building2, Users } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { COLLECTIONS } from '../../../shared/types/firebase.types';
import { SettingsService } from '../../../shared/services/settings.service';
import { useAuth } from '../../../contexts/useAuth';

interface CashierSettingsPanelProps {
    allUsers: User[];
    setAllUsers: (user: User) => void;
    businesses: Business[];
}

const CashierSettingsPanel: React.FC<CashierSettingsPanelProps> = ({
    allUsers,
    setAllUsers,
    businesses
}) => {
    const { currentUser } = useAuth();
    const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
    const [selectedRole, setSelectedRole] = useState<'MANAGER' | 'EMPLOYEE'>('EMPLOYEE');
    const [selectedUserId, setSelectedUserId] = useState<string>('');

    // Global POS Settings State
    const [superAdminPin, setSuperAdminPin] = useState('');
    const [confirmSuperAdminPin, setConfirmSuperAdminPin] = useState('');
    const [vatRate, setVatRate] = useState<number>(12);
    const [serviceChargeRate, setServiceChargeRate] = useState<number>(0);
    const [showSuperAdminPin, setShowSuperAdminPin] = useState(false);
    const [isSavingGlobal, setIsSavingGlobal] = useState(false);
    const [saveGlobalSuccess, setSaveGlobalSuccess] = useState(false);
    const [globalError, setGlobalError] = useState<string | null>(null);

    // Internal pin state for the selected user
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [showPin, setShowPin] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Derived states
    const filteredUsers = allUsers.filter(u =>
        (u.businessUnitIds?.includes(selectedBusinessId) || u.businessId === selectedBusinessId) &&
        u.role === selectedRole
    );

    const selectedUser = allUsers.find(u => u.id === selectedUserId);

    // Effect triggers defaults when the form changes constraints
    useEffect(() => {
        if (businesses.length > 0 && !selectedBusinessId) {
            setSelectedBusinessId(businesses[0].id);
        }
    }, [businesses, selectedBusinessId]);

    // Fetch existing super admin pin on mount
    useEffect(() => {
        const loadSettings = async () => {
            const settings = await SettingsService.getPOSSettings();
            if (settings.superAdminPin) {
                setSuperAdminPin(settings.superAdminPin);
            }
            if (settings.vatRate !== undefined) {
                setVatRate(settings.vatRate);
            }
            if (settings.serviceChargeRate !== undefined) {
                setServiceChargeRate(settings.serviceChargeRate);
            }
        };
        loadSettings();
    }, []);

    // Cleanup and default assignment when toggling between settings
    useEffect(() => {
        if (filteredUsers.length > 0) {
            // Auto-Select the first item if current selection isn't in scope
            if (!selectedUserId || !filteredUsers.find(u => u.id === selectedUserId)) {
                setSelectedUserId(filteredUsers[0].id);
            }
        } else {
            setSelectedUserId('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBusinessId, selectedRole, allUsers]);

    // Resync PIN fields when a user changes
    useEffect(() => {
        if (selectedUser) {
            setPin(selectedUser.posPin || '');
            setConfirmPin('');
        } else {
            setPin('');
            setConfirmPin('');
        }
    }, [selectedUser]);

    const handleSavePin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaveSuccess(false);

        if (!selectedUser) {
            setError('Please select a user first');
            return;
        }

        // Validate PIN
        if (pin.length !== 4 || !/^\d+$/.test(pin)) {
            setError('PIN must be exactly 4 digits');
            return;
        }

        if (pin !== confirmPin) {
            setError('PINs do not match');
            return;
        }

        setIsSaving(true);
        try {
            const userRef = doc(db, COLLECTIONS.USERS, selectedUser.id);
            await updateDoc(userRef, { posPin: pin });

            setAllUsers({ ...selectedUser, posPin: pin });
            setSaveSuccess(true);
            setConfirmPin(''); // Clear confirm pin on success

            // Clear success message after 3 seconds
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error('Error updating POS PIN:', err);
            setError('Failed to update PIN. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveGlobalSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setGlobalError(null);
        setSaveGlobalSuccess(false);

        // Validate PIN if provided
        if (superAdminPin) {
            if (superAdminPin.length !== 4 || !/^\d+$/.test(superAdminPin)) {
                setGlobalError('PIN must be exactly 4 digits');
                return;
            }

            if (superAdminPin !== confirmSuperAdminPin && confirmSuperAdminPin !== '') {
                setGlobalError('PINs do not match');
                return;
            }
        }

        if (vatRate < 0 || vatRate > 100) {
            setGlobalError('VAT rate must be between 0 and 100');
            return;
        }

        if (serviceChargeRate < 0 || serviceChargeRate > 100) {
            setGlobalError('Service Charge rate must be between 0 and 100');
            return;
        }

        setIsSavingGlobal(true);
        try {
            await SettingsService.updatePOSSettings(
                { 
                    superAdminPin,
                    vatRate,
                    serviceChargeRate 
                },
                currentUser?.id,
                currentUser?.name
            );

            setSaveGlobalSuccess(true);
            setConfirmSuperAdminPin(''); // Clear confirm pin on success

            // Clear success message after 3 seconds
            setTimeout(() => setSaveGlobalSuccess(false), 3000);
        } catch (err) {
            console.error('Error updating Global POS Settings:', err);
            setGlobalError('Failed to update settings. Please try again.');
        } finally {
            setIsSavingGlobal(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                        <Store size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Point of Sale Settings</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Configure POS access PINs for Cashiers and Managers</p>
                    </div>
                </div>
            </div>

            <div className="p-6">
                {/* Global POS Settings Configuration */}
                <div className="mb-8 pb-8 border-b border-slate-200 dark:border-slate-700/50">
                    <form onSubmit={handleSaveGlobalSettings} className="max-w-2xl space-y-6">
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-md font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                                    <KeyRound size={18} className="text-amber-500" />
                                    Master Override PIN
                                </h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    Set a universal 4-digit PIN that grants full access to any POS terminal regardless of the active cashier or location.
                                </p>
                            </div>

                            {globalError && (
                                <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
                                    <AlertCircle size={16} />
                                    <p>{globalError}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Master PIN (4 digits)
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <KeyRound size={16} className="text-slate-400" />
                                    </div>
                                    <input
                                        type={showSuperAdminPin ? "text" : "password"}
                                        maxLength={4}
                                        value={superAdminPin}
                                        onChange={(e) => setSuperAdminPin(e.target.value.replace(/\D/g, ''))}
                                        className="pl-10 w-full rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                                        placeholder="0000"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSuperAdminPin(!showSuperAdminPin)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                        {showSuperAdminPin ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Confirm Master PIN
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <KeyRound size={16} className="text-slate-400" />
                                    </div>
                                    <input
                                        type={showSuperAdminPin ? "text" : "password"}
                                        maxLength={4}
                                        value={confirmSuperAdminPin}
                                        onChange={(e) => setConfirmSuperAdminPin(e.target.value.replace(/\D/g, ''))}
                                        className="pl-10 w-full rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
                                        placeholder="0000"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">VAT Rate (%)</label>
                                    <input
                                        type="number"
                                        value={vatRate}
                                        onChange={(e) => setVatRate(Number(e.target.value))}
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Service Charge Rate (%)</label>
                                    <input
                                        type="number"
                                        value={serviceChargeRate}
                                        onChange={(e) => setServiceChargeRate(Number(e.target.value))}
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="submit"
                                disabled={isSavingGlobal}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50"
                            >
                                {isSavingGlobal ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Save Global Settings
                            </button>
                            {saveGlobalSuccess && (
                                <span className="text-sm text-green-600 dark:text-green-400">Settings saved successfully!</span>
                            )}
                        </div>
                    </form>
                </div>

                {/* Configuration Selections */}
                <div>
                    <h4 className="text-md font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Users size={18} className="text-purple-500" />
                        User Access PINs
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pb-8 border-b border-slate-200 dark:border-slate-700/50">
                        {/* Business Unit Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                <Building2 size={16} className="text-slate-400" />
                                Business Unit
                            </label>
                            <select
                                value={selectedBusinessId}
                                onChange={(e) => setSelectedBusinessId(e.target.value)}
                                className="w-full rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                            >
                                {businesses.map(bu => (
                                    <option key={bu.id} value={bu.id}>{bu.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Role Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                <Users size={16} className="text-slate-400" />
                                Role Filter
                            </label>
                            <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRole('EMPLOYEE')}
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedRole === 'EMPLOYEE'
                                        ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                >
                                    Cashiers
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedRole('MANAGER')}
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedRole === 'MANAGER'
                                        ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                >
                                    Managers
                                </button>
                            </div>
                        </div>

                        {/* User Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Select User
                            </label>
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                disabled={filteredUsers.length === 0}
                                className="w-full rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                            >
                                {filteredUsers.length === 0 ? (
                                    <option value="">No users found</option>
                                ) : (
                                    filteredUsers.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))
                                )}
                            </select>
                        </div>
                    </div>

                    <form onSubmit={handleSavePin} className="max-w-md space-y-6">
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                                    {selectedUser ? `PIN Configuration for ${selectedUser.name}` : 'PIN Configuration'}
                                </h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    Set a 4-digit PIN for this user to access the Point of Sale system.
                                </p>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
                                    <AlertCircle size={16} />
                                    <p>{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    {selectedUser?.posPin ? 'Update PIN (4 digits)' : 'New PIN (4 digits)'}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <KeyRound size={16} className="text-slate-400" />
                                    </div>
                                    <input
                                        type={showPin ? "text" : "password"}
                                        maxLength={4}
                                        value={pin}
                                        disabled={!selectedUser}
                                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                        className="pl-10 w-full rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                                        placeholder={selectedUser ? (selectedUser.posPin ? "••••" : "0000") : "Select a user first"}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPin(!showPin)}
                                        disabled={!selectedUser}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
                                    >
                                        {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Confirm PIN
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <KeyRound size={16} className="text-slate-400" />
                                    </div>
                                    <input
                                        type={showPin ? "text" : "password"}
                                        maxLength={4}
                                        value={confirmPin}
                                        disabled={!selectedUser}
                                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                                        className="pl-10 w-full rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                                        placeholder="0000"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="submit"
                                disabled={!selectedUser || isSaving || pin.length !== 4 || confirmPin.length !== 4}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {isSaving ? 'Saving...' : 'Save PIN'}
                            </button>

                            {saveSuccess && (
                                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                    PIN updated successfully for {selectedUser?.name}!
                                </span>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CashierSettingsPanel;
