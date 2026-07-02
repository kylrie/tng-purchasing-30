import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Loader2 } from 'lucide-react';
import { SettingsService } from '../../../shared/services/settings.service';
import { useAuth } from '../../../contexts/useAuth';

export const POSSettingsView: React.FC = () => {
    const { currentUser } = useAuth();
    const [vatRate, setVatRate] = useState<number>(12);
    const [serviceChargeRate, setServiceChargeRate] = useState<number>(0);
    
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            const settings = await SettingsService.getPOSSettings();
            if (settings.vatRate !== undefined) {
                setVatRate(settings.vatRate);
            }
            if (settings.serviceChargeRate !== undefined) {
                setServiceChargeRate(settings.serviceChargeRate);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (vatRate < 0 || vatRate > 100) {
            setError('VAT rate must be between 0 and 100');
            return;
        }

        if (serviceChargeRate < 0 || serviceChargeRate > 100) {
            setError('Service Charge rate must be between 0 and 100');
            return;
        }

        setIsSaving(true);
        try {
            await SettingsService.updatePOSSettings(
                { 
                    vatRate,
                    serviceChargeRate 
                },
                currentUser?.id,
                currentUser?.name
            );

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
            }, 3000);
        } catch (err) {
            console.error('Error updating POS Settings:', err);
            setError('Failed to update settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">POS Settings</h1>
                <p className="text-slate-600 dark:text-slate-400">Configure global rates and settings for the Point of Sale system.</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <form onSubmit={handleSave} className="space-y-6">
                    {error && (
                        <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
                            <AlertCircle size={18} />
                            <p>{error}</p>
                        </div>
                    )}
                    
                    {success && (
                        <div className="flex items-center gap-2 p-4 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                            <CheckIcon size={18} />
                            <p>Settings saved successfully!</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">VAT Rate (%)</label>
                            <input
                                type="number"
                                value={vatRate}
                                onChange={(e) => setVatRate(Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Service Charge Rate (%)</label>
                            <input
                                type="number"
                                value={serviceChargeRate}
                                onChange={(e) => setServiceChargeRate(Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Helper component
const CheckIcon = ({ size }: { size: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);
