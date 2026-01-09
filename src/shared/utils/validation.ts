/**
 * Shared Validation Utilities
 * Used across components for consistent input validation
 */

/**
 * Sanitizes a URL by ensuring it has a proper protocol prefix
 * Auto-prepends https:// for common URL patterns that are missing protocol
 * @param url - The URL string to sanitize
 * @returns Sanitized URL with protocol, or original if already valid
 */
export const sanitizeAttachmentUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';

    // Already has a protocol - return as-is
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }

    // Common patterns that should get https:// prepended
    // Matches: drive.google.com, docs.google.com, example.com/path, etc.
    if (/^[a-z0-9][-a-z0-9]*\.[a-z]{2,}/i.test(trimmed)) {
        return `https://${trimmed}`;
    }

    // Return original for other cases (might be relative or special)
    return trimmed;
};

/**
 * Validates if a string is a properly formatted URL with safe protocols
 * Blocks potentially dangerous protocols like javascript:, data:, file:
 * @param url - The URL string to validate
 * @returns true if valid URL with http/https protocol, false otherwise
 */
export const isValidUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;

    // Sanitize first to add protocol if missing
    const sanitized = sanitizeAttachmentUrl(trimmed);

    try {
        const parsed = new URL(sanitized);
        // Only allow safe protocols (http and https)
        // Block javascript:, data:, file:, and other schemes
        return ['http:', 'https:'].includes(parsed.protocol);
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
