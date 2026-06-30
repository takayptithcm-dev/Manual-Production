import { GoogleGenAI, Type } from "@google/genai";
import { ProductionManual } from "../types";
import { STANDARD_MATERIALS } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const sendChatMessage = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  knowledgeBase: string
) => {
  const contents = [...history, { role: "user", parts: [{ text: message }] }];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction:
          "Bạn là một trợ lý ảo chuyên gia về Thiết kế và Thi công Gian hàng Triển lãm (Exhibition Booth). Nhiệm vụ của bạn là giải đáp các thắc mắc của người dùng về vật liệu, quy cách thi công, an toàn lao động, và các vấn đề liên quan đến sản xuất booth. Hãy trả lời ngắn gọn, súc tích, chuyên nghiệp và dễ hiểu bằng tiếng Việt.\n\nDưới đây là TÀI LIỆU QUY CÁCH SẢN XUẤT TIÊU CHUẨN của công ty. Hãy dựa vào đây để trả lời càng chính xác càng tốt nếu người dùng hỏi về kiến thức liên quan:\n" + knowledgeBase,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Error in chat:", error);
    throw new Error("Không thể gửi tin nhắn. Vui lòng thử lại.");
  }
};

export const generateProductionManual = async (
  renderImagesBase64: string[],
  techDrawingsBase64: string[],
  environment: "indoor" | "outdoor",
  standardMaterials: string[],
  knowledgeBase: string
): Promise<ProductionManual> => {
  const parts: any[] = [];

  renderImagesBase64.forEach((img) => {
    const mimeType = img.substring(img.indexOf(":") + 1, img.indexOf(";"));
    const data = img.split(",")[1];
    parts.push({
      inlineData: {
        data: data,
        mimeType: mimeType,
      },
    });
  });

  techDrawingsBase64.forEach((img) => {
    const mimeType = img.substring(img.indexOf(":") + 1, img.indexOf(";"));
    const data = img.split(",")[1];
    parts.push({
      inlineData: {
        data: data,
        mimeType: mimeType,
      },
    });
  });

  const prompt = `
    Bạn là một chuyên gia Thiết kế Booth Sự Kiện và Thi công Triển lãm (Exhibition Design & Production).
    Tôi đang cần bóc tách bản vẽ sản xuất cho một gian hàng triển lãm.
    Môi trường thi công: ${environment === "indoor" ? "Trong nhà (Indoor)" : "Ngoài trời (Outdoor)"}.
    
    Hãy phân tích hình ảnh Render 3D (và bản vẽ kỹ thuật nếu có) để tạo ra một Production Manual chi tiết.
    
    KIẾN THỨC NỀN TẢNG (CHUYÊN MÔN SẢN XUẤT):
    Hãy tham khảo Quy cách sản xuất chi tiết dưới đây để quyết định vật liệu, phương pháp thi công, và TÓM TẮT lại thành "Quy cách sản xuất tiêu chuẩn" cho phần \`technicalSpecifications\`. Chỉ liệt kê những hạng mục CÓ XUẤT HIỆN HOẶC LIÊN QUAN chặt chẽ đến gian hàng trong ảnh render, lược bỏ những thứ không cần thiết.
    
    """
${knowledgeBase}
    """
    
    Yêu cầu trả về JSON với cấu trúc sau:
    {
      "annotations": [
        {
          "id": "chuỗi ngẫu nhiên duy nhất",
          "x": số từ 0 đến 100 (tọa độ X trên ảnh render, ví dụ 20 cho 20%),
          "y": số từ 0 đến 100 (tọa độ Y trên ảnh render, ví dụ 50 cho 50%),
          "label": "Tên hạng mục ngắn gọn (VD: Vách logo, Quầy tiếp tân)",
          "description": "Mô tả chi tiết quy cách sản xuất (vật liệu, độ dày, cách ghép nối, sơn phủ...)",
          "material": "Vật liệu đề xuất",
          "spec": "Kích thước Dài x Cao x Sâu (VD: 3000W x 2400H x 500D) trích xuất từ bản vẽ hoặc ước lượng",
          "note": "Ghi chú thi công",
          "quantity": 1
        }
      ],
      "technicalSpecifications": "Bản TÓM TẮT các Quy cách sản xuất tiêu chuẩn (từ kiến thức ở trên) ÁP DỤNG TRỰC TIẾP cho các hạng mục có trong bản vẽ của gian hàng này. Hãy soạn thảo như một tài liệu hướng dẫn chuyên nghiệp cho xưởng và vendor thi công.",
      "generalNotes": "Các lưu ý chung về thi công, an toàn, và lắp đặt dựa trên môi trường ${environment}."
    }
    
    Lưu ý quan trọng: 
    - Tọa độ x, y nên phân bổ hợp lý trên các hạng mục chính trong ảnh render.
    - LƯU Ý VỀ QUY CÁCH VÀ VẬT LIỆU: Hãy tham chiếu danh sách "Thư viện Vật liệu chuẩn" của người dùng dưới đây để hiểu về phong cách, cách gọi tên và các quy chuẩn thi công mà họ thường sử dụng. Hãy dùng danh sách này làm CƠ SỞ ĐỂ SUY LUẬN và viết ra mô tả quy cách (description) cho linh hoạt, tự nhiên và phù hợp với từng hạng mục cụ thể trong ảnh, KHÔNG CẦN copy y nguyên 100% nếu nó không hoàn toàn khớp với bối cảnh:
      ${standardMaterials.join("\n      - ")}
    - Ưu tiên sử dụng chính xác các thuật ngữ "ván MDF hoàn thiện dán Decal" và "Fomex cắt CNC hoàn thiện dán Decal" thay vì dùng các từ như mdf sơn, decal bồi.
    - Vật liệu đề xuất phải phù hợp với môi trường ${environment}.
    - RẤT QUAN TRỌNG: Nếu có Bản vẽ Kỹ thuật (Technical Drawings) kèm theo, hãy TÌM VÀ ĐỌC HẾT CÁC SỐ ĐO (kích thước) trên bản vẽ tương ứng với từng hạng mục, điền chính xác hệ số đo (Rộng x Cao x Sâu / WxHxD) vào trường "spec" tương ứng (Ví dụ: 2000W x 1500H). Nếu không có bản vẽ kích thước, hãy tự ước lượng theo ngữ cảnh mô hình.
  `;

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            annotations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  label: { type: Type.STRING },
                  description: { type: Type.STRING },
                  material: { type: Type.STRING },
                  spec: { type: Type.STRING },
                  note: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                },
                required: [
                  "id",
                  "x",
                  "y",
                  "label",
                  "description",
                  "material",
                  "spec",
                  "note",
                  "quantity",
                ],
              },
            },
            technicalSpecifications: { type: Type.STRING },
            generalNotes: { type: Type.STRING },
          },
          required: ["annotations", "technicalSpecifications", "generalNotes"],
        },
      },
    });

    const jsonStr = response.text?.trim() || "{}";
    return JSON.parse(jsonStr) as ProductionManual;
  } catch (error) {
    console.error("Error generating manual:", error);
    throw new Error("Không thể tạo manual. Vui lòng thử lại.");
  }
};
