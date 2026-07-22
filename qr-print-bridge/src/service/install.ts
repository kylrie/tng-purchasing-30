/**
 * Install the bridge as a Windows service (auto-start on boot, auto-restart on
 * crash). Run ONCE, in an Administrator terminal:  npm run install-service
 *
 * Uses node-windows (an optional dependency). If it isn't installed, the message
 * explains the fallback (Task Scheduler / NSSM — see README).
 */

/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');          // bridge root (has config.json)
const SCRIPT = path.resolve(__dirname, '..', 'index.js');  // dist/index.js

function main(): void {
    let nodeWindows: { Service: new (opts: unknown) => NodeServiceLike };
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeWindows = require('node-windows');
    } catch {
        console.error('node-windows is not installed. Run `npm install` first, or use the Task Scheduler / NSSM fallback in README.md.');
        process.exit(1);
        return;
    }

    const svc = new nodeWindows.Service({
        name: 'TNG QR Print Bridge',
        description: 'Prints PAID QR-order Kitchen/Bar tickets to the thermal printer automatically.',
        script: SCRIPT,
        workingDirectory: ROOT,
        env: [{ name: 'BRIDGE_CONFIG', value: path.join(ROOT, 'config.json') }],
        wait: 2,
        grow: 0.5,
        maxRestarts: 10,
    });

    svc.on('install', () => {
        console.log('Service installed. Starting…');
        svc.start();
    });
    svc.on('alreadyinstalled', () => console.log('Service is already installed.'));
    svc.on('start', () => console.log('Service "TNG QR Print Bridge" is running and set to auto-start on boot.'));
    svc.on('error', (e: unknown) => console.error('Service error:', e));

    svc.install();
}

interface NodeServiceLike {
    on(event: string, cb: (arg?: unknown) => void): void;
    install(): void;
    start(): void;
}

main();
