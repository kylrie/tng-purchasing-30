/**
 * Xendit HTTP client wrapper (Phase 3 · createXenditSession seam).
 *
 * The single place TNG talks to Xendit over HTTP. It is INJECTED into
 * `createXenditSessionHandler` so the handler is unit-testable with a stub and
 * never makes a live call (QR_XENDIT_IMPLEMENTATION_PLAN §1, §7). `fetchImpl`
 * and `now` are injectable so this wrapper itself is testable with a stubbed
 * fetch — no real network, no live Xendit.
 *
 * Uses the Payments API v3 Payment Sessions endpoint
 * (`POST /v3/sessions`, session_type PAY, mode PAYMENT_LINK,
 * capture_method AUTOMATIC) — one integration for GCash/Maya/QRPH/card (PH).
 * Card data / 3DS never touch TNG servers; we only receive a hosted-checkout URL.
 *
 * SECURITY: the secret key is used ONLY to build the Basic-auth header and is
 * NEVER logged (§4). Errors log status + a truncated body, never the header.
 */

const SESSIONS_PATH = '/v3/sessions';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_SESSION_TTL_MS = 30 * 60_000; // Xendit's 30-min default (§1)
const MAX_LOGGED_BODY = 500;

/** What the handler asks the client to create (server-authoritative values). */
export interface XenditCreateSessionParams {
    referenceId: string;
    amount: number;
    currency: string;
    items: { name: string; quantity: number; price: number }[];
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
}

/** The normalized result the handler persists. */
export interface XenditSession {
    paymentSessionId: string;
    paymentRequestId: string;
    paymentLinkUrl: string;
    expiresAtMillis: number;
}

/** The seam the handler depends on. Both the real HTTP client and the local
 *  mock (see createMockXenditClient) implement this. */
export interface XenditClient {
    createSession(params: XenditCreateSessionParams): Promise<XenditSession>;
}

/**
 * Typed transport error. `retriable` distinguishes a transient failure (network
 * / timeout / 5xx — the caller should surface `unavailable`) from a definite
 * API rejection (4xx / bad response — the caller should surface `internal`).
 */
export class XenditClientError extends Error {
    constructor(
        message: string,
        public readonly retriable: boolean,
        public readonly status?: number,
    ) {
        super(message);
        this.name = 'XenditClientError';
    }
}

type FetchLike = (url: string, init: RequestInit) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
    text(): Promise<string>;
}>;

export interface XenditHttpClientConfig {
    secretKey: string;
    apiBase: string;
    timeoutMs?: number;
    /** Injectable for tests; defaults to the platform global fetch. */
    fetchImpl?: FetchLike;
    /** Injectable clock for the expiry fallback; defaults to Date.now. */
    now?: () => number;
}

function toMillis(expiresAt: unknown, fallback: number): number {
    if (typeof expiresAt === 'string') {
        const ms = Date.parse(expiresAt);
        if (!Number.isNaN(ms)) return ms;
    }
    return fallback;
}

/**
 * Build the real HTTP-backed Xendit client. Never called by unit tests of the
 * handler (they inject a stub); exercised directly only by xenditClient.test.ts
 * with a stubbed `fetchImpl`.
 */
export function createXenditHttpClient(config: XenditHttpClientConfig): XenditClient {
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const fetchImpl: FetchLike = config.fetchImpl ?? ((url, init) => fetch(url, init) as unknown as ReturnType<FetchLike>);
    const now = config.now ?? Date.now;
    // base64(secretKey + ':') per Xendit Basic auth. Built once; never logged.
    const authHeader = 'Basic ' + Buffer.from(config.secretKey + ':').toString('base64');

    async function createSession(params: XenditCreateSessionParams): Promise<XenditSession> {
        const url = config.apiBase.replace(/\/+$/, '') + SESSIONS_PATH;
        const requestBody = {
            reference_id: params.referenceId,
            session_type: 'PAY',
            mode: 'PAYMENT_LINK',
            capture_method: 'AUTOMATIC',
            amount: params.amount,
            currency: params.currency,
            items: params.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
            success_return_url: params.successUrl,
            cancel_return_url: params.cancelUrl,
            metadata: params.metadata,
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let res: Awaited<ReturnType<FetchLike>>;
        try {
            res = await fetchImpl(url, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                    'Idempotency-key': params.idempotencyKey,
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });
        } catch (e) {
            // Network failure / abort (timeout) → transient. Log WITHOUT the header/secret.
            console.error('xendit.createSession.transport', { referenceId: params.referenceId, error: (e as Error).message });
            throw new XenditClientError(`Xendit request failed: ${(e as Error).message}`, true);
        } finally {
            clearTimeout(timer);
        }

        if (!res.ok) {
            const retriable = res.status >= 500;
            let bodyText = '';
            try { bodyText = (await res.text()).slice(0, MAX_LOGGED_BODY); } catch { /* ignore */ }
            // Log status + truncated body only — never the auth header / secret.
            console.error('xendit.createSession.http', { referenceId: params.referenceId, status: res.status, body: bodyText });
            throw new XenditClientError(`Xendit returned HTTP ${res.status}`, retriable, res.status);
        }

        let data: Record<string, unknown>;
        try {
            data = (await res.json()) as Record<string, unknown>;
        } catch (e) {
            console.error('xendit.createSession.parse', { referenceId: params.referenceId, error: (e as Error).message });
            throw new XenditClientError('Xendit returned an unparseable response', false, res.status);
        }

        const paymentSessionId = (data.payment_session_id ?? data.id) as string | undefined;
        const paymentLinkUrl = data.payment_link_url as string | undefined;
        if (!paymentSessionId || !paymentLinkUrl) {
            console.error('xendit.createSession.shape', { referenceId: params.referenceId, status: res.status });
            throw new XenditClientError('Xendit response missing session id / link', false, res.status);
        }

        return {
            paymentSessionId,
            paymentRequestId: (data.payment_request_id as string | undefined) ?? '',
            paymentLinkUrl,
            expiresAtMillis: toMillis(data.expires_at, now() + DEFAULT_SESSION_TTL_MS),
        };
    }

    return { createSession };
}

/**
 * Local/dev mock — returns a fake `/checkout/demo`-style link and never touches
 * the network (QR_XENDIT_IMPLEMENTATION_PLAN §3 "Local/dev ⇒ mock"). Used when
 * no real secret is configured so the emulator / design-preview never call
 * Xendit. Deterministic clock injected for reproducibility.
 */
export function createMockXenditClient(now: () => number = Date.now): XenditClient {
    return {
        async createSession(params: XenditCreateSessionParams): Promise<XenditSession> {
            const ref = encodeURIComponent(params.referenceId);
            return {
                paymentSessionId: `ps-mock-${ref}`,
                paymentRequestId: `pr-mock-${ref}`,
                paymentLinkUrl: `/checkout/demo?ref=${ref}`,
                expiresAtMillis: now() + DEFAULT_SESSION_TTL_MS,
            };
        },
    };
}
