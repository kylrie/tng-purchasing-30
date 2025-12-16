import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Sparkline Component
const Sparkline: React.FC<{ data: number[]; color?: string }> = ({ data, color = '#22c55e' }) => {
    if (!data || data.length < 2) return null;

    const width = 100;
    const height = 24;
    const padding = 2;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
        const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((value - min) / range) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-5">
            <defs>
                <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="1" />
                </linearGradient>
            </defs>
            <polyline
                fill="none"
                stroke={`url(#sparkGrad-${color.replace('#', '')})`}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    );
};

// Progress Ring Component
const ProgressRing: React.FC<{
    progress: number;
    size?: number;
    strokeWidth?: number;
    gradientColors?: [string, string];
    children?: React.ReactNode;
}> = ({ progress, size = 56, strokeWidth = 4, gradientColors = ['#f97316', '#eab308'], children }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (Math.min(progress, 100) / 100) * circumference;
    const gradientId = `ring-${gradientColors[0].replace('#', '')}-${gradientColors[1].replace('#', '')}`;

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={gradientColors[0]} />
                        <stop offset="100%" stopColor={gradientColors[1]} />
                    </linearGradient>
                </defs>
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(100, 116, 139, 0.3)"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                />
            </svg>
            {/* Icon in center */}
            <div className="absolute inset-0 flex items-center justify-center">
                {children}
            </div>
        </div>
    );
};

export interface PreviewItem {
    id: string;
    title: string;
    subtitle?: string;
}

export interface BreakdownItem {
    label: string;
    count: number;
    color?: string;
}

export interface DashboardCardProps {
    id: string;
    label: string;
    value: string;
    route: string;
    icon: LucideIcon;
    progress?: number;
    sparklineData?: number[];
    gradientColors?: [string, string];
    iconColor?: string;
    sparklineColor?: string;
    // Trend indicator
    trendPercent?: number;
    trend?: 'up' | 'down' | 'neutral';
    // Urgency (for pulse animation)
    urgency?: 'critical' | 'warning' | 'normal';
    // Hover preview items
    previewItems?: PreviewItem[];
    // Expandable breakdown
    breakdown?: BreakdownItem[];
    // Dropdown filter
    filterOptions?: { value: string; label: string }[];
    selectedFilter?: string;
    onFilterChange?: (value: string) => void;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
    label,
    value,
    route,
    icon: Icon,
    progress = 0,
    sparklineData,
    gradientColors = ['#f97316', '#eab308'],
    iconColor = 'text-orange-400',
    sparklineColor = '#f97316',
    trendPercent,
    trend = 'neutral',
    urgency = 'normal',
    previewItems = [],
    breakdown = [],
    filterOptions,
    selectedFilter,
    onFilterChange
}) => {
    const navigate = useNavigate();
    const [isExpanded, setIsExpanded] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Urgency pulse animation classes
    const urgencyClass = urgency === 'critical'
        ? 'animate-pulse-fast'
        : urgency === 'warning'
            ? 'animate-pulse'
            : '';

    // Trend color
    const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400';
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

    const handleExpandClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="relative">
            <button
                onClick={() => navigate(route)}
                onMouseEnter={() => setShowPreview(true)}
                onMouseLeave={() => setShowPreview(false)}
                className={`w-full p-3 rounded-xl bg-slate-800/80 border border-slate-700/50 
                    shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]
                    hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.03),0_0_15px_rgba(139,92,246,0.15)]
                    hover:border-purple-500/30
                    transition-all duration-300 group text-left flex flex-col items-center ${urgencyClass}`}
            >
                {/* Trend Indicator - Top Right */}
                {trendPercent !== undefined && (
                    <div className={`absolute top-2 right-2 flex items-center gap-0.5 text-[10px] font-medium ${trendColor}`}>
                        <TrendIcon size={10} />
                        <span>{Math.abs(trendPercent)}%</span>
                    </div>
                )}

                {/* Expand Button - Top Left (if breakdown exists) */}
                {breakdown.length > 0 && (
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={handleExpandClick}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleExpandClick(e as unknown as React.MouseEvent); }}
                        className="absolute top-2 left-2 p-0.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </div>
                )}

                {/* Progress Ring with Icon */}
                <ProgressRing
                    progress={progress}
                    size={48}
                    strokeWidth={3}
                    gradientColors={gradientColors}
                >
                    <div className={`p-1 rounded-lg bg-slate-700/50 ${iconColor}`}>
                        <Icon size={16} />
                    </div>
                </ProgressRing>

                {/* Value */}
                <div className="mt-1.5 text-xl font-bold text-white group-hover:scale-105 transition-transform">
                    {value}
                </div>

                {/* Label */}
                <div className="text-[10px] font-medium text-slate-300">
                    {label}
                </div>

                {/* Dropdown Filter */}
                {filterOptions && filterOptions.length > 0 && (
                    <select
                        onClick={(e) => e.stopPropagation()}
                        value={selectedFilter || ''}
                        onChange={(e) => {
                            e.stopPropagation();
                            onFilterChange?.(e.target.value);
                        }}
                        className="mt-1 w-full px-1.5 py-0.5 text-[10px] bg-slate-700/50 border border-slate-600/50 rounded text-slate-300 focus:outline-none focus:border-purple-500/50"
                    >
                        {filterOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                )}

                {/* Sparkline */}
                {sparklineData && sparklineData.length > 0 && (
                    <div className="mt-1.5 w-full">
                        <Sparkline data={sparklineData} color={sparklineColor} />
                    </div>
                )}
            </button>

            {/* Hover Preview Tooltip */}
            {showPreview && previewItems.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 p-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
                    <div className="text-[10px] font-semibold text-slate-400 mb-1">Quick Preview</div>
                    {previewItems.slice(0, 3).map((item, idx) => (
                        <div key={item.id} className={`text-xs text-slate-300 py-0.5 ${idx > 0 ? 'border-t border-slate-700/50' : ''}`}>
                            <div className="font-medium truncate">{item.title}</div>
                            {item.subtitle && <div className="text-[10px] text-slate-500 truncate">{item.subtitle}</div>}
                        </div>
                    ))}
                </div>
            )}

            {/* Expanded Breakdown */}
            {isExpanded && breakdown.length > 0 && (
                <div className="mt-1 p-2 bg-slate-800/60 border border-slate-700/50 rounded-lg">
                    <div className="text-[10px] font-semibold text-slate-400 mb-1">Breakdown</div>
                    {breakdown.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs py-0.5">
                            <span className="text-slate-300">{item.label}</span>
                            <span className={item.color || 'text-slate-400'}>{item.count}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DashboardCard;
