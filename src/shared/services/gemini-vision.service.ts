import { GoogleGenAI } from '@google/genai';

// ============================================================
// TYPES
// ============================================================

export interface ExtractedItem {
    name: string;
    quantity: number;
    unit: string;
    unitPrice?: number;
    confidence: 'high' | 'medium' | 'low';
    rawText?: string;
}

export interface ExtractionResult {
    items: ExtractedItem[];
    documentType: string;
    supplierName?: string;
    documentDate?: string;
    documentNumber?: string;
    rawResponse?: string;
}

// ============================================================
// FILE HELPERS
// ============================================================

/**
 * Convert any File to a base64 data string for Gemini
 */
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Strip the data URI prefix (e.g. "data:image/jpeg;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================================================
// GEMINI VISION SERVICE
// ============================================================

export class GeminiVisionService {

    private static getClient(): GoogleGenAI {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('VITE_GEMINI_API_KEY is not set. Please add it to your .env file.');
        }
        return new GoogleGenAI({ apiKey });
    }

    /**
     * Extract inventory items from a delivery receipt, purchase order, or invoice.
     * Supports: images (JPG, PNG, WEBP) and PDFs.
     */
    static async extractInventoryFromDocument(file: File): Promise<ExtractionResult> {
        const client = this.getClient();

        // Validate file type
        const supportedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
            'image/gif', 'application/pdf'
        ];
        if (!supportedTypes.includes(file.type)) {
            throw new Error(`Unsupported file type: ${file.type}. Please upload an image (JPG, PNG, WEBP) or PDF.`);
        }

        // Convert file to base64
        const base64Data = await fileToBase64(file);
        const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf';

        const prompt = `You are an expert at reading delivery receipts, purchase orders, and invoices for restaurants and bars in the Philippines.

Analyze this document and extract ALL inventory items. Return ONLY a valid JSON object with this exact structure:

{
  "documentType": "delivery receipt|purchase order|invoice|unknown",
  "supplierName": "supplier name or null",
  "documentDate": "date string or null",
  "documentNumber": "DR/PO/invoice number or null",
  "items": [
    {
      "name": "exact item name as written",
      "quantity": 1.5,
      "unit": "unit of measure (e.g. kg, bottle, box, pcs, case, sack, liter)",
      "unitPrice": 150.50,
      "confidence": "high|medium|low",
      "rawText": "the raw text you found this in"
    }
  ]
}

Rules:
- Extract ALL line items you see, even if confidence is low
- For quantity, use decimals if needed (e.g. 2.5 kg)
- For unit, use the shortest common form: kg, g, liter, ml, bottle, box, case, pcs, sack, dozen, pack
- Extract unitPrice if visible on the document. If not, use 0 or null.
- If quantity is unclear, use 1 and set confidence to "low"
- Include items even if you can't read the full name - use what you can see
- DO NOT include non-inventory lines (like tax rows, subtotals, grand totals)
- Return ONLY the JSON, no other text`;

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType,
                                data: base64Data
                            }
                        },
                        { text: prompt }
                    ]
                }
            ]
        });

        const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse JSON from response
        try {
            // Remove any markdown code block wrappers if present
            const jsonText = rawText
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();

            const parsed = JSON.parse(jsonText);

            return {
                documentType: parsed.documentType || 'unknown',
                supplierName: parsed.supplierName || undefined,
                documentDate: parsed.documentDate || undefined,
                documentNumber: parsed.documentNumber || undefined,
                items: (parsed.items || []).map((item: Partial<ExtractedItem>) => ({
                    name: item.name || 'Unknown Item',
                    quantity: typeof item.quantity === 'number' ? item.quantity : 1,
                    unit: item.unit || 'pcs',
                    unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : undefined,
                    confidence: (['high', 'medium', 'low'].includes(item.confidence as string)
                        ? item.confidence
                        : 'medium') as 'high' | 'medium' | 'low',
                    rawText: item.rawText
                })),
                rawResponse: rawText
            };
        } catch {
            console.error('[GeminiVisionService] Failed to parse JSON:', rawText);
            throw new Error('AI could not parse the document. Please ensure the image is clear and try again.');
        }
    }
}
