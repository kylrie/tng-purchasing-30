import { GoogleGenAI } from '@google/genai';

// ============================================================
// TYPES
// ============================================================

export interface ExtractedItem {
    name: string;
    quantity: number;
    unit: string;
    unitPrice?: number;
    category?: string;
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
      "category": "category from allowed list",
      "confidence": "high|medium|low",
      "rawText": "the raw text you found this in"
    }
  ]
}

Allowed Categories: Spirits, Wine, Beer, Mixers, Beverage, Food, Frozen Good, Dry Goods, Equipment, Furniture, Supplies, Glassware, Souvenir, Other

Rules:
- Extract ALL line items you see, even if confidence is low
- For quantity, use decimals if needed (e.g. 2.5 kg)
- Only categorize as "Food" if the item is a prepared or finished meal. Raw ingredients and materials MUST be categorized as "Dry Goods" or "Frozen Good".
- For unit, use the shortest common form: kg, g, liter, ml, bottle, box, case, pcs, sack, dozen, pack
- Extract unitPrice if visible on the document. If not, use 0 or null.
- If quantity is unclear, use 1 and set confidence to "low"
- Include items even if you can't read the full name - use what you can see
- DO NOT include non-inventory lines (like tax rows, subtotals, grand totals)
- Return ONLY the JSON, no other text`;

        const response = await client.models.generateContent({
            model: 'gemini-3.5-flash',
            config: {
                thinkingConfig: { thinkingBudget: -1 }
            },
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
                    category: item.category,
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

    /**
     * Categorize a list of inventory item names with their types.
     */
    static async categorizeItems(itemsToCategorize: {name: string, type: string}[]): Promise<Record<string, string>> {
        if (itemsToCategorize.length === 0) return {};

        const client = this.getClient();
        
        const prompt = `You are an expert restaurant inventory manager.
Categorize the following list of inventory items into the most appropriate category based on their name and type (e.g. RAW_MATERIAL, FINISHED_GOOD).

Allowed Categories: Spirits, Wine, Beer, Mixers, Beverage, Food, Frozen Good, Dry Goods, Equipment, Furniture, Supplies, Glassware, Souvenir, Alcohol Beverage, Non Alcohol, Other

CRITICAL RULES:
1. The "Food" category should ONLY be used if the item type is FINISHED_GOOD. If the item type is RAW_MATERIAL, PRODUCTION, or anything else, food-related items MUST be categorized as "Dry Goods" or "Frozen Good", never "Food".
2. If the item type is FINISHED_GOOD, it MUST ONLY be categorized into one of these: "Food", "Souvenir", "Alcohol Beverage", or "Non Alcohol". Do not use any other categories (like Spirits, Wine, Beer, Beverage, etc.) for finished products.
3. If the item type is RAW_MATERIAL or PRODUCTION, use the old categories (Spirits, Wine, Beer, Mixers, Beverage, Equipment, Furniture, Supplies, Glassware, Other) as appropriate, but strictly follow Rule 1.

Items to categorize:
${JSON.stringify(itemsToCategorize)}

Return ONLY a JSON object where the key is the exact item name and the value is the category. Example:
{
  "Jameson Irish Whiskey": "Spirits",
  "Chicken wings": "Frozen Good",
  "Napkins": "Supplies"
}

Do not return any markdown code block wrappers or other text. ONLY the raw JSON object.`;

        const response = await client.models.generateContent({
            model: 'gemini-3.5-flash',
            config: {
                thinkingConfig: { thinkingBudget: -1 }
            },
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        
        try {
            const jsonText = rawText
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();
            
            return JSON.parse(jsonText);
        } catch {
            console.error('[GeminiVisionService] Failed to parse categorisation JSON:', rawText);
            return {};
        }
    }
}
