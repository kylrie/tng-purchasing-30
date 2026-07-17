/**
 * Datastore port — the ONLY ERP surface the broker touches.
 *
 * The broker reads exactly two things: a single `users/{uid}` document and the
 * one `config/permissions` document. It never lists collections, never queries,
 * never reads customers/orders/inventory/payroll/POS. The port makes that
 * boundary explicit and lets the contract tests inject synthetic documents.
 *
 * In production the port is backed by the ERP firebase-admin Firestore
 * (database `tng-systems`). Even if the runtime SA's IAM were broader than these
 * paths (Firestore IAM cannot scope reads to specific documents — see the
 * security runbook), this port cannot express a wider read: there is no generic
 * document-read method and no caller-supplied collection/path parameter.
 */

/** Raw ERP user document — only the fields the projection consumes are typed. */
export interface ErpUserDoc {
  email?: unknown;
  name?: unknown; // TNG User.name is the display name
  role?: unknown;
  status?: unknown; // UserStatus: ACTIVE | PENDING_APPROVAL | REJECTED | INACTIVE
  businessId?: unknown;
  businessUnitIds?: unknown;
  permissions?: unknown; // per-user override strings
  employeeId?: unknown;
  updatedAt?: unknown;
  // NOTE: the real doc also holds posPin/posPinHash/pcfCeiling/etc. — the broker
  // deliberately does not read or return them (no field, no projection input).
}

/** `config/permissions`: role→permissions under `roles_permissions` or `permissions`. */
export interface ErpPermissionMatrixDoc {
  roles_permissions?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  version?: unknown;
}

export interface ErpDatastore {
  getUserDoc(uid: string): Promise<ErpUserDoc | null>;
  getPermissionMatrix(): Promise<ErpPermissionMatrixDoc | null>;
}

/** In-memory synthetic datastore for the contract tests / Lab runs. */
export class SyntheticErpDatastore implements ErpDatastore {
  constructor(
    private readonly users: Record<string, ErpUserDoc>,
    private readonly matrix: ErpPermissionMatrixDoc | null = null,
    private readonly failRead = false,
  ) {}

  async getUserDoc(uid: string): Promise<ErpUserDoc | null> {
    if (this.failRead) throw new Error('synthetic datastore read failure');
    return Object.prototype.hasOwnProperty.call(this.users, uid) ? this.users[uid] : null;
  }

  async getPermissionMatrix(): Promise<ErpPermissionMatrixDoc | null> {
    if (this.failRead) throw new Error('synthetic datastore read failure');
    return this.matrix;
  }
}

/** Minimal Firestore surface the adapter needs (point-gets only; no query API). */
export interface FirestoreLike {
  collection(name: string): {
    doc(id: string): { get(): Promise<{ exists: boolean; data(): unknown }> };
  };
}

/** Firestore-backed datastore: two point-gets, no `.where`, no `.listCollections`. */
export function firestoreDatastore(db: FirestoreLike): ErpDatastore {
  return {
    async getUserDoc(uid) {
      const snap = await db.collection('users').doc(uid).get();
      return snap.exists ? ((snap.data() ?? {}) as ErpUserDoc) : null;
    },
    async getPermissionMatrix() {
      const snap = await db.collection('config').doc('permissions').get();
      return snap.exists ? ((snap.data() ?? {}) as ErpPermissionMatrixDoc) : null;
    },
  };
}

/** Read the role→permissions map, accepting either config key. */
export function permissionTableOf(matrix: ErpPermissionMatrixDoc | null): Record<string, unknown> {
  if (!matrix) return {};
  const table = matrix.roles_permissions ?? matrix.permissions ?? {};
  return typeof table === 'object' && table !== null ? (table as Record<string, unknown>) : {};
}
