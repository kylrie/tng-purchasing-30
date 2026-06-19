import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Loader2, Search, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User, Business } from '../../procurement/types';
import type { BlackBookRecipe } from '../types/blackbook.types';
import { BlackBookService } from '../services/blackbook.service';
import { usePermissions } from '../../../hooks/usePermissions';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import CreateBlackBookModal from '../components/CreateBlackBookModal';

// ============================================================
// DIGITAL BLACK BOOK VIEW
// Main orchestrator view for the Digital Black Book module.
// Renders a grid of recipes.
// ============================================================

interface DigitalBlackBookViewProps {
    businesses: Business[];
    currentUser: User;
}

const DigitalBlackBookView: React.FC<DigitalBlackBookViewProps> = ({
    businesses
}) => {
    const { hasPermission } = usePermissions();
    const { selectedBusinessUnit } = useBusinessUnit();
    const navigate = useNavigate();

    // RBAC: Admin can edit, non-admin is view-only
    const isAdmin = hasPermission('menu:black_book:edit') || hasPermission('menu:black_book:create');

    const [recipes, setRecipes] = useState<BlackBookRecipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Fetch recipes for the selected business unit
    const loadRecipes = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let allRecipes: BlackBookRecipe[] = [];
            if (selectedBusinessUnit === 'all') {
                for (const bu of businesses) {
                    const buRecipes = await BlackBookService.getRecipes(bu.id);
                    allRecipes.push(...buRecipes);
                }
            } else {
                allRecipes = await BlackBookService.getRecipes(selectedBusinessUnit);
            }
            // Sort alphabetically
            allRecipes.sort((a, b) => a.name.localeCompare(b.name));
            setRecipes(allRecipes);
        } catch (err) {
            console.error('Error loading Black Book recipes:', err);
            setError('Failed to load recipes. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [selectedBusinessUnit, businesses]);

    useEffect(() => {
        loadRecipes();
    }, [loadRecipes]);

    const filteredRecipes = recipes.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.prepStation.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="text-amber-500 animate-spin" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Loading Digital Black Book...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                    <p className="text-red-500 dark:text-red-400 mb-2">{error}</p>
                    <button
                        onClick={loadRecipes}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full -m-4 md:-m-6 lg:-m-8">
            {/* Page Header */}
            <div className="flex items-center justify-between px-6 py-6 border-b border-[#e8e0d4] dark:border-slate-700 bg-transparent">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <BookOpen size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Digital Black Book</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Standardized Recipe Operations · {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative hidden md:block w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search recipes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                        />
                    </div>
                    {isAdmin && (
                        <button
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-500 text-white rounded-xl text-sm font-semibold hover:from-amber-700 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20"
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            <Plus size={18} />
                            New Recipe
                        </button>
                    )}
                </div>
            </div>
            
            {/* Mobile Search */}
            <div className="md:hidden px-6 py-3 bg-transparent border-b border-[#e8e0d4] dark:border-slate-700">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search recipes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-[#e8e0d4] dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                    />
                </div>
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto bg-transparent p-6">
                <div className="max-w-[1600px] mx-auto">
                    {filteredRecipes.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredRecipes.map(recipe => (
                                <button
                                    key={recipe.id}
                                    onClick={() => navigate(`/menu/digital-black-book/${recipe.id}`)}
                                    className="group flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-[#e8e0d4] dark:border-slate-700 overflow-hidden hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-300 dark:hover:border-amber-700 transition-all text-left"
                                >
                                    {/* Image Section */}
                                    <div className="w-full aspect-[4/3] bg-slate-100 dark:bg-slate-700/50 relative overflow-hidden">
                                        {recipe.platingPhotoUrl ? (
                                            <img 
                                                src={recipe.platingPhotoUrl} 
                                                alt={recipe.name} 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                                <ImageIcon size={32} className="mb-2 opacity-50" />
                                                <span className="text-xs font-medium">No Photo</span>
                                            </div>
                                        )}
                                        {/* Station Badge */}
                                        <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur-md text-white text-xs font-medium rounded-lg">
                                            {recipe.prepStation}
                                        </div>
                                    </div>
                                    
                                    {/* Text Section */}
                                    <div className="p-4 flex flex-col flex-1 justify-between">
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-2">
                                                {recipe.name}
                                            </h3>
                                        </div>
                                        <div className="flex items-center justify-between mt-4">
                                            <span className="text-xs font-medium px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-center">
                                                {recipe.recipeId}
                                            </span>
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                v{recipe.version.replace('v', '')}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-50 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mb-4">
                                <BookOpen size={32} className="text-amber-500 dark:text-amber-400" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                                {searchQuery ? 'No recipes found' : 'No Recipes Yet'}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                                {searchQuery
                                    ? `We couldn't find any recipes matching "${searchQuery}".`
                                    : 'Create your first Digital Black Book recipe to start standardizing your kitchen operations.'}
                            </p>
                            {!searchQuery && isAdmin && (
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="mt-6 px-6 py-2.5 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-500/20"
                                >
                                    Create First Recipe
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <CreateBlackBookModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onRecipeCreated={loadRecipes}
            />
        </div>
    );
};

export default DigitalBlackBookView;
