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
import { ReceiptInfo, Subscription } from '@/types';

interface SubscriptionDetectionResult {
  isSubscriptionPayment: boolean;
  isNewSubscription: boolean;
  isInstallmentPlan: boolean; // New: for installment payment plans
  subscriptionName?: string;
  amount?: number;
  category?: string;
  description?: string;
  duration?: number; // Duration in months extracted from text
  confidence?: number; // Confidence level (0-100)
  totalAmount?: number; // Total amount for installment plans
  paidAmount?: number; // Amount already paid for installment plans
  remainingAmount?: number; // Remaining amount to pay
}

const subscriptionSchema = {
  type: Type.OBJECT,
  properties: {
    isSubscriptionPayment: {
      type: Type.BOOLEAN,
      description: "Whether the text indicates a payment for an existing subscription service THIS MONTH.",
    },
    isNewSubscription: {
      type: Type.BOOLEAN,
      description: "Whether the text indicates creating/setting up a NEW subscription service.",
    },
    isInstallmentPlan: {
      type: Type.BOOLEAN,
      description: "Whether the text indicates a payment plan where user pays some amount upfront and will pay remaining in monthly installments.",
    },
    subscriptionName: {
      type: Type.STRING,
      description: "The name of the subscription service or item being purchased on installment.",
    },
    amount: {
      type: Type.NUMBER,
      description: "The monthly amount to be paid for subscription or installment.",
    },
    category: {
      type: Type.STRING,
      description: "The category of the subscription service or installment item. Choose the most appropriate one.",
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
    description: {
      type: Type.STRING,
      description: "A brief description of what this is for.",
    },
    duration: {
      type: Type.NUMBER,
      description: "Duration in months for subscription or installment plan.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confidence level from 0-100 on how certain you are about the classification.",
    },
    totalAmount: {
      type: Type.NUMBER,
      description: "Total amount for installment plans (upfront + remaining).",
    },
    paidAmount: {
      type: Type.NUMBER,
      description: "Amount already paid upfront for installment plans.",
    },
    remainingAmount: {
      type: Type.NUMBER,
      description: "Remaining amount to be paid in installments.",
    },
  },
  required: ["isSubscriptionPayment", "isNewSubscription", "isInstallmentPlan", "confidence"],
};

export async function detectSubscriptionPayment(inputText: string, activeSubscriptions: Subscription[] = []): Promise<SubscriptionDetectionResult> {
  try {
    // Build a list of active subscription names for context
    const subscriptionNames = activeSubscriptions
      .filter(sub => sub.isActive)
      .map(sub => sub.name)
      .join(', ');
    
    const subscriptionContext = activeSubscriptions.length > 0 
      ? `\n\nKhoảng trả hàng tháng hiện tại: ${subscriptionNames}`
      : '\n\nChưa có khoảng trả hàng tháng nào.';

    const prompt = `Phân tích văn bản và xác định loại:

Text: "${inputText}"${subscriptionContext}

🔴 THANH TOÁN DV HÀNG THÁNG (isSubscriptionPayment=true):
- CHỈ khi văn bản đề cập đến thanh toán cho MỘT TRONG CÁC DỊCH VỤ HIỆN TẠI: ${subscriptionNames || 'Không có'}
- Ví dụ: "Netflix tháng này", "Spotify bill", "thanh toán tháng này"
- QUAN TRỌNG: CHỈ trả về true nếu tên dịch vụ KHỚP với danh sách hiện tại

🟢 TẠO DV HÀNG THÁNG MỚI (isNewSubscription=true):
- "đăng ký Netflix 12 tháng", "gg one 50k/tháng, 12 tháng"
- Format: "[Dịch vụ] [Giá]/tháng, [Thời gian] tháng"

🔵 KẾ HOẠCH TRẢ GÓP (isInstallmentPlan=true):
- "laptop mới, đã trả 1tr, phải trả 13tr trong 12 tháng"
- Pattern: "[Sản phẩm], đã trả [số tiền], còn [số tiền] [thời gian] tháng"

⚫ KHÁC (tất cả false):
- Hóa đơn mua sắm, giao dịch thường

Danh mục: "Ăn uống", "Di chuyển", "Mua sắm", "Giải trí", "Sức khỏe", "Giáo dục", "Khác"

Trích xuất: tên, số tiền, thời gian, danh mục. Confidence 0-100.`;


    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: subscriptionSchema,
      },
    });

    const jsonText = response.text?.trim() || '';
    console.log("[geminiService] Subscription detection response:", jsonText);
    console.log("[geminiService] Input text was:", inputText);
    
    if (!jsonText) {
      return { isSubscriptionPayment: false, isNewSubscription: false, isInstallmentPlan: false, confidence: 0 };
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
    
    if (parsedData.category && categoryMap[parsedData.category]) {
      console.warn(`[geminiService] Converting English category "${parsedData.category}" to Vietnamese "${categoryMap[parsedData.category]}"`);
      parsedData.category = categoryMap[parsedData.category];
    }
    
    // Add confidence filtering - if confidence is too low, default to no detection
    const confidence = parsedData.confidence || 50;
    if (confidence < 60) {
      console.log(`[geminiService] Low confidence (${confidence}%), defaulting to no subscription detection`);
      return { isSubscriptionPayment: false, isNewSubscription: false, isInstallmentPlan: false, confidence };
    }
    
    // Additional validation for subscription payments - check if the detected name matches existing subscriptions
    if (parsedData.isSubscriptionPayment) {
      const detectedName = parsedData.subscriptionName?.toLowerCase() || '';
      const hasMatchingSubscription = activeSubscriptions.some(sub => 
        sub.isActive && (
          sub.name.toLowerCase().includes(detectedName) || 
          detectedName.includes(sub.name.toLowerCase())
        )
      );
      
      if (!hasMatchingSubscription && activeSubscriptions.length > 0) {
        console.log(`[geminiService] No matching active subscription found for "${parsedData.subscriptionName}", treating as regular transaction`);
        return { isSubscriptionPayment: false, isNewSubscription: false, isInstallmentPlan: false, confidence };
      }
    }
    
    return {
      isSubscriptionPayment: parsedData.isSubscriptionPayment || false,
      isNewSubscription: parsedData.isNewSubscription || false,
      isInstallmentPlan: parsedData.isInstallmentPlan || false,
      subscriptionName: parsedData.subscriptionName,
      amount: parsedData.amount,
      category: parsedData.category,
      description: parsedData.description,
      duration: parsedData.duration,
      confidence: confidence,
      totalAmount: parsedData.totalAmount,
      paidAmount: parsedData.paidAmount,
      remainingAmount: parsedData.remainingAmount,
    };

  } catch (error) {
    console.error("Error detecting subscription payment:", error);
    return { isSubscriptionPayment: false, isNewSubscription: false, isInstallmentPlan: false, confidence: 0 };
  }
}

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