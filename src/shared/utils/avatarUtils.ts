/**
 * Avatar Utilities
 * Local avatar generation to replace external ui-avatars.com dependency
 */

/**
 * Generate initials-based avatar as data URI
 * Replaces dependency on ui-avatars.com external service
 * 
 * @param name - User's display name
 * @returns Data URI for an SVG avatar with initials
 * 
 * @example
 * <img src={generateAvatarUrl("John Doe")} alt="Avatar" />
 */
export function generateAvatarUrl(name: string): string {
    if (!name || name.trim() === '') {
        name = '?';
    }

    const initials = name
        .split(' ')
        .filter(part => part.length > 0)
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    // Generate a consistent color from the name (deterministic hash)
    const hash = name.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    const hue = Math.abs(hash % 360);

    // SVG with rounded background and centered initials
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <rect width="48" height="48" fill="hsl(${hue}, 55%, 45%)" rx="24"/>
        <text x="24" y="24" text-anchor="middle" dominant-baseline="central" 
              fill="white" font-family="system-ui, -apple-system, sans-serif" 
              font-size="18" font-weight="600">
            ${initials}
        </text>
    </svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Get avatar URL with fallback to generated avatar
 * 
 * @param avatarUrl - User's avatar URL (may be undefined/null)
 * @param name - User's display name for fallback generation
 * @returns Avatar URL or generated fallback
 */
export function getAvatarWithFallback(avatarUrl: string | undefined | null, name: string): string {
    if (avatarUrl && avatarUrl.trim() !== '') {
        return avatarUrl;
    }
    return generateAvatarUrl(name);
}
