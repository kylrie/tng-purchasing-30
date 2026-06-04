import { GoogleGenAI } from "@google/genai";

/**
 * SECURITY WARNING (Issue C1):
 * The Gemini API key is exposed in client-side code. While this works, it's a security risk.
 * API keys can be extracted from browser DevTools, leading to unauthorized usage.
 * 
 * RECOMMENDED: Move these AI calls to a Firebase Cloud Function or backend proxy.
 * Example Cloud Function endpoint: /api/gemini/insight
 * 
 * For now, ensure your API key has appropriate restrictions:
 * 1. Set HTTP referrer restrictions in Google Cloud Console
 * 2. Use API quota limits
 * 3. Monitor usage for anomalies
 */

export const generateProcurementInsight = async (
    promptContext: string
): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        return "API Key is missing. Please provide a valid API Key to generate insights.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const systemInstruction = `You are an expert procurement and supply chain analyst. 
    Analyze the provided JSON data which includes procurement requisitions.
    
    Terminology:
    - BURF: Business Unit Requisition Form (Initial Request)
    - PRF: Purchase Requisition Form (Finalized Request with Price/Supplier)
    
    Your goal is to provide an executive summary for the current user based on their role.
    - Highlight any BURFs pending Manager or CIC approval.
    - Highlight any PRFs pending final Manager approval.
    - Identify bottlenecks in the approval process based on status counts.
    
    Keep the response concise (under 150 words), professional, and actionable. Use bullet points for clarity.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this procurement data: ${promptContext}`,
            config: {
                systemInstruction: systemInstruction,
                thinkingConfig: { thinkingBudget: -1 }
            }
        });

        return response.text || "No insights generated.";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Failed to generate insights at this time. Please try again later.";
    }
};

export const estimateItemCost = async (itemName: string): Promise<number> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("API Key missing for cost estimation");
        return 0;
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `Estimate the average market price in Philippine Peso (PHP) for this item: "${itemName}". 
    Return ONLY the number (numeric value), no currency symbol, no text. 
    If uncertain, provide a conservative estimate for a business context. 
    Example output: 1500`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: -1 }
            }
        });

        const text = response.text || "0";
        const match = text.match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[0]) : 0;
    } catch (error) {
        console.error("Gemini Cost Est Error:", error);
        return 0;
    }
};
