/**
 * Input Sanitization Utility
 * FIX C6: Prevents XSS and injection attacks by sanitizing user input
 * 
 * @module sanitize
 */
import DOMPurify from 'dompurify';

/**
 * Sanitizes text input by removing all HTML tags and normalizing whitespace
 * Use this for all user-generated string fields before storing in Firestore
 * 
 * @param input - Raw user input string
 * @returns Sanitized string with no HTML and normalized whitespace
 */
export const sanitizeText = (input: string | undefined | null): string => {
    if (!input) return '';

    // FIX C6: Remove all HTML tags to prevent XSS
    const cleaned = DOMPurify.sanitize(input, {
        ALLOWED_TAGS: [],      // Strip ALL HTML tags
        ALLOWED_ATTR: []       // Strip ALL HTML attributes
    });

    // Normalize whitespace: collapse multiple spaces, trim edges
    return cleaned
        .trim()
        .replace(/\s+/g, ' ');
};

/**
 * Sanitizes a number input, returning 0 for invalid values
 * Prevents NaN and Infinity from being stored
 * 
 * @param input - Raw number input
 * @returns Valid number or 0
 */
export const sanitizeNumber = (input: number | string | undefined | null): number => {
    if (input === undefined || input === null) return 0;
    const num = typeof input === 'string' ? parseFloat(input) : input;
    return isNaN(num) || !isFinite(num) ? 0 : num;
};

/**
 * Sanitizes an array of requisition items
 * Applies text sanitization to name and remarks fields
 * 
 * @param items - Array of item objects with name, quantity, uom, remarks
 * @returns Sanitized items array
 */
export const sanitizeItems = <T extends { name: string; remarks?: string; quantity?: number }>(
    items: T[]
): T[] => {
    return items.map(item => ({
        ...item,
        name: sanitizeText(item.name),
        remarks: sanitizeText(item.remarks),
        quantity: sanitizeNumber(item.quantity),
    }));
};

/**
 * Sanitizes a requisition object before saving
 * Apply this to the full requisition data before calling createRequisition
 * 
 * @param data - Partial requisition object
 * @returns Sanitized requisition data
 */
export const sanitizeRequisition = <T extends {
    description?: string;
    remarks?: string;
    items?: any[];
}>(data: T): T => {
    return {
        ...data,
        description: sanitizeText(data.description),
        remarks: sanitizeText(data.remarks),
        items: data.items ? sanitizeItems(data.items) : [],
    };
};
