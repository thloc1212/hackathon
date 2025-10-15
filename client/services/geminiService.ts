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
    category: {
      type: Type.STRING,
      description: "The primary spending category for this entire transaction, determined by analyzing all items purchased. Choose the most dominant category. If unsure, try searching on the Internet what the brand is about. Choose 'Khác' when unknown.",
      enum: [
        "Ăn uống",
        "Di chuyển",
        "Mua sắm",
        "Giải trí",
        "Sức khỏe",
        "Giáo dục",
        "Khác",
      ],
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
            type: Type.NUMBER,
            description: "The quantity of the item purchased. Can be a decimal number (e.g., 1.5 kg). Default to 1 if not specified.",
          },
          price: {
            type: Type.NUMBER,
            description: "The price of a single unit of the item.",
          },
          category: {
            type: Type.STRING,
            description: "The category of this specific item. If unsure, try searching on the Internet what it is about. Choose 'Khác' when unknown.",
            enum: [
              "Ăn uống",
              "Di chuyển",
              "Mua sắm",
              "Giải trí",
              "Sức khỏe",
              "Giáo dục",
              "Khác",
            ],
          },
        },
        required: ["name", "price"],
      },
    },
  },
  required: ["total", "items"],
};

// Import the ReceiptInfo type from the centralized types
import { ReceiptInfo } from '@/types';

export async function parseReceipt(base64Image: string, mimeType: string): Promise<ReceiptInfo> {
  try {
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: `IMPORTANT: You MUST respond in Vietnamese. Use Vietnamese category names ONLY.

Phân tích hình ảnh hóa đơn và trích xuất thông tin:
1. Tên cửa hàng/doanh nghiệp, ngày tháng
2. Danh sách các mặt hàng đã mua với tên, số lượng và giá.
3. Với mỗi món hàng, xác định danh mục của nó
4. Xác định danh mục CHÍNH cho toàn bộ giao dịch:
   - Nếu hầu hết các món là đồ ăn/đồ uống → category: "Ăn uống" (NOT "Food")
   - Nếu liên quan đến vận chuyển/di chuyển → category: "Di chuyển" (NOT "Transport")
   - Nếu là mua sắm/bán lẻ → category: "Mua sắm" (NOT "Shopping")
   - Nếu là y tế/dược phẩm → category: "Sức khỏe" (NOT "Health")
   - Nếu là giáo dục → category: "Giáo dục" (NOT "Education")
   - Nếu là phim/game/giải trí → category: "Giải trí" (NOT "Entertainment")
   - Nếu không chắc chắn → category: "Khác" (NOT "Other")
   
CRITICAL: The category field MUST be one of these EXACT Vietnamese strings:
- "Ăn uống"
- "Di chuyển"
- "Mua sắm"
- "Giải trí"
- "Sức khỏe"
- "Giáo dục"
- "Khác"
CRITICAL:All the items MUST have a price field as a number. If the price is missing or not a number, GUESS the price based on the item name using your knowledge.
CRITICAL: The total field MUST be a number and MUST match the sum of all item prices. If the total is missing or not a number, CALCULATE it as the sum of all item prices.

DO NOT use English category names like "Food", "Transport", "Shopping", "Health", "Education", "Entertainment", or "Other".`,
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema,
      },
    });

    const jsonText = response.text?.trim() || '';
    console.log("[geminiService] Raw response text:", jsonText);
    if (!jsonText) {
      throw new Error("Empty response from Gemini API");
    }
    
    const parsedData = JSON.parse(jsonText);
    
    // Fallback: Convert English categories to Vietnamese if AI still returns English
    const categoryMap: Record<string, string> = {
      'Food': 'Ăn uống',
      'Transport': 'Di chuyển',
      'Shopping': 'Mua sắm',
      'Entertainment': 'Giải trí',
      'Health': 'Sức khỏe',
      'Education': 'Giáo dục',
      'Other': 'Khác',
      'Utilities': 'Khác'
    };
    
    // Convert overall category
    if (parsedData.category && categoryMap[parsedData.category]) {
      console.warn(`[geminiService] Converting English category "${parsedData.category}" to Vietnamese "${categoryMap[parsedData.category]}"`);
      parsedData.category = categoryMap[parsedData.category];
    }
    
    // Convert item categories
    if (Array.isArray(parsedData.items)) {
      parsedData.items.forEach((item: any) => {
        if (item.category && categoryMap[item.category]) {
          console.warn(`[geminiService] Converting item English category "${item.category}" to Vietnamese "${categoryMap[item.category]}"`);
          item.category = categoryMap[item.category];
        }
      });
    }
    
    // Basic validation to ensure the data shape matches the ReceiptInfo interface
    if (
        typeof parsedData.total === 'number' &&
        Array.isArray(parsedData.items) &&
        parsedData.items.every((item: any) => 
          typeof item.name === 'string' && 
          typeof item.price === 'number'
        )
    ) {
        // Ensure optional fields have proper types if they exist
        const result: ReceiptInfo = {
          total: parsedData.total,
          items: parsedData.items,
          merchant: typeof parsedData.merchant === 'string' ? parsedData.merchant : undefined,
          date: typeof parsedData.date === 'string' ? parsedData.date : undefined,
          category: typeof parsedData.category === 'string' ? parsedData.category : undefined,
        };
        return result;
    } else {
        throw new Error("Parsed data does not match the expected receipt structure.");
    }

  } catch (error) {
    console.error("Error parsing receipt with Gemini API:", error);
    throw new Error("Failed to analyze the receipt. Please try another image.");
  }
}