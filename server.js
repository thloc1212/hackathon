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

// Logging middleware - logs all requests and responses
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log incoming request
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  if (req.body && Object.keys(req.body).length > 0) {
    // For large bodies like images, just log a summary
    if (req.body.imageBase64) {
      console.log('Body:', {
        ...req.body,
        imageBase64: `[IMAGE DATA: ${req.body.imageBase64.length} characters]`
      });
    } else {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
  }

  // Capture original json method to log responses
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    console.log(`\n[${new Date().toISOString()}] Response ${res.statusCode} for ${req.method} ${req.url} (${duration}ms)`);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    console.log('--- End Response ---\n');
    return originalJson.call(this, data);
  };

  next();
});

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

// Update user profile (protected route)
app.put('/auth/profile', async (req, res) => {
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

    // Extract profile fields from request
    const { name, bio, avatarUri, dateOfBirth } = req.body;

    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUri !== undefined) updateData.avatarUri = avatarUri;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;

    // Update user
    const updatedUser = await database.updateUser(session.userId, updateData);

    // Remove password from response
    const { password: _, ...userResponse } = updatedUser;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Transaction Routes

// Middleware to verify session for protected routes
const verifySession = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authorization header required' 
      });
    }

    const sessionId = authHeader.replace('Bearer ', '');
    const session = await database.findSessionById(sessionId);
    
    if (!session || new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({ 
        error: 'Invalid or expired session' 
      });
    }

    const user = await database.findUserById(session.userId);
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found' 
      });
    }

    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
};

// Create transaction
app.post('/transactions', verifySession, async (req, res) => {
  try {
    const { amount, category, description, date, type, merchant, items } = req.body;

    // Validate required fields
    if (!amount || !category || !description || !type) {
      return res.status(400).json({ 
        error: 'Amount, category, description, and type are required' 
      });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ 
        error: 'Type must be either "income" or "expense"' 
      });
    }

    const transactionData = {
      userId: req.user.id,
      amount: parseFloat(amount),
      category,
      description,
      date: date || new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      type,
      merchant: merchant || null,
      items: items || []
    };

    const newTransaction = await database.createTransaction(transactionData);

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: newTransaction
    });

  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Get user transactions
app.get('/transactions', verifySession, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;

    const transactions = await database.findTransactionsByUserId(req.user.id, limit, offset);

    res.json({
      success: true,
      data: transactions,
      count: transactions.length
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Get user transaction statistics
app.get('/transactions/stats', verifySession, async (req, res) => {
  try {
    const stats = await database.getUserTransactionStats(req.user.id);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Get single transaction
app.get('/transactions/:id', verifySession, async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await database.findTransactionById(id);

    if (!transaction) {
      return res.status(404).json({ 
        error: 'Transaction not found' 
      });
    }

    // Check if transaction belongs to user
    if (transaction.userId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Access denied' 
      });
    }

    res.json({
      success: true,
      data: transaction
    });

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Update transaction
app.put('/transactions/:id', verifySession, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const transaction = await database.findTransactionById(id);
    if (!transaction) {
      return res.status(404).json({ 
        error: 'Transaction not found' 
      });
    }

    // Check if transaction belongs to user
    if (transaction.userId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Access denied' 
      });
    }

    // Validate type if provided
    if (updateData.type && !['income', 'expense'].includes(updateData.type)) {
      return res.status(400).json({ 
        error: 'Type must be either "income" or "expense"' 
      });
    }

    // Convert amount to number if provided
    if (updateData.amount !== undefined) {
      updateData.amount = parseFloat(updateData.amount);
    }

    const updatedTransaction = await database.updateTransaction(id, updateData);

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: updatedTransaction
    });

  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Delete transaction
app.delete('/transactions/:id', verifySession, async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await database.findTransactionById(id);

    if (!transaction) {
      return res.status(404).json({ 
        error: 'Transaction not found' 
      });
    }

    // Check if transaction belongs to user
    if (transaction.userId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Access denied' 
      });
    }

    await database.deleteTransaction(id);

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });

  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Get user budgets
app.get('/budgets', verifySession, async (req, res) => {
  try {
    const budgets = await database.getUserBudgets(req.user.id);

    res.json({
      success: true,
      data: budgets
    });

  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Update user budgets
app.put('/budgets', verifySession, async (req, res) => {
  try {
    const { budgets } = req.body;

    if (!budgets || typeof budgets !== 'object') {
      return res.status(400).json({ 
        error: 'Budgets must be an object with category names as keys and numbers as values' 
      });
    }

    // Validate all values are numbers
    for (const [category, budget] of Object.entries(budgets)) {
      if (typeof budget !== 'number' || budget < 0) {
        return res.status(400).json({ 
          error: `Budget for ${category} must be a positive number` 
        });
      }
    }

    const updatedBudgets = await database.updateUserBudgets(req.user.id, budgets);

    res.json({
      success: true,
      message: 'Budgets updated successfully',
      data: updatedBudgets
    });

  } catch (error) {
    console.error('Update budgets error:', error);
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
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
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
              },
            },
          },
          required: ["category"],
        },
      },
    });

    // response may contain parsed object or a text string. Parse safely.
    let data;
    if (response && response.parsed) {
      data = response.parsed;
      console.log('[/parse] Gemini response.parsed:', JSON.stringify(data, null, 2));
    } else if (response && typeof response.text === 'string') {
      try {
        data = JSON.parse(response.text);
        console.log('[/parse] Gemini response.text parsed:', JSON.stringify(data, null, 2));
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

    // Fallback: Convert English categories to Vietnamese if AI still returns English
    const categoryMap = {
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
    if (data.category && categoryMap[data.category]) {
      console.warn(`[/parse] Converting English category "${data.category}" to Vietnamese "${categoryMap[data.category]}"`);
      data.category = categoryMap[data.category];
    }
    
    // Convert item categories
    if (Array.isArray(data.items)) {
      data.items.forEach((item) => {
        if (item.category && categoryMap[item.category]) {
          console.warn(`[/parse] Converting item English category "${item.category}" to Vietnamese "${categoryMap[item.category]}"`);
          item.category = categoryMap[item.category];
        }
      });
    }

    // Ensure category field exists in response
    if (!data.category && data.items && data.items.length > 0) {
      console.warn('[/parse] WARNING: AI did not return overall category, will use item categories to determine');
      // Fallback: determine category from items if AI didn't provide one
      const categoryCounts = {};
      data.items.forEach((item) => {
        if (item.category) {
          categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
        }
      });
      // Pick the most frequent category
      const dominantCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Khác';
      data.category = dominantCategory;
      console.log('[/parse] Auto-determined category from items:', dominantCategory);
    }

    console.log('[/parse] Final response being sent to client:', JSON.stringify(data, null, 2));
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
  return `IMPORTANT: You MUST respond in Vietnamese. Use Vietnamese category names ONLY.

Trích xuất dữ liệu có cấu trúc từ văn bản hoặc hình ảnh hóa đơn.
  
Hướng dẫn:
1. Trích xuất tên cửa hàng, tổng tiền và danh sách các mặt hàng với số tiền của chúng
2. Với mỗi món hàng, xác định danh mục của nó
3. Phân tích TẤT CẢ các món hàng để xác định danh mục CHÍNH cho toàn bộ giao dịch này:
   - Nếu hầu hết các món là đồ ăn/đồ uống → category: "Ăn uống" (NOT "Food")
   - Nếu các món liên quan đến vận chuyển/di chuyển → category: "Di chuyển" (NOT "Transport")
   - Nếu là mua sắm/bán lẻ → category: "Mua sắm" (NOT "Shopping")
   - Nếu là y tế/dược phẩm → category: "Sức khỏe" (NOT "Health")
   - Nếu là giáo dục → category: "Giáo dục" (NOT "Education")
   - Nếu là phim/game/giải trí → category: "Giải trí" (NOT "Entertainment")
   - Nếu không chắc chắn → category: "Khác" (NOT "Other")
4. Trả về JSON với merchant, total, category (cho toàn bộ giao dịch), và items array (mỗi món có description, amount, category)

CRITICAL: The category field MUST be one of these EXACT Vietnamese strings:
- "Ăn uống"
- "Di chuyển"
- "Mua sắm"
- "Giải trí"
- "Sức khỏe"
- "Giáo dục"
- "Khác"

DO NOT use English category names like "Food", "Transport", "Shopping", "Health", "Education", "Entertainment", or "Other".`;
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
