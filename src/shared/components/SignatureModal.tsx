import React, { useRef, useEffect, useState, useCallback } from 'react';
import SignaturePad from 'signature_pad';
import { PenLine, Eraser, Loader2, AlertCircle } from 'lucide-react';
import Card from './Card';

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (signatureBlob: Blob) => void;
    title?: string;
    isLoading?: boolean;
}

const SignatureModal: React.FC<SignatureModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Digital Signature Required',
    isLoading = false,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const signaturePadRef = useRef<SignaturePad | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Derived: anything in-flight disables controls
    const isBusy = isLoading || isSubmitting;

    // Disable / enable canvas pen input when busy
    useEffect(() => {
        if (!signaturePadRef.current) return;
        if (isBusy) {
            signaturePadRef.current.off();
        } else {
            signaturePadRef.current.on();
        }
    }, [isBusy]);

    // Initialize signature pad when modal opens
    useEffect(() => {
        if (!isOpen || !canvasRef.current) return;

        const canvas = canvasRef.current;

        // Reset state on open
// eslint-disable-next-line react-hooks/set-state-in-effect
        setIsEmpty(true);
        setIsSubmitting(false);
        setError(null);

        // Set canvas dimensions for sharp rendering
        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = rect.width * ratio;
            canvas.height = rect.height * ratio;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(ratio, ratio);
            }
            // Clear the pad after resize to avoid distortion
            if (signaturePadRef.current) {
                signaturePadRef.current.clear();
                setIsEmpty(true);
            }
        };

        // Small delay to ensure DOM is laid out
        const timer = setTimeout(() => {
            resizeCanvas();

            if (!signaturePadRef.current) {
                signaturePadRef.current = new SignaturePad(canvas, {
                    backgroundColor: 'rgba(0, 0, 0, 0)', // transparent
                    penColor: 'rgb(15, 23, 42)', // slate-900
                    minWidth: 1.5,
                    maxWidth: 3,
                });
            }

            // Listen for draw events to track empty state
            signaturePadRef.current.addEventListener('endStroke', () => {
                setIsEmpty(signaturePadRef.current?.isEmpty() ?? true);
            });
        }, 100);

        const handleResize = () => {
            // Save data, resize, restore
            const data = signaturePadRef.current?.toData();
            resizeCanvas();
            if (data && signaturePadRef.current) {
                signaturePadRef.current.fromData(data);
                setIsEmpty(signaturePadRef.current.isEmpty());
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
            if (signaturePadRef.current) {
                signaturePadRef.current.off();
                signaturePadRef.current = null;
            }
        };
    }, [isOpen]);

    const handleClear = useCallback(() => {
        signaturePadRef.current?.clear();
        setIsEmpty(true);
        setError(null);
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) return;
        if (isSubmitting) return; // Prevent double-click

        setIsSubmitting(true);
        setError(null);

        try {
            // Convert canvas to blob
            const dataUrl = signaturePadRef.current.toDataURL('image/png');
            const res = await fetch(dataUrl);
            const blob = await res.blob();

            // Hand off to parent — parent controls isLoading from here
            onConfirm(blob);
        } catch (err) {
            console.error('Failed to process signature:', err);
            setError('Failed to process signature. Please try again.');
            setIsSubmitting(false);
        }
    }, [onConfirm, isSubmitting]);

    // Reset isSubmitting when parent isLoading transitions from true → false
    // (means the parent finished its async work)
    useEffect(() => {
        if (!isLoading && isSubmitting) {
// eslint-disable-next-line react-hooks/set-state-in-effect
            setIsSubmitting(false);
        }
    }, [isLoading]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-lg !p-0 animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <PenLine className="text-green-500" size={20} />
                        {title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Please draw your signature below to confirm this approval.
                    </p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                        <AlertCircle size={16} className="flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Signature Canvas */}
                <div className="p-6">
                    <div className={`relative rounded-lg border-2 border-dashed overflow-hidden transition-colors ${isBusy
                        ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-200'
                        : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-100'
                        }`}>
                        <canvas
                            ref={canvasRef}
                            className={`w-full touch-none transition-opacity ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}
                            style={{ height: '200px' }}
                        />
                        {/* Uploading overlay */}
                        {isBusy && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-slate-50/40">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-500 font-medium">
                                    <Loader2 size={20} className="animate-spin" />
                                    Uploading...
                                </div>
                            </div>
                        )}
                        {/* Signature line */}
                        <div className="absolute bottom-12 left-8 right-8 border-b border-slate-300 dark:border-slate-400" />
                        <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-slate-400 dark:text-slate-500">
                            Sign above the line
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between gap-3">
                    {/* Left: Clear */}
                    <button
                        onClick={handleClear}
                        disabled={isBusy || isEmpty}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Eraser size={16} /> Clear
                    </button>

                    {/* Right: Cancel + Submit */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isBusy}
                            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isEmpty || isBusy}
                            className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-green-900/20 flex items-center gap-2 min-w-[160px] justify-center"
                        >
                            {isBusy ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    {isSubmitting && !isLoading ? 'Processing...' : 'Uploading Signature...'}
                                </>
                            ) : (
                                <>
                                    <PenLine size={16} /> Submit Approval
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default SignatureModal;
