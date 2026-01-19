/**
 * Centralized Application Constants
 * Refactored from hardcoded values throughout the codebase
 */

// =============================================================================
// UI TIMING CONSTANTS
// =============================================================================

/**
 * UI timing constants for consistent user experience
 * All values in milliseconds
 */
export const UI_CONSTANTS = {
    /** Standard toast/notification display duration */
    TOAST_DURATION: 5000,
    /** Short toast duration for quick confirmations */
    TOAST_DURATION_SHORT: 3000,
    /** Delay before auto-focusing input elements */
    FOCUS_DELAY: 10,
} as const;

// =============================================================================
// TIME CALCULATION CONSTANTS
// =============================================================================

/**
 * Time calculation constants for date/deadline calculations
 */
export const TIME_CONSTANTS = {
    /** Milliseconds in a day (24 * 60 * 60 * 1000) */
    MS_PER_DAY: 86400000,
    /** End of day hour (23:59:59) */
    END_OF_DAY_HOURS: 23,
    END_OF_DAY_MINUTES: 59,
    END_OF_DAY_SECONDS: 59,
} as const;
