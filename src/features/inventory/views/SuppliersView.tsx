import React from 'react';

const SuppliersView = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Suppliers</h1>
                    <p className="text-slate-500">Manage vendor relationships</p>
                </div>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                    Add Supplier
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-slate-500">No suppliers listed.</p>
            </div>
        </div>
    );
};

export default SuppliersView;
