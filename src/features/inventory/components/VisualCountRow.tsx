import React, { useState } from 'react';
import {
    Wine,
    Beer,
    Coffee,
    Box,
    Wrench,
    Minus,
    Plus,
    Calculator
} from 'lucide-react';
import type { InventoryItem, InventoryItemType } from '../types/InventoryItem';

// ============================================================
// PROPS
// ============================================================

interface VisualCountRowProps {
    item: InventoryItem;
    count: number;
    partialCount: number;
    onCountChange: (count: number, partialCount: number) => void;
    onCalculatorOpen: () => void;
}

// ============================================================
// PARTIAL COUNT SLIDER - For RAW_MATERIAL and PRODUCTION
// ============================================================

const PartialSlider: React.FC<{
    value: number;
    onChange: (value: number) => void;
}> = ({ value, onChange }) => {
    const fillPercent = value * 100;

    return (
        <div className="relative w-full">
            {/* Visual Bottle */}
            <div className="h-16 w-12 mx-auto relative mb-2">
                <div className="absolute inset-0 border-2 border-slate-500 rounded-t-sm rounded-b-lg bg-slate-800/50 overflow-hidden">
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-500 to-cyan-400 transition-all duration-150"
                        style={{ height: `${fillPercent}%` }}
                    />
                    <div
                        className="absolute bottom-0 left-0 w-1/3 bg-white/20 transition-all duration-150"
                        style={{ height: `${fillPercent}%` }}
                    />
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-3 border-2 border-slate-500 border-b-0 rounded-t-sm bg-slate-800/50" />
            </div>

            {/* Slider Input */}
            <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />

            <div className="text-center mt-1">
                <span className="text-sm font-medium text-cyan-400">{(value * 100).toFixed(0)}%</span>
            </div>
        </div>
    );
};

// ============================================================
// SIMPLE STEPPER - For ASSET and FINISHED_GOOD
// ============================================================

const SimpleStepper: React.FC<{
    value: number;
    onChange: (value: number) => void;
    unit: string;
}> = ({ value, onChange, unit }) => {
    const [draft, setDraft] = useState<string>(value.toString());

    // Keep draft in sync when parent value changes (e.g. from calculator)
    React.useEffect(() => { setDraft(value.toString()); }, [value]);

    const commit = () => {
        const parsed = parseFloat(draft);
        if (!isNaN(parsed) && parsed >= 0) {
            onChange(parsed);
        } else {
            setDraft(value.toString()); // revert on invalid
        }
    };

    return (
        <div className="flex items-center justify-center gap-3">
            <button
                onClick={() => onChange(Math.max(0, value - 1))}
                className="w-12 h-12 rounded-xl bg-slate-700 hover:bg-red-500/30 text-slate-300 hover:text-red-400 flex items-center justify-center transition-colors"
            >
                <Minus size={20} />
            </button>

            <div className="text-center min-w-[80px]">
                <input
                    type="text"
                    inputMode="decimal"
                    value={draft}
                    onChange={e => {
                        // Allow digits, one decimal point, and empty string
                        if (/^\d*\.?\d*$/.test(e.target.value)) setDraft(e.target.value);
                    }}
                    onFocus={e => e.target.select()}
                    onBlur={commit}
                    onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                    className="w-full text-center text-2xl font-bold text-white bg-transparent outline-none border-b-2 border-transparent focus:border-purple-400 transition-colors cursor-text"
                />
                <p className="text-xs text-slate-400">{unit}s</p>
            </div>

            <button
                onClick={() => onChange(value + 1)}
                className="w-12 h-12 rounded-xl bg-slate-700 hover:bg-green-500/30 text-slate-300 hover:text-green-400 flex items-center justify-center transition-colors"
            >
                <Plus size={20} />
            </button>
        </div>
    );
};

// ============================================================
// GET ICON BY CATEGORY/TYPE
// ============================================================

const getCategoryIcon = (item: InventoryItem) => {
    if (item.type === 'ASSET') return Wrench;

    switch (item.category) {
        case 'Spirits': return Wine;
        case 'Wine': return Wine;
        case 'Beer': return Beer;
        case 'Mixers': return Coffee;
        case 'Equipment': return Wrench;
        default: return Box;
    }
};

// ============================================================
// INLINE EDITABLE COUNT INPUT - Full units box (Raw/Production)
// ============================================================

const FullUnitsInput: React.FC<{
    count: number;
    onCountChange: (count: number) => void;
}> = ({ count, onCountChange }) => {
    const [draft, setDraft] = useState<string>(count.toString());

    // Sync when parent count changes (e.g. from the calculator popup)
    React.useEffect(() => { setDraft(count.toString()); }, [count]);

    const commit = () => {
        const parsed = parseFloat(draft);
        if (!isNaN(parsed) && parsed >= 0) {
            onCountChange(Math.floor(parsed)); // full units = whole numbers only
        } else {
            setDraft(count.toString()); // revert on invalid input
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => onCountChange(Math.max(0, count - 1))}
                className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-red-500/30 text-slate-300 hover:text-red-400 flex items-center justify-center transition-colors flex-shrink-0"
            >
                <Minus size={16} />
            </button>

            <input
                type="text"
                inputMode="numeric"
                value={draft}
                onChange={e => {
                    // Only allow whole numbers (full units)
                    if (/^\d*$/.test(e.target.value)) setDraft(e.target.value);
                }}
                onFocus={e => e.target.select()}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="flex-1 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg text-center outline-none ring-0 border-2 border-transparent focus:border-purple-400 transition-colors cursor-text"
            />

            <button
                onClick={() => onCountChange(count + 1)}
                className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-green-500/30 text-slate-300 hover:text-green-400 flex items-center justify-center transition-colors flex-shrink-0"
            >
                <Plus size={16} />
            </button>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const VisualCountRow: React.FC<VisualCountRowProps> = ({
    item,
    count,
    partialCount,
    onCountChange,
    onCalculatorOpen
}) => {
    const itemIcon = getCategoryIcon(item);

    // Determine which UI to show based on item type
    const showSlider = item.type === 'RAW_MATERIAL' || item.type === 'PRODUCTION';
    const showStepper = item.type === 'ASSET' || item.type === 'FINISHED_GOOD';
    
    // Calculate stock equivalents
    const conversion = item.units.conversion > 0 ? item.units.conversion : 1;
    const currentStockBuyUnits = (item.currentStock / conversion).toFixed(2).replace(/\.00$/, '');

    const handlePartialChange = (partial: number) => {
        onCountChange(count, partial);
    };

    const handleStepperChange = (newCount: number) => {
        onCountChange(newCount, 0); // No partial for assets/finished goods
    };

    // Type badge color
    const typeBadgeColors: Record<InventoryItemType, string> = {
        'RAW_MATERIAL': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'PRODUCTION': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'FINISHED_GOOD': 'bg-green-500/20 text-green-400 border-green-500/30',
        'ASSET': 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    };

    const typeLabels: Record<InventoryItemType, string> = {
        'RAW_MATERIAL': 'Raw',
        'PRODUCTION': 'Prod',
        'FINISHED_GOOD': 'Finished',
        'ASSET': 'Asset'
    };

    return (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-purple-500/30 transition-all">
            {/* Header Row */}
            <div className="flex gap-4 mb-4">
                {/* Icon */}
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0 border border-slate-600">
                    {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                        React.createElement(itemIcon, { size: 24, className: "text-purple-400" })
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white truncate">{item.name}</h4>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${typeBadgeColors[item.type]}`}>
                            {typeLabels[item.type]}
                        </span>
                    </div>
                    <p className="text-sm text-slate-400">{item.category}</p>
                    <p className="text-sm font-semibold text-slate-300 mt-1">
                        Current: {item.currentStock} {item.units.recipeUnit}s <span className="text-slate-500 font-bold mx-1">=</span> <span className="text-cyan-400">{currentStockBuyUnits} {item.units.buyUnit}s</span>
                    </p>
                </div>

                {/* Calculator Button */}
                <button
                    onClick={onCalculatorOpen}
                    className="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center transition-colors"
                >
                    <Calculator size={18} />
                </button>
            </div>

            {/* Count Input - Conditional UI */}
            {showSlider && (
                <div className="grid grid-cols-2 gap-4">
                    {/* Full Units */}
                    <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wide mb-2 block">
                            Full {item.units.buyUnit}s
                        </label>
                        <FullUnitsInput
                            count={count}
                            onCountChange={(newCount) => onCountChange(newCount, partialCount)}
                        />
                    </div>

                    {/* Partial Unit - Slider */}
                    <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wide mb-2 block">
                            Partial {item.units.buyUnit}
                        </label>
                        <PartialSlider
                            value={partialCount}
                            onChange={handlePartialChange}
                        />
                    </div>
                </div>
            )}

            {showStepper && (
                <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide mb-3 block text-center">
                        Quantity
                    </label>
                    <SimpleStepper
                        value={count}
                        onChange={handleStepperChange}
                        unit={item.units.buyUnit}
                    />
                </div>
            )}

            {/* Total Display */}
            <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                <span className="text-sm text-slate-400">Total Count:</span>
                <span className="text-lg font-bold text-cyan-400">
                    {(count + partialCount).toFixed(showSlider ? 1 : 0)} {item.units.buyUnit}s
                </span>
            </div>
        </div>
    );
};

export default VisualCountRow;
