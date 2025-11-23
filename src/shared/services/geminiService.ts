import { GoogleGenAI } from "@google/genai";

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
            model: 'gemini-2.0-flash',
            contents: `Analyze this procurement data: ${promptContext}`,
            config: {
                systemInstruction: systemInstruction,
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
            model: 'gemini-2.0-flash',
            contents: prompt,
        });

        const text = response.text || "0";
        const match = text.match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[0]) : 0;
    } catch (error) {
        console.error("Gemini Cost Est Error:", error);
        return 0;
    }
};
