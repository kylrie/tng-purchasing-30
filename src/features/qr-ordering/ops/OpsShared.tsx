// QR Operations — shared presentational primitives (chips, timers, alert badge).
// Kept tiny + dependency-light so every ops tab renders the SAME status language.

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
    CHIP_CLS, BAR_CLS, orderStatusPresentation, paymentStatusPresentation,
    type OpsColor, type AttentionLevel,
} from './qrOpsStatus';

/** Elapsed whole-minutes between a past epoch-ms and `now`. */
export function minutesSince(pastMillis: number, now: number): number {
    if (!pastMillis) return 0;
    return Math.max(0, Math.floor((now - pastMillis) / 60000));
}

/** "12 min" / "1 h 04 m" — dense, glanceable elapsed label. */
export function elapsedLabel(pastMillis: number, now: number): string {
    const m = minutesSince(pastMillis, now);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return `${h}h ${String(rem).padStart(2, '0')}m`;
}

/** "MM:SS" waiting timer for kitchen cards (updates as `now` ticks). */
export function clockLabel(pastMillis: number, now: number): string {
    if (!pastMillis) return '00:00';
    const totalSec = Math.max(0, Math.floor((now - pastMillis) / 1000));
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export const StatusChip: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
    const p = orderStatusPresentation(status);
    const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
    return <span className={`inline-flex items-center font-black uppercase tracking-wide rounded ${pad} ${CHIP_CLS[p.color]}`}>{p.label}</span>;
};

export const PaymentChip: React.FC<{ paymentStatus: string; size?: 'sm' | 'md' }> = ({ paymentStatus, size = 'md' }) => {
    const p = paymentStatusPresentation(paymentStatus);
    const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
    return <span className={`inline-flex items-center font-black uppercase tracking-wide rounded ${pad} ${CHIP_CLS[p.color]}`}>{p.label}</span>;
};

/** Left accent bar keyed to an operational color (dense rows read faster with it). */
export const AccentBar: React.FC<{ color: OpsColor }> = ({ color }) => (
    <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${BAR_CLS[color]}`} aria-hidden />
);

export const AttentionBadge: React.FC<{ level: AttentionLevel; reason: string }> = ({ level, reason }) => {
    if (level === 'none') return null;
    const cls = level === 'critical'
        ? 'bg-red-600 text-white'
        : 'bg-amber-500 text-white';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wide ${cls}`}>
            <AlertTriangle size={12} strokeWidth={2.75} /> {reason}
        </span>
    );
};
