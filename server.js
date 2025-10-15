import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import os from "os";
import { GoogleGenAI, Type } from "@google/genai";
import bcrypt from "bcryptjs";
import database from './lib/database.js';

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

// Authentication Routes

// Sign Up
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, dateOfBirth } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Check if user already exists
    const existingUser = await database.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        error: 'User with this email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await database.createUser({
      email,
      password: hashedPassword,
      dateOfBirth: dateOfBirth || null
    });

    // Remove password from response
    const { password: _, ...userResponse } = newUser;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Sign In
app.post('/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Find user by email
    const user = await database.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Create session
    const sessionExpiry = new Date();
    sessionExpiry.setDate(sessionExpiry.getDate() + 7); // 7 days

    const session = await database.createSession({
      userId: user.id,
      expiresAt: sessionExpiry.toISOString()
    });

    // Remove password from response
    const { password: _, ...userResponse } = user;

    res.json({
      success: true,
      message: 'Signed in successfully',
      user: userResponse,
      session: {
        id: session.id,
        expiresAt: session.expiresAt
      }
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Sign Out
app.post('/auth/signout', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (sessionId) {
      await database.deleteSession(sessionId);
    }

    res.json({
      success: true,
      message: 'Signed out successfully'
    });

  } catch (error) {
    console.error('Signout error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Verify Session (for protected routes)
app.post('/auth/verify', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(401).json({ 
        error: 'Session ID required' 
      });
    }

    // Find session
    const session = await database.findSessionById(sessionId);
    if (!session) {
      return res.status(401).json({ 
        error: 'Invalid session' 
      });
    }

    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      await database.deleteSession(sessionId);
      return res.status(401).json({ 
        error: 'Session expired' 
      });
    }

    // Find user
    const user = await database.findUserById(session.userId);
    if (!user) {
      await database.deleteSession(sessionId);
      return res.status(401).json({ 
        error: 'User not found' 
      });
    }

    // Remove password from response
    const { password: _, ...userResponse } = user;

    res.json({
      success: true,
      user: userResponse,
      session: {
        id: session.id,
        expiresAt: session.expiresAt
      }
    });

  } catch (error) {
    console.error('Verify session error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Get user profile (protected route)
app.get('/auth/profile', async (req, res) => {
  try {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionId) {
      return res.status(401).json({ 
        error: 'Authorization header required' 
      });
    }

    // Verify session
    const session = await database.findSessionById(sessionId);
    if (!session || new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({ 
        error: 'Invalid or expired session' 
      });
    }

    // Find user
    const user = await database.findUserById(session.userId);
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found' 
      });
    }

    // Remove password from response
    const { password: _, ...userResponse } = user;

    res.json({
      success: true,
      user: userResponse
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
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

// New endpoint: produce an insight text for a top spending category using Gemini
app.post('/insight', async (req, res) => {
  try {
    const { category, spent, percentage, totalSpent } = req.body || {};

    if (!category) {
      return res.status(400).json({ error: 'category required' });
    }

    const prompt = `You are a friendly personal finance assistant. Given the top spending category: ${category}, the amount spent: ${spent}, the share percentage: ${percentage} and total spent: ${totalSpent}, provide a short actionable saving tip in Vietnamese (2-3 sentences) and include a suggested monthly saving amount as a number. Return only plain text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'text/plain',
      },
    });

    // Prefer response.text, fallback to parsed
    const insightText = response?.text || (response?.parsed && JSON.stringify(response.parsed)) || 'No insight available';

    res.json({ insight: insightText });
  } catch (err) {
    console.error('Error in /insight handler:', err);
    res.status(500).json({ error: 'Insight generation failed', detail: err?.message ?? String(err) });
  }
});

function buildPrompt() {
  return `Extract structured data (merchant, total, items, categories) from the given receipt text or image. Return JSON only.`;
}

const PORT = process.env.PORT || 3001;
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
