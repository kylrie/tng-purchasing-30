import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import type { User, Business } from '../../procurement/types';
import type { BlackBookRecipe, QualityCheckItem } from '../types/blackbook.types';
import { BlackBookService } from '../services/blackbook.service';
import { usePermissions } from '../../../hooks/usePermissions';
import BlackBookRecipeCard from '../components/BlackBookRecipeCard';
import BlackBookMediaSection from '../components/BlackBookMediaSection';
import BlackBookQualityControls from '../components/BlackBookQualityControls';
import BlackBookFooter from '../components/BlackBookFooter';
import UpdateBlackBookVersionModal from '../components/UpdateBlackBookVersionModal';

interface DigitalBlackBookDetailsViewProps {
    businesses: Business[];
    currentUser: User;
}

const DigitalBlackBookDetailsView: React.FC<DigitalBlackBookDetailsViewProps> = ({
    currentUser
}) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { hasPermission } = usePermissions();

    const canApprove = hasPermission('menu:black_book:approve');
    const canEdit = hasPermission('menu:black_book:edit');
    const isAdmin = canEdit || hasPermission('menu:black_book:create');

    const [selectedRecipe, setSelectedRecipe] = useState<BlackBookRecipe | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

    const loadRecipe = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const recipe = await BlackBookService.getRecipe(id);
            if (recipe) {
                setSelectedRecipe(recipe);
            } else {
                setError('Recipe not found.');
            }
        } catch (err) {
            console.error('Error loading Black Book recipe:', err);
            setError('Failed to load recipe. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadRecipe();
    }, [loadRecipe]);

    const handleChecklistChange = (updatedChecklist: QualityCheckItem[]) => {
        if (!selectedRecipe) return;
        setSelectedRecipe({
            ...selectedRecipe,
            qualityChecklist: updatedChecklist
        });
    };

    const handleApprove = async () => {
        if (!selectedRecipe || !canApprove) return;
        
        if (window.confirm(`Are you sure you want to approve version ${selectedRecipe.version}?`)) {
            try {
                await BlackBookService.approveRecipe(selectedRecipe.id, currentUser.name);
                await loadRecipe();
            } catch (err) {
                console.error('Failed to approve recipe:', err);
                window.alert('Failed to approve recipe. Please try again.');
            }
        }
    };

    const handlePrintStationCopy = () => {
        window.print();
    };

    const handleOpenTESChecklist = () => {
        window.alert('TES Training Checklist feature is coming soon!');
    };

    const handleUpdateVideoUrl = async () => {
        if (!isAdmin || !selectedRecipe) return;
        const newUrl = window.prompt('Enter new video URL (YouTube or Google Drive):', selectedRecipe.youtubeVideoUrl || selectedRecipe.trainingVideoUrl || '');
        if (newUrl !== null) {
            try {
                const isYouTube = newUrl.includes('youtube.com') || newUrl.includes('youtu.be');
                const isDrive = newUrl.includes('drive.google.com');

                await BlackBookService.updateRecipe(
                    selectedRecipe.id,
                    { 
                        youtubeVideoUrl: isYouTube ? newUrl : (isDrive ? '' : newUrl),
                        trainingVideoUrl: isDrive ? newUrl : ''
                    },
                    'Updated training video link',
                    currentUser.name
                );
                loadRecipe();
            } catch (err) {
                console.error('Failed to update video URL:', err);
                window.alert('Failed to update video URL. Please try again.');
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="text-amber-500 animate-spin" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Loading recipe details...</p>
                </div>
            </div>
        );
    }

    if (error || !selectedRecipe) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                    <p className="text-red-500 dark:text-red-400 mb-4">{error || 'Recipe not found'}</p>
                    <button
                        onClick={() => navigate('/menu/digital-black-book')}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                    >
                        Back to Black Book
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 print:m-0 print:space-y-0 pb-12 px-4 sm:px-6 lg:px-8">
            {/* Top Navigation */}
            <div className="print:hidden">
                <button 
                    onClick={() => navigate('/menu/digital-black-book')}
                    className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-500 transition-colors bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-fit"
                >
                    <ArrowLeft size={18} />
                    <span className="font-medium">Back to Black Book</span>
                </button>
            </div>

            {/* Detail Panels */}
            <div className="space-y-6">
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
                    canApprove={canApprove}
                    canEdit={canEdit}
                    onApprove={handleApprove}
                    onUpdateVersion={() => setIsUpdateModalOpen(true)}
                    onPrintStationCopy={handlePrintStationCopy}
                    onOpenTESChecklist={handleOpenTESChecklist}
                />
            </div>

            {isUpdateModalOpen && selectedRecipe && (
                <UpdateBlackBookVersionModal
                    isOpen={isUpdateModalOpen}
                    onClose={() => setIsUpdateModalOpen(false)}
                    onRecipeUpdated={loadRecipe}
                    recipe={selectedRecipe}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};

export default DigitalBlackBookDetailsView;
