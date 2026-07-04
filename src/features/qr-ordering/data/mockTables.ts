// QR Ordering — Table Management MOCK DATA (Phase 1 UI prototype)
// Per docs/QR_SCREEN_SPEC.md: mock only — no Firebase, no callables. The demo
// board lets staff try the create/list/QR-reveal flow without a backend.

export interface MockTable {
    id: string;
    tableNumber: string;
    isActive: boolean;
    businessUnitId: string;
    createdAtMillis: number;
}

export const MOCK_BUSINESS_UNIT = 'inflatable-island';

export const MOCK_TABLES: MockTable[] = [
    { id: 'demo-t1', tableNumber: '1', isActive: true, businessUnitId: MOCK_BUSINESS_UNIT, createdAtMillis: 1_717_000_000_000 },
    { id: 'demo-t2', tableNumber: '2', isActive: true, businessUnitId: MOCK_BUSINESS_UNIT, createdAtMillis: 1_717_100_000_000 },
    { id: 'demo-t5', tableNumber: '5', isActive: true, businessUnitId: MOCK_BUSINESS_UNIT, createdAtMillis: 1_717_200_000_000 },
    { id: 'demo-t12', tableNumber: '12', isActive: false, businessUnitId: MOCK_BUSINESS_UNIT, createdAtMillis: 1_717_300_000_000 },
];

/** Deterministic, valid-looking mock token for the demo QR-reveal flow. */
export function mockTokenFor(id: string): string {
    return `DEMOTOKEN${id.replace(/[^A-Za-z0-9]/g, '')}`.padEnd(12, '0');
}
