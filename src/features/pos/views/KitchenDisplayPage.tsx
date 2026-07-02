import React, { useState } from 'react';
import { KitchenDisplayView } from '../components/KitchenDisplayView';
import { ChefHat } from 'lucide-react';

interface KitchenDisplayPageProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    businesses: any[];
}

export const KitchenDisplayPage: React.FC<KitchenDisplayPageProps> = ({ businesses }) => {
    const [selectedBusinessId, setSelectedBusinessId] = useState(businesses[0]?.id || '');

    if (!selectedBusinessId) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
                <p>No business unit selected or available.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-screen bg-slate-900">
            {businesses.length > 1 && (
                <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between z-10 shrink-0">
                    <div className="flex items-center gap-3 text-emerald-400">
                        <ChefHat className="w-6 h-6" />
                        <span className="font-bold">Select Kitchen</span>
                    </div>
                    <select
                        value={selectedBusinessId}
                        onChange={(e) => setSelectedBusinessId(e.target.value)}
                        className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    >
                        {businesses.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
            )}
            <div className="flex-1 overflow-hidden relative">
                <KitchenDisplayView businessUnitId={selectedBusinessId} />
            </div>
        </div>
    );
};
