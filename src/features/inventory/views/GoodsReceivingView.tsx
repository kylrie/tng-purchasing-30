import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Truck,
    Upload,
    FileImage,
    FileText,
    Sparkles,
    CheckCircle,
    AlertCircle,
    Loader2,
    X,
    RefreshCw,
    Package,
    Building2,
    ChevronRight,
    Eye,
    Plus,
    Trash2,
    Check,
    Info,
    ArrowRight,
    Camera,
    SwitchCamera,
    CircleDot,
    Aperture
} from 'lucide-react';
import type { InventoryItem } from '../types/InventoryItem';
import { InventoryService } from '../services/inventory.service';
import { GeminiVisionService, type ExtractedItem, type ExtractionResult } from '../../../shared/services/gemini-vision.service';
import type { Business, User } from '../../procurement/types';

// ============================================================
// TYPES
// ============================================================

interface MatchedReceivingRow {
    extractedItem: ExtractedItem | null;
    inventoryItem: InventoryItem | null;
    matchedBy: 'sku' | 'name' | 'fuzzy' | 'manual' | null;
    quantity: number;
    unitPrice: number;
    confirmed: boolean;
}

interface GoodsReceivingViewProps {
    businesses: Business[];
    currentUser?: User | null;
}

type InputMode = 'upload' | 'camera';

// ============================================================
// FUZZY MATCHING
// ============================================================

function normalizeStr(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[m][n];
}

function fuzzyMatchItem(name: string, items: InventoryItem[]): { item: InventoryItem | null; matchedBy: 'sku' | 'name' | 'fuzzy' | null } {
    const norm = normalizeStr(name);
    const exactName = items.find(i => normalizeStr(i.name) === norm);
    if (exactName) return { item: exactName, matchedBy: 'name' };
    const containsMatch = items.find(i => normalizeStr(i.name).includes(norm) || norm.includes(normalizeStr(i.name)));
    if (containsMatch) return { item: containsMatch, matchedBy: 'name' };
    let bestItem: InventoryItem | null = null;
    let bestDist = Infinity;
    const maxDist = Math.max(2, Math.floor(norm.length * 0.3));
    for (const item of items) {
        const dist = levenshtein(norm, normalizeStr(item.name));
        if (dist <= maxDist && dist < bestDist) { bestDist = dist; bestItem = item; }
    }
    if (bestItem) return { item: bestItem, matchedBy: 'fuzzy' };
    return { item: null, matchedBy: null };
}

// ============================================================
// STEP INDICATOR
// ============================================================

const steps = ['Upload Document', 'Review AI Extract', 'Confirm & Apply'];

const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => (
    <div className="flex items-center justify-center gap-0 mb-8">
        {steps.map((label, i) => (
            <React.Fragment key={i}>
                <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2 ${i < currentStep ? 'bg-emerald-500 border-emerald-500 text-white'
                            : i === currentStep ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/30'
                                : 'bg-slate-800 border-slate-600 text-slate-500'
                        }`}>
                        {i < currentStep ? <Check size={16} /> : i + 1}
                    </div>
                    <span className={`text-xs mt-1.5 font-medium hidden sm:block ${i === currentStep ? 'text-purple-400' : i < currentStep ? 'text-emerald-400' : 'text-slate-500'
                        }`}>{label}</span>
                </div>
                {i < steps.length - 1 && (
                    <div className={`h-0.5 w-16 sm:w-24 mx-2 mt-[-18px] sm:mt-[-18px] transition-all ${i < currentStep ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                )}
            </React.Fragment>
        ))}
    </div>
);

// ============================================================
// COMPONENT
// ============================================================

const GoodsReceivingView: React.FC<GoodsReceivingViewProps> = ({ businesses, currentUser }) => {
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState(businesses[0]?.id || '');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [step, setStep] = useState(0);
    const [inputMode, setInputMode] = useState<InputMode>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);
    const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
    const [rows, setRows] = useState<MatchedReceivingRow[]>([]);
    const [referenceNumber, setReferenceNumber] = useState('');
    const [isApplying, setIsApplying] = useState(false);
    const [applySuccess, setApplySuccess] = useState(false);
    const [applyError, setApplyError] = useState<string | null>(null);

    // Camera state
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [isCaptured, setIsCaptured] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if (!selectedBusinessUnit) return;
        InventoryService.getInventory(selectedBusinessUnit).then(setItems);
    }, [selectedBusinessUnit]);

    // Stop camera stream on unmount or mode change
    useEffect(() => {
        return () => { stopCamera(); };
    }, []);

    // ---- Camera helpers ----

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setCameraActive(false);
    };

    const startCamera = async (facing: 'environment' | 'user') => {
        setCameraError(null);
        // Stop any existing stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setCameraActive(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Camera not accessible';
            setCameraError(
                msg.includes('Permission denied') || msg.includes('NotAllowed')
                    ? 'Camera permission denied. Please allow camera access in your browser.'
                    : 'Could not start camera. Make sure your device has a camera connected.'
            );
        }
    };

    const handleOpenCamera = async () => {
        setInputMode('camera');
        setIsCaptured(false);
        await startCamera(facingMode);
    };

    const handleFlipCamera = async () => {
        const next = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(next);
        await startCamera(next);
    };

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(blob => {
            if (!blob) return;
            const capturedFile = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
            const previewUrl = URL.createObjectURL(blob);
            setFile(capturedFile);
            setFilePreview(previewUrl);
            setIsCaptured(true);
            // Pause video but keep stream alive for retake
            if (videoRef.current) videoRef.current.pause();
        }, 'image/jpeg', 0.92);
    };

    const handleRetake = async () => {
        setIsCaptured(false);
        setFile(null);
        setFilePreview(null);
        if (videoRef.current) videoRef.current.play();
    };

    const handleCloseCamera = () => {
        stopCamera();
        setInputMode('upload');
        setIsCaptured(false);
    };

    // ---- File upload helpers ----

    const processFile = useCallback(async (f: File) => {
        const supported = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
        if (!supported.includes(f.type)) {
            setAnalyzeError(`Unsupported file type. Please upload a JPG, PNG, WEBP, or PDF.`);
            return;
        }
        setFile(f);
        setAnalyzeError(null);
        if (f.type.startsWith('image/')) {
            setFilePreview(URL.createObjectURL(f));
        } else {
            setFilePreview(null);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) processFile(f);
    }, [processFile]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) processFile(f);
    }, [processFile]);

    // ---- Analyze with Gemini ----

    const handleAnalyze = async () => {
        if (!file) return;
        // Stop camera before analyzing
        stopCamera();
        setIsAnalyzing(true);
        setAnalyzeError(null);
        try {
            const result = await GeminiVisionService.extractInventoryFromDocument(file);
            setExtraction(result);
            const matched: MatchedReceivingRow[] = result.items.map(extracted => {
                const { item, matchedBy } = fuzzyMatchItem(extracted.name, items);
                return { 
                    extractedItem: extracted, 
                    inventoryItem: item, 
                    matchedBy, 
                    quantity: extracted.quantity || 1, 
                    unitPrice: extracted.unitPrice || 0,
                    confirmed: !!item 
                };
            });
            setRows(matched);
            setStep(1);
        } catch (err) {
            setAnalyzeError(err instanceof Error ? err.message : 'Failed to analyze document.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // ---- Row editing ----

    const handleAddManualRow = () => {
        setRows(prev => [...prev, {
            extractedItem: null,
            inventoryItem: null,
            matchedBy: 'manual',
            quantity: 1,
            unitPrice: 0,
            confirmed: false
        }]);
    };

    const handleDeleteRow = (idx: number) => {
        setRows(prev => prev.filter((_, i) => i !== idx));
    };

    const handleItemChange = (idx: number, itemId: string) => {
        const item = items.find(i => i.id === itemId) || null;
        setRows(prev => prev.map((r, i) => i === idx ? { 
            ...r, 
            inventoryItem: item, 
            matchedBy: item && r.matchedBy !== 'manual' ? 'manual' : r.matchedBy,
            confirmed: !!item
        } : r));
    };

    const handleRowChange = (idx: number, field: 'quantity' | 'unitPrice', value: string) => {
        const num = parseFloat(value);
        setRows(prev => prev.map((r, i) => i === idx ? {
            ...r,
            [field]: isNaN(num) ? '' : num
        } : r));
    };

    const toggleConfirm = (idx: number) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, confirmed: !r.confirmed } : r));
    const confirmedRows = rows.filter(r => r.confirmed && r.inventoryItem);

    // ---- Apply to inventory ----

    const handleApply = async () => {
        if (!currentUser) {
            setApplyError("You must be logged in to apply changes.");
            return;
        }
        setIsApplying(true);
        setApplyError(null);
        try {
            const payload = confirmedRows.map(row => ({
                inventoryItemId: row.inventoryItem!.id,
                qtyReceived: Number(row.quantity) || 0,
                unitPrice: Number(row.unitPrice) || 0
            }));
            
            await InventoryService.receiveGoodsBatch(
                selectedBusinessUnit, 
                payload, 
                { id: currentUser.id, name: currentUser.name || currentUser.email },
                referenceNumber
            );
            setApplySuccess(true);
            setItems(await InventoryService.getInventory(selectedBusinessUnit));
        } catch (err) {
            setApplyError(err instanceof Error ? err.message : 'Failed to update inventory.');
        } finally {
            setIsApplying(false);
        }
    };

    const handleReset = () => {
        stopCamera();
        setStep(0);
        setInputMode('upload');
        setFile(null);
        setFilePreview(null);
        setExtraction(null);
        setRows([]);
        setReferenceNumber('');
        setAnalyzeError(null);
        setApplySuccess(false);
        setApplyError(null);
        setIsCaptured(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const currentBusiness = businesses.find(b => b.id === selectedBusinessUnit);
    const readyToAnalyze = !!file && (inputMode === 'upload' || isCaptured);

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Truck className="text-purple-600 dark:text-purple-400" />
                        Goods Receiving
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Upload or photograph a delivery receipt to auto-update inventory
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 self-start sm:self-auto">
                    <Building2 size={16} className="text-slate-500 dark:text-slate-400" />
                    <select
                        value={selectedBusinessUnit}
                        onChange={e => { setSelectedBusinessUnit(e.target.value); handleReset(); }}
                        className="bg-transparent text-slate-900 dark:text-white focus:outline-none text-sm"
                    >
                        {businesses.map(bu => (
                            <option key={bu.id} value={bu.id} className="bg-white dark:bg-slate-800">{bu.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* AI Badge */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-xl w-fit">
                <Sparkles size={16} className="text-purple-400" />
                <span className="text-sm text-purple-300 font-medium">Powered by Gemini Vision AI</span>
            </div>

            <StepIndicator currentStep={step} />

            {/* ================================================================
                STEP 0 - UPLOAD / CAMERA
            ================================================================ */}
            {step === 0 && (
                <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Capture Delivery Document</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                Upload a file or use your camera to photograph the receipt
                            </p>
                        </div>
                    </div>

                    {/* Mode toggle */}
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl w-fit">
                        <button
                            onClick={() => { handleCloseCamera(); setInputMode('upload'); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'upload'
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <Upload size={15} /> Upload File
                        </button>
                        <button
                            onClick={handleOpenCamera}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'camera'
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <Camera size={15} /> Use Camera
                        </button>
                    </div>

                    {/* ====================== UPLOAD MODE ====================== */}
                    {inputMode === 'upload' && (
                        <>
                            {!file ? (
                                <div
                                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${isDragging
                                            ? 'border-purple-500 bg-purple-500/10'
                                            : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                                        }`}
                                >
                                    <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="hidden" />
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="flex gap-3">
                                            <div className="p-3 bg-purple-500/10 rounded-xl"><FileImage size={30} className="text-purple-400" /></div>
                                            <div className="p-3 bg-cyan-500/10 rounded-xl"><FileText size={30} className="text-cyan-400" /></div>
                                        </div>
                                        <div>
                                            <p className="text-slate-900 dark:text-white font-semibold text-lg">Drop your delivery document here</p>
                                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">or click to browse</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {['JPG', 'PNG', 'WEBP', 'PDF'].map(ext => (
                                                <span key={ext} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium">{ext}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                                        <FileImage size={20} className="text-purple-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-900 dark:text-white font-medium truncate">{file.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                        <button onClick={() => { setFile(null); setFilePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-400 transition-colors"><X size={16} /></button>
                                    </div>
                                    {filePreview && (
                                        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-64">
                                            <img src={filePreview} alt="Preview" className="w-full object-contain max-h-64" />
                                            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-lg">
                                                <Eye size={12} className="text-white" /><span className="text-white text-xs">Preview</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* ====================== CAMERA MODE ====================== */}
                    {inputMode === 'camera' && (
                        <div className="space-y-3">
                            {cameraError ? (
                                <div className="flex flex-col items-center gap-4 py-10 text-center">
                                    <div className="p-4 bg-red-500/10 rounded-full"><Camera size={32} className="text-red-400" /></div>
                                    <div>
                                        <p className="text-slate-900 dark:text-white font-medium">Camera Unavailable</p>
                                        <p className="text-sm text-red-400 mt-1 max-w-sm">{cameraError}</p>
                                    </div>
                                    <button onClick={() => startCamera(facingMode)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2">
                                        <RefreshCw size={14} /> Try Again
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Video + captured overlay */}
                                    <div className="relative rounded-xl overflow-hidden bg-black border border-slate-700" style={{ minHeight: '280px' }}>
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className={`w-full rounded-xl object-cover transition-opacity ${isCaptured ? 'opacity-0' : 'opacity-100'}`}
                                            style={{ maxHeight: '400px' }}
                                        />
                                        {/* Captured image overlay */}
                                        {isCaptured && filePreview && (
                                            <img
                                                src={filePreview}
                                                alt="Captured"
                                                className="absolute inset-0 w-full h-full object-cover rounded-xl"
                                            />
                                        )}
                                        {/* Hidden canvas for capture */}
                                        <canvas ref={canvasRef} className="hidden" />

                                        {/* Viewfinder corner guides */}
                                        {!isCaptured && cameraActive && (
                                            <>
                                                <div className="absolute top-3 left-3 w-7 h-7 border-t-2 border-l-2 border-white/70 rounded-tl-sm" />
                                                <div className="absolute top-3 right-3 w-7 h-7 border-t-2 border-r-2 border-white/70 rounded-tr-sm" />
                                                <div className="absolute bottom-3 left-3 w-7 h-7 border-b-2 border-l-2 border-white/70 rounded-bl-sm" />
                                                <div className="absolute bottom-3 right-3 w-7 h-7 border-b-2 border-r-2 border-white/70 rounded-br-sm" />
                                            </>
                                        )}

                                        {/* Live indicator */}
                                        {cameraActive && !isCaptured && (
                                            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full">
                                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                                <span className="text-white text-xs font-medium">LIVE</span>
                                            </div>
                                        )}

                                        {/* Captured badge */}
                                        {isCaptured && (
                                            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-emerald-600/90 px-3 py-1 rounded-full">
                                                <CheckCircle size={12} className="text-white" />
                                                <span className="text-white text-xs font-semibold">Photo Captured</span>
                                            </div>
                                        )}

                                        {/* Flip camera button */}
                                        {!isCaptured && cameraActive && (
                                            <button
                                                onClick={handleFlipCamera}
                                                className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                                                title="Flip camera"
                                            >
                                                <SwitchCamera size={18} />
                                            </button>
                                        )}

                                        {/* Loading state */}
                                        {!cameraActive && !cameraError && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Loader2 size={30} className="text-white animate-spin" />
                                                    <p className="text-white text-sm">Starting camera...</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Camera controls */}
                                    <div className="flex items-center justify-between gap-3">
                                        <button
                                            onClick={handleCloseCamera}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl text-sm font-medium transition-colors"
                                        >
                                            <X size={15} /> Close
                                        </button>

                                        <div className="flex items-center gap-3">
                                            {isCaptured ? (
                                                <>
                                                    <button
                                                        onClick={handleRetake}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl text-sm font-medium transition-colors"
                                                    >
                                                        <RefreshCw size={15} /> Retake
                                                    </button>
                                                    <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-xl text-sm font-medium border border-emerald-500/30">
                                                        <CheckCircle size={15} /> Ready to Analyze
                                                    </div>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={handleCapture}
                                                    disabled={!cameraActive}
                                                    className="flex items-center gap-2 px-8 py-3 bg-white dark:bg-white text-slate-900 font-bold rounded-2xl disabled:opacity-40 hover:bg-slate-100 transition-colors shadow-lg"
                                                    title="Capture photo"
                                                >
                                                    <Aperture size={20} className="text-slate-800" />
                                                    Capture
                                                </button>
                                            )}
                                        </div>

                                        {/* Spacer to balance layout */}
                                        <div className="w-24" />
                                    </div>

                                    {/* Tip */}
                                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 justify-center">
                                        <CircleDot size={12} />
                                        <span>Position the receipt fully in frame · Ensure good lighting</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {analyzeError && (
                        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                            <p className="text-red-300 text-sm">{analyzeError}</p>
                        </div>
                    )}

                    {/* Tip (upload mode only) */}
                    {inputMode === 'upload' && (
                        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                            <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                            <p className="text-blue-300 text-sm">
                                For best results, use a clear, well-lit photo. The AI reads both handwritten and printed receipts.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            onClick={handleAnalyze}
                            disabled={!readyToAnalyze || isAnalyzing}
                            className="flex items-center gap-2.5 px-8 py-3 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25"
                        >
                            {isAnalyzing ? (
                                <><Loader2 size={18} className="animate-spin" />Analyzing with AI...</>
                            ) : (
                                <><Sparkles size={18} />Analyze Document<ArrowRight size={16} /></>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ================================================================
                STEP 1 - REVIEW
            ================================================================ */}
            {step === 1 && extraction && (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-wrap gap-4">
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Document Type</p>
                            <p className="text-slate-900 dark:text-white font-medium capitalize">{extraction.documentType}</p>
                        </div>
                        {extraction.supplierName && <div><p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Supplier</p><p className="text-slate-900 dark:text-white font-medium">{extraction.supplierName}</p></div>}
                        {extraction.documentDate && <div><p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Date</p><p className="text-slate-900 dark:text-white font-medium">{extraction.documentDate}</p></div>}
                        <div className="flex-1 min-w-[200px]">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Invoice / Reference #</p>
                            <input
                                type="text"
                                placeholder="Enter Reference Number"
                                value={referenceNumber}
                                onChange={e => setReferenceNumber(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            />
                        </div>
                        <div className="ml-auto w-full sm:w-auto flex items-center justify-end gap-2 mt-2 sm:mt-0">
                            <span className="text-xs text-slate-400">{file?.name}</span>
                            <button onClick={handleReset} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 bg-slate-800 rounded">
                                <RefreshCw size={12} /> Re-upload
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{rows.length}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Items Found</p>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-emerald-400">{rows.filter(r => r.inventoryItem).length}</p>
                            <p className="text-xs text-emerald-300 mt-0.5">Matched</p>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-amber-400">{rows.filter(r => !r.inventoryItem).length}</p>
                            <p className="text-xs text-amber-300 mt-0.5">Not Found</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white">Extracted Items</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Check items to include. Edit matches, quantities and unit prices.</p>
                            </div>
                            <button onClick={handleAddManualRow} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-sm font-medium rounded-lg transition-colors">
                                <Plus size={14} /> Add Row
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800/80">
                                    <tr>
                                        <th className="w-10 p-3 text-center">
                                            <button onClick={() => setRows(prev => prev.map(r => ({ ...r, confirmed: !!r.inventoryItem })))} className="text-xs text-purple-400 hover:text-purple-300" title="Check all matched">All</button>
                                        </th>
                                        <th className="text-left p-3 text-slate-500 dark:text-slate-400 font-medium">AI Extracted Name</th>
                                        <th className="text-left p-3 text-slate-500 dark:text-slate-400 font-medium hidden sm:table-cell">Matched Inventory Item</th>
                                        <th className="text-center p-3 text-slate-500 dark:text-slate-400 font-medium w-28">Qty Received</th>
                                        <th className="text-center p-3 text-slate-500 dark:text-slate-400 font-medium w-32">Unit Price (₱)</th>
                                        <th className="text-right p-3 text-slate-500 dark:text-slate-400 font-medium w-28">Total Price</th>
                                        <th className="text-center p-3 text-slate-500 dark:text-slate-400 font-medium w-12">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, idx) => (
                                        <tr key={idx} className={`border-t border-slate-200 dark:border-slate-700/50 transition-colors ${row.confirmed ? 'bg-emerald-500/5' : ''} ${!row.inventoryItem ? 'opacity-80' : ''}`}>
                                            <td className="p-3 text-center align-top pt-4">
                                                <button onClick={() => toggleConfirm(idx)} disabled={!row.inventoryItem} className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all ${row.confirmed && row.inventoryItem ? 'bg-emerald-500 border-emerald-500' : 'border-slate-400 dark:border-slate-600'} disabled:cursor-not-allowed`}>
                                                    {row.confirmed && row.inventoryItem && <Check size={12} className="text-white" />}
                                                </button>
                                            </td>
                                            <td className="p-3 align-top pt-4">
                                                {row.extractedItem ? (
                                                    <>
                                                        <p className="text-slate-900 dark:text-white font-medium">{row.extractedItem.name}</p>
                                                        <div className="flex gap-2 items-center mt-1">
                                                            <span className="text-xs text-slate-500 dark:text-slate-400">Extracted: {row.extractedItem.quantity} {row.extractedItem.unit}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.extractedItem.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-400' : row.extractedItem.confidence === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                {row.extractedItem.confidence}
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-slate-400 italic text-sm">Manual Entry</span>
                                                )}
                                            </td>
                                            <td className="p-3 hidden sm:table-cell align-top pt-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <select
                                                        value={row.inventoryItem?.id || ''}
                                                        onChange={(e) => handleItemChange(idx, e.target.value)}
                                                        className={`w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${row.inventoryItem ? 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white' : 'border-amber-500/50 text-amber-400'}`}
                                                    >
                                                        <option value="">-- Select Inventory Item --</option>
                                                        {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.category})</option>)}
                                                    </select>
                                                    {row.inventoryItem && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${row.matchedBy === 'name' ? 'bg-emerald-500/20 text-emerald-400' : row.matchedBy === 'sku' ? 'bg-purple-500/20 text-purple-400' : row.matchedBy === 'manual' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                                {row.matchedBy === 'fuzzy' ? 'Fuzzy' : row.matchedBy}
                                                            </span>
                                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                                In stock: {row.inventoryItem.currentStock} {row.inventoryItem.units.recipeUnit}
                                                            </span>
                                                            <span className="text-xs font-medium text-cyan-600 dark:text-cyan-500">
                                                                = {((row.inventoryItem.currentStock / (row.inventoryItem.units.conversion > 0 ? row.inventoryItem.units.conversion : 1)).toFixed(2).replace(/\.00$/, ''))} {row.inventoryItem.units.buyUnit}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center align-top pt-3">
                                                <div className="flex flex-col gap-1 items-center">
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        step="0.01"
                                                        value={row.quantity} 
                                                        onChange={e => handleRowChange(idx, 'quantity', e.target.value)} 
                                                        className="w-full max-w-[80px] px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500" 
                                                    />
                                                    {row.inventoryItem && (
                                                        <span className="text-[10px] text-slate-400">Buy: {row.inventoryItem.units.buyUnit}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center align-top pt-3">
                                                <div className="flex flex-col gap-1 items-center">
                                                    <div className="relative w-full max-w-[100px]">
                                                        <span className="absolute left-2.5 top-1.5 text-slate-500 dark:text-slate-400 text-sm">₱</span>
                                                        <input 
                                                            type="number" 
                                                            min="0"
                                                            step="0.01"
                                                            value={row.unitPrice} 
                                                            onChange={e => handleRowChange(idx, 'unitPrice', e.target.value)} 
                                                            className="w-full pl-6 pr-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-left text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500" 
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right align-top pt-5">
                                                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                                                    ₱{((Number(row.quantity) || 0) * (Number(row.unitPrice) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center align-top pt-4">
                                                <button onClick={() => handleDeleteRow(idx)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors mx-auto block" title="Remove row">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <button onClick={handleReset} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-medium rounded-xl transition-colors">
                            Start Over
                        </button>
                        <button onClick={() => setStep(2)} disabled={confirmedRows.length === 0} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
                            Review {confirmedRows.length} Item{confirmedRows.length !== 1 ? 's' : ''} <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* ================================================================
                STEP 2 - CONFIRM & APPLY
            ================================================================ */}
            {step === 2 && !applySuccess && (
                <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Confirm Stock Update</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                        The following quantities will be <strong className="text-emerald-400">added</strong> to stock for <strong className="text-white">{currentBusiness?.name}</strong>:
                    </p>
                    
                    {referenceNumber && (
                        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg">
                            <FileText size={14} className="text-slate-400" />
                            <span className="text-sm text-slate-300">Ref: <span className="text-white font-medium">{referenceNumber}</span></span>
                        </div>
                    )}

                    <div className="space-y-2 mb-6">
                        {confirmedRows.map((row, idx) => {
                            const item = row.inventoryItem!;
                            const total = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
                            return (
                                <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <Package size={16} className="text-slate-400 flex-shrink-0" />
                                        <div>
                                            <p className="text-slate-900 dark:text-white font-medium">{item.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{item.category}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-5">
                                        <div className="text-right flex flex-col items-end">
                                            <span className="text-slate-400 text-xs">Stock Added</span>
                                            <div className="flex items-center gap-2 text-sm mt-0.5">
                                                <span className="font-bold text-emerald-400">+{row.quantity} {item.units.buyUnit}</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end w-24">
                                            <span className="text-slate-400 text-xs">Total Cost</span>
                                            <span className="font-bold text-slate-900 dark:text-white mt-0.5">
                                                ₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div className="flex justify-end p-4 bg-slate-800/80 rounded-xl border border-slate-700 mt-4">
                            <div className="text-right flex items-center gap-4">
                                <span className="text-slate-400">Grand Total:</span>
                                <span className="text-xl font-bold text-purple-400">
                                    ₱{confirmedRows.reduce((sum, row) => sum + ((Number(row.quantity) || 0) * (Number(row.unitPrice) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                    {applyError && (
                        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
                            <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                            <p className="text-red-300 text-sm">{applyError}</p>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <button onClick={() => setStep(1)} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-medium rounded-xl transition-colors">Back</button>
                        <button onClick={handleApply} disabled={isApplying} className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-emerald-500/20">
                            {isApplying ? <><Loader2 size={18} className="animate-spin" />Updating...</> : <><CheckCircle size={18} />Apply {confirmedRows.length} Update{confirmedRows.length !== 1 ? 's' : ''}</>}
                        </button>
                    </div>
                </div>
            )}

            {/* ================================================================
                SUCCESS STATE
            ================================================================ */}
            {applySuccess && (
                <div className="bg-white dark:bg-slate-800/60 border border-emerald-500/30 rounded-2xl p-10 text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle size={36} className="text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Inventory Updated!</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">
                            Added received quantities to <strong className="text-white">{confirmedRows.length} item{confirmedRows.length !== 1 ? 's' : ''}</strong> in {currentBusiness?.name}.
                        </p>
                    </div>
                    <button onClick={handleReset} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity mx-auto">
                        <Camera size={16} /> Receive Another
                    </button>
                </div>
            )}
        </div>
    );
};

export default GoodsReceivingView;
