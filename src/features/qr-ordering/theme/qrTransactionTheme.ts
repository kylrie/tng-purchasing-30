// QR transaction pages — business-specific THEME registry.
//
// The checkout + order-status pages are ONE shared transaction engine. Only the
// visible business identity differs per venue. This module maps a businessUnitId
// to a resolved theme (colors, background, surfaces, logo, status tones) that the
// shared views consume — so the engine is never duplicated, only re-skinned.
//
// The business is resolved from AUTHORITATIVE order data (getQrOrder returns
// businessUnitId), so the correct brand survives hard refresh, new tab, cold
// open, direct-URL paste, back/forward, and the Xendit redirect. There is NO
// dependence on transient React/nav state, and an unknown business falls back to
// the neutral default (Inflatable) — never silently to the wrong specific brand.
//
// INFLATABLE_THEME values reproduce the PRIOR hardcoded Inflatable styling exactly
// (colors + the distinct accent alphas/shadows), so Inflatable pages are visually
// unchanged; FUN_ROOF_TXN_THEME is the dark-neon identity from the menu module.
//
// Two accent families keep both brands honest:
//   • `primary`  — the SECONDARY accent (Inflatable pink / Fun Roof magenta):
//                  table labels, selection rings, current-step dot, "order more".
//   • `cta`      — the SOLID brand-primary (Inflatable teal / Fun Roof magenta):
//                  spinners, back chevron, checkout heading, "qty×", secure badge,
//                  the pay button (which additionally uses `ctaGradient` when set).
//
// Pure data — no React, no side effects.

import {
    FUN_ROOF_COLORS, FUN_ROOF_THEME, FUN_ROOF_BACKGROUND, FUN_ROOF_CTA_GRADIENT,
} from '../funroof/funRoofTheme';
import { FUN_ROOF_BUSINESS_ID } from '../utils/customerMenuUrl';

/** Semantic status tones the order-status badges/chips use (business-agnostic
 *  meaning; each theme supplies light- or dark-appropriate classes). */
export type TxnTone = 'amber' | 'blue' | 'emerald' | 'red' | 'slate';

export interface QrTransactionTheme {
    key: 'inflatable' | 'funroof';
    brandName: string;
    isDark: boolean;

    // ── Page canvas ──
    pageBackground: string;
    topGlow: string;
    headerBg: string;       // sticky order-status header
    stickyBarBg: string;    // checkout sticky pay bar

    // ── Text ──
    text: string;
    textMuted: string;
    textFaint: string;

    // ── Surfaces ──
    surface: string;
    surfaceBorder: string;
    surfaceShadow: string;
    modalShadow: string;    // connecting overlay card
    subtleFill: string;     // inset info rows

    // ── Secondary accent (pink / magenta) ──
    primary: string;
    primarySoft: string;    // icon tiles (~10% alpha)
    primaryPing: string;    // animated current-step ping (~30%)
    primaryRing: string;    // current-step dot ring (~20%)
    primaryGlow: string;    // selected-method glow (~45%)
    onPrimary: string;

    // ── Brand-primary solid + CTA (teal / magenta) ──
    cta: string;
    ctaGradient?: string;   // pay-button background gradient (falls back to cta)
    ctaSoft: string;        // connecting-overlay spinner tile (~8% alpha)
    ctaShadow: string;
    onCta: string;
    priceAccent: string;    // total/price emphasis + secure badge

    // ── Logo ──
    logoSrc?: string;

    // ── Status tones + stepper + states ──
    tone: Record<TxnTone, string>;
    stepDone: string;
    stepPendingBorder: string;
    railDone: string;
    railPending: string;
    infoBannerBg: string;
    infoBannerBorder: string;
    infoBannerText: string;
    stateTitle: string;      // not-found/error title color
    stateIconMuted: string;  // not-found icon
    stateIconError: string;  // error icon (semantic red)
}

/** Inflatable Island — ORIGINAL light beach theme; values match the prior
 *  hardcoded styling so Inflatable's pages are visually unchanged. */
export const INFLATABLE_THEME: QrTransactionTheme = {
    key: 'inflatable',
    brandName: 'Inflatable Island',
    isDark: false,
    pageBackground: '#ffffff',
    topGlow:
        'radial-gradient(90% 60% at 50% -8%, #ffd6e6 0%, rgba(255,214,230,0) 60%),' +
        'radial-gradient(78% 55% at 90% 0%, #b9f0e2 0%, rgba(185,240,226,0) 58%),' +
        'linear-gradient(#ffffff00, #ffffff 82%)',
    headerBg: 'rgba(255,255,255,0.9)',
    stickyBarBg: 'rgba(255,255,255,0.95)',
    text: '#1e293b',
    textMuted: '#64748b',
    textFaint: '#94a3b8',
    surface: '#ffffff',
    surfaceBorder: 'rgba(0,0,0,0.05)',
    surfaceShadow: '0 2px 12px rgba(0,0,0,0.05)',
    modalShadow: '0 24px 60px -12px rgba(15,23,42,0.3)',
    subtleFill: '#f9fafb',
    primary: '#ec4899',
    primarySoft: 'rgba(236,72,153,0.10)',
    primaryPing: 'rgba(236,72,153,0.30)',
    primaryRing: 'rgba(236,72,153,0.20)',
    primaryGlow: 'rgba(236,72,153,0.45)',
    onPrimary: '#ffffff',
    cta: '#0d6e62',
    ctaGradient: undefined,
    ctaSoft: 'rgba(13,110,98,0.08)',
    ctaShadow: '0 16px 36px -8px rgba(13,110,98,0.55)',
    onCta: '#ffffff',
    priceAccent: '#0d6e62',
    logoSrc: undefined,
    tone: {
        amber: 'bg-amber-100 text-amber-700 border border-amber-200',
        blue: 'bg-blue-100 text-blue-700 border border-blue-200',
        emerald: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        red: 'bg-red-100 text-red-700 border border-red-200',
        slate: 'bg-slate-100 text-slate-600 border border-slate-200',
    },
    stepDone: '#10b981',
    stepPendingBorder: '#cbd5e1',
    railDone: '#34d399',
    railPending: '#e2e8f0',
    infoBannerBg: '#fffbeb',
    infoBannerBorder: '#fde68a',
    infoBannerText: '#92400e',
    stateTitle: '#334155',
    stateIconMuted: '#94a3b8',
    stateIconError: '#fb7185',
};

/** The Fun Roof — dark neon theme derived from the menu module's identity. */
export const FUN_ROOF_TXN_THEME: QrTransactionTheme = {
    key: 'funroof',
    brandName: 'The Fun Roof',
    isDark: true,
    pageBackground: FUN_ROOF_BACKGROUND,
    topGlow:
        'radial-gradient(95% 60% at 50% -8%, rgba(245,32,155,0.28) 0%, rgba(245,32,155,0) 60%),' +
        'radial-gradient(80% 55% at 90% 0%, rgba(55,211,230,0.16) 0%, rgba(55,211,230,0) 58%),' +
        'linear-gradient(rgba(11,7,19,0), rgba(11,7,19,0) 82%)',
    headerBg: 'rgba(11,7,19,0.9)',
    stickyBarBg: 'rgba(11,7,19,0.92)',
    text: FUN_ROOF_THEME.text,
    textMuted: FUN_ROOF_THEME.textMuted,
    textFaint: FUN_ROOF_THEME.textFaint,
    surface: FUN_ROOF_THEME.surfaceSolid,
    surfaceBorder: FUN_ROOF_THEME.border,
    surfaceShadow: '0 12px 34px -10px rgba(0,0,0,0.6)',
    modalShadow: '0 24px 60px -12px rgba(0,0,0,0.7)',
    subtleFill: 'rgba(255,255,255,0.05)',
    primary: FUN_ROOF_COLORS.magenta,
    primarySoft: FUN_ROOF_THEME.primarySoft,
    primaryPing: 'rgba(245,32,155,0.35)',
    primaryRing: 'rgba(245,32,155,0.25)',
    primaryGlow: 'rgba(245,32,155,0.5)',
    onPrimary: '#ffffff',
    cta: FUN_ROOF_COLORS.magenta,
    ctaGradient: FUN_ROOF_CTA_GRADIENT,
    ctaSoft: 'rgba(245,32,155,0.16)',
    ctaShadow: '0 16px 36px -8px rgba(245,32,155,0.5)',
    onCta: '#ffffff',
    priceAccent: FUN_ROOF_COLORS.lime,
    logoSrc: '/funroof-logo.webp',
    tone: {
        amber: 'bg-amber-500/15 text-amber-300 border border-amber-400/30',
        blue: 'bg-sky-500/15 text-sky-300 border border-sky-400/30',
        emerald: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30',
        red: 'bg-rose-500/15 text-rose-300 border border-rose-400/30',
        slate: 'bg-white/10 text-slate-300 border border-white/15',
    },
    stepDone: FUN_ROOF_COLORS.lime,
    stepPendingBorder: 'rgba(255,255,255,0.22)',
    railDone: FUN_ROOF_COLORS.lime,
    railPending: 'rgba(255,255,255,0.12)',
    infoBannerBg: 'rgba(245,32,155,0.12)',
    infoBannerBorder: 'rgba(245,32,155,0.35)',
    infoBannerText: '#FFC4E6',
    stateTitle: FUN_ROOF_THEME.text,
    stateIconMuted: '#94a3b8',
    stateIconError: '#fb7185',
};

/**
 * Resolve the transaction theme for a business unit. b1 → The Fun Roof; every
 * other (or unknown/empty) business → the neutral default (Inflatable Island).
 * A Fun Roof order therefore ALWAYS renders Fun Roof (never flips on refresh),
 * and an unknown business never silently adopts a specific other brand's identity
 * beyond the safe neutral default.
 */
export function resolveQrTransactionTheme(businessUnitId: string | undefined | null): QrTransactionTheme {
    return (businessUnitId ?? '').trim() === FUN_ROOF_BUSINESS_ID ? FUN_ROOF_TXN_THEME : INFLATABLE_THEME;
}
