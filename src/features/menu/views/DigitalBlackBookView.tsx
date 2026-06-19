import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Loader2 } from 'lucide-react';
import type { User, Business } from '../../procurement/types';
import type { BlackBookRecipe, QualityCheckItem } from '../types/blackbook.types';
import { BlackBookService } from '../services/blackbook.service';
import { usePermissions } from '../../../hooks/usePermissions';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import BlackBookSidebar from '../components/BlackBookSidebar';
import BlackBookRecipeCard from '../components/BlackBookRecipeCard';
import BlackBookMediaSection from '../components/BlackBookMediaSection';
import BlackBookQualityControls from '../components/BlackBookQualityControls';
import BlackBookFooter from '../components/BlackBookFooter';
import CreateBlackBookModal from '../components/CreateBlackBookModal';

// ============================================================
// DIGITAL BLACK BOOK VIEW
// Main orchestrator view for the Digital Black Book module.
// Renders sidebar + detail panels. Respects RBAC permissions.
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

    // RBAC: Admin can edit, non-admin is view-only
    const isAdmin = hasPermission('menu:black_book:edit') || hasPermission('menu:black_book:create');

    const [recipes, setRecipes] = useState<BlackBookRecipe[]>([]);
    const [selectedRecipe, setSelectedRecipe] = useState<BlackBookRecipe | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Fetch recipes for the selected business unit
    const loadRecipes = useCallback(async () => {
        if (selectedBusinessUnit === 'all') {
            // Load recipes from all accessible business units
            setLoading(true);
            setError(null);
            try {
                const allRecipes: BlackBookRecipe[] = [];
                for (const bu of businesses) {
                    const buRecipes = await BlackBookService.getRecipes(bu.id);
                    allRecipes.push(...buRecipes);
                }
                // Sort alphabetically
                allRecipes.sort((a, b) => a.name.localeCompare(b.name));
                setRecipes(allRecipes);
                // Auto-select first recipe if nothing selected
                if (allRecipes.length > 0 && !selectedRecipe) {
                    setSelectedRecipe(allRecipes[0]);
                }
            } catch (err) {
                console.error('Error loading Black Book recipes:', err);
                setError('Failed to load recipes. Please try again.');
            } finally {
                setLoading(false);
            }
        } else {
            setLoading(true);
            setError(null);
            try {
                const buRecipes = await BlackBookService.getRecipes(selectedBusinessUnit);
                setRecipes(buRecipes);
                if (buRecipes.length > 0 && !selectedRecipe) {
                    setSelectedRecipe(buRecipes[0]);
                }
            } catch (err) {
                console.error('Error loading Black Book recipes:', err);
                setError('Failed to load recipes. Please try again.');
            } finally {
                setLoading(false);
            }
        }
    }, [selectedBusinessUnit, businesses]);

    useEffect(() => {
        loadRecipes();
    }, [loadRecipes]);

    // Handle recipe selection
    const handleSelectRecipe = (recipe: BlackBookRecipe) => {
        setSelectedRecipe(recipe);
    };

    // Handle checklist changes (kitchen staff can interact with checklist)
    const handleChecklistChange = (updatedChecklist: QualityCheckItem[]) => {
        if (!selectedRecipe) return;
        setSelectedRecipe({
            ...selectedRecipe,
            qualityChecklist: updatedChecklist
        });
    };

    // Print station copy (PDF generation placeholder)
    const handlePrintStationCopy = () => {
        if (!selectedRecipe) return;
        // TODO: Integrate PDF generation
        window.print();
    };

    // Open TES Training Checklist
    const handleOpenTESChecklist = () => {
        window.alert('TES Training Checklist feature is coming soon!');
    };

    // Update Video URL
    const handleUpdateVideoUrl = async () => {
        if (!isAdmin || !selectedRecipe) return;
        const newUrl = window.prompt('Enter new video URL (YouTube or Google Drive):', selectedRecipe.youtubeVideoUrl || selectedRecipe.trainingVideoUrl || '');
        if (newUrl !== null) {
            try {
                await BlackBookService.updateRecipe(
                    selectedRecipe.id,
                    { 
                        youtubeVideoUrl: newUrl, 
                        trainingVideoUrl: '' // Reset the other to avoid conflicts
                    },
                    'Updated training video link',
                    currentUser.name
                );
                loadRecipes();
            } catch (err) {
                console.error('Failed to update video URL:', err);
                window.alert('Failed to update video URL. Please try again.');
            }
        }
    };

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
        <div className="flex flex-col h-full -m-4 md:-m-6 lg:-m-8 print:m-0 print:h-auto">
            {/* Page Header */}
            <div className="print:hidden flex items-center justify-between px-6 py-4 border-b border-[#e8e0d4] dark:border-slate-700 bg-[#faf8f5]/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <BookOpen size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Digital Black Book</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Standardized Recipe Operations · {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isAdmin && (
                        <button
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-500 text-white rounded-lg text-sm font-semibold hover:from-amber-700 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20"
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            <Plus size={16} />
                            New Recipe
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content: Sidebar + Detail */}
            <div className="flex flex-1 overflow-hidden print:overflow-visible">
                {/* Sidebar */}
                <div className="print:hidden h-full flex flex-shrink-0">
                    <BlackBookSidebar
                        recipes={recipes}
                        selectedRecipeId={selectedRecipe?.id ?? null}
                        onSelectRecipe={handleSelectRecipe}
                    />
                </div>

                {/* Detail Panel */}
                <div className="flex-1 overflow-y-auto print:overflow-visible bg-[#faf8f5] dark:bg-slate-900 p-6 print:p-0 space-y-6">
                    {selectedRecipe ? (
                        <>
                            <BlackBookRecipeCard
                                recipe={selectedRecipe}
                                isAdmin={isAdmin}
                            />
                            <BlackBookMediaSection
                                recipe={selectedRecipe}
                                onUpdateVideoUrl={isAdmin ? handleUpdateVideoUrl : undefined}
                            />
                            <BlackBookQualityControls
                                recipe={selectedRecipe}
                                onChecklistChange={handleChecklistChange}
                            />
                            <BlackBookFooter
                                recipe={selectedRecipe}
                                onPrintStationCopy={handlePrintStationCopy}
                                onOpenTESChecklist={handleOpenTESChecklist}
                            />
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-50 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mb-4">
                                <BookOpen size={32} className="text-amber-500 dark:text-amber-400" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                                {recipes.length === 0 ? 'No Recipes Yet' : 'Select a Recipe'}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                                {recipes.length === 0
                                    ? 'Create your first Digital Black Book recipe to start standardizing your kitchen operations.'
                                    : 'Choose a recipe from the sidebar to view its complete operational specification.'}
                            </p>
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
