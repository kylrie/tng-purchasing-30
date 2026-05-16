import React from 'react';
import type { SimulatedDeduction } from '../types/pos-import.types';
import { AlertCircle, CheckCircle2, CornerDownRight } from 'lucide-react';

interface PosImportPreviewModalProps {
    isOpen: boolean;
    simulatedDeductions: SimulatedDeduction[];
    onConfirm: () => void;
    onCancel: () => void;
    isSubmitting?: boolean;
}

export const PosImportPreviewModal: React.FC<PosImportPreviewModalProps> = ({
    isOpen,
    simulatedDeductions,
    onConfirm,
    onCancel,
    isSubmitting = false
}) => {
    if (!isOpen) return null;

    // Count how many FGs vs RMs are affected
    const fgCount = simulatedDeductions.filter(d => d.type === 'FG' || d.type === 'FG_DIRECT').length;
    const rmCount = simulatedDeductions.filter(d => d.type === 'RM').length;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b flex justify-between items-center bg-white">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Import Preview (Dry Run)</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Found {fgCount} menu items resulting in {rmCount} raw material deductions.
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-600">
                                <thead className="bg-gray-50/80 text-gray-700 uppercase font-semibold border-b text-xs tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Item Name / Recipe Tree</th>
                                        <th className="px-6 py-4 text-right">Current Stock</th>
                                        <th className="px-6 py-4 text-right">Deduction</th>
                                        <th className="px-6 py-4 text-right">New Stock</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {simulatedDeductions.map((deduction, i) => {
                                        const isNegative = deduction.newTheoreticalStock < 0;
                                        
                                        return (
                                            <tr key={`${deduction.itemId}-${i}`} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-6 py-3.5">
                                                    <div className={`flex items-center ${
                                                        deduction.type === 'RM' ? 'pl-8' : 
                                                        deduction.type === 'PRODUCTION' ? 'pl-4' : ''
                                                    }`}>
                                                        {deduction.type !== 'FG' && deduction.type !== 'FG_DIRECT' && (
                                                            <CornerDownRight className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                                                        )}
                                                        <span className={`font-medium ${
                                                            deduction.type === 'FG' || deduction.type === 'FG_DIRECT' ? 'text-gray-900' : 'text-gray-600'
                                                        }`}>
                                                            {deduction.itemName}
                                                        </span>
                                                        <span className={`ml-2 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border ${
                                                            deduction.type === 'FG' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                            deduction.type === 'FG_DIRECT' ? 'bg-green-50 text-green-600 border-green-200' :
                                                            deduction.type === 'PRODUCTION' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                                            'bg-orange-50 text-orange-600 border-orange-200'
                                                        }`}>
                                                            {deduction.type === 'FG_DIRECT' ? 'FG (DIRECT)' : deduction.type}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3.5 text-right font-medium">
                                                    {(Number.isFinite(deduction.currentTheoreticalStock) ? deduction.currentTheoreticalStock : 0).toFixed(2)}
                                                </td>
                                                <td className={`px-6 py-3.5 text-right font-medium ${deduction.type === 'PRODUCTION' ? 'text-gray-400' : 'text-red-600'}`}>
                                                    {deduction.type === 'PRODUCTION' ? '-' : `-${deduction.deductionAmount.toFixed(2)}`}
                                                </td>
                                                <td className={`px-6 py-3.5 text-right font-bold ${isNegative ? 'text-red-600' : 'text-gray-900'}`}>
                                                    {(Number.isFinite(deduction.newTheoreticalStock) ? deduction.newTheoreticalStock : 0).toFixed(2)}
                                                    {isNegative && (
                                                        <AlertCircle className="inline-block w-4 h-4 ml-1.5 text-red-500" />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {simulatedDeductions.length === 0 && (
                            <div className="p-12 pl-6 text-center">
                                <p className="text-gray-500">No deductions found. Please ensure items are matched and have recipes configured.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSubmitting || simulatedDeductions.length === 0}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Processing Import...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                Confirm & Update Inventory
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
