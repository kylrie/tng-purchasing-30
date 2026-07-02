import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Loader2 } from 'lucide-react';
import { SettingsService } from '../../../shared/services/settings.service';
import { useAuth } from '../../../contexts/useAuth';

interface POSSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const POSSettingsModal: React.FC<POSSettingsModalProps> = ({ isOpen, onClose }) => {
    const { currentUser } = useAuth();
    const [vatRate, setVatRate] = useState<number>(12);
    const [serviceChargeRate, setServiceChargeRate] = useState<number>(0);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
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
            setSuccess(false);
            setError(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

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
                onClose();
            }, 1500);
        } catch (err) {
            console.error('Error updating POS Settings:', err);
            setError('Failed to update settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-700 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white">POS Configuration</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <form onSubmit={handleSave} className="space-y-6">
                        {error && (
                            <div className="flex items-center gap-2 p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <AlertCircle size={16} />
                                <p>{error}</p>
                            </div>
                        )}
                        
                        {success && (
                            <div className="flex items-center gap-2 p-3 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                <p>Settings saved successfully!</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">VAT Rate (%)</label>
                                <input
                                    type="number"
                                    value={vatRate}
                                    onChange={(e) => setVatRate(Number(e.target.value))}
                                    className="w-full rounded-xl border border-slate-600 bg-slate-900/50 text-white px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Service Charge Rate (%)</label>
                                <input
                                    type="number"
                                    value={serviceChargeRate}
                                    onChange={(e) => setServiceChargeRate(Number(e.target.value))}
                                    className="w-full rounded-xl border border-slate-600 bg-slate-900/50 text-white px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end gap-3 border-t border-slate-700">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 text-slate-300 hover:text-white font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl transition-all disabled:opacity-50"
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
        </div>
    );
};

export default POSSettingsModal;
