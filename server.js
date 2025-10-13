import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import os from "os";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "20mb" }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Route test
app.get("/", (req, res) => res.send("Gemini local server is running!"));

// Lightweight connectivity check: returns a simple JSON to verify client -> server
app.get('/ping', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// Test POST endpoint that echoes body so client can verify request reaches server
app.post('/parse-test', (req, res) => {
  console.log('[/parse-test] incoming body:', req.body);
  res.json({ ok: true, echo: req.body });
});

// Route chính để parse OCR text hoặc ảnh
app.post("/parse", async (req, res) => {
  try {
    const { ocrText, imageBase64, mimeType = "image/jpeg" } = req.body;
    // Log incoming request body to help debugging network issues
    console.log('[/parse] incoming body:', { ocrText: ocrText ? `${String(ocrText).slice(0,200)}${String(ocrText).length > 200 ? '...':''}` : undefined, hasImage: !!imageBase64 });

    const contents = [{ role: "user", parts: [{ text: buildPrompt() }] }];
    if (ocrText) contents[0].parts.push({ text: `OCR:\n${ocrText}` });
    if (imageBase64)
      contents[0].parts.push({
        inlineData: { mimeType, data: imageBase64 },
      });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING },
            total: { type: Type.NUMBER },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  category: {
                    type: Type.STRING,
                    enum: [
                      "Food",
                      "Transport",
                      "Utilities",
                      "Shopping",
                      "Health",
                      "Education",
                      "Other",
                    ],
                  },
                },
              },
            },
          },
        },
      },
    });

    // response may contain parsed object or a text string. Parse safely.
    let data;
    if (response && response.parsed) {
      data = response.parsed;
    } else if (response && typeof response.text === 'string') {
      try {
        data = JSON.parse(response.text);
      } catch (parseErr) {
        console.error('Failed to JSON.parse response.text:', parseErr);
        console.error('Raw response:', response);
        // Fallback to return the raw response so client can inspect
        data = { raw: response };
      }
    } else {
      // If neither parsed nor text exists, return the response object as-is
      data = response ?? { message: 'No response from model' };
    }

    res.json(data);
  } catch (err) {
    console.error('Error in /parse handler:', err);
    // Provide more context in the error response to help debugging locally
    res.status(500).json({ error: 'Gemini error', detail: err?.message ?? String(err), stack: err?.stack });
  }
});

function buildPrompt() {
  return `Extract structured data (merchant, total, items, categories) from the given receipt text or image. Return JSON only.`;
}

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
  try {
    const ifaces = os.networkInterfaces();
    console.log('Network interfaces (IPv4):');
    Object.keys(ifaces).forEach((name) => {
      ifaces[name]
        .filter((i) => i.family === 'IPv4')
        .forEach((i) => console.log(` - ${name}: ${i.address}`));
    });
  } catch (e) {
    console.warn('Failed to list network interfaces', e);
  }
});
