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
            type: Type.INTEGER,
            description: "The quantity of the item purchased.",
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
        required: ["name", "quantity", "price"],
      },
    },
  },
  required: ["merchant", "date", "total", "category", "items"],
};

// Add type for consistency with camera.tsx expected shape
export interface ReceiptInfo {
  merchant: string;
  date: string;
  total: number;
  category?: string;
  items: Array<{
    name: string;
    price: number;
    quantity?: number;
    category?: string;
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
      text: `IMPORTANT: You MUST respond in Vietnamese. Use Vietnamese category names ONLY.

Phân tích hình ảnh hóa đơn và trích xuất thông tin:
1. Tên cửa hàng/doanh nghiệp, ngày tháng, tổng tiền
2. Danh sách các mặt hàng đã mua với tên, số lượng và giá
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