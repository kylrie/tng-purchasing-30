// QR Ordering — pure QR matrix helpers (admin table print/export).
//
// Wraps the zero-dependency `qrcode-generator` (public-domain, purely local — the
// customer link is NEVER sent to any external QR service, so a table's qrToken
// stays private). Both the on-screen render and the SVG download build from the
// same deterministic matrix, so they can't diverge.

import qrcode from 'qrcode-generator';

export type QrEcc = 'L' | 'M' | 'Q' | 'H';

/**
 * Build the QR module matrix (true = dark) for `text` in Byte mode at the
 * smallest fitting version. Pure + deterministic. Throws only when the text is
 * too long to fit any QR version — callers surface that as an error state.
 */
export function buildQrMatrix(text: string, ecc: QrEcc = 'M'): boolean[][] {
    const qr = qrcode(0, ecc); // 0 = auto-pick the smallest version
    qr.addData(text);          // URLs auto-select Byte mode
    qr.make();
    const n = qr.getModuleCount();
    const matrix: boolean[][] = [];
    for (let r = 0; r < n; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
        matrix.push(row);
    }
    return matrix;
}

export interface QrSvgOptions {
    /** Quiet-zone width in modules (QR spec minimum is 4). */
    margin?: number;
    dark?: string;
    light?: string;
}

/**
 * Serialize a module matrix to a standalone, crisp SVG string with unit-sized
 * modules (scale via width/height or CSS). Used for the download so the exported
 * file is identical to what's rendered on screen.
 */
export function qrMatrixToSvgString(matrix: boolean[][], opts: QrSvgOptions = {}): string {
    const margin = opts.margin ?? 4;
    const dark = opts.dark ?? '#0f172a';
    const light = opts.light ?? '#ffffff';
    const n = matrix.length;
    const size = n + margin * 2;
    let rects = '';
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (matrix[r][c]) rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1"/>`;
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`
        + `<rect width="${size}" height="${size}" fill="${light}"/>`
        + `<g fill="${dark}">${rects}</g></svg>`;
}
