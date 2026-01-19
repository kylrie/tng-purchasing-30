import React, { useState, useEffect } from 'react';
import { Receipt, Loader2, Check, AlertCircle, Percent } from 'lucide-react';
import { SettingsService, type TaxSettings } from '../../../shared/services/settings.service';

interface TaxSettingsPanelProps {
    currentUserId: string;
    currentUserName: string;
    className?: string;
}

/**
 * TaxSettingsPanel - Configuration component for VAT/EWT Tax Defaults
 * Allows admins to configure the default VAT and EWT percentages
 * used when creating new PRFs.
 */
const TaxSettingsPanel: React.FC<TaxSettingsPanelProps> = ({
    currentUserId,
    currentUserName,
    className
}) => {
    const [settings, setSettings] = useState<TaxSettings>({
        defaultVatPercentage: 12,
        defaultEwtPercentage: 2,
        vatOptions: [0, 5, 12],
        ewtOptions: [1, 2, 5, 10, 15]
    });
    const [form, setForm] = useState({ vatRate: 12, ewtRate: 2 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Load existing settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                setLoading(true);
                const taxSettings = await SettingsService.getTaxSettings();
                setSettings(taxSettings);
                setForm({
                    vatRate: taxSettings.defaultVatPercentage,
                    ewtRate: taxSettings.defaultEwtPercentage
                });
            } catch (err) {
                console.error('Error loading tax settings:', err);
                setError('Failed to load tax settings');
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, []);

    // Save settings
    const handleSave = async () => {
        // Validate rates
        if (form.vatRate < 0 || form.vatRate > 100) {
            setError('VAT rate must be between 0 and 100%');
            return;
        }
        if (form.ewtRate < 0 || form.ewtRate > 100) {
            setError('EWT rate must be between 0 and 100%');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const newSettings: TaxSettings = {
                defaultVatPercentage: form.vatRate,
                defaultEwtPercentage: form.ewtRate,
                vatOptions: settings.vatOptions || [0, 5, 12],
                ewtOptions: settings.ewtOptions || [1, 2, 5, 10, 15]
            };
            await SettingsService.updateTaxSettings(
                newSettings,
                currentUserId,
                currentUserName
            );
            setSettings(newSettings);
            setSuccess('Tax settings saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Error saving tax settings:', err);
            setError('Failed to save tax settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = form.vatRate !== settings.defaultVatPercentage || form.ewtRate !== settings.defaultEwtPercentage;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="animate-spin text-purple-400" size={24} />
                <span className="ml-2 text-slate-400">Loading tax settings...</span>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className || ''}`}>
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Receipt size={20} className="text-emerald-400" />
                    Tax Rate Defaults
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                    Configure default VAT and EWT percentages applied when creating new PRFs.
                </p>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
                    <Check size={20} />
                    <span>{success}</span>
                </div>
            )}

            {/* Tax Rates Form */}
            <div className="bg-slate-900/30 p-6 rounded-lg border border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* VAT Rate */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Default VAT Rate
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={form.vatRate}
                                onChange={(e) => setForm({ ...form, vatRate: parseFloat(e.target.value) || 0 })}
                                className="w-24 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                            <Percent size={18} className="text-slate-400" />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Value-Added Tax applied to purchases (commonly 12% in Philippines)
                        </p>
                    </div>

                    {/* EWT Rate */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Default EWT Rate
                        </label>
                        <div className="flex items-center gap-2">
                            <select
                                value={form.ewtRate}
                                onChange={(e) => setForm({ ...form, ewtRate: parseFloat(e.target.value) })}
                                className="w-24 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            >
                                <option value="1">1%</option>
                                <option value="2">2%</option>
                                <option value="5">5%</option>
                                <option value="10">10%</option>
                                <option value="15">15%</option>
                            </select>
                            <Percent size={18} className="text-slate-400" />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Expanded Withholding Tax rate (typically 1-2% for goods)
                        </p>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-700">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check size={16} />
                                Save Changes
                            </>
                        )}
                    </button>
                    {hasChanges && (
                        <span className="text-yellow-400 text-xs">Unsaved changes</span>
                    )}
                </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-300 mb-2">How it works</h4>
                <ul className="text-xs text-blue-200/70 space-y-1">
                    <li>• These defaults are used when creating new Purchase Requisitions (PRFs).</li>
                    <li>• Users can still adjust the VAT/EWT rates on individual PRFs if needed.</li>
                    <li>• VAT is added to the total, EWT is withheld (deducted) from payment.</li>
                    <li>• Net Amount = Total Amount - EWT</li>
                </ul>
            </div>
        </div>
    );
};

export default TaxSettingsPanel;
