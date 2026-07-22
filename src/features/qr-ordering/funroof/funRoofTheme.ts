// The Fun Roof — QR menu THEME configuration (business unit b1).
//
// This module owns The Fun Roof's visual identity, derived from the official
// logo (public/funroof-logo.png): a neon rooftop-nightlife palette —
// FUN = lime→yellow, ROOF = orange→coral→magenta→purple, THE = cyan/purple.
// It is intentionally distinct from the Inflatable Island beach theme (light,
// pink+teal) so the two businesses are unmistakable while sharing the same QR
// product design language (card shapes, radii, spacing, nav + button patterns).
//
// Pure data — no React, no side effects. The Fun Roof view/sheet/cart consume it.

/** Named brand colors pulled from the logo. */
export const FUN_ROOF_COLORS = {
    magenta: '#F5209B',   // ROOF — primary accent
    pink: '#FF62A8',      // ROOF highlight
    orange: '#FF9F45',    // ROOF top
    lime: '#A7E739',      // FUN — secondary accent
    yellow: '#F6E13B',    // FUN highlight
    cyan: '#37D3E6',      // THE
    purple: '#8B36E0',    // outline / depth
    ink: '#0B0713',       // near-black plum base
} as const;

/**
 * Semantic tokens the UI reads. Kept small and flat so a designer can retune the
 * brand in one place without touching component markup.
 */
export const FUN_ROOF_THEME = {
    // Primary interactive accent (active nav, add buttons, focus ring, CTA).
    primary: FUN_ROOF_COLORS.magenta,
    primarySoft: 'rgba(245,32,155,0.16)',
    // Secondary accent (prices, "signature" tags) — the lime side of the logo.
    accent: FUN_ROOF_COLORS.lime,
    // Text on the dark canvas.
    text: '#F7F3FF',          // near-white, faint lavender
    textMuted: '#B7ABD1',     // lavender-gray for descriptions/labels
    textFaint: '#8C80A6',     // sold-out / tertiary
    // Card / sheet surfaces (dark glass over the night gradient).
    surface: 'rgba(28,16,46,0.72)',
    surfaceSolid: '#170D26',
    surfaceRaised: 'rgba(40,24,64,0.85)',
    border: 'rgba(255,255,255,0.10)',
    borderStrong: 'rgba(255,255,255,0.16)',
    // Neutral image-zone tile shown until a dish has a real photo.
    imageTile: 'rgba(255,255,255,0.05)',
} as const;

/**
 * The full-page night background: a deep plum→black base washed with soft neon
 * glows echoing the logo (magenta, purple, lime, cyan). Premium but restrained —
 * content sits on solid dark surfaces so the menu stays readable, never washed out.
 */
export const FUN_ROOF_BACKGROUND =
    'radial-gradient(115% 62% at 50% -6%, rgba(245,32,155,0.30) 0%, rgba(245,32,155,0) 55%),' +
    'radial-gradient(80% 46% at 8% 2%, rgba(55,211,230,0.20) 0%, rgba(55,211,230,0) 55%),' +
    'radial-gradient(85% 48% at 96% 6%, rgba(167,231,57,0.16) 0%, rgba(167,231,57,0) 52%),' +
    'radial-gradient(120% 80% at 50% 108%, rgba(139,54,224,0.28) 0%, rgba(139,54,224,0) 60%),' +
    'linear-gradient(180deg, #0B0713 0%, #0B0713 100%)';

/** Magenta→purple gradient for the primary CTA / floating summary bar. */
export const FUN_ROOF_CTA_GRADIENT =
    'linear-gradient(135deg, #F5209B 0%, #B12FCB 55%, #8B36E0 100%)';

/** Soft glow behind the hero logo (tuned to the theme, not the raster's own rays). */
export const FUN_ROOF_LOGO_GLOW =
    'radial-gradient(50% 60% at 50% 50%, rgba(245,32,155,0.35) 0%, rgba(167,231,57,0.12) 45%, rgba(245,32,155,0) 72%)';

export type FunRoofTheme = typeof FUN_ROOF_THEME;
