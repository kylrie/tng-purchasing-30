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

export interface ExtractedRecipeIngredient {
    name: string;
    quantity: number;
    unit: string;
}

export interface ExtractedRecipeResult {
    name: string;
    category: string;
    yieldQuantity: number;
    yieldUnit: string;
    procedure: string;
    ingredients: ExtractedRecipeIngredient[];
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

    /**
     * Automatically assign a Category and a Department (Bar, Kitchen, Retail) to a list of items based on their name and type.
     */
    static async organizeItems(itemsToOrganize: {name: string, type: string}[]): Promise<Record<string, {category: string, department: string}>> {
        if (itemsToOrganize.length === 0) return {};

        const client = this.getClient();
        
        const prompt = `You are an expert restaurant and bar inventory manager.
For each item in the following list, you must provide BOTH an appropriate Category and a logical Department based on its name and type.

Allowed Categories: Spirits, Wine, Beer, Mixers, Beverage, Food, Frozen Good, Dry Goods, Equipment, Furniture, Supplies, Glassware, Souvenir, Alcohol Beverage, Non Alcohol, Other
Allowed Departments: Bar, Kitchen, Retail, Office

CRITICAL CATEGORY RULES:
1. The "Food" category should ONLY be used if the item type is FINISHED_GOOD. If the item type is RAW_MATERIAL, PRODUCTION, or anything else, food-related items MUST be categorized as "Dry Goods" or "Frozen Good", never "Food".
2. If the item type is FINISHED_GOOD, it MUST ONLY be categorized into one of these: "Food", "Souvenir", "Alcohol Beverage", or "Non Alcohol".
3. If the item type is RAW_MATERIAL or PRODUCTION, use the old categories (Spirits, Wine, Beer, Mixers, Beverage, Equipment, Furniture, Supplies, Glassware, Other) as appropriate, but strictly follow Rule 1.

CRITICAL DEPARTMENT RULES:
1. "Bar" should contain items related to beverages (alcoholic or non-alcoholic), drink mixers, glassware, and bar equipment. Categories like Spirits, Wine, Beer, Mixers, Beverage usually belong here.
2. "Kitchen" should contain items related to food production, cooking, ingredients, kitchen equipment. Categories like Food, Frozen Good, Dry Goods usually belong here.
3. "Retail" should contain items intended for direct sale as merchandise or pre-packaged goods that aren't prepared in-house (e.g., Souvenirs).
4. "Office" should contain items used for administrative, back-office, and general business operations (e.g., office supplies, IT equipment, furniture).

Items to organize:
${JSON.stringify(itemsToOrganize)}

Return ONLY a JSON object where the key is the exact item name and the value is an object with "category" and "department" keys. Example:
{
  "Jameson Irish Whiskey": { "category": "Spirits", "department": "Bar" },
  "Chicken wings": { "category": "Frozen Good", "department": "Kitchen" },
  "T-Shirt Logo": { "category": "Souvenir", "department": "Retail" },
  "Napkins": { "category": "Supplies", "department": "Kitchen" }
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
            console.error('[GeminiVisionService] Failed to parse organize items JSON:', rawText);
            return {};
        }
    }

    /**
     * Extract recipe details from a document (PDF or Image).
     * Used for Smart Reading Recipes.
     */
    static async extractRecipeFromDocument(file: File): Promise<ExtractedRecipeResult> {
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

        const prompt = `You are an expert at reading culinary recipes for a restaurant system.
Analyze this recipe document and extract the relevant details.

Return ONLY a valid JSON object with this exact structure:

{
  "name": "Recipe Name",
  "category": "Main Course", // Guess a category if not explicitly stated, like Appetizer, Main Course, Dessert, Beverage, Condiment, Other
  "yieldQuantity": 30, // The numerical yield amount
  "yieldUnit": "orders", // The unit of the yield
  "procedure": "1. Step one...\\n2. Step two...", // Combine all steps into a single string with newlines
  "ingredients": [
    {
      "name": "Exact ingredient name",
      "quantity": 1.5,
      "unit": "unit (e.g. kg, g, liter, ml, pcs, tbsp, tsp, cup)"
    }
  ]
}

Only output valid JSON. Do not use markdown blocks like \`\`\`json.`;

        try {
            const response = await client.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt },
                            { inlineData: { data: base64Data, mimeType } }
                        ]
                    }
                ]
            });

            let rawText = response.text || '';
            
            // Clean up markdown code blocks if Gemini accidentally included them
            rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

            try {
                const parsed = JSON.parse(rawText) as ExtractedRecipeResult;
                return parsed;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (parseError) {
                console.error('[GeminiVisionService] Failed to parse recipe JSON:', rawText);
                throw new Error('Could not understand the AI response. Please try again or use a clearer document.');
            }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error('[GeminiVisionService] Error extracting recipe:', error);
            throw new Error('Failed to analyze the recipe document. Ensure your API key is valid and the file is legible.');
        }
    }

    /**
     * Extracts physical counts from a CSV or raw text string 
     * by matching names to the provided inventory items.
     * Returns a map of inventoryItemId -> newCount.
     */
    static async extractManualCounts(fileText: string, availableItems: {id: string, name: string, recipeUnit: string, buyUnit: string, conversion: number}[]): Promise<Record<string, number>> {
        if (!fileText || availableItems.length === 0) return {};

        const client = this.getClient();
        
        // Trim filetext to avoid incredibly massive prompts if the file is insanely huge. 
        // 50,000 characters is plenty for a CSV of this size.
        const trimmedText = fileText.substring(0, 50000);
        
        const prompt = `You are an expert inventory data entry assistant.
I have an unstructured text report (like a CSV or Excel dump) of manual inventory counts, and I have a list of my exact inventory items in the database.

Your task is to extract the quantities for each item found in the report, match them to the EXACT 'id' of my database items, and CONVERT the counted quantity into the item's FULL 'buyUnit' if necessary.

Here is the list of my database items with their units:
${JSON.stringify(availableItems)}

Here is the unstructured manual count report:
${trimmedText}

Instructions:
1. Carefully read the report and look for item names and their counted quantities. Often, the quantity is under a column like "IN", "TOTAL COUNT", "BEG", or just a number next to the item name. The report may also specify the Unit of Measure (UM) used for the count (e.g. "G", "KG", "PCS").
2. For every item you find in the report, fuzzy-match its name to the closest matching "name" in my database items list.
3. If you find a solid match, extract the counted quantity as a number, AND note the unit it was counted in from the report.
4. IMPORTANT: You MUST convert the counted quantity into the item's 'buyUnit'. 
   - If the report's counted unit matches the 'buyUnit' (e.g. both are KG, or both are PCS), no conversion is needed.
   - If the report's counted unit matches the 'recipeUnit' (e.g. counted in G, but buyUnit is KG), you MUST divide the counted quantity by the 'conversion' factor to get the quantity in 'buyUnit'. (For example, if they counted 170 G, and conversion is 1000, return 0.17).
   - If no unit is specified in the report, assume they counted in the item's 'buyUnit'.
5. Return ONLY a JSON object where the key is the database item "id" and the value is the final converted numeric quantity in the 'buyUnit'.

Example Output:
{
  "item_id_123": 45.5,
  "item_id_456": 0.17
}

Do not return any markdown code block wrappers or other text. ONLY the raw JSON object.`;

        let rawText = '';
        try {
            const response = await client.models.generateContent({
                model: 'gemini-3.5-flash',
                config: {
                    temperature: 0.1,
                    thinkingConfig: { thinkingBudget: -1 }
                },
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });

            rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            
            // Robustly extract the JSON object from anywhere in the text
            const match = rawText.match(/\{[\s\S]*\}/);
            const jsonText = match ? match[0] : '{}';
                
            return JSON.parse(jsonText);
        } catch (error) {
            console.error('[GeminiVisionService] Failed to extract manual counts:', error);
            console.error('Raw Gemini Response:', rawText);
            return {};
        }
    }
}
