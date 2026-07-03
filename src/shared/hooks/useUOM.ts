/**
 * useUOM – Returns the system-hardcoded UOM list.
 *
 * UOMs are now a fixed, built-in list and CANNOT be modified by users.
 * The Firestore `uom/units` document is no longer read or written to.
 * The `updateUOMs` function is kept as a no-op for backwards compatibility
 * with any existing call-sites that still reference it.
 */
import { UOM_CODES } from '../constants/uom.constants';

export const useUOM = () => {
    return {
        /** The fixed, system-defined list of UOM code strings. */
        uomOptions: UOM_CODES,

        /**
         * @deprecated UOMs are now hardcoded and cannot be updated.
         * This is a no-op kept for backwards compatibility.
         */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
        updateUOMs: async (_units: string[]): Promise<void> => {
            console.warn('[useUOM] updateUOMs is disabled – UOMs are now hardcoded.');
        },

        loading: false,
        error: null as string | null,
    };
};
