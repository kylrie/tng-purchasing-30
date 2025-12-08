import React from 'react';

interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    fillColor?: string;
    strokeWidth?: number;
    showDots?: boolean;
}

/**
 * Simple SVG Sparkline component for trend visualization
 */
const Sparkline: React.FC<SparklineProps> = ({
    data,
    width = 80,
    height = 24,
    color = '#8b5cf6',
    fillColor,
    strokeWidth = 1.5,
    showDots = false
}) => {
    if (!data || data.length < 2) {
        return (
            <div style={{ width, height }} className="flex items-center justify-center text-slate-500 text-xs">
                No data
            </div>
        );
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = data.map((value, index) => {
        const x = padding + (index / (data.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((value - min) / range) * chartHeight;
        return { x, y, value };
    });

    const pathD = points.reduce((acc, point, index) => {
        return acc + (index === 0 ? `M ${point.x},${point.y}` : ` L ${point.x},${point.y}`);
    }, '');

    // Calculate trend (positive = up, negative = down)
    const trend = data.length >= 2 ? data[data.length - 1] - data[0] : 0;
    const lineColor = trend >= 0 ? '#22c55e' : '#ef4444'; // green for up, red for down
    const finalColor = color === 'auto' ? lineColor : color;

    return (
        <svg width={width} height={height} className="overflow-visible">
            {/* Gradient fill under the line */}
            {fillColor && (
                <>
                    <defs>
                        <linearGradient id={`sparkline-gradient-${data.join('-')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={finalColor} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={finalColor} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <path
                        d={`${pathD} L ${points[points.length - 1].x},${height - padding} L ${padding},${height - padding} Z`}
                        fill={`url(#sparkline-gradient-${data.join('-')})`}
                    />
                </>
            )}

            {/* Main line */}
            <path
                d={pathD}
                fill="none"
                stroke={finalColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Dots at each data point */}
            {showDots && points.map((point, index) => (
                <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r={2}
                    fill={finalColor}
                />
            ))}

            {/* Highlight last point */}
            <circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r={3}
                fill={finalColor}
                className="animate-pulse"
            />
        </svg>
    );
};

export default Sparkline;
