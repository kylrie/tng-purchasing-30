import React, { useState, useEffect, useCallback } from 'react';
import {
    Monitor,
    Plus,
    Search,
    Loader2,
    Building2,
    Edit,
    Archive,
    AlertTriangle,
    CheckCircle,
    Wrench,
    XCircle,
    TrendingDown
} from 'lucide-react';
import PesoSign from '../../../shared/components/PesoSign';
import type { InventoryItem, AssetStatus } from '../types/InventoryItem';
import { InventoryService } from '../services/inventory.service';
import FixedAssetModal from '../components/FixedAssetModal';
import type { Business, User } from '../../procurement/types';

// ============================================================
// PROPS
// ============================================================

interface FixedAssetsViewProps {
    businesses: Business[];
    currentUser?: User;
    allUsers?: User[];
}

// ============================================================
// DEPRECIATION HELPER
// ============================================================

const calculateBookValue = (asset: InventoryItem): { bookValue: number; percentDepreciated: number } => {
    const purchasePrice = asset.assetDetails?.purchasePrice || asset.costPerUnit * asset.currentStock;
    const purchaseDate = asset.assetDetails?.purchaseDate;
    const depreciationRate = asset.assetDetails?.depreciationRate; // % per year

    if (!purchaseDate || !depreciationRate || depreciationRate <= 0) {
        return { bookValue: purchasePrice, percentDepreciated: 0 };
    }

    const usefulLifeYears = 100 / depreciationRate;
    const purchaseDateObj = new Date(purchaseDate);
    const today = new Date();
    const ageInMonths = Math.max(0,
        (today.getFullYear() - purchaseDateObj.getFullYear()) * 12 +
        (today.getMonth() - purchaseDateObj.getMonth())
    );

    const monthlyDepreciation = purchasePrice / (usefulLifeYears * 12);
    const totalMonths = usefulLifeYears * 12;
    const monthsDepreciated = Math.min(ageInMonths, totalMonths);
    const accumulatedDepreciation = monthlyDepreciation * monthsDepreciated;
    const bookValue = Math.max(0, purchasePrice - accumulatedDepreciation);
    const percentDepreciated = (accumulatedDepreciation / purchasePrice) * 100;

    return { bookValue, percentDepreciated: Math.min(100, percentDepreciated) };
};

// ============================================================
// ASSET STATUS BADGE
// ============================================================

const StatusBadge: React.FC<{ status: AssetStatus }> = ({ status }) => {
    const config: Record<AssetStatus, { bg: string; text: string; Icon: typeof CheckCircle }> = {
        'Active': { bg: 'bg-green-500/20', text: 'text-green-400', Icon: CheckCircle },
        'Broken': { bg: 'bg-red-500/20', text: 'text-red-400', Icon: XCircle },
        'In Repair': { bg: 'bg-amber-500/20', text: 'text-amber-400', Icon: Wrench },
        'Decommissioned': { bg: 'bg-slate-500/20', text: 'text-slate-400', Icon: Archive }
    };

    const { bg, text, Icon } = config[status] || config['Active'];

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${bg} ${text}`}>
            <Icon size={12} />
            {status}
        </span>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const FixedAssetsView: React.FC<FixedAssetsViewProps> = ({ businesses, allUsers = [] }) => {
    // State
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>(
        businesses.length > 0 ? businesses[0].id : ''
    );
    const [assets, setAssets] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<InventoryItem | null>(null);

    // Load data function
    const loadData = useCallback(async () => {
        if (!selectedBusinessUnit) return;

        setIsLoading(true);
        try {
            // Fetch only ASSET type items
            const items = await InventoryService.getInventory(selectedBusinessUnit, 'ASSET');
            setAssets(items);
        } catch (err) {
            console.error('Error loading fixed assets:', err);
        } finally {
            setIsLoading(false);
        }
    }, [selectedBusinessUnit]);

    // Load data on mount and when BU changes
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filter assets
    const filteredAssets = assets.filter(asset =>
        searchQuery === '' ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.assetDetails?.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.assetDetails?.assignedTo?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Stats
    const totalValue = assets.reduce((sum, a) => sum + (a.assetDetails?.purchasePrice || a.costPerUnit * a.currentStock), 0);
    const totalBookValue = assets.reduce((sum, a) => sum + calculateBookValue(a).bookValue, 0);
    const activeCount = assets.filter(a => a.assetDetails?.status === 'Active' || !a.assetDetails?.status).length;
    const brokenCount = assets.filter(a => a.assetDetails?.status === 'Broken').length;
    const inRepairCount = assets.filter(a => a.assetDetails?.status === 'In Repair').length;

    // Format date helper
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
        } catch {
            return '-';
        }
    };

    // Handlers
    const handleAddAsset = () => {
        setEditingAsset(null);
        setIsModalOpen(true);
    };

    const handleEditAsset = (asset: InventoryItem) => {
        setEditingAsset(asset);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingAsset(null);
    };

    const handleModalSave = () => {
        loadData(); // Refresh the list
    };

    const handleDecommissionAsset = async (asset: InventoryItem) => {
        if (confirm(`Are you sure you want to decommission "${asset.name}"? This action will mark the asset as inactive.`)) {
            try {
                await InventoryService.updateInventoryItem(asset.id, {
                    isActive: false,
                    assetDetails: {
                        ...asset.assetDetails,
                        status: 'Decommissioned'
                    }
                });
                setAssets(prev => prev.filter(a => a.id !== asset.id));
                alert('Asset decommissioned successfully');
            } catch (err) {
                console.error('Error decommissioning asset:', err);
                alert('Failed to decommission asset');
            }
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Loader2 size={48} className="text-teal-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading fixed assets...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                        <Monitor className="text-teal-400" />
                        Fixed Assets
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Track equipment, machinery, and furniture
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleAddAsset}
                        className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-xl font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
                    >
                        <Plus size={18} />
                        Add Asset
                    </button>

                    {/* Business Unit Selector */}
                    <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                        <Building2 size={16} className="text-slate-400" />
                        <select
                            value={selectedBusinessUnit}
                            onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                            className="bg-transparent text-white focus:outline-none text-sm"
                        >
                            {businesses.map(bu => (
                                <option key={bu.id} value={bu.id} className="bg-slate-800">
                                    {bu.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search by name, serial #, category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Total Assets</p>
                    <p className="text-2xl font-bold text-white">{assets.length}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm">Purchase Value</p>
                    <p className="text-2xl font-bold text-slate-300 flex items-center gap-1">
                        <PesoSign size={18} />
                        {totalValue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm flex items-center gap-1">
                        <TrendingDown size={14} className="text-amber-400" /> Book Value
                    </p>
                    <p className="text-2xl font-bold text-teal-400 flex items-center gap-1">
                        <PesoSign size={18} />
                        {totalBookValue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> Active</p>
                    <p className="text-2xl font-bold text-green-400">{activeCount}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm flex items-center gap-1"><Wrench size={14} className="text-amber-400" /> In Repair</p>
                    <p className="text-2xl font-bold text-amber-400">{inRepairCount}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <p className="text-slate-400 text-sm flex items-center gap-1"><AlertTriangle size={14} className="text-red-400" /> Broken</p>
                    <p className="text-2xl font-bold text-red-400">{brokenCount}</p>
                </div>
            </div>

            {/* Assets Table */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                {filteredAssets.length === 0 ? (
                    <div className="text-center py-16">
                        <Monitor size={48} className="mx-auto mb-4 text-slate-600" />
                        <p className="text-slate-400 mb-4">
                            {searchQuery ? 'No assets match your search' : 'No fixed assets yet'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={handleAddAsset}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Add Your First Asset
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-900/50 border-b border-slate-700">
                                <tr>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase p-4">Asset</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase p-4">Tag / Serial #</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase p-4">Category</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase p-4">Purchase Date</th>
                                    <th className="text-right text-xs font-semibold text-slate-400 uppercase p-4">Book Value</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase p-4">Status</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase p-4">Assigned To</th>
                                    <th className="text-right text-xs font-semibold text-slate-400 uppercase p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {filteredAssets.map(asset => (
                                    <tr key={asset.id} className="hover:bg-slate-700/30 transition-colors">
                                        {/* Asset Name + Image */}
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden">
                                                    {asset.imageUrl ? (
                                                        <img
                                                            src={asset.imageUrl}
                                                            alt={asset.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <Monitor size={20} className="text-slate-400" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{asset.name}</p>
                                                    <p className="text-xs text-slate-500">Qty: {asset.currentStock}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Serial Number */}
                                        <td className="p-4">
                                            <span className="font-mono text-sm text-slate-300">
                                                {asset.assetDetails?.serialNumber || asset.sku || '-'}
                                            </span>
                                        </td>

                                        {/* Category */}
                                        <td className="p-4">
                                            <span className="text-slate-300">{asset.category}</span>
                                        </td>

                                        {/* Purchase Date */}
                                        <td className="p-4">
                                            <span className="text-slate-300">
                                                {formatDate(asset.assetDetails?.purchaseDate)}
                                            </span>
                                        </td>

                                        {/* Book Value */}
                                        <td className="p-4 text-right">
                                            {(() => {
                                                const { bookValue, percentDepreciated } = calculateBookValue(asset);
                                                const purchasePrice = asset.assetDetails?.purchasePrice || asset.costPerUnit * asset.currentStock;
                                                return (
                                                    <div>
                                                        <p className={`font-medium flex items-center justify-end gap-1 ${percentDepreciated >= 100 ? 'text-red-400' : 'text-green-400'}`}>
                                                            <PesoSign size={14} />
                                                            {bookValue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                                                        </p>
                                                        {percentDepreciated > 0 && (
                                                            <p className="text-xs text-slate-500">
                                                                {percentDepreciated.toFixed(0)}% of ₱{purchasePrice.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>

                                        {/* Status */}
                                        <td className="p-4">
                                            <StatusBadge status={asset.assetDetails?.status || 'Active'} />
                                        </td>

                                        {/* Assigned To */}
                                        <td className="p-4">
                                            <span className="text-slate-300">
                                                {asset.assetDetails?.assignedTo || '-'}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleEditAsset(asset)}
                                                    className="p-2 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                    title="Edit Asset"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDecommissionAsset(asset)}
                                                    className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                                    title="Decommission Asset"
                                                >
                                                    <Archive size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Fixed Asset Modal */}
            <FixedAssetModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                onSave={handleModalSave}
                asset={editingAsset}
                businessUnitId={selectedBusinessUnit}
                allUsers={allUsers.map(u => ({ id: u.id, name: u.name }))}
            />
        </div>
    );
};

export default FixedAssetsView;
