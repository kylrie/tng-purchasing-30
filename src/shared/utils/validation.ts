/**
 * Shared Validation Utilities
 * Used across components for consistent input validation
 */

/**
 * Validates if a string is a properly formatted URL
 * @param url - The URL string to validate
 * @returns true if valid URL, false otherwise
 */
export const isValidUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;

    try {
        new URL(trimmed);
        return true;
    } catch {
        return false;
    }
};

/**
 * Validates if a string is a Google Drive link
 * @param url - The URL string to validate
 * @returns true if valid Google Drive URL, false otherwise
 */
export const isGoogleDriveLink = (url: string): boolean => {
    if (!isValidUrl(url)) return false;
    return url.includes('drive.google.com') || url.includes('docs.google.com');
};

/**
 * Sanitizes a URL by trimming whitespace
 * Returns undefined if empty or invalid
 * @param url - The URL string to sanitize
 * @returns Sanitized URL or undefined
 */
export const sanitizeUrl = (url: string | undefined | null): string | undefined => {
    if (!url) return undefined;
    const trimmed = url.trim();
    return trimmed || undefined;
};
