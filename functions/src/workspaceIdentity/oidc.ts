/**
 * Service-to-service caller authentication — Google OIDC identity tokens.
 *
 * The ONLY thing allowed to call the broker is the Workspace server, proving its
 * identity with a short-lived Google-signed OIDC token whose audience is this
 * broker. No static API key as the sole control, no long-lived shared secret,
 * no browser access, no permissive CORS. Every gate is hard:
 *   - issuer MUST be https://accounts.google.com
 *   - audience MUST equal the configured broker audience
 *   - caller service-account email MUST be on the approved-caller allowlist
 *     and email_verified true
 *   - exp MUST be in the future
 *
 * Signature verification is injected (`verifyJwtSignature`) so the tests are
 * hermetic; production wires google-auth-library's OAuth2Client.verifyIdToken
 * (which checks Google's signature + audience). This pure gate re-asserts every
 * claim regardless — defense-in-depth and independently unit-testable.
 */

export const GOOGLE_OIDC_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'] as const;

export interface OidcClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  sub?: string;
}

export interface OidcVerifierConfig {
  audience: string;
  approvedCallers: string[];
  verifyJwtSignature: (token: string) => Promise<OidcClaims>;
}

export class OidcAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OidcAuthError';
  }
}

/** Verify a caller OIDC token end to end; returns the caller email or throws. */
export async function verifyCallerIdentity(
  token: string,
  config: OidcVerifierConfig,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<{ callerEmail: string }> {
  if (!token || typeof token !== 'string') {
    throw new OidcAuthError('Missing caller identity token.');
  }

  let claims: OidcClaims;
  try {
    claims = await config.verifyJwtSignature(token);
  } catch (err) {
    throw new OidcAuthError(`Caller token signature verification failed: ${(err as Error).message}`);
  }

  if (!claims.iss || !(GOOGLE_OIDC_ISSUERS as readonly string[]).includes(claims.iss)) {
    throw new OidcAuthError('Caller token has wrong issuer.');
  }
  if (claims.aud !== config.audience) {
    throw new OidcAuthError('Caller token has wrong audience.');
  }
  if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds) {
    throw new OidcAuthError('Caller token expired.');
  }
  if (claims.email_verified !== true) {
    throw new OidcAuthError('Caller token email not verified.');
  }
  const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : '';
  const approved = config.approvedCallers.map((e) => e.toLowerCase());
  if (!email || !approved.includes(email)) {
    throw new OidcAuthError('Caller is not on the approved-caller allowlist.');
  }
  return { callerEmail: email };
}
