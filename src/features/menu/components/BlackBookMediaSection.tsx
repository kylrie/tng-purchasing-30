import React from 'react';
import { Play, Image as ImageIcon, GraduationCap } from 'lucide-react';
import type { BlackBookRecipe } from '../types/blackbook.types';
import { getDriveEmbedUrl, getYouTubeEmbedUrl } from '../../../shared/utils/video-embed';

interface BlackBookMediaSectionProps {
    recipe: BlackBookRecipe;
    onUpdateVideoUrl?: () => void;
}

const BlackBookMediaSection: React.FC<BlackBookMediaSectionProps> = ({ recipe, onUpdateVideoUrl }) => {
    const driveEmbedUrl = recipe.trainingVideoUrl ? getDriveEmbedUrl(recipe.trainingVideoUrl) : null;
    const ytEmbedUrl = recipe.youtubeVideoUrl ? getYouTubeEmbedUrl(recipe.youtubeVideoUrl) : null;
    const embedUrl = ytEmbedUrl || driveEmbedUrl;

    return (
        <div className="space-y-6">
            {/* Step-by-Step Method */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#e8e0d4] dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d4] dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Step-by-Step Method</h2>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f5f0e8] dark:bg-slate-700 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 border border-[#e8e0d4] dark:border-slate-600">
                        <GraduationCap size={12} />
                        TES training flow
                    </span>
                </div>

                <div className="p-6 space-y-4">
                    {recipe.methodSteps.map(step => (
                        <div key={step.stepNumber} className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-[#2c2520] dark:bg-amber-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-1">
                                {step.stepNumber}
                            </div>
                            <div className="flex-1 bg-[#faf8f5] dark:bg-slate-700/50 rounded-xl px-5 py-4 border border-[#e8e0d4] dark:border-slate-600">
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{step.instruction}</p>
                            </div>
                        </div>
                    ))}
                    {recipe.methodSteps.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">No method steps added yet.</p>
                    )}
                </div>
            </div>

            {/* 2-Column Media Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Plating / Serving Photo */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#e8e0d4] dark:border-slate-700 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d4] dark:border-slate-700">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Plating / Serving Photo</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            visual standard
                        </span>
                    </div>
                    <div className="p-6">
                        {recipe.platingPhotoUrl ? (
                            <img
                                src={recipe.platingPhotoUrl}
                                alt={`${recipe.name} plating`}
                                className="w-full h-56 object-cover rounded-xl border border-[#e8e0d4] dark:border-slate-600"
                            />
                        ) : (
                            <div className="w-full h-56 bg-gradient-to-br from-amber-100 to-orange-50 dark:from-slate-700 dark:to-slate-600 rounded-xl border border-[#e8e0d4] dark:border-slate-600 flex flex-col items-center justify-center">
                                <ImageIcon size={32} className="text-amber-400 dark:text-slate-400 mb-2" />
                                <p className="text-sm font-medium text-amber-700 dark:text-slate-400">Final plate photo placeholder</p>
                                <p className="text-xs text-amber-500 dark:text-slate-500 mt-1">Required: top view + 45° angle + portion guide</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Training Video */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#e8e0d4] dark:border-slate-700 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d4] dark:border-slate-700">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Training Video</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            required viewing
                        </span>
                    </div>
                    <div className="p-6">
                        {embedUrl ? (
                            <div className="relative w-full h-56 rounded-xl overflow-hidden border border-[#e8e0d4] dark:border-slate-600">
                                <iframe
                                    src={embedUrl}
                                    title={`${recipe.name} training video`}
                                    className="absolute inset-0 w-full h-full"
                                    allow="autoplay; encrypted-media"
                                    allowFullScreen
                                    sandbox="allow-scripts allow-same-origin"
                                />
                            </div>
                        ) : (
                            <div 
                                onClick={onUpdateVideoUrl}
                                className={`w-full h-56 bg-gradient-to-br from-stone-600 to-stone-800 dark:from-slate-700 dark:to-slate-600 rounded-xl border border-[#e8e0d4] dark:border-slate-600 flex flex-col items-center justify-center ${onUpdateVideoUrl ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                            >
                                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
                                    <Play size={24} className="text-white ml-0.5" />
                                </div>
                                <p className="text-sm font-medium text-white">Embedded private YouTube/Vimeo/TES video</p>
                                <p className="text-xs text-white/70 mt-1">
                                    {onUpdateVideoUrl ? 'Click here to add a video link' : 'Staff must watch and pass checklist before station access'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BlackBookMediaSection;
