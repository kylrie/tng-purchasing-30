/**
 * Minimal in-memory Firestore Admin fake (Sprint 1 integration tests).
 *
 * Implements ONLY the operations the QR handlers use — point get/set/update,
 * equality-filter queries with limit, and a single-threaded runTransaction.
 * It is intentionally NOT a general Firestore. It lets the callable handlers run
 * under `tsx --test` with no emulator/Java. Rules behavior (M3 direct-read,
 * M4 BU-scope) is NOT covered here — that needs the real emulator (see the
 * rules.emulator.test.ts CI suite).
 *
 * Cast to `Firestore` at the call site: `fake as unknown as Firestore`.
 */

type Data = Record<string, unknown>;

class Store {
    private cols = new Map<string, Map<string, Data>>();
    private idCounter = 0;

    newId(): string {
        this.idCounter += 1;
        return `fake_${this.idCounter}`;
    }
    col(name: string): Map<string, Data> {
        let c = this.cols.get(name);
        if (!c) { c = new Map(); this.cols.set(name, c); }
        return c;
    }
    get(name: string, id: string): Data | undefined {
        const d = this.col(name).get(id);
        return d ? { ...d } : undefined;
    }
    set(name: string, id: string, data: Data): void {
        this.col(name).set(id, { ...data });
    }
    update(name: string, id: string, data: Data): void {
        const cur = this.col(name).get(id) ?? {};
        this.col(name).set(id, { ...cur, ...data });
    }
    query(name: string, filters: [string, unknown][], limit?: number): { id: string; data: Data }[] {
        let rows = [...this.col(name).entries()].map(([id, data]) => ({ id, data }));
        for (const [field, value] of filters) rows = rows.filter(r => r.data[field] === value);
        if (limit !== undefined) rows = rows.slice(0, limit);
        return rows.map(r => ({ id: r.id, data: { ...r.data } }));
    }
}

class DocSnap {
    constructor(public id: string, private _data: Data | undefined) {}
    get exists(): boolean { return this._data !== undefined; }
    data(): Data | undefined { return this._data; }
}

class DocRef {
    constructor(private store: Store, public readonly _collName: string, public readonly id: string) {}
    async get(): Promise<DocSnap> { return new DocSnap(this.id, this.store.get(this._collName, this.id)); }
    async set(data: Data): Promise<void> { this.store.set(this._collName, this.id, data); }
    async update(data: Data): Promise<void> { this.store.update(this._collName, this.id, data); }
}

class Query {
    constructor(
        protected store: Store,
        protected collName: string,
        protected filters: [string, unknown][] = [],
        protected _limit?: number,
    ) {}
    where(field: string, _op: string, value: unknown): Query {
        return new Query(this.store, this.collName, [...this.filters, [field, value]], this._limit);
    }
    limit(n: number): Query {
        return new Query(this.store, this.collName, this.filters, n);
    }
    async get(): Promise<{ empty: boolean; size: number; docs: DocSnap[] }> {
        const rows = this.store.query(this.collName, this.filters, this._limit);
        const docs = rows.map(r => new DocSnap(r.id, r.data));
        return { empty: docs.length === 0, size: docs.length, docs };
    }
}

class CollectionRef extends Query {
    doc(id?: string): DocRef {
        return new DocRef(this.store, this.collName, id ?? this.store.newId());
    }
}

class FakeTransaction {
    private writes: (() => void)[] = [];
    constructor(private store: Store) {}
    async get(ref: DocRef): Promise<DocSnap> { return ref.get(); }
    set(ref: DocRef, data: Data): void { this.writes.push(() => this.store.set(ref._collName, ref.id, data)); }
    update(ref: DocRef, data: Data): void { this.writes.push(() => this.store.update(ref._collName, ref.id, data)); }
    _commit(): void { this.writes.forEach(w => w()); }
}

export class FakeFirestore {
    private store = new Store();

    collection(name: string): CollectionRef {
        return new CollectionRef(this.store, name);
    }
    async runTransaction<T>(fn: (txn: FakeTransaction) => Promise<T>): Promise<T> {
        const txn = new FakeTransaction(this.store);
        const result = await fn(txn);
        txn._commit();
        return result;
    }

    /** Test-only: seed a document directly. */
    _seed(collName: string, id: string, data: Data): void {
        this.store.set(collName, id, data);
    }
    /** Test-only: read a document directly. */
    _read(collName: string, id: string): Data | undefined {
        return this.store.get(collName, id);
    }
    /** Test-only: all docs in a collection. */
    _all(collName: string): { id: string; data: Data }[] {
        return this.store.query(collName, []);
    }
}
