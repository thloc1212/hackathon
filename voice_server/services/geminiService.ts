
import { GoogleGenAI, Type } from "@google/genai";
import { Receipt } from '../types';

const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    merchant_name: {
      type: Type.STRING,
      description: "Tên của cửa hàng hoặc người bán.",
    },
    transaction_date: {
      type: Type.STRING,
      description: "Ngày giao dịch theo định dạng YYYY-MM-DD.",
    },
    items: {
      type: Type.ARRAY,
      description: "Danh sách các mặt hàng đã mua.",
      items: {
        type: Type.OBJECT,
        properties: {
          description: {
            type: Type.STRING,
            description: "Tên hoặc mô tả của mặt hàng.",
          },
          quantity: {
            type: Type.INTEGER,
            description: "Số lượng mặt hàng đã mua.",
          },
          price: {
            type: Type.NUMBER,
            description: "Đơn giá của một mặt hàng.",
          },
        },
        required: ["description", "quantity", "price"],
      },
    },
    total_amount: {
      type: Type.NUMBER,
      description: "Tổng số tiền của giao dịch.",
    },
  },
  required: ["merchant_name", "transaction_date", "items", "total_amount"],
};

export const generateReceiptJson = async (transcript: string): Promise<Receipt> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Bạn là một AI chuyên gia xử lý hóa đơn. Nhiệm vụ của bạn là phân tích bản ghi giọng nói của người dùng mô tả các mặt hàng đã mua và chuyển đổi nó thành một đối tượng JSON có cấu trúc tuân thủ lược đồ được cung cấp.

    - Suy ra tên cửa hàng, ngày tháng, các mặt hàng và tổng tiền.
    - Nếu ngày không được chỉ định, hãy sử dụng ngày hôm nay.
    - Tính tổng số tiền nếu nó không được đề cập rõ ràng bằng cách cộng giá các mặt hàng (số lượng * đơn giá).
    - Đảm bảo tất cả các giá trị tiền tệ là số.

    Bản ghi:
    "${transcript}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema,
      },
    });

    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);
    return parsedJson as Receipt;

  } catch (error) {
    console.error("Error generating receipt from Gemini API:", error);
    throw new Error("Tạo hóa đơn thất bại. Mô hình có thể đã trả về định dạng không hợp lệ.");
  }
};
