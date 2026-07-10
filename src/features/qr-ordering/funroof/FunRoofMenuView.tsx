import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Martini, UtensilsCrossed, Gamepad2, Plus, Sparkles, ChevronRight, Flame, AlertCircle, RefreshCw } from 'lucide-react';
import { FUN_ROOF_MENU_GROUPS, loadFunRoofMenu, type FunRoofItem, type FunRoofGroup } from './funRoofMenu';
import { FUN_ROOF_THEME as T, FUN_ROOF_COLORS, FUN_ROOF_BACKGROUND, FUN_ROOF_CTA_GRADIENT, FUN_ROOF_LOGO_GLOW } from './funRoofTheme';
import { peso } from './funRoofFormat';
import { formatTableLabel } from '../utils/tableUtils';
import { isConfigValid } from '../../../config/firebase';
import { resolveFunRoofTable, isWrongBusinessError } from './funRoofTable.service';
import { isCallableUnavailable, toUserFacingMenuError } from '../services/publicMenu.service';
import { submitQrOrder, toUserFacingOrderError, newIdempotencyKey } from '../services/createOrder.service';
import { isQrPaymentsEnabled } from '../services/createSession.service';
import { FUN_ROOF_BUSINESS_ID } from '../utils/customerMenuUrl';
import { withBusinessParam } from '../utils/adminBusinessParam';
import FunRoofProductSheet from './FunRoofProductSheet';
import FunRoofCartDrawer, { type FunRoofPick } from './FunRoofCartDrawer';
import { FUN_ROOF_ORDERING_PAUSED, FUN_ROOF_ORDERING_PAUSED_MESSAGE } from './funRoofOrderingStatus';

/**
 * The Fun Roof — QR customer menu + ordering (business unit b1).
 *
 * Same end-to-end transaction flow as the Inflatable Island module, re-skinned
 * into The Fun Roof dark-neon identity and served from the curated menu:
 *   scan /funroof/<qrToken> → resolve the real table (getPublicMenu) →
 *   browse the curated menu → cart → createQrOrder (server-priced) → checkout →
 *   Xendit (when payments are enabled) → order status.
 *
 * The displayed menu is the curated Fun Roof snapshot; its item ids ARE the b1
 * menu_items ids, so createQrOrder reprices every line server-side. `/funroof`
 * with no/`demo` token shows the menu in demo mode (no real order).
 */

const GROUP_ICON: Record<FunRoofGroup, React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>> = {
    Drinks: Martini,
    Food: UtensilsCrossed,
    Play: Gamepad2,
};

const ImageFallback: React.FC<{ group: FunRoofGroup }> = ({ group }) => {
    const Icon = GROUP_ICON[group];
    return (
        <div className="w-full h-full flex items-center justify-center" style={{ background: T.imageTile }}>
            <Icon size={22} strokeWidth={1.75} style={{ color: FUN_ROOF_COLORS.magenta }} />
        </div>
    );
};

type TableStatus = 'demo' | 'resolving' | 'ready' | 'error';

const FunRoofMenuView: React.FC = () => {
    // The route param is the opaque QR token (like Inflatable's /order/:tableId).
    const { tableId: qrToken } = useParams<{ tableId?: string }>();
    const navigate = useNavigate();

    // Real table vs demo is decided from the route + Firebase config.
    const usingRealTable = isConfigValid && !!qrToken && qrToken.trim() !== '' && qrToken.trim().toLowerCase() !== 'demo';

    const [tableStatus, setTableStatus] = useState<TableStatus>(usingRealTable ? 'resolving' : 'demo');
    const [tableError, setTableError] = useState<string>('');
    const [reloadKey, setReloadKey] = useState(0);
    // qr_tables doc id (createQrOrder's tableId) — empty until a real table resolves.
    const [resolvedTableId, setResolvedTableId] = useState<string>('');
    const [tableNumber, setTableNumber] = useState<string>(usingRealTable ? '' : '12');

    // The complete curated menu (snapshot ids === b1 menu_items ids → orderable).
    const [menuItems] = useState<FunRoofItem[]>(() => loadFunRoofMenu());

    const [activeGroup, setActiveGroup] = useState<FunRoofGroup>('Drinks');
    const [activeSub, setActiveSub] = useState<string>('Classics');
    const [picks, setPicks] = useState<FunRoofPick[]>([]);
    const [detailItem, setDetailItem] = useState<FunRoofItem | null>(null);
    const [picksOpen, setPicksOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string>('');
    const lineSeq = useRef(0);
    const idempotencyKeyRef = useRef<string>('');

    // Resolve the scanned token → real table (id + number). Menu shows regardless.
    useEffect(() => {
        if (!usingRealTable) { setTableStatus('demo'); return; }
        let cancelled = false;
        setTableStatus('resolving');
        setTableError('');
        resolveFunRoofTable((qrToken ?? '').trim())
            .then(table => {
                if (cancelled) return;
                setResolvedTableId(table.tableId);
                setTableNumber(table.tableNumber);
                setTableStatus('ready');
            })
            .catch(err => {
                if (cancelled) return;
                if (import.meta.env.DEV && isCallableUnavailable(err)) {
                    setTableNumber('12'); // local dev without deployed functions → demo table
                    setTableStatus('demo');
                    return;
                }
                setTableError(isWrongBusinessError(err)
                    ? 'This QR code isn’t for The Fun Roof. Please scan the code on your table.'
                    : toUserFacingMenuError(err));
                setTableStatus('error');
            });
        return () => { cancelled = true; };
    }, [usingRealTable, qrToken, reloadKey]);

    const pickCount = picks.reduce((n, l) => n + l.qty, 0);
    const pickTotal = picks.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const canSubmitRealOrder = tableStatus === 'ready' && resolvedTableId !== '';

    const subcategories = useMemo(() => FUN_ROOF_MENU_GROUPS.find(g => g.key === activeGroup)?.subcategories ?? [], [activeGroup]);
    const visibleItems = useMemo(() => menuItems.filter(i => i.group === activeGroup && i.category === activeSub), [menuItems, activeGroup, activeSub]);
    const countFor = (group: FunRoofGroup, sub: string) => menuItems.filter(i => i.group === group && i.category === sub).length;

    const handleGroupChange = (group: FunRoofGroup) => {
        setActiveGroup(group);
        const firstSub = FUN_ROOF_MENU_GROUPS.find(g => g.key === group)?.subcategories[0];
        if (firstSub) setActiveSub(firstSub);
    };

    const addPick = (item: FunRoofItem, qty: number) => {
        lineSeq.current += 1;
        const name = item.serving ? `${item.name} · ${item.serving}` : item.name;
        setPicks(prev => [...prev, { lineId: `L${lineSeq.current}`, id: item.id, name, unitPrice: item.sellingPrice, qty }]);
    };
    const handleQuickAdd = (item: FunRoofItem) => addPick(item, 1);
    const handleAddFromSheet = (item: FunRoofItem, qty: number) => { addPick(item, qty); setDetailItem(null); };
    const changeQty = (lineId: string, next: number) => { if (next < 1) return; setPicks(prev => prev.map(l => l.lineId === lineId ? { ...l, qty: next } : l)); };
    const removePick = (lineId: string) => setPicks(prev => prev.filter(l => l.lineId !== lineId));

    const openPicks = () => { setSubmitError(''); setPicksOpen(true); };

    const handleCheckout = async () => {
        if (submitting) return;
        // P0 CONTAINMENT: Fun Roof (b1) online ordering is paused — never create an
        // order or navigate. Defense-in-depth: the cart CTA is already blocked below,
        // this guard makes it impossible to reach createQrOrder even if a stale/cached
        // client somehow invokes checkout. See funRoofOrderingStatus.ts.
        if (FUN_ROOF_ORDERING_PAUSED) { setSubmitError(FUN_ROOF_ORDERING_PAUSED_MESSAGE); return; }
        if (!canSubmitRealOrder) {
            if (usingRealTable) return; // real table still resolving — wait, don't go to demo
            // Demo / local fallback — the shared demo checkout (no real order).
            setPicksOpen(false);
            navigate('/checkout/demo');
            return;
        }
        if (picks.length === 0) return;
        if (!idempotencyKeyRef.current) idempotencyKeyRef.current = newIdempotencyKey();
        setSubmitting(true);
        setSubmitError('');
        try {
            const lines = picks.map(p => ({ lineId: p.lineId, id: p.id, name: p.name, unitPrice: p.unitPrice, qty: p.qty, note: '' }));
            const result = await submitQrOrder({ tableId: resolvedTableId, lines, idempotencyKey: idempotencyKeyRef.current });
            const summaryLines = picks.map(p => ({ name: p.name, qty: p.qty, unitPrice: p.unitPrice }));
            setSubmitting(false);
            idempotencyKeyRef.current = '';
            setPicks([]);
            setPicksOpen(false);
            // Carry the venue id (b1) so the shared checkout/order-status pages paint
            // the Fun Roof brand instantly; the order's businessUnitId stays authoritative.
            const handoff = { orderId: result.orderId, orderNumber: result.orderNumber, totalAmount: result.totalAmount, tableNumber, qrToken, businessUnitId: FUN_ROOF_BUSINESS_ID, lines: summaryLines };
            if (isQrPaymentsEnabled(FUN_ROOF_BUSINESS_ID)) navigate(withBusinessParam(`/checkout/${result.orderId}`, FUN_ROOF_BUSINESS_ID), { state: handoff });
            else navigate(withBusinessParam(`/order-status/${result.orderId}`, FUN_ROOF_BUSINESS_ID), { state: handoff });
        } catch (err) {
            setSubmitting(false);
            setSubmitError(toUserFacingOrderError(err));
        }
    };

    // Hard table error (wrong business / not found / inactive) → block, don't show a
    // misleading menu with someone else's / no table.
    if (tableStatus === 'error') {
        return (
            <div className="min-h-dvh flex flex-col items-center justify-center px-8 text-center" style={{ background: FUN_ROOF_BACKGROUND, color: T.text }}>
                <AlertCircle size={34} style={{ color: FUN_ROOF_COLORS.magenta }} />
                <h1 className="mt-4 text-lg font-extrabold" style={{ color: T.text }}>We couldn’t open this table</h1>
                <p className="mt-1.5 text-sm max-w-[18rem]" style={{ color: T.textMuted }}>{tableError}</p>
                <button type="button" onClick={() => setReloadKey(k => k + 1)} className="mt-6 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-white font-bold" style={{ background: FUN_ROOF_CTA_GRADIENT }}>
                    <RefreshCw size={18} /> Try again
                </button>
            </div>
        );
    }

    const tableLabel = tableStatus === 'resolving' ? '…' : formatTableLabel(tableNumber);

    return (
        <div className="min-h-dvh relative overflow-x-hidden" style={{ background: FUN_ROOF_BACKGROUND, color: T.text }}>
            <div className="relative z-10 max-w-md mx-auto w-full px-5">
                <header className="relative pt-9">
                    <div className="relative mx-auto w-full flex flex-col items-center">
                        <div className="relative">
                            <div aria-hidden className="pointer-events-none absolute -inset-10" style={{ background: FUN_ROOF_LOGO_GLOW }} />
                            <img
                                src="/funroof-logo.webp"
                                alt="The Fun Roof"
                                width={760}
                                height={527}
                                className="relative mx-auto h-auto select-none"
                                style={{ width: 'min(200px, 60vw)', filter: 'drop-shadow(0 8px 28px rgba(245,32,155,0.40))' }}
                                draggable={false}
                            />
                        </div>
                    </div>

                    <div className="relative mt-4 h-16">
                        <div className="absolute inset-0 flex items-center justify-center text-center">
                            <div
                                className="text-[42px] leading-none font-extrabold tracking-tight max-w-[70vw] truncate px-2"
                                style={{ backgroundImage: 'linear-gradient(92deg, #37D3E6 0%, #7FE0A8 52%, #A7E739 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}
                            >
                                {tableLabel}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={openPicks}
                            aria-label={`Open my picks, ${pickCount} item${pickCount === 1 ? '' : 's'}`}
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                            style={{ background: T.surfaceRaised, border: `1px solid ${T.borderStrong}`, boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}
                        >
                            <Sparkles size={22} style={{ color: FUN_ROOF_COLORS.magenta }} />
                            {pickCount > 0 && (
                                <span key={pickCount} className="qr-pop absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center text-white" style={{ background: FUN_ROOF_COLORS.magenta }}>{pickCount}</span>
                            )}
                        </button>
                    </div>
                </header>

                {/* Level 1 — Drinks / Food / Play */}
                <div className="mt-5 grid grid-cols-3 gap-2.5">
                    {FUN_ROOF_MENU_GROUPS.map(group => {
                        const isActive = activeGroup === group.key;
                        const Icon = GROUP_ICON[group.key];
                        return (
                            <button
                                key={group.key}
                                type="button"
                                onClick={() => handleGroupChange(group.key)}
                                aria-pressed={isActive}
                                className="flex items-center justify-center gap-1.5 py-3 rounded-full font-extrabold tracking-wide text-[13px] uppercase transition-all duration-200 active:scale-[0.98]"
                                style={isActive ? { background: FUN_ROOF_CTA_GRADIENT, color: '#fff', boxShadow: '0 10px 26px -8px rgba(245,32,155,0.6)' } : { background: T.surface, color: T.textMuted, border: `1px solid ${T.border}` }}
                            >
                                <Icon size={17} strokeWidth={2.25} />
                                {group.key}
                            </button>
                        );
                    })}
                </div>

                {/* Level 2 — subcategories */}
                <div className="mt-4 flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
                    {subcategories.map(sub => {
                        const isActive = activeSub === sub;
                        const n = countFor(activeGroup, sub);
                        return (
                            <button
                                key={sub}
                                type="button"
                                onClick={(e) => { setActiveSub(sub); e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }}
                                aria-pressed={isActive}
                                className="whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95 flex items-center gap-1.5"
                                style={isActive ? { background: FUN_ROOF_COLORS.magenta, color: '#fff', boxShadow: '0 6px 16px rgba(245,32,155,0.4)' } : { background: T.surface, color: n === 0 ? T.textFaint : T.textMuted, border: `1px solid ${T.border}` }}
                            >
                                {sub}
                                <span className="tabular-nums text-[11px] opacity-70">{n}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-7 flex items-center gap-4">
                    <h2 className="text-[15px] font-extrabold tracking-[0.15em] uppercase" style={{ color: FUN_ROOF_COLORS.cyan }}>{activeSub}</h2>
                    <span className="h-px flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${FUN_ROOF_COLORS.magenta}66, transparent)` }} />
                </div>

                <div className="mt-4 space-y-4 pb-40">
                    {visibleItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}` }}>
                                <UtensilsCrossed size={26} style={{ color: T.textFaint }} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold mb-1" style={{ color: T.text }}>Nothing here yet</h3>
                            <p className="text-sm max-w-[16rem]" style={{ color: T.textMuted }}>Try another category — there’s plenty on the roof.</p>
                        </div>
                    ) : (
                        visibleItems.map(item => (
                            <div key={item.id} className="flex items-center gap-4 rounded-[20px] p-4" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: '0 10px 30px -12px rgba(0,0,0,0.6)' }}>
                                <button type="button" onClick={() => setDetailItem(item)} aria-haspopup="dialog" className="flex items-center gap-3.5 flex-1 min-w-0 text-left rounded-2xl outline-none focus-visible:ring-2" style={{ '--tw-ring-color': FUN_ROOF_COLORS.magenta } as React.CSSProperties}>
                                    <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0" style={{ border: `1px solid ${T.border}` }}>
                                        {item.imageUrl ? (<img src={item.imageUrl} alt="" loading="lazy" decoding="async" width={80} height={80} className="w-full h-full object-cover" />) : (<ImageFallback group={item.group} />)}
                                    </div>
                                    <div className="flex-1 min-w-0 py-0.5">
                                        <h3 className="font-bold text-[16px] leading-tight line-clamp-2" style={{ color: T.text }}>{item.name}</h3>
                                        {item.description && (<p className="text-[13px] leading-snug mt-1 line-clamp-2" style={{ color: T.textMuted }}>{item.description}</p>)}
                                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                            {item.bestSeller && (<span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: FUN_ROOF_COLORS.ink, background: FUN_ROOF_COLORS.lime }}><Flame size={11} className="fill-current" /> Bestseller</span>)}
                                            {!item.bestSeller && item.tag && item.tag.length <= 16 && (<span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: FUN_ROOF_COLORS.cyan, background: 'rgba(55,211,230,0.12)', border: `1px solid rgba(55,211,230,0.3)` }}>{item.tag}</span>)}
                                            {item.serving && (<span className="text-[12px] font-medium" style={{ color: T.textFaint }}>{item.serving}</span>)}
                                        </div>
                                    </div>
                                </button>
                                <div className="flex flex-col items-end justify-between self-stretch py-1 shrink-0">
                                    <div className="font-extrabold text-[16px] tabular-nums" style={{ color: FUN_ROOF_COLORS.lime }}>{peso(item.sellingPrice)}</div>
                                    <button type="button" onClick={() => handleQuickAdd(item)} aria-label={`Add ${item.name} to my picks`} className="w-[46px] h-[46px] rounded-2xl flex items-center justify-center active:scale-95 transition-transform duration-200" style={{ background: T.primarySoft, border: `1px solid ${T.borderStrong}` }}>
                                        <Plus size={20} strokeWidth={2.75} style={{ color: FUN_ROOF_COLORS.magenta }} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {pickCount > 0 && (
                <div className="fixed bottom-0 inset-x-0 z-40 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="max-w-md mx-auto">
                        <button type="button" onClick={openPicks} className="w-full flex items-center gap-4 rounded-[24px] px-5 py-4 text-white active:scale-[0.97] transition-transform duration-200" style={{ background: FUN_ROOF_CTA_GRADIENT, boxShadow: '0 16px 40px -10px rgba(245,32,155,0.6)' }}>
                            <div className="relative shrink-0">
                                <Sparkles size={24} strokeWidth={2} />
                                <span key={pickCount} className="qr-pop absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center" style={{ background: '#fff', color: FUN_ROOF_COLORS.magenta }}>{pickCount}</span>
                            </div>
                            <div className="text-left leading-tight min-w-0">
                                <p className="font-bold text-[15px]">{pickCount} pick{pickCount === 1 ? '' : 's'}</p>
                                <p className="text-white/75 text-sm">View my picks</p>
                            </div>
                            <div className="ml-auto flex items-center gap-2 shrink-0">
                                <span className="text-xl font-extrabold tabular-nums">{peso(pickTotal)}</span>
                                <ChevronRight size={22} strokeWidth={2.5} className="text-white/90" />
                            </div>
                        </button>
                    </div>
                </div>
            )}

            <FunRoofProductSheet item={detailItem} onClose={() => setDetailItem(null)} onAdd={handleAddFromSheet} />
            <FunRoofCartDrawer
                open={picksOpen}
                lines={picks}
                tableNumber={tableNumber}
                onClose={() => setPicksOpen(false)}
                onChangeQty={changeQty}
                onRemove={removePick}
                onClear={() => setPicks([])}
                onCheckout={handleCheckout}
                submitting={submitting}
                submitError={submitError}
                orderingPaused={FUN_ROOF_ORDERING_PAUSED}
                pausedMessage={FUN_ROOF_ORDERING_PAUSED_MESSAGE}
            />
        </div>
    );
};

export default FunRoofMenuView;
