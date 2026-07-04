// QR Ordering — shared Firebase Functions accessor for the customer callables.
//
// A single memoized `Functions` handle used by every QR client service
// (publicMenu, createOrder, …). Centralizing it means the local-emulator
// `connectFunctionsEmulator` wiring runs exactly once — calling it twice on the
// same instance (which is what two separate service modules would do, since
// getFunctions(app) returns the same instance per app) throws at runtime.

import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';
import { app } from '../../../config/firebase';

let functionsInstance: Functions | null = null;

/** Lazily create the shared Functions handle. Connects to a local emulator only
 *  when VITE_FUNCTIONS_EMULATOR_HOST (e.g. "localhost:5001") is set — never in prod. */
export function getQrFunctions(): Functions {
    if (functionsInstance) return functionsInstance;
    const fns = getFunctions(app);
    const emulatorHost = import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST as string | undefined;
    if (emulatorHost) {
        const [host, port] = emulatorHost.split(':');
        connectFunctionsEmulator(fns, host || 'localhost', Number(port) || 5001);
    }
    functionsInstance = fns;
    return fns;
}
