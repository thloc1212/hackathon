import { GoogleGenAI, Type } from "@google/genai";

// Use API key from client env
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("EXPO_PUBLIC_GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    merchant: {
      type: Type.STRING,
      description: "The name of the store or vendor.",
    },
    date: {
      type: Type.STRING,
      description: "The date of the transaction.",
    },
    total: {
      type: Type.NUMBER,
      description: "The final total amount of the transaction.",
    },
    items: {
      type: Type.ARRAY,
      description: "A list of items purchased.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "The name of the item.",
          },
          quantity: {
            type: Type.INTEGER,
            description: "The quantity of the item purchased.",
          },
          price: {
            type: Type.NUMBER,
            description: "The price of a single unit of the item.",
          },
        },
        required: ["name", "quantity", "price"],
      },
    },
  },
  required: ["merchant", "date", "total", "items"],
};

// Add type for consistency with camera.tsx expected shape
export interface ReceiptInfo {
  merchant: string;
  date: string;
  total: number;
  items: Array<{
    name: string;
    price: number;
    quantity?: number;
  }>;
}

export async function parseReceipt(base64Image: string, mimeType: string): Promise<ReceiptInfo> {
  try {
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: "Analyze the receipt image and extract the merchant name, date, total amount, and list of purchased items including name, quantity, and price.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema,
      },
    });

    const jsonText = response.text.trim();
    const parsedData = JSON.parse(jsonText);
    
    // Basic validation to ensure the data shape matches the ReceiptInfo interface
    if (
        typeof parsedData.merchant === 'string' &&
        typeof parsedData.date === 'string' &&
        typeof parsedData.total === 'number' &&
        Array.isArray(parsedData.items)
    ) {
        return parsedData as ReceiptInfo;
    } else {
        throw new Error("Parsed data does not match the expected receipt structure.");
    }

  } catch (error) {
    console.error("Error parsing receipt with Gemini API:", error);
    throw new Error("Failed to analyze the receipt. Please try another image.");
  }
}