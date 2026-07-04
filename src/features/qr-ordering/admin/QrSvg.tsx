import React from 'react';

/**
 * Render a QR module matrix as a crisp, accessible SVG. Presentational + pure:
 * the caller builds the matrix (see qrMatrix.buildQrMatrix) so this component
 * never throws. Modules are unit-sized in the viewBox and scaled by width/height,
 * so it stays sharp at any print size.
 */
interface QrSvgProps {
    matrix: boolean[][];
    /** Rendered pixel size (square). */
    size: number;
    /** Quiet-zone width in modules (QR spec minimum is 4). */
    margin?: number;
    /** Required — describes the code for screen readers. */
    ariaLabel: string;
    className?: string;
}

export const QrSvg: React.FC<QrSvgProps> = ({ matrix, size, margin = 4, ariaLabel, className }) => {
    const n = matrix.length;
    const dim = n + margin * 2;
    const rects: React.ReactNode[] = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (matrix[r][c]) rects.push(<rect key={`${r}-${c}`} x={c + margin} y={r + margin} width={1} height={1} />);
        }
    }
    return (
        <svg
            role="img"
            aria-label={ariaLabel}
            className={className}
            width={size}
            height={size}
            viewBox={`0 0 ${dim} ${dim}`}
            shapeRendering="crispEdges"
        >
            <rect width={dim} height={dim} fill="#ffffff" />
            <g fill="#0f172a">{rects}</g>
        </svg>
    );
};
