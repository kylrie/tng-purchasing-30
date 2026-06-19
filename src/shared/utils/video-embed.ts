// ============================================================
// VIDEO EMBEDDING UTILITIES
// Google Drive link parser + embed URL converter
// ============================================================

/**
 * Extracts the FILE_ID from a Google Drive sharing link and returns an embeddable preview URL.
 * Supports formats:
 *   - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   - https://drive.google.com/file/d/FILE_ID/view
 *   - https://drive.google.com/open?id=FILE_ID
 *
 * @param url - The raw Google Drive sharing URL pasted by the user.
 * @returns The embeddable preview URL, or null if the URL is not a valid Google Drive link.
 */
export function getDriveEmbedUrl(url: string): string | null {
    if (!url || typeof url !== 'string') return null;

    // Pattern 1: /file/d/FILE_ID/...
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch && fileMatch[1]) {
        return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }

    // Pattern 2: ?id=FILE_ID
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
        return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
    }

    return null;
}

/**
 * Checks if a URL is a valid Google Drive link that can be embedded.
 */
export function isGoogleDriveUrl(url: string): boolean {
    return getDriveEmbedUrl(url) !== null;
}
