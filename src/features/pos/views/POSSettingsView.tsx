import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Loader2, Printer, Wifi, Bluetooth, Monitor } from 'lucide-react';
import { SettingsService } from '../../../shared/services/settings.service';
import { useAuth } from '../../../contexts/useAuth';
import { POSPrinterService, type PrinterConnectionType } from '../services/pos-printer.service';

export const POSSettingsView: React.FC = () => {
    const { currentUser } = useAuth();
    const [vatRate, setVatRate] = useState<number>(12);
    const [serviceChargeRate, setServiceChargeRate] = useState<number>(0);
    const [printerType, setPrinterType] = useState<PrinterConnectionType>('simulator');
    const [printerIp, setPrinterIp] = useState<string>('192.168.1.100');
    
    const [isSaving, setIsSaving] = useState(false);
    const [isTestingPrinter, setIsTestingPrinter] = useState(false);
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
            
            // In a real app, printer settings should be saved to localStorage (per device) rather than Firestore (global)
            // because printers are hardware-specific to the POS terminal.
            const savedPrinter = localStorage.getItem('pos_printer_type');
            if (savedPrinter) setPrinterType(savedPrinter as PrinterConnectionType);
            const savedIp = localStorage.getItem('pos_printer_ip');
            if (savedIp) setPrinterIp(savedIp);
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

            // Save device-specific settings to localStorage
            localStorage.setItem('pos_printer_type', printerType);
            localStorage.setItem('pos_printer_ip', printerIp);

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

    const handleTestPrint = async () => {
        setError(null);
        setIsTestingPrinter(true);
        try {
            if (printerType === 'bluetooth') {
                await POSPrinterService.connectBluetooth();
            }
            const payload = POSPrinterService.generateReceiptPayload("=== FUN GUYS POS ===\n\nTest Print Successful!\nThank you.\n\n");
            await POSPrinterService.print({ type: printerType, ipAddress: printerIp }, payload);
        } catch (err: any) {
            setError(err.message || 'Failed to print test receipt.');
        } finally {
            setIsTestingPrinter(false);
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

                    <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Printer className="w-5 h-5 text-slate-500" />
                            Hardware Configuration (This Device)
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Printer Connection Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPrinterType('simulator')}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border ${printerType === 'simulator' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                                    >
                                        <Monitor className="w-5 h-5 mb-1" />
                                        <span className="text-xs font-medium">Simulator</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPrinterType('bluetooth')}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border ${printerType === 'bluetooth' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                                    >
                                        <Bluetooth className="w-5 h-5 mb-1" />
                                        <span className="text-xs font-medium">Bluetooth</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPrinterType('lan')}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border ${printerType === 'lan' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                                    >
                                        <Wifi className="w-5 h-5 mb-1" />
                                        <span className="text-xs font-medium">LAN / IP</span>
                                    </button>
                                </div>
                            </div>
                            
                            {printerType === 'lan' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Printer IP Address</label>
                                    <input
                                        type="text"
                                        value={printerIp}
                                        onChange={(e) => setPrinterIp(e.target.value)}
                                        placeholder="192.168.1.100"
                                        className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    />
                                    <p className="text-xs text-slate-500 mt-2">Requires QZ Tray or local proxy running on this device.</p>
                                </div>
                            )}
                            
                            {printerType === 'bluetooth' && (
                                <div>
                                    <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl">
                                        <p className="text-sm text-blue-700 dark:text-blue-400">
                                            <strong>Web Bluetooth</strong> will prompt you to pair with your thermal printer when you print. Ensure your printer is in pairing mode.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={handleTestPrint}
                                disabled={isTestingPrinter}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                            >
                                {isTestingPrinter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                                Test Connection
                            </button>
                        </div>
                    </div>

                    <div className="pt-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700">
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
