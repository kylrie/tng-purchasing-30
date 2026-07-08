/**
 * Remove the Windows service. Run in an Administrator terminal:
 *   npm run uninstall-service
 */

/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'node:path';

const SCRIPT = path.resolve(__dirname, '..', 'index.js');

function main(): void {
    let nodeWindows: { Service: new (opts: unknown) => NodeServiceLike };
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeWindows = require('node-windows');
    } catch {
        console.error('node-windows is not installed. If you used the Task Scheduler / NSSM fallback, remove it there.');
        process.exit(1);
        return;
    }

    const svc = new nodeWindows.Service({ name: 'TNG QR Print Bridge', script: SCRIPT });
    svc.on('uninstall', () => console.log('Service "TNG QR Print Bridge" uninstalled.'));
    svc.on('error', (e: unknown) => console.error('Service error:', e));
    svc.uninstall();
}

interface NodeServiceLike {
    on(event: string, cb: (arg?: unknown) => void): void;
    uninstall(): void;
}

main();
