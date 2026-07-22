/**
 * TNG QR Print Bridge — entrypoint.
 *
 * Loads config, connects to Firestore with the service account, and runs the
 * bridge until stopped. Designed to run as a Windows service (auto-start, auto-
 * restart). A fatal startup error exits non-zero so the service manager restarts.
 */

import { loadConfig } from './config';
import { initFirestore, markOffline } from './firestoreJobs';
import { Bridge } from './bridge';

async function main(): Promise<void> {
    const config = loadConfig();
    console.log(`[startup] TNG QR Print Bridge · config=${config._configPath} · BU=${config.businessUnitId} · db=${config.databaseId}`);

    const { db } = initFirestore(config);
    const bridge = new Bridge(db, config);
    bridge.start();
    console.log('[startup] bridge online — watching for PAID-order print jobs.');

    let shuttingDown = false;
    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[shutdown] ${signal} — stopping bridge…`);
        await bridge.stop();
        await markOffline(db, config.businessUnitId);
        console.log('[shutdown] done.');
        process.exit(0);
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e) => {
    console.error('[fatal]', (e as Error).message);
    process.exit(1);
});
