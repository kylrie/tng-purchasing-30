/**
 * ProductionSummaryPanel — Right sidebar panel for Event procurement.
 *
 * Displays:
 *   - Total Servings breakdown (confirmed + buffer)
 *   - Estimated food cost & cost per guest
 *   - "Generate Requirements" action button
 *   - Validation warnings
 */

import React from 'react';
import {
  Users, ChefHat, DollarSign, Sparkles, Loader2, AlertTriangle, BookOpen,
} from 'lucide-react';
import type { BURFEventDetails } from '../types';
import type { ExplosionSummary } from '../services/eventProcurementService';

interface ProductionSummaryPanelProps {
  eventDetails: BURFEventDetails;
  summary: ExplosionSummary | null;
  isGenerating: boolean;
  hasExistingItems: boolean;
  onGenerate: () => void;
}

const ProductionSummaryPanel: React.FC<ProductionSummaryPanelProps> = ({
  eventDetails,
  summary,
  isGenerating,
  hasExistingItems,
  onGenerate,
}) => {
  const totalServings = Math.ceil(
    eventDetails.confirmedGuests * (1 + eventDetails.productionBufferPercent / 100)
  );
  const bufferServings = totalServings - eventDetails.confirmedGuests;

  const isValid = eventDetails.menuItems?.length > 0 && eventDetails.confirmedGuests > 0;

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm dark:shadow-none animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
          <ChefHat size={16} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Production Summary
        </h3>
      </div>

      {/* Metrics Grid */}
      <div className="space-y-3 mb-5">
        {/* Total Servings */}
        <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-100 dark:border-purple-500/20">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-purple-600 dark:text-purple-400" />
            <span className="text-sm text-slate-600 dark:text-slate-300">Total Servings</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-purple-700 dark:text-purple-300">
              {eventDetails.confirmedGuests > 0 ? totalServings : '—'}
            </span>
            {eventDetails.confirmedGuests > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {eventDetails.confirmedGuests} confirmed + {bufferServings} buffer
              </p>
            )}
          </div>
        </div>

        {/* Summary metrics (shown after generation) */}
        {summary && (
          <>
            {/* Kitchen Batches / FG count */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <ChefHat size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-300">Menu Items</span>
              </div>
              <span className="font-semibold text-slate-700 dark:text-white">
                {summary.finishedGoodsCount}
              </span>
            </div>

            {/* Estimated Food Cost */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-300">Est. Food Cost</span>
              </div>
              <span className="font-semibold text-slate-700 dark:text-white">
                ₱{summary.estimatedFoodCost.toLocaleString()}
              </span>
            </div>

            {/* Cost Per Guest */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-300">Cost / Guest</span>
              </div>
              <span className="font-semibold text-slate-700 dark:text-white">
                ₱{summary.costPerGuest.toLocaleString()}
              </span>
            </div>

            {/* Raw Materials Count */}
            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm text-slate-600 dark:text-slate-300">Items Generated</span>
              </div>
              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                {summary.rawMaterialsCount}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Validation warning */}
      {!isValid && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Add <strong>Menu Items</strong> and enter <strong>Confirmed Guests</strong> to generate requirements.
          </p>
        </div>
      )}

      {/* Overwrite warning */}
      {hasExistingItems && isValid && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Items already exist in the table. Generating will <strong>replace</strong> them.
          </p>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={!isValid || isGenerating}
        className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98]"
      >
        {isGenerating ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Generate Requirements →
          </>
        )}
      </button>

      {/* Sub-caption */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center justify-center gap-1">
        <BookOpen size={10} />
        Uses approved recipes from the Digital Black Book
      </p>
    </div>
  );
};

export default ProductionSummaryPanel;
