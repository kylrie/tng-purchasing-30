/**
 * Raw ESC/POS transport over TCP (RAW / JetDirect, port 9100) — the exact thing
 * QZ Tray does under the hood for a network printer, but headless. Opens a socket
 * to the printer, writes the ESC/POS bytes, and resolves once the data has been
 * flushed. Rejects on connect error, socket error, or timeout.
 *
 * The XP-Q801 (Ethernet, 192.168.100.104) listens on the standard raw port 9100.
 */

import net from 'node:net';

export interface PrinterTarget { host: string; port: number; }

/** Send raw bytes to a network thermal printer. Resolves after the bytes are
 *  written and the socket closes cleanly; rejects on error/timeout. */
export function sendRaw(target: PrinterTarget, data: Buffer, timeoutMs = 8000): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (err?: Error) => {
            if (settled) return;
            settled = true;
            try { socket.destroy(); } catch { /* ignore */ }
            if (err) reject(err); else resolve();
        };

        const socket = new net.Socket();
        socket.setTimeout(timeoutMs);

        socket.once('error', (e) => finish(e instanceof Error ? e : new Error(String(e))));
        socket.once('timeout', () => finish(new Error(`Printer ${target.host}:${target.port} timed out after ${timeoutMs}ms`)));

        socket.connect(target.port, target.host, () => {
            socket.write(data, (writeErr) => {
                if (writeErr) { finish(writeErr); return; }
                // Flush and close the write side; the printer has the bytes. Resolve
                // once fully flushed (end → 'close') so we don't cut the job short.
                socket.end();
            });
        });

        socket.once('close', (hadError) => {
            if (!hadError) finish();
            else finish(new Error(`Socket to ${target.host}:${target.port} closed with error`));
        });
    });
}

/** Lightweight reachability probe (TCP connect only) for health checks. */
export function probe(target: PrinterTarget, timeoutMs = 3000): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        let done = false;
        const end = (ok: boolean) => { if (done) return; done = true; try { socket.destroy(); } catch { /* */ } resolve(ok); };
        socket.setTimeout(timeoutMs);
        socket.once('error', () => end(false));
        socket.once('timeout', () => end(false));
        socket.connect(target.port, target.host, () => end(true));
    });
}
