/**
 * Form Error Handler Utility
 * FIX M9: Standardized try-catch logic for form submissions
 * 
 * @module formErrorHandler
 */

/**
 * Standard error response structure
 */
export interface FormResult<T = void> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
        code?: string;
        field?: string; // For field-specific errors
    };
}

/**
 * Wraps an async form handler with standardized error handling
 * Prevents unhandled exceptions from crashing the UI
 * 
 * @example
 * const handleSubmit = withFormErrorHandler(async (data) => {
 *   await saveToFirestore(data);
 *   return { savedId: '123' };
 * });
 * 
 * const result = await handleSubmit(formData);
 * if (!result.success) {
 *   setError(result.error.message);
 * }
 */
export function withFormErrorHandler<TInput, TOutput = void>(
    handler: (input: TInput) => Promise<TOutput>,
    options?: {
        onError?: (error: Error) => void; // Custom error callback
        logErrors?: boolean;
    }
): (input: TInput) => Promise<FormResult<TOutput>> {
    return async (input: TInput) => {
        try {
            const data = await handler(input);
            return { success: true, data };
        } catch (err) {
            const error = err as Error;

            // Log if enabled
            if (options?.logErrors !== false) {
                console.error('Form submission error:', error);
            }

            // Call custom error handler if provided
            options?.onError?.(error);

            // Parse Firebase errors for better messages
            const message = parseFirebaseError(error.message);

            return {
                success: false,
                error: {
                    message,
                    code: (error as any).code,
                }
            };
        }
    };
}

/**
 * HOC for React form components
 * Wraps the submit handler and provides error state
 */
export function useFormSubmit<TInput, TOutput = void>(
    handler: (input: TInput) => Promise<TOutput>
) {
    const wrappedHandler = withFormErrorHandler(handler);

    return async (input: TInput) => {
        const result = await wrappedHandler(input);
        return result;
    };
}

/**
 * Parses Firebase error codes into user-friendly messages
 */
function parseFirebaseError(message: string): string {
    // Common Firebase Auth errors
    if (message.includes('auth/user-not-found')) {
        return 'No account found with this email.';
    }
    if (message.includes('auth/wrong-password')) {
        return 'Incorrect password.';
    }
    if (message.includes('auth/email-already-in-use')) {
        return 'An account with this email already exists.';
    }
    if (message.includes('auth/weak-password')) {
        return 'Password must be at least 6 characters.';
    }
    if (message.includes('permission-denied')) {
        return 'You do not have permission to perform this action.';
    }
    if (message.includes('not-found')) {
        return 'The requested document was not found.';
    }

    // Network errors
    if (message.includes('network') || message.includes('Failed to fetch')) {
        return 'Network error. Please check your connection.';
    }

    return message || 'An unexpected error occurred.';
}

/**
 * Async wrapper that catches errors and returns a standardized result
 * Use this for any async operation that should not crash the app
 * 
 * @example
 * const result = await safeAsync(fetchData, fallbackData);
 */
export async function safeAsync<T>(
    fn: () => Promise<T>,
    fallback: T
): Promise<{ data: T; error?: Error }> {
    try {
        const data = await fn();
        return { data };
    } catch (err) {
        console.error('safeAsync caught error:', err);
        return { data: fallback, error: err as Error };
    }
}
