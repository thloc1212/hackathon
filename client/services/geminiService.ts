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
    console.log('[geminiService] Processing image with MIME type:', mimeType);
    console.log('[geminiService] Base64 data length:', base64Image.length);
    
    // Ensure MIME type is supported by Gemini API
    let processedMimeType = mimeType;
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      // Gemini API supports HEIC, but let's log it for debugging
      console.log('[geminiService] Processing HEIC/HEIF image from iOS');
    } else if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(mimeType)) {
      // Default to JPEG for unknown types
      console.warn('[geminiService] Unknown MIME type, defaulting to image/jpeg:', mimeType);
      processedMimeType = 'image/jpeg';
    }
    
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: processedMimeType,
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
    
    // Provide more specific error messages for different scenarios
    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('limit')) {
        throw new Error("API quota exceeded. Please try again later.");
      } else if (error.message.includes('image') || error.message.includes('format')) {
        throw new Error("Image format not supported. Please try taking a new photo or selecting a different image.");
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        throw new Error("Network error. Please check your connection and try again.");
      }
    }
    
    throw new Error("Failed to analyze the receipt. Please try taking a clearer photo or try again.");
  }
}

// New function for voice-based receipt processing
export async function generateReceiptJson(transcript: string): Promise<any> {
  if (!transcript || transcript.trim() === '') {
    throw new Error("Không có văn bản để xử lý");
  }

  try {
    console.log('[geminiService] Processing voice transcript, length:', transcript.length);
    
    const prompt = `
    Bạn là một AI chuyên gia xử lý hóa đơn. Nhiệm vụ của bạn là phân tích bản ghi giọng nói của người dùng mô tả các mặt hàng đã mua và chuyển đổi nó thành một đối tượng JSON có cấu trúc.

    Phân tích văn bản sau đây về một hóa đơn:
    "${transcript}"

    CRITICAL: Your response MUST follow this EXACT schema:
    {
      "merchant": "tên cửa hàng/người bán",
      "date": "ngày giao dịch (YYYY-MM-DD)",
      "total": số tiền tổng (number),
      "category": "danh mục chính của giao dịch (một trong các giá trị: Ăn uống, Di chuyển, Mua sắm, Giải trí, Sức khỏe, Giáo dục, Khác)",
      "items": [
        {
          "name": "tên của mặt hàng",
          "price": giá của mặt hàng (number),
          "quantity": số lượng (number),
          "category": "danh mục của mặt hàng (một trong các giá trị: Ăn uống, Di chuyển, Mua sắm, Giải trí, Sức khỏe, Giáo dục, Khác)"
        }
      ]
    }

    Lưu ý:
    - Nếu ngày không được chỉ định, sử dụng ngày hôm nay.
    - Tính tổng số tiền nếu không được đề cập bằng cách cộng giá các mặt hàng (số lượng * đơn giá).
    - Đảm bảo tất cả các giá trị tiền tệ là số.
    - Các danh mục PHẢI là một trong các giá trị: "Ăn uống", "Di chuyển", "Mua sắm", "Giải trí", "Sức khỏe", "Giáo dục", "Khác"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema,
      },
    });

    const jsonText = response.text?.trim() || '';
    console.log("[geminiService] Raw voice response:", jsonText);
    if (!jsonText) {
      throw new Error("Không có phản hồi từ API");
    }
    
    const parsedJson = JSON.parse(jsonText);
    return parsedJson;

  } catch (error) {
    console.error("Error generating receipt from Gemini API:", error);
    throw new Error("Tạo hóa đơn thất bại. Vui lòng thử lại với lời nói rõ ràng hơn.");
  }
}