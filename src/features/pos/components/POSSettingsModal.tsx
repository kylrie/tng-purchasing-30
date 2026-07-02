import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Loader2, Printer, Wifi, Bluetooth, Monitor } from 'lucide-react';
import { SettingsService } from '../../../shared/services/settings.service';
import { useAuth } from '../../../contexts/useAuth';
import { POSPrinterService, type PrinterConnectionType } from '../services/pos-printer.service';

interface POSSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const POSSettingsModal: React.FC<POSSettingsModalProps> = ({ isOpen, onClose }) => {
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
        if (isOpen) {
            const loadSettings = async () => {
                const settings = await SettingsService.getPOSSettings();
                if (settings.vatRate !== undefined) {
                    setVatRate(settings.vatRate);
                }
                if (settings.serviceChargeRate !== undefined) {
                    setServiceChargeRate(settings.serviceChargeRate);
                }
                
                const savedPrinter = localStorage.getItem('pos_printer_type');
                if (savedPrinter) setPrinterType(savedPrinter as PrinterConnectionType);
                const savedIp = localStorage.getItem('pos_printer_ip');
                if (savedIp) setPrinterIp(savedIp);
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

            localStorage.setItem('pos_printer_type', printerType);
            localStorage.setItem('pos_printer_ip', printerIp);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-700 flex flex-col max-h-[90vh]">
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

                        <div className="pt-6 border-t border-slate-700">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Printer className="w-5 h-5 text-slate-400" />
                                Hardware Configuration (This Device)
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Printer Connection</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPrinterType('simulator')}
                                            className={`flex flex-col items-center justify-center p-2 rounded-xl border ${printerType === 'simulator' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-900/50 border-slate-600 text-slate-400 hover:bg-slate-800'}`}
                                        >
                                            <Monitor className="w-4 h-4 mb-1" />
                                            <span className="text-[10px] font-medium">Simulator</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPrinterType('bluetooth')}
                                            className={`flex flex-col items-center justify-center p-2 rounded-xl border ${printerType === 'bluetooth' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-900/50 border-slate-600 text-slate-400 hover:bg-slate-800'}`}
                                        >
                                            <Bluetooth className="w-4 h-4 mb-1" />
                                            <span className="text-[10px] font-medium">Bluetooth</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPrinterType('lan')}
                                            className={`flex flex-col items-center justify-center p-2 rounded-xl border ${printerType === 'lan' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-900/50 border-slate-600 text-slate-400 hover:bg-slate-800'}`}
                                        >
                                            <Wifi className="w-4 h-4 mb-1" />
                                            <span className="text-[10px] font-medium">LAN / IP</span>
                                        </button>
                                    </div>
                                </div>
                                
                                {printerType === 'lan' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Printer IP Address</label>
                                        <input
                                            type="text"
                                            value={printerIp}
                                            onChange={(e) => setPrinterIp(e.target.value)}
                                            placeholder="192.168.1.100"
                                            className="w-full rounded-xl border border-slate-600 bg-slate-900/50 text-white px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        />
                                    </div>
                                )}
                            </div>
                            
                            <div className="mt-4">
                                <button
                                    type="button"
                                    onClick={handleTestPrint}
                                    disabled={isTestingPrinter}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                                >
                                    {isTestingPrinter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                                    Test Connection
                                </button>
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
