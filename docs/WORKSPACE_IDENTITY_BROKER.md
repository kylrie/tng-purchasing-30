# Workspace Identity Broker — Security & Deployment Runbook

The **narrow** ERP → TNG Workspace identity API. It lets the Workspace app read
the *minimum* identity + authorization needed to place an employee into the
right workspaces/channels, **without** granting the Workspace any direct
Firestore access to the ERP.

- Source: `functions/src/workspaceIdentity/`
- Function export: `workspaceIdentity` (v2 `onRequest`) in `functions/src/index.ts`
- Consumer: the `tng-workspace` app's `BrokerErpProvider` (server-side only)
- Status: **not deployed.** Prepared on branch `feat/workspace-identity-broker`
  for owner review. Do not deploy to ERP Main without explicit approval.

## Why it exists

The earlier Workspace design would have used a Firebase service account with
`roles/datastore.viewer` — **project-wide** Firestore read, far beyond the
identity use case. This broker removes that: the Workspace holds only an
invoke-only caller identity; the broker (running inside `tng-systems`) holds the
narrow reader and returns only the minimized contract.

```
Workspace ──(Google OIDC, invoke-only)──▶ workspaceIdentity ──▶ users/{uid} + config/permissions ONLY
```

## Response contract (the only data that crosses the boundary)

```
erp_user_id, email, display_name, status, role,
business_ids[], business_unit_ids[], workspace_permission_ids[],
profile_updated_at, permission_version, recommended_cache_ttl_seconds
```

- `workspace_permission_ids` is a **projected, allowlisted** vocabulary
  (`workspace.access|admin`, `channel.management|finance|hr|audit|founders`) —
  never a raw ERP permission string. Projection: `projection.ts`.
- Non-`ACTIVE` employees return empty `workspace_permission_ids` (status still
  reported so the Workspace can revoke).
- Assembled by `contract.ts::buildResponse` (whitelisted keys only) and checked
  by `assertStrict`. No `posPin`/`posPinHash`/`pcfCeiling`/bank/salary/customer/
  order/inventory field can appear — there is no field for it.

## Request shapes (both require a valid caller OIDC token)

```
POST /  { "firebaseIdToken": "<employee Firebase ID token>" }   // login: broker verifies it
POST /  { "erpUserId": "<Firebase uid>" }                        // revalidation: trusted caller
```

## Service-to-service authentication (OIDC)

`oidc.ts` verifies the caller token on every request:
issuer `accounts.google.com` · audience = broker URL · caller SA email on the
allowlist + `email_verified` · exp valid. Signature is checked by
`google-auth-library` (`OAuth2Client.verifyIdToken`). **No** static API key as
the sole control, **no** long-lived shared secret, **no** browser access, **no**
CORS headers. All failures collapse to one opaque `UNAUTHENTICATED`.

## Firestore access boundary — and an honest IAM limitation

The broker reads **exactly two documents** via a datastore port (`datastore.ts`)
with no query/list API and no caller-supplied path:

- `users/{uid}` (identity + role/status/business + per-user permission overrides)
- `config/permissions` (role→permissions matrix; key `roles_permissions` or `permissions`)

> **IAM limitation (verified, not assumed):** Google Cloud / Firestore IAM
> **cannot** restrict a principal's reads to specific document paths or
> collections. `roles/datastore.user` / `datastore.viewer` grant database-wide
> read. There is no path-scoped read role. So the broker's runtime SA
> technically *can* read more than these two docs at the IAM layer.

Compensating controls (because path-level IAM does not exist):

- The broker code is the **only** component that holds the reader identity;
  Workspace has **invoke-only** access and cannot read Firestore at all.
- The port exposes **no** generic document-read endpoint and **rejects**
  arbitrary collection/document parameters — a caller can ask for a uid, nothing
  else.
- Strict contract projection — even a wider read could not widen the response.
- Dedicated broker service account (below), **not** shared with other functions.
- Cloud Audit Logs (Data Access) on the broker SA; monitored invocation volume.
- Code-owner review required for any change under `functions/src/workspaceIdentity/`.
- Optionally, a **separate Firestore database** or a replicated identity
  projection could give true isolation later; documented as a future hardening,
  not claimed today.

## Employee token verification

`employeeToken.ts` + firebase-admin `auth.verifyIdToken(token, true)` (JWKS +
revocation). Issuer `securetoken.google.com/tng-systems`, audience `tng-systems`,
exp. A token from another Firebase project fails → `INVALID_EMPLOYEE_TOKEN`.

## Logging / redaction

`workspaceIdentity.ts` binds the firebase-functions structured logger. The
handler logs ONLY safe fields — caller SA email (for audit), status, role, and
counts. It **never** logs the employee token, email, name, the raw document, or
any sensitive field (proved by `__tests__/workspaceIdentity.test.ts` #16).

## Production deployment plan (owner-gated — DO NOT run yet)

| Item | Value |
|---|---|
| Hosting | Firebase Cloud Functions v2 (`onRequest`, Cloud Run under the hood) |
| Function name | `workspaceIdentity` |
| Region | match the ERP functions' region (default `us-central1`; pin if the project standardizes elsewhere) |
| Production URL shape | `https://<region>-tng-systems.cloudfunctions.net/workspaceIdentity` (or the Cloud Run URL) |
| Firebase project | `tng-systems` |
| Named Firestore DB | `tng-systems` (matches `qrDb`/transactions/admin) |
| Runtime service account | a **dedicated** SA `workspace-identity-broker@tng-systems.iam.gserviceaccount.com` with `roles/datastore.user` (read) — NOT reused by other functions |
| Caller (Workspace) SA | `workspace-identity-caller@<workspace-project>.iam.gserviceaccount.com` — **no** datastore role; granted `roles/run.invoker` on this function only |
| Invoker IAM | restrict `run.invoker` to the caller SA (remove `allUsers`) — belt-and-braces with the OIDC allowlist |
| Env (`functions/.env.tng-systems`, non-secret) | `WORKSPACE_BROKER_AUDIENCE=<function URL>`, `WORKSPACE_BROKER_CALLERS=<caller SA email>`, `WORKSPACE_BROKER_ERP_PROJECT=tng-systems`, `WORKSPACE_BROKER_PERM_VERSION=v1`, `WORKSPACE_BROKER_CACHE_TTL=300` |
| Broker audience | the function's own HTTPS URL (the Workspace mints OIDC tokens for exactly this audience) |

### Rollout
1. Create the dedicated runtime SA (`datastore.user`) and set it as the
   function's runtime service account.
2. Create the caller SA (no datastore role); grant it `run.invoker` on
   `workspaceIdentity` only.
3. Set the env block; `firebase deploy --only functions:workspaceIdentity`.
4. Restrict the invoker to the caller SA (remove `allUsers`).
5. Smoke test with an OIDC token from the caller SA against a synthetic uid in
   `tng-systems-staging` before pointing production Workspace at it.

### Rollback
- `firebase functions:delete workspaceIdentity` (removes the endpoint), or
- remove the caller SA from `run.invoker` (instantly denies Workspace), or
- Workspace-side: unset `ERP_IDENTITY_BROKER_SERVICE_ACCOUNT` → Workspace SSO
  fails closed. No ERP data is affected by any rollback.

## Tests

`cd functions && npx tsx --test src/workspaceIdentity/__tests__/workspaceIdentity.test.ts`
— 24 tests, synthetic data only, no Firebase/Google network. Covers active
accept; inactive/pending/rejected zero-eligibility; missing profile; wrong
project/audience/caller/expiry; business assignments; allowlist-only; unknown
discarded; raw/sensitive fields absent; strict-schema rejection; no-secret
logging; deactivation via resolve-by-uid; fail-closed datastore/bad-request.
