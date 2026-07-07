import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, ShoppingBag, Utensils, CupSoda, Plus, Flame, ChevronRight, Sparkles, UtensilsCrossed, RefreshCw } from 'lucide-react';
import { MOCK_MENU_ITEMS, MENU_GROUPS, MOCK_TABLE } from '../data/mockMenu';
import type { PublicMenuItem, MenuGroup } from '../data/mockMenu';
import { isConfigValid } from '../../../config/firebase';
import { fetchPublicMenu, isCallableUnavailable, toUserFacingMenuError } from '../services/publicMenu.service';
import { submitQrOrder, toUserFacingOrderError, newIdempotencyKey } from '../services/createOrder.service';
import { isQrPaymentsEnabled } from '../services/createSession.service';
import { shouldUseMockMenu } from '../services/publicMenu.mapper';
import ProductDetailsSheet from './ProductDetailsSheet';
import CartDrawer from './CartDrawer';
import type { CartLine } from './CartDrawer';

/**
 * QR Ordering — Customer Menu (Inflatable Island Beach Club theme)
 *
 * Spec: docs/QR_SCREEN_SPEC.md §1 · Approved design clone.
 *
 * Data source: the real `getPublicMenu` callable (sanitized, server-authoritative),
 * with a mock fallback for the demo route (/order/demo), a missing token, or when
 * Firebase isn't configured locally. No Xendit, no createQrOrder, no payment.
 *
 * Two-level Food / Drinks navigation over a candy pink→mint gradient header,
 * a single-column card list, and a floating teal cart bar.
 */

const PINK = '#ec4899';
const TEAL = '#0d6e62';

const MOCK_LOAD_MS = 700;

/** Neutral image-zone placeholder used until a dish has a real photo. */
const ImagePlaceholder: React.FC = () => (
    <div className="w-full h-full flex items-center justify-center bg-[#f0fdf4]">
        <UtensilsCrossed size={24} className="text-[#a9d2cb]" strokeWidth={1.75} />
    </div>
);

const SkeletonRow: React.FC = () => (
    <div className="flex items-center gap-4 bg-white rounded-[20px] p-4 shadow-[0_10px_30px_-8px_rgba(15,23,42,0.12)] animate-pulse">
        <div className="w-24 h-24 rounded-2xl bg-black/[0.05] shrink-0" />
        <div className="flex-1 min-w-0">
            <div className="h-4 w-2/3 bg-black/[0.06] rounded-md" />
            <div className="h-3 w-4/5 bg-black/[0.04] rounded-md mt-2.5" />
            <div className="h-3 w-1/2 bg-black/[0.04] rounded-md mt-1.5" />
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="h-4 w-12 bg-black/[0.06] rounded-md" />
            <div className="h-[52px] w-[52px] bg-black/[0.05] rounded-2xl" />
        </div>
    </div>
);

const CustomerMenuView: React.FC = () => {
    const { tableId } = useParams<{ tableId: string }>();
    const navigate = useNavigate();

    // Demo/local mock vs. real callable is decided from the route + config.
    const usingMock = shouldUseMockMenu(tableId, isConfigValid);

    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [reloadKey, setReloadKey] = useState(0);
    const [menuItems, setMenuItems] = useState<PublicMenuItem[]>([]);
    // The visible TABLE label must NEVER show the raw qrToken (the route param).
    // It stays a neutral placeholder until getPublicMenu resolves the real
    // human-readable tableNumber (setTableNumber in the fetch below). Only the
    // mock/demo route seeds a concrete number up front.
    const [tableNumber, setTableNumber] = useState<string>(
        usingMock ? MOCK_TABLE.tableNumber : '',
    );
    // Resolved qr_tables document id from getPublicMenu — the key createQrOrder
    // needs (distinct from the route's opaque QR token). Empty until a real menu
    // loads, which is what gates real order submission vs. the mock fallback.
    const [resolvedTableId, setResolvedTableId] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string>('');
    const [activeGroup, setActiveGroup] = useState<MenuGroup>('Food');
    const [activeSub, setActiveSub] = useState<string>('Appetizers');

    // Cart. In demo/mock mode it's seeded to match the approved mock
    // (2 items · ₱570.00); against a real menu it starts empty.
    const [cart, setCart] = useState<CartLine[]>(() =>
        usingMock
            ? [
                { lineId: 'seed-1', id: 'ib-sisig', name: 'Sisig', unitPrice: 285, qty: 1, note: '' },
                { lineId: 'seed-2', id: 'ib-lechon', name: 'Lechon Kawali', unitPrice: 285, qty: 1, note: '' },
            ]
            : [],
    );
    const [detailItem, setDetailItem] = useState<PublicMenuItem | null>(null);
    const [cartOpen, setCartOpen] = useState(false);
    const lineSeq = useRef(2);
    // Idempotency key for the current submit. Held stable across retries so a
    // lost-response retry / double-tap returns the same order; regenerated after
    // a successful submit so the next distinct order gets a fresh key.
    const idempotencyKeyRef = useRef<string>('');

    const isLoading = status === 'loading';
    const cartCount = cart.reduce((n, line) => n + line.qty, 0);
    const cartTotal = cart.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);

    // Load the menu: mock (demo/local) or the real getPublicMenu callable.
    useEffect(() => {
        let cancelled = false;
        setStatus('loading');
        setErrorMsg('');

        if (usingMock) {
            const timer = window.setTimeout(() => {
                if (cancelled) return;
                setMenuItems(MOCK_MENU_ITEMS);
                setStatus('ready');
            }, MOCK_LOAD_MS);
            return () => { cancelled = true; window.clearTimeout(timer); };
        }

        fetchPublicMenu((tableId ?? '').trim())
            .then(result => {
                if (cancelled) return;
                setMenuItems(result.items);
                if (result.tableNumber) setTableNumber(result.tableNumber);
                if (result.tableId) setResolvedTableId(result.tableId);
                setStatus('ready');
            })
            .catch(err => {
                if (cancelled) return;
                // Local dev convenience: if the function isn't reachable (not
                // deployed / network), fall back to the mock rather than erroring.
                if (import.meta.env.DEV && isCallableUnavailable(err)) {
                    setMenuItems(MOCK_MENU_ITEMS);
                    setStatus('ready');
                    return;
                }
                setErrorMsg(toUserFacingMenuError(err));
                setStatus('error');
            });
        return () => { cancelled = true; };
    }, [tableId, usingMock, reloadKey]);

    const handleRetry = () => setReloadKey(k => k + 1);

    // FIXED, approved two-level navigation (product decision — never derived from
    // whatever categories happen to exist in Firestore). Every button below is
    // always present in its original place: Food = Appetizers / Mains / Sharing
    // Plates / Desserts; Drinks = Soft Drinks / Fresh Juice / Cocktails / Beer /
    // Coffee. Real items are normalized INTO these categories in the mapper.
    const subcategories = useMemo(
        () => MENU_GROUPS.find(g => g.key === activeGroup)?.subcategories ?? [],
        [activeGroup],
    );

    const visibleItems = useMemo(
        () => menuItems.filter(item => item.group === activeGroup && item.category === activeSub),
        [menuItems, activeGroup, activeSub],
    );

    const handleGroupChange = (group: MenuGroup) => {
        setActiveGroup(group);
        const firstSub = MENU_GROUPS.find(g => g.key === group)?.subcategories[0];
        if (firstSub) setActiveSub(firstSub);
    };

    const addLine = (item: PublicMenuItem, qty: number, note: string) => {
        if (!item.isAvailable) return;
        lineSeq.current += 1;
        setCart(prev => [...prev, {
            lineId: `L${lineSeq.current}`,
            id: item.id,
            name: item.name,
            unitPrice: item.sellingPrice,
            qty,
            note,
        }]);
    };

    // Product Details "Add to cart" (with qty + note).
    const handleAddToCart = (item: PublicMenuItem, qty: number, note: string) => {
        addLine(item, qty, note);
        setDetailItem(null);
    };
    // Card "+" quick add (qty 1, no note).
    const handleQuickAdd = (item: PublicMenuItem) => addLine(item, 1, '');

    // Cart drawer line operations (spec §3).
    const handleChangeQty = (lineId: string, nextQty: number) => {
        if (nextQty < 1) return;
        setCart(prev => prev.map(line => (line.lineId === lineId ? { ...line, qty: nextQty } : line)));
    };
    const handleRemoveLine = (lineId: string) => setCart(prev => prev.filter(line => line.lineId !== lineId));
    const handleClearCart = () => setCart([]);

    // Real order submission is possible only once a real menu has resolved a
    // table id; otherwise (demo route, missing token, unconfigured Firebase, or
    // the dev mock fallback) we keep the existing mock checkout flow.
    const canSubmitRealOrder = !usingMock && resolvedTableId !== '';

    // Open the cart, clearing any stale submit error from a previous attempt.
    const openCart = () => { setSubmitError(''); setCartOpen(true); };

    const handleCheckout = async () => {
        if (submitting) return;
        if (!canSubmitRealOrder) {
            // Demo / local fallback — unchanged mock checkout hop.
            setCartOpen(false);
            navigate('/checkout/demo');
            return;
        }
        if (cart.length === 0) return;

        // Reuse the key on a retry of the same submit; mint one on a fresh submit.
        if (!idempotencyKeyRef.current) idempotencyKeyRef.current = newIdempotencyKey();

        setSubmitting(true);
        setSubmitError('');
        try {
            const result = await submitQrOrder({ tableId: resolvedTableId, lines: cart, idempotencyKey: idempotencyKeyRef.current });
            // Snapshot the cart summary BEFORE clearing it, so checkout can render
            // the order without an extra round-trip.
            const summaryLines = cart.map(l => ({ name: l.name, qty: l.qty, unitPrice: l.unitPrice, note: l.note }));
            setSubmitting(false);
            idempotencyKeyRef.current = ''; // next distinct submit gets a fresh key
            setCart([]);                    // clear the cart ONLY after a successful create (kept intact on error for retry)
            setCartOpen(false);
            const handoff = {
                orderId: result.orderId,
                orderNumber: result.orderNumber,
                totalAmount: result.totalAmount,
                tableNumber,
                qrToken: tableId,
                lines: summaryLines,
            };
            // When online payments are enabled, route the created order through
            // the Xendit checkout; otherwise (dark launch / flag off) preserve the
            // existing hop straight to the order-status page. Either way the order
            // is created and unpaid — payment truth still comes from the webhook.
            if (isQrPaymentsEnabled()) {
                navigate(`/checkout/${result.orderId}`, { state: handoff });
            } else {
                navigate(`/order-status/${result.orderId}`, { state: handoff });
            }
        } catch (err) {
            setSubmitting(false);
            setSubmitError(toUserFacingOrderError(err));
        }
    };

    return (
        <div className="min-h-dvh bg-white text-slate-800 relative overflow-x-hidden">
            {/* Candy gradient behind the header */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-[460px] -z-0"
                style={{
                    background:
                        'radial-gradient(55% 40% at 50% 2%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 60%),' +
                        'radial-gradient(95% 62% at 50% -4%, #ffd6e6 0%, rgba(255,214,230,0) 60%),' +
                        'radial-gradient(78% 55% at 90% 4%, #b9f0e2 0%, rgba(185,240,226,0) 58%),' +
                        'radial-gradient(78% 55% at 10% 4%, #ffdcea 0%, rgba(255,220,234,0) 58%),' +
                        'linear-gradient(#ffffff00, #ffffff 80%)',
                }}
            />

            <div className="relative z-10 max-w-md mx-auto w-full px-5">
                {/* Header hero: logo + table + cart */}
                <header className="relative pt-8">
                    <Sparkles size={22} className="absolute left-1 top-12 text-[#0d6e62]/70" strokeWidth={2} aria-hidden />
                    <Sparkles size={20} className="absolute right-2 top-10 text-white drop-shadow" strokeWidth={2} aria-hidden />

                    <img
                        src="/inflatable-logo.avif"
                        alt="Inflatable Island Beach Club"
                        className="mx-auto w-[300px] max-w-[82%] h-auto select-none [filter:saturate(1.9)_contrast(1.32)_brightness(1.01)_drop-shadow(0_0_0.5px_rgba(0,0,0,0.28))_drop-shadow(0_2px_10px_rgba(236,72,153,0.22))]"
                        draggable={false}
                    />

                    <div className="relative mt-5 h-20">
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <p className="text-[13px] font-semibold tracking-[0.35em] text-[#0d6e62]">TABLE</p>
                            {/* Shows the real human table number once getPublicMenu resolves it; a
                                neutral "…" placeholder before then. The raw qrToken is NEVER rendered
                                here (not even for one frame). truncate stays only as a width backstop. */}
                            <p className="text-[46px] leading-none font-extrabold text-[#0d6e62] mt-1 max-w-[85vw] truncate px-2">{tableNumber || '…'}</p>
                        </div>
                        <button
                            type="button"
                            onClick={openCart}
                            aria-label={`Open cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white shadow-[0_10px_30px_rgba(17,24,39,0.12)] flex items-center justify-center active:scale-95 transition-transform"
                        >
                            <ShoppingCart size={26} className="text-[#0d6e62]" strokeWidth={2} />
                            {cartCount > 0 && (
                                <span
                                    key={cartCount}
                                    className="qr-pop absolute -top-1 -right-1 min-w-[24px] h-6 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center shadow"
                                    style={{ backgroundColor: PINK }}
                                >
                                    {cartCount}
                                </span>
                            )}
                        </button>
                    </div>
                </header>

                {/* Level 1 — Food / Drinks */}
                <div className="mt-6 grid grid-cols-2 gap-3.5">
                    {MENU_GROUPS.map(group => {
                        const isActive = activeGroup === group.key;
                        const Icon = group.key === 'Food' ? Utensils : CupSoda;
                        return (
                            <button
                                key={group.key}
                                type="button"
                                onClick={() => handleGroupChange(group.key)}
                                aria-pressed={isActive}
                                className={`flex items-center justify-center gap-2.5 py-3.5 rounded-full bg-white font-bold tracking-wide text-[15px] uppercase transition-all duration-200 active:scale-[0.98] ${isActive
                                    ? 'shadow-[0_8px_22px_rgba(239,78,140,0.18)]'
                                    : 'border border-slate-200 shadow-sm'
                                    }`}
                                style={isActive
                                    ? { color: PINK, boxShadow: `inset 0 0 0 2px ${PINK}` }
                                    : { color: TEAL }}
                            >
                                <Icon size={20} strokeWidth={2.25} />
                                {group.key}
                            </button>
                        );
                    })}
                </div>

                {/* Level 2 — subcategories */}
                <div className="mt-4 flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
                    {subcategories.map(sub => {
                        const isActive = activeSub === sub;
                        return (
                            <button
                                key={sub}
                                type="button"
                                onClick={(e) => {
                                    setActiveSub(sub);
                                    e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                                }}
                                aria-pressed={isActive}
                                className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95 ${isActive
                                    ? 'text-white shadow-[0_6px_16px_rgba(239,78,140,0.28)]'
                                    : 'bg-white text-slate-500 border border-slate-200'
                                    }`}
                                style={isActive ? { backgroundColor: PINK } : undefined}
                            >
                                {sub}
                            </button>
                        );
                    })}
                </div>

                {/* Section header */}
                <div className="mt-7 flex items-center gap-4">
                    <h2 className="text-[15px] font-extrabold tracking-[0.15em] uppercase" style={{ color: PINK }}>
                        {activeSub}
                    </h2>
                    <span className="h-px flex-1 rounded-full" style={{ backgroundColor: `${PINK}55` }} />
                </div>

                {/* Item list */}
                <div className="mt-4 space-y-4 pb-40">
                    {isLoading ? (
                        Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                    ) : status === 'error' ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
                                <UtensilsCrossed size={26} className="text-rose-400" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700 mb-1">Menu unavailable</h3>
                            <p className="text-slate-400 text-sm max-w-[18rem] mb-5">{errorMsg}</p>
                            <button
                                type="button"
                                onClick={handleRetry}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-bold shadow-[0_8px_20px_-4px_rgba(239,78,140,0.45)] active:scale-95 transition-transform"
                                style={{ backgroundColor: PINK }}
                            >
                                <RefreshCw size={16} strokeWidth={2.5} /> Try again
                            </button>
                        </div>
                    ) : menuItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
                                <UtensilsCrossed size={26} className="text-slate-400" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700 mb-1">Menu coming soon</h3>
                            <p className="text-slate-400 text-sm max-w-[16rem]">There aren’t any items on this menu yet. Please ask our staff for help.</p>
                        </div>
                    ) : visibleItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
                                <UtensilsCrossed size={26} className="text-slate-400" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700 mb-1">No items available in this category.</h3>
                            <p className="text-slate-400 text-sm max-w-[16rem]">Please try another category.</p>
                        </div>
                    ) : (
                        visibleItems.map(item => {
                            const soldOut = !item.isAvailable;
                            return (
                                <div
                                    key={item.id}
                                    className={`flex items-center gap-4 bg-white rounded-[20px] p-4 shadow-[0_10px_30px_-8px_rgba(15,23,42,0.12)] ${soldOut ? 'opacity-70' : ''}`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setDetailItem(item)}
                                        aria-haspopup="dialog"
                                        className="flex items-center gap-3.5 flex-1 min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] rounded-2xl"
                                    >
                                        <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-[#f0fdf4]">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt="" loading="lazy" decoding="async" width={96} height={96} className={`w-full h-full object-cover ${soldOut ? 'grayscale' : ''}`} />
                                            ) : (
                                                <ImagePlaceholder />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 py-0.5">
                                            <h3 className="font-bold text-[17px] leading-tight text-[#0d6e62] line-clamp-1">{item.name}</h3>
                                            {item.description && (
                                                <p className="text-sm text-slate-500 leading-snug mt-1 line-clamp-2">{item.description}</p>
                                            )}
                                            {item.bestSeller && !soldOut && (
                                                <p className="mt-2 flex items-center gap-1.5 text-[13px] font-bold" style={{ color: PINK }}>
                                                    <Flame size={15} className="fill-current" /> Best seller
                                                </p>
                                            )}
                                            {soldOut && (
                                                <p className="mt-2 text-[13px] font-bold text-slate-400">Sold out</p>
                                            )}
                                        </div>
                                    </button>

                                    <div className="flex flex-col items-end justify-between self-stretch py-1 pr-1 shrink-0">
                                        <div className="font-extrabold text-[17px]" style={{ color: TEAL }}>
                                            <span className="text-sm align-top mr-0.5">₱</span>{item.sellingPrice}
                                        </div>
                                        {!soldOut && (
                                            <button
                                                type="button"
                                                onClick={() => handleQuickAdd(item)}
                                                aria-label={`Add ${item.name} to cart`}
                                                className="w-[52px] h-[52px] rounded-2xl bg-white shadow-[0_8px_20px_-4px_rgba(15,23,42,0.18)] flex items-center justify-center active:scale-95 transition-transform duration-200"
                                            >
                                                <Plus size={22} strokeWidth={2.5} style={{ color: PINK }} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Floating cart bar */}
            {cartCount > 0 && (
                <div className="fixed bottom-0 inset-x-0 z-40 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="max-w-md mx-auto">
                        <button
                            type="button"
                            onClick={openCart}
                            className="w-full flex items-center gap-4 rounded-[24px] px-5 py-4 text-white shadow-[0_16px_36px_-8px_rgba(13,110,98,0.55)] active:scale-[0.96] transition-transform duration-200"
                            style={{ backgroundColor: TEAL }}
                        >
                            <div className="relative shrink-0">
                                <ShoppingBag size={26} strokeWidth={2} />
                                <span
                                    key={cartCount}
                                    className="qr-pop absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                                    style={{ backgroundColor: PINK }}
                                >
                                    {cartCount}
                                </span>
                            </div>
                            <div className="text-left leading-tight min-w-0">
                                <p className="font-bold text-[15px]">{cartCount} item{cartCount === 1 ? '' : 's'}</p>
                                <p className="text-white/70 text-sm">View cart</p>
                            </div>
                            <div className="ml-auto flex items-center gap-2 shrink-0">
                                <span className="text-xl font-extrabold tabular-nums">₱{cartTotal.toFixed(2)}</span>
                                <ChevronRight size={22} strokeWidth={2.5} className="text-white/90" />
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* Product Details — bottom sheet (mobile) / centered modal (tablet+) */}
            <ProductDetailsSheet
                item={detailItem}
                onClose={() => setDetailItem(null)}
                onAdd={handleAddToCart}
            />

            {/* Cart Drawer — bottom drawer (mobile) / right side panel (tablet+) */}
            <CartDrawer
                open={cartOpen}
                lines={cart}
                tableNumber={tableNumber}
                onClose={() => setCartOpen(false)}
                onChangeQty={handleChangeQty}
                onRemove={handleRemoveLine}
                onClear={handleClearCart}
                onCheckout={handleCheckout}
                submitting={submitting}
                submitError={submitError}
            />
        </div>
    );
};

export default CustomerMenuView;
