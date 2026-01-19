/**
 * Centralized User-Facing Messages
 * 
 * This module provides a single source of truth for all user-facing strings,
 * making it easier to maintain consistency and prepare for future i18n.
 * 
 * @usage Import and use: import { MESSAGES } from '@/config/messages';
 *        Then: setError(MESSAGES.errors.saveFailed);
 */

// =============================================================================
// ERROR MESSAGES
// =============================================================================
export const ERRORS = {
    // Generic
    generic: 'An unexpected error occurred. Please try again.',
    networkError: 'Network error. Please check your connection and try again.',

    // Authentication
    authFailed: 'Authentication failed. Please sign in again.',
    sessionExpired: 'Your session has expired. Please sign in again.',
    permissionDenied: 'You do not have permission to perform this action.',

    // Data Operations
    saveFailed: 'Failed to save changes. Please try again.',
    loadFailed: 'Failed to load data. Please refresh the page.',
    deleteFailed: 'Failed to delete item. Please try again.',

    // Form Validation
    requiredField: 'This field is required.',
    invalidEmail: 'Please enter a valid email address.',
    invalidNumber: 'Please enter a valid number.',

    // Requisitions
    requisitionSaveFailed: 'Failed to save requisition. Please try again.',
    requisitionSubmitFailed: 'Failed to submit requisition. Please try again.',
    requisitionNotFound: 'Requisition not found.',

    // File/Upload
    uploadFailed: 'Failed to upload file. Please try again.',
    fileTooLarge: 'File is too large. Maximum size is {maxSize}.',
    invalidFileType: 'Invalid file type. Allowed types: {allowedTypes}.',
} as const;

// =============================================================================
// SUCCESS MESSAGES
// =============================================================================
export const SUCCESS = {
    // Generic
    saved: 'Changes saved successfully!',
    deleted: 'Item deleted successfully!',

    // Requisitions
    requisitionSaved: 'Requisition saved successfully!',
    requisitionSubmitted: 'Requisition submitted successfully!',
    draftSaved: 'Draft saved successfully! You can continue editing later.',

    // Settings
    settingsSaved: 'Settings saved successfully!',

    // User Management
    userCreated: 'User created successfully!',
    userUpdated: 'User updated successfully!',
    passwordChanged: 'Password changed successfully!',
} as const;

// =============================================================================
// CONFIRMATION MESSAGES
// =============================================================================
export const CONFIRMATIONS = {
    deleteItem: 'Are you sure you want to delete this item?',
    discardChanges: 'You have unsaved changes. Are you sure you want to leave?',
    submitRequisition: 'Are you sure you want to submit this requisition?',
    approveRequisition: 'Are you sure you want to approve this requisition?',
    rejectRequisition: 'Are you sure you want to reject this requisition?',
} as const;

// =============================================================================
// LABELS & UI TEXT
// =============================================================================
export const LABELS = {
    // Common Actions
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    submit: 'Submit',
    approve: 'Approve',
    reject: 'Reject',

    // Status
    loading: 'Loading...',
    saving: 'Saving...',
    submitting: 'Submitting...',
    processing: 'Processing...',
} as const;

// =============================================================================
// COMBINED EXPORT FOR CONVENIENCE
// =============================================================================
export const MESSAGES = {
    errors: ERRORS,
    success: SUCCESS,
    confirmations: CONFIRMATIONS,
    labels: LABELS,
} as const;

/**
 * I18N STRATEGY NOTES
 * ==================
 * 
 * When implementing internationalization:
 * 
 * 1. Replace this file with a proper i18n library (e.g., react-intl, i18next)
 * 2. Move strings to locale files (e.g., en.json, tl.json)
 * 3. Use placeholder syntax for dynamic values: "File too large. Max: {maxSize}"
 * 4. Consider plural forms for counts
 * 5. Keep keys consistent across locales
 * 
 * Example migration path:
 * - Current: ERRORS.saveFailed
 * - Future:  t('errors.saveFailed') // returns localized string
 */
