/**
 * Bridge configuration loader. Reads a single JSON file (config.json by default,
 * or the path in BRIDGE_CONFIG) so a non-developer can set it up by editing one
 * file. Validates the fields that must be present and fills sane defaults.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { PrinterTarget } from './printer';
import type { Station } from './escpos';

export interface BridgeConfig {
    businessUnitId: string;
    databaseId: string;
    serviceAccountPath: string;
    printers: Record<Station, PrinterTarget>;
    maxAttempts: number;
    retryDelayMs: number;
    socketTimeoutMs: number;
    heartbeatMs: number;
    pollIntervalMs: number;
    /** Absolute path the config was loaded from (for logs). */
    _configPath: string;
}

const DEFAULTS = {
    databaseId: 'tng-systems',
    maxAttempts: 3,
    retryDelayMs: 3000,
    socketTimeoutMs: 8000,
    heartbeatMs: 15000,
    pollIntervalMs: 20000,
};

function resolveConfigPath(): string {
    const fromEnv = process.env.BRIDGE_CONFIG;
    if (fromEnv) return path.resolve(fromEnv);
    return path.resolve(process.cwd(), 'config.json');
}

function requireTarget(raw: unknown, station: string): PrinterTarget {
    if (!raw || typeof raw !== 'object') throw new Error(`config.printers.${station} is required ({ host, port })`);
    const t = raw as Record<string, unknown>;
    const host = typeof t.host === 'string' ? t.host.trim() : '';
    const port = typeof t.port === 'number' ? t.port : Number(t.port);
    if (!host) throw new Error(`config.printers.${station}.host is required`);
    if (!Number.isFinite(port) || port <= 0) throw new Error(`config.printers.${station}.port must be a positive number`);
    return { host, port };
}

/** Load + validate the bridge config. Throws a clear error if unusable. */
export function loadConfig(): BridgeConfig {
    const configPath = resolveConfigPath();
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config not found at ${configPath}. Copy config.example.json → config.json and edit it.`);
    }
    let raw: Record<string, unknown>;
    try {
        raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    } catch (e) {
        throw new Error(`Config at ${configPath} is not valid JSON: ${(e as Error).message}`);
    }

    const businessUnitId = typeof raw.businessUnitId === 'string' ? raw.businessUnitId.trim() : '';
    if (!businessUnitId) throw new Error('config.businessUnitId is required (e.g. "b3").');

    const serviceAccountPath = typeof raw.serviceAccountPath === 'string' ? raw.serviceAccountPath.trim() : '';
    if (!serviceAccountPath) throw new Error('config.serviceAccountPath is required (path to the Firebase service-account key JSON).');
    const saAbs = path.isAbsolute(serviceAccountPath) ? serviceAccountPath : path.resolve(path.dirname(configPath), serviceAccountPath);
    if (!fs.existsSync(saAbs)) throw new Error(`Service-account key not found at ${saAbs}.`);

    const printersRaw = (raw.printers && typeof raw.printers === 'object') ? raw.printers as Record<string, unknown> : {};
    const printers: Record<Station, PrinterTarget> = {
        KITCHEN: requireTarget(printersRaw.KITCHEN, 'KITCHEN'),
        BAR: requireTarget(printersRaw.BAR, 'BAR'),
    };

    const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

    return {
        businessUnitId,
        databaseId: typeof raw.databaseId === 'string' && raw.databaseId.trim() ? raw.databaseId.trim() : DEFAULTS.databaseId,
        serviceAccountPath: saAbs,
        printers,
        maxAttempts: Math.max(1, num(raw.maxAttempts, DEFAULTS.maxAttempts)),
        retryDelayMs: Math.max(0, num(raw.retryDelayMs, DEFAULTS.retryDelayMs)),
        socketTimeoutMs: Math.max(1000, num(raw.socketTimeoutMs, DEFAULTS.socketTimeoutMs)),
        heartbeatMs: Math.max(3000, num(raw.heartbeatMs, DEFAULTS.heartbeatMs)),
        pollIntervalMs: Math.max(5000, num(raw.pollIntervalMs, DEFAULTS.pollIntervalMs)),
        _configPath: configPath,
    };
}
