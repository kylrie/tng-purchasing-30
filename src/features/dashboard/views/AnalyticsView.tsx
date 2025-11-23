import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface AnalyticsViewProps {
    isAiLoading: boolean;
    handleGenerateInsight: () => void;
    aiInsight: string | null;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ isAiLoading, handleGenerateInsight, aiInsight }) => {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Procurement Insights</h1>
            <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2"><Sparkles className="text-brand-500" /> AI Analysis</h3>
                        <p className="text-sm text-slate-500">Smart insights based on your current workflow.</p>
                    </div>
                    <button onClick={handleGenerateInsight} disabled={isAiLoading} className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50">
                        {isAiLoading ? <Loader2 className="animate-spin" /> : 'Generate Insight'}
                    </button>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-line">
                    {aiInsight || "Click generate to analyze bottlenecks and actionable items."}
                </div>
            </div>
        </div>
    );
};
