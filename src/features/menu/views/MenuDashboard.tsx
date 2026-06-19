import React, { useState } from 'react';
import { ChefHat, ShoppingBag, Factory } from 'lucide-react';
import type { Business, User } from '../../procurement/types';
import FinishedGoodsTab from '../components/FinishedGoodsTab';
import ProductionRecipeTab from '../components/ProductionRecipeTab';

interface MenuDashboardProps {
    businesses: Business[];
    currentUser?: User;
}

const MenuDashboard: React.FC<MenuDashboardProps> = ({ businesses, currentUser }) => {
    const [activeTab, setActiveTab] = useState<'finished' | 'production'>('finished');

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <ChefHat className="text-purple-600 dark:text-purple-400" />
                        Menu Engineering
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Recipe builder, production tracking, and cost analysis
                    </p>
                </div>
            </div>

            {/* Top-Level Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
                <button
                    className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${
                        activeTab === 'finished'
                            ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    onClick={() => setActiveTab('finished')}
                >
                    <ShoppingBag size={16} />
                    Finished Goods
                </button>
                <button
                    className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${
                        activeTab === 'production'
                            ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    onClick={() => setActiveTab('production')}
                >
                    <Factory size={16} />
                    Production Recipes
                </button>
            </div>

            {/* Tab Content */}
            <div className="mt-4">
                {activeTab === 'finished' && (
                    <FinishedGoodsTab businesses={businesses} currentUser={currentUser} />
                )}
                {activeTab === 'production' && (
                    <ProductionRecipeTab businesses={businesses} currentUser={currentUser} />
                )}
            </div>
        </div>
    );
};

export default MenuDashboard;
