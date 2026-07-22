/**
 * Health check CLI — `npm run health`. Verifies the bridge can (a) read its
 * config + service account, (b) reach the configured printers on :9100, and
 * (c) shows the last heartbeat this bridge wrote. Exits 0 if healthy, 1 otherwise.
 */

import { loadConfig } from './config';
import { initFirestore, BRIDGE_STATUS_COLLECTION } from './firestoreJobs';
import { probe } from './printer';
import type { Station } from './escpos';

async function main(): Promise<number> {
    const config = loadConfig();
    console.log(`Config OK: ${config._configPath}`);
    console.log(`Business unit: ${config.businessUnitId} · Database: ${config.databaseId}`);

    let ok = true;

    for (const station of ['KITCHEN', 'BAR'] as Station[]) {
        const t = config.printers[station];
        const reachable = await probe(t, 3000);
        console.log(`Printer ${station} ${t.host}:${t.port} — ${reachable ? 'REACHABLE' : 'UNREACHABLE'}`);
        if (!reachable) ok = false;
    }

    try {
        const { db } = initFirestore(config);
        const snap = await db.collection(BRIDGE_STATUS_COLLECTION).doc(config.businessUnitId).get();
        if (snap.exists) {
            const d = snap.data() as Record<string, unknown>;
            const hb = d.lastHeartbeat as { toDate?: () => Date } | undefined;
            console.log(`Firestore OK. Bridge status: online=${d.online} lastHeartbeat=${hb?.toDate?.().toISOString?.() ?? 'n/a'}`);
        } else {
            console.log('Firestore OK. No heartbeat yet (bridge has not run).');
        }
    } catch (e) {
        console.log(`Firestore ERROR: ${(e as Error).message}`);
        ok = false;
    }

    console.log(ok ? 'HEALTHY' : 'UNHEALTHY');
    return ok ? 0 : 1;
}

main().then(code => process.exit(code)).catch((e) => { console.error((e as Error).message); process.exit(1); });
