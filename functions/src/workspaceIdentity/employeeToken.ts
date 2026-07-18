/**
 * Employee Firebase ID-token verification (login path).
 *
 * On login the Workspace forwards the employee's Firebase ID token; the broker —
 * not the Workspace — verifies it, so the Workspace needs no ERP Firebase
 * credential. The gate asserts issuer, audience (the ERP Firebase project), and
 * expiry. A token minted for a different Firebase project fails.
 *
 * Signature verification is injected so the tests are hermetic; production wires
 * firebase-admin's `auth.verifyIdToken` (Google JWKS + revocation). This pure
 * gate re-asserts every claim as defense-in-depth.
 */

export interface FirebaseClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  sub?: string;
  uid?: string;
  email?: string;
}

/**
 * Decode ONLY the safe, non-secret claims (iss, aud, sub) from a JWT WITHOUT
 * verifying it — for diagnostics only. Never returns the token, signature, or
 * any other claim (no email, no custom claims). Returns {} for anything that is
 * not a well-formed JWT. Used to make a project mismatch visible in logs.
 */
export function decodeSafeClaims(
  token: string,
): { iss?: string; aud?: string; sub?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    const json = Buffer.from(
      parts[1]!.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8');
    const p = JSON.parse(json) as {
      iss?: string;
      aud?: unknown;
      sub?: string;
      user_id?: string;
    };
    const aud =
      typeof p.aud === 'string'
        ? p.aud
        : Array.isArray(p.aud)
          ? String(p.aud[0])
          : undefined;
    return { iss: p.iss, aud, sub: p.sub ?? p.user_id };
  } catch {
    return {};
  }
}

export interface EmployeeTokenVerifierConfig {
  erpProjectId: string;
  verifyFirebaseSignature: (token: string) => Promise<FirebaseClaims>;
}

export class EmployeeTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmployeeTokenError';
  }
}

export async function verifyEmployeeToken(
  token: string,
  config: EmployeeTokenVerifierConfig,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<{ erpUserId: string; email: string | null }> {
  if (!token || typeof token !== 'string') {
    throw new EmployeeTokenError('Missing employee token.');
  }

  let claims: FirebaseClaims;
  try {
    claims = await config.verifyFirebaseSignature(token);
  } catch (err) {
    throw new EmployeeTokenError(
      `Employee token signature verification failed: ${(err as Error).message}`,
    );
  }

  const expectedIssuer = `https://securetoken.google.com/${config.erpProjectId}`;
  if (claims.iss !== expectedIssuer) {
    throw new EmployeeTokenError('Employee token has wrong issuer (project).');
  }
  if (claims.aud !== config.erpProjectId) {
    throw new EmployeeTokenError('Employee token has wrong audience (project).');
  }
  if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds) {
    throw new EmployeeTokenError('Employee token expired.');
  }
  const uid = claims.uid ?? claims.sub;
  if (!uid || typeof uid !== 'string') {
    throw new EmployeeTokenError('Employee token has no uid.');
  }
  return { erpUserId: uid, email: claims.email ?? null };
}
