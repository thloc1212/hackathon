import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import os from "os";
import { GoogleGenAI, Type } from "@google/genai";
import bcrypt from "bcryptjs";
import database from './lib/database.js';
import emailService from './lib/emailService.js';

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

// Sign Up (Passwordless - no password required)
app.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, dateOfBirth } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ 
        error: 'Name and email are required' 
      });
    }

    // Validate name length
    if (name.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Name must be at least 2 characters long' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Please enter a valid email address' 
      });
    }

    // Check if user already exists
    const existingUser = await database.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        error: 'User with this email already exists' 
      });
    }

    // Create user without password
    const newUser = await database.createUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      dateOfBirth: dateOfBirth || null
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully. Please use the login page to request an OTP.',
      user: newUser
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Request OTP for Login
app.post('/auth/request-otp', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Please enter a valid email address' 
      });
    }

    // Check if user exists
    const user = await database.findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ 
        error: 'No account found with this email. Please sign up first.' 
      });
    }

    // Generate OTP
    const otp = emailService.generateOTP(8);

    // Save OTP to database
    await database.createOtp(email, otp);

    // Send OTP via email
    try {
      await emailService.sendOTP(email, otp);
      
      res.json({
        success: true,
        message: 'OTP has been sent to your email. Please check your inbox.'
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Delete the OTP since email failed to send
      const otpRecord = await database.findOtpByEmail(email);
      if (otpRecord) {
        await database.deleteOtp(otpRecord.id);
      }
      
      return res.status(500).json({ 
        error: 'Failed to send OTP email. Please check email configuration.',
        detail: emailError.message 
      });
    }

  } catch (error) {
    console.error('Request OTP error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Verify OTP and Login
app.post('/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate required fields
    if (!email || !otp) {
      return res.status(400).json({ 
        error: 'Email and OTP are required' 
      });
    }

    // Find OTP record
    const otpRecord = await database.findOtpByEmail(email);
    if (!otpRecord) {
      return res.status(401).json({ 
        error: 'Invalid or expired OTP. Please request a new one.' 
      });
    }

    // Verify OTP (case-insensitive)
    if (otpRecord.otp.toUpperCase() !== otp.toUpperCase().trim()) {
      return res.status(401).json({ 
        error: 'Invalid OTP. Please try again.' 
      });
    }

    // Find user
    const user = await database.findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    // Delete used OTP
    await database.deleteOtp(otpRecord.id);

    // Create session
    const sessionExpiry = new Date();
    sessionExpiry.setDate(sessionExpiry.getDate() + 7); // 7 days

    const session = await database.createSession({
      userId: user.id,
      expiresAt: sessionExpiry.toISOString()
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: user,
      session: {
        id: session.id,
        expiresAt: session.expiresAt
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Sign In (DEPRECATED - use request-otp and verify-otp instead)
app.post('/auth/signin', async (req, res) => {
  return res.status(410).json({ 
    error: 'Password-based login is no longer supported. Please use passwordless login with OTP.',
    message: 'Use /auth/request-otp to receive an OTP, then /auth/verify-otp to login.'
  });
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
    const month = req.query.month ? parseInt(req.query.month) : null;
    const year = req.query.year ? parseInt(req.query.year) : null;

    console.log('[GET /transactions] Raw query params:', req.query);
    console.log('[GET /transactions] Parsed filter params:', { month, year, limit, offset });

    const transactions = await database.findTransactionsByUserId(req.user.id, limit, offset, month, year);

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
    const month = req.query.month ? parseInt(req.query.month) : null;
    const year = req.query.year ? parseInt(req.query.year) : null;
    
    console.log('[GET /transactions/stats] Raw query params:', req.query);
    console.log('[GET /transactions/stats] Parsed filter params:', { month, year });
    
    const stats = await database.getUserTransactionStats(req.user.id, month, year);

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

// Subscription Routes

// Create subscription
app.post('/subscriptions', verifySession, async (req, res) => {
  try {
    const { name, description, pricePerMonth, totalMonths, category, startDate } = req.body;

    // Validate required fields
    if (!name || !pricePerMonth || !totalMonths || !category) {
      return res.status(400).json({ 
        error: 'name, pricePerMonth, totalMonths, and category are required' 
      });
    }

    if (pricePerMonth <= 0 || totalMonths <= 0) {
      return res.status(400).json({ 
        error: 'Price per month and total months must be positive numbers' 
      });
    }

    const subscriptionData = {
      userId: req.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      pricePerMonth: parseFloat(pricePerMonth),
      currentMonth: 1,
      totalMonths: parseInt(totalMonths),
      paidAmount: 0,
      category: category.trim(),
      startDate: startDate || new Date().toISOString().split('T')[0],
      nextPaymentDate: startDate || new Date().toISOString().split('T')[0],
      isActive: true
    };

    const newSubscription = await database.createSubscription(subscriptionData);

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: newSubscription
    });

  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Get user subscriptions
app.get('/subscriptions', verifySession, async (req, res) => {
  try {
    const subscriptions = await database.findSubscriptionsByUserId(req.user.id);

    res.json({
      success: true,
      data: subscriptions,
      count: subscriptions.length
    });

  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Get single subscription
app.get('/subscriptions/:id', verifySession, async (req, res) => {
  try {
    const { id } = req.params;
    const subscription = await database.findSubscriptionById(id);

    if (!subscription) {
      return res.status(404).json({ 
        error: 'Subscription not found' 
      });
    }

    // Check if subscription belongs to user
    if (subscription.userId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Access denied' 
      });
    }

    res.json({
      success: true,
      data: subscription
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Update subscription
app.put('/subscriptions/:id', verifySession, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const subscription = await database.findSubscriptionById(id);
    if (!subscription) {
      return res.status(404).json({ 
        error: 'Subscription not found' 
      });
    }

    // Check if subscription belongs to user
    if (subscription.userId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Access denied' 
      });
    }

    // Convert numeric fields if provided
    if (updateData.pricePerMonth !== undefined) {
      updateData.pricePerMonth = parseFloat(updateData.pricePerMonth);
    }
    if (updateData.totalMonths !== undefined) {
      updateData.totalMonths = parseInt(updateData.totalMonths);
    }
    if (updateData.currentMonth !== undefined) {
      updateData.currentMonth = parseInt(updateData.currentMonth);
    }
    if (updateData.paidAmount !== undefined) {
      updateData.paidAmount = parseFloat(updateData.paidAmount);
    }

    const updatedSubscription = await database.updateSubscription(id, updateData);

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: updatedSubscription
    });

  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Pay subscription (update subscription payment status)
app.post('/subscriptions/:id/pay', verifySession, async (req, res) => {
  try {
    const { id } = req.params;
    const subscription = await database.findSubscriptionById(id);

    if (!subscription) {
      return res.status(404).json({ 
        error: 'Subscription not found' 
      });
    }

    // Check if subscription belongs to user
    if (subscription.userId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Access denied' 
      });
    }

    // Update subscription payment
    const updatedSubscription = await database.updateSubscription(id, {
      paidAmount: subscription.paidAmount + subscription.pricePerMonth,
      currentMonth: Math.min(subscription.currentMonth + 1, subscription.totalMonths),
      // Update next payment date (add 1 month)
      nextPaymentDate: new Date(new Date(subscription.nextPaymentDate).setMonth(new Date(subscription.nextPaymentDate).getMonth() + 1)).toISOString().split('T')[0]
    });

    res.json({
      success: true,
      message: 'Subscription payment recorded successfully',
      data: updatedSubscription
    });

  } catch (error) {
    console.error('Pay subscription error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Delete subscription
app.delete('/subscriptions/:id', verifySession, async (req, res) => {
  try {
    const { id } = req.params;
    const subscription = await database.findSubscriptionById(id);

    if (!subscription) {
      return res.status(404).json({ 
        error: 'Subscription not found' 
      });
    }

    // Check if subscription belongs to user
    if (subscription.userId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Access denied' 
      });
    }

    await database.deleteSubscription(id);

    res.json({
      success: true,
      message: 'Subscription deleted successfully'
    });

  } catch (error) {
    console.error('Delete subscription error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
});

// Parse subscription via natural language
app.post('/subscriptions/parse', verifySession, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ 
        error: 'Text is required for subscription parsing' 
      });
    }

    const prompt = `Parse this subscription information into structured data. Return JSON only.

Text: "${text}"

Extract:
- name (subscription service name)
- pricePerMonth (monthly price as number)
- totalMonths (total subscription length in months)
- category (one of: Giải trí, Mua sắm, Sức khỏe, Giáo dục, Di chuyển, Ăn uống, Khác)
- startDate (YYYY-MM-DD format, today if not specified)
- description (optional description)

Category mapping guide:
- Entertainment/Gaming/Streaming services → "Giải trí"
- Shopping/E-commerce apps → "Mua sắm"  
- Health/Fitness apps → "Sức khỏe"
- Education/Learning apps → "Giáo dục"
- Transport/Travel apps → "Di chuyển"
- Food delivery services → "Ăn uống"
- All other services → "Khác"

Examples:
"Netflix 199k/month for 12 months" → {"name": "Netflix", "pricePerMonth": 199000, "totalMonths": 12, "category": "Giải trí", "startDate": "2025-10-20"}
"Spotify Premium 59k monthly, 6 months starting today" → {"name": "Spotify Premium", "pricePerMonth": 59000, "totalMonths": 6, "category": "Giải trí", "startDate": "2025-10-20"}

Return valid JSON object only:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            pricePerMonth: { type: Type.NUMBER },
            totalMonths: { type: Type.NUMBER },
            category: { 
              type: Type.STRING,
              enum: ["Giải trí", "Mua sắm", "Sức khỏe", "Giáo dục", "Di chuyển", "Ăn uống", "Khác"]
            },
            startDate: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["name", "pricePerMonth", "totalMonths", "category", "startDate"]
        }
      }
    });

    let parsedData;
    if (response && response.parsed) {
      parsedData = response.parsed;
    } else if (response && typeof response.text === 'string') {
      try {
        parsedData = JSON.parse(response.text);
      } catch (parseErr) {
        console.error('Failed to JSON.parse subscription response:', parseErr);
        return res.status(500).json({ error: 'Failed to parse subscription data' });
      }
    } else {
      return res.status(500).json({ error: 'No valid response from AI' });
    }

    res.json({
      success: true,
      data: parsedData
    });

  } catch (error) {
    console.error('Parse subscription error:', error);
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

// Helper function to detect subscription patterns
function detectSubscriptionPattern(text) {
  const subscriptionCreationKeywords = [
    'subscription', 'sub ', ' sub', 'đăng ký', 'gói cước', 'register for', 'sign up for',
    'monthly plan', 'yearly plan', 'premium plan', 'gói premium', 'gói cước',
    'for 12 months', 'for 6 months', 'trong', 'months', 'tháng',
    'monthly fee', 'phí hàng tháng', 'per month', '/tháng', '/month',
    'yearly', 'hàng năm', 'annual'
  ];
  
  // More specific subscription services when mentioned with creation context
  const subscriptionServices = [
    'netflix sub', 'spotify sub', 'youtube sub', 'yt sub', 'disney sub',
    'netflix subscription', 'spotify premium', 'youtube premium', 
    'office 365', 'adobe', 'canva pro', 'notion', 'figma',
    'gym membership', 'phòng tập'
  ];
  
  const paymentIndicators = [
    'tháng này', 'this month', 'thanh toán', 'trả tiền', 'pay ', 'payment',
    'đã trả', 'paid', 'bill', 'hóa đơn', 'invoice'
  ];
  
  const lowerText = text.toLowerCase().trim();
  
  // If it contains payment indicators, it's likely a payment, not subscription creation
  const hasPaymentIndicator = paymentIndicators.some(indicator => lowerText.includes(indicator));
  if (hasPaymentIndicator) {
    console.log(`[detectSubscriptionPattern] Text "${text}" contains payment indicators, not subscription creation`);
    return false;
  }
  
  // Check for subscription creation keywords or services with creation context
  const hasSubscriptionKeyword = subscriptionCreationKeywords.some(keyword => lowerText.includes(keyword));
  const hasSubscriptionService = subscriptionServices.some(service => lowerText.includes(service));
  
  // Additional pattern checks for subscription creation
  const hasNumericDuration = /\d+\s*(?:tháng|months?|years?|năm)/i.test(text);
  const hasMonthlyPattern = /\d+k?\s*\/?\s*(?:tháng|month|monthly)/i.test(text);
  
  const isSubscriptionCreation = hasSubscriptionKeyword || hasSubscriptionService || 
                                 (hasNumericDuration && hasMonthlyPattern);
  
  console.log(`[detectSubscriptionPattern] Text: "${text}", hasSubscriptionKeyword: ${hasSubscriptionKeyword}, hasSubscriptionService: ${hasSubscriptionService}, hasNumericDuration: ${hasNumericDuration}, hasMonthlyPattern: ${hasMonthlyPattern}, hasPaymentIndicator: ${hasPaymentIndicator}, result: ${isSubscriptionCreation}`);
  
  return isSubscriptionCreation && !hasPaymentIndicator;
}

// Helper function to detect subscription payment patterns
function detectSubscriptionPayment(text) {
  const paymentIndicators = [
    'tháng này', 'this month', 'thanh toán', 'trả tiền', 'pay ', 'payment ',
    'đã trả', 'paid', 'trả ', 'pay for', 'bill', 'hóa đơn', 'invoice'
  ];
  
  const subscriptionServices = [
    'netflix', 'spotify', 'youtube', 'disney', 'prime', 'office', 'adobe',
    'internet', 'điện thoại', 'phone', 'mobile', 'wifi', 'gym', 'phòng tập',
    'app store', 'google play', 'steam', 'gamepass', 'aws', 'cloud',
    'yt', 'fb', 'facebook', 'instagram', 'tiktok', 'zoom', 'canva',
    'dropbox', 'icloud', 'onedrive', 'figma', 'slack', 'notion',
    'amazon', 'hulu', 'paramount', 'hbo', 'max', 'apple music',
    'google one', 'microsoft 365', 'creative cloud'
  ];
  
  const lowerText = text.toLowerCase().trim();
  
  // Check if it contains both a subscription service and payment indicator
  const hasService = subscriptionServices.some(service => lowerText.includes(service));
  const hasPayment = paymentIndicators.some(indicator => lowerText.includes(indicator));
  
  // Additional checks for common patterns
  const isPaymentPattern = hasService && hasPayment;
  
  // Check for patterns like "netflix 100k", "spotify premium payment", etc.
  const hasMoneyPattern = /\d+[k|K]|\d+\.\d+|\d+,\d+|\d+ ?(?:đ|vnd|usd|dollar)/i.test(lowerText);
  
  // Be more specific: service + money pattern + no subscription creation indicators
  const subscriptionCreationWords = ['sub ', ' sub', 'subscription', 'đăng ký', 'register', 'sign up'];
  const hasCreationWords = subscriptionCreationWords.some(word => lowerText.includes(word));
  
  const isServiceWithMoneyPayment = hasService && hasMoneyPattern && !hasCreationWords;
  
  console.log(`[detectSubscriptionPayment] Text: "${text}", hasService: ${hasService}, hasPayment: ${hasPayment}, hasMoneyPattern: ${hasMoneyPattern}, hasCreationWords: ${hasCreationWords}, result: ${isPaymentPattern || isServiceWithMoneyPayment}`);
  
  return isPaymentPattern || isServiceWithMoneyPayment;
}

// Helper function to handle subscription payment parsing
async function handleSubscriptionPayment(req, res) {
  try {
    const { ocrText } = req.body;
    
    const prompt = `Parse this subscription payment information. Return JSON only.

Text: "${ocrText}"

This appears to be a subscription payment. Extract:
- serviceName (subscription service being paid for)
- amount (payment amount, estimate if not specified)
- category (one of: Giải trí, Mua sắm, Sức khỏe, Giáo dục, Di chuyển, Ăn uống, Khác)
- description (payment description)

Category mapping guide:
- Entertainment/Gaming/Streaming services → "Giải trí"
- Shopping/E-commerce apps → "Mua sắm"  
- Health/Fitness apps → "Sức khỏe"
- Education/Learning apps → "Giáo dục"
- Transport/Travel apps → "Di chuyển"
- Food delivery services → "Ăn uống"
- All other services → "Khác"

Examples:
"Netflix tháng này" → {"serviceName": "Netflix", "amount": 199000, "category": "Giải trí", "description": "Thanh toán Netflix tháng này", "isSubscriptionPayment": true}
"Spotify this month" → {"serviceName": "Spotify Premium", "amount": 59000, "category": "Giải trí", "description": "Thanh toán Spotify this month", "isSubscriptionPayment": true}

Return valid JSON object with isSubscriptionPayment: true:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            serviceName: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { 
              type: Type.STRING,
              enum: ["Giải trí", "Mua sắm", "Sức khỏe", "Giáo dục", "Di chuyển", "Ăn uống", "Khác"]
            },
            description: { type: Type.STRING },
            isSubscriptionPayment: { type: Type.BOOLEAN }
          },
          required: ["serviceName", "amount", "category", "description", "isSubscriptionPayment"]
        }
      }
    });

    let parsedData;
    if (response && response.parsed) {
      parsedData = response.parsed;
    } else if (response && typeof response.text === 'string') {
      try {
        parsedData = JSON.parse(response.text);
      } catch (parseErr) {
        console.error('Failed to JSON.parse subscription payment response:', parseErr);
        return res.status(500).json({ error: 'Failed to parse subscription payment data' });
      }
    } else {
      return res.status(500).json({ error: 'No valid response from AI' });
    }

    // Ensure the isSubscriptionPayment flag is set
    parsedData.isSubscriptionPayment = true;

    console.log('[/parse] Subscription payment data being sent to client:', JSON.stringify(parsedData, null, 2));
    res.json(parsedData);
  } catch (error) {
    console.error('Subscription payment parsing error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
}
async function handleSubscriptionParsing(req, res) {
  try {
    const { ocrText } = req.body;
    
    const prompt = `Parse this subscription creation information into structured data. Return JSON only.

Text: "${ocrText}"

This is for CREATING A NEW SUBSCRIPTION (not a payment). Extract:
- name (subscription service name - infer full service name if abbreviated)
- pricePerMonth (estimated monthly price as number in VND if not specified)
- totalMonths (total subscription length in months, default to 12 if not specified)
- category (one of: Giải trí, Mua sắm, Sức khỏe, Giáo dục, Di chuyển, Ăn uống, Khác)
- startDate (YYYY-MM-DD format, today if not specified: ${new Date().toISOString().split('T')[0]})
- description (brief description of the subscription)

Category mapping guide:
- Entertainment/Gaming/Streaming services → "Giải trí"
- Shopping/E-commerce apps → "Mua sắm"  
- Health/Fitness apps → "Sức khỏe"
- Education/Learning apps → "Giáo dục"
- Transport/Travel apps → "Di chuyển"
- Food delivery services → "Ăn uống"
- All other services → "Khác"

Common service price estimates (VND):
- Netflix: 199000, Spotify: 59000, YouTube Premium: 79000, Disney+: 149000
- Office 365: 169000, Adobe: 499000, Canva Pro: 119000
- Gym membership: 500000, WiFi/Internet: 300000

Examples:
"Netflix subscription" → {"name": "Netflix", "pricePerMonth": 199000, "totalMonths": 12, "category": "Giải trí", "startDate": "${new Date().toISOString().split('T')[0]}", "description": "Netflix streaming subscription", "isSubscription": true}
"yt sub" → {"name": "YouTube Premium", "pricePerMonth": 79000, "totalMonths": 12, "category": "Giải trí", "startDate": "${new Date().toISOString().split('T')[0]}", "description": "YouTube Premium subscription", "isSubscription": true}
"Spotify Premium for 6 months" → {"name": "Spotify Premium", "pricePerMonth": 59000, "totalMonths": 6, "category": "Giải trí", "startDate": "${new Date().toISOString().split('T')[0]}", "description": "Spotify Premium music subscription for 6 months", "isSubscription": true}
"gym membership 500k/month" → {"name": "Gym Membership", "pricePerMonth": 500000, "totalMonths": 12, "category": "Sức khỏe", "startDate": "${new Date().toISOString().split('T')[0]}", "description": "Monthly gym membership", "isSubscription": true}

Return valid JSON object with isSubscription: true to indicate this is subscription data:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            pricePerMonth: { type: Type.NUMBER },
            totalMonths: { type: Type.NUMBER },
            category: { 
              type: Type.STRING,
              enum: ["Giải trí", "Mua sắm", "Sức khỏe", "Giáo dục", "Di chuyển", "Ăn uống", "Khác"]
            },
            startDate: { type: Type.STRING },
            description: { type: Type.STRING },
            isSubscription: { type: Type.BOOLEAN }
          },
          required: ["name", "pricePerMonth", "totalMonths", "category", "startDate", "isSubscription"]
        }
      }
    });

    let parsedData;
    if (response && response.parsed) {
      parsedData = response.parsed;
    } else if (response && typeof response.text === 'string') {
      try {
        parsedData = JSON.parse(response.text);
      } catch (parseErr) {
        console.error('Failed to JSON.parse subscription response:', parseErr);
        return res.status(500).json({ error: 'Failed to parse subscription data' });
      }
    } else {
      return res.status(500).json({ error: 'No valid response from AI' });
    }

    // Ensure the isSubscription flag is set
    parsedData.isSubscription = true;

    console.log('[/parse] Subscription data being sent to client:', JSON.stringify(parsedData, null, 2));
    res.json(parsedData);
  } catch (error) {
    console.error('Subscription parsing error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message 
    });
  }
}

// Route chính để parse OCR text hoặc ảnh
app.post("/parse", async (req, res) => {
  try {
    const { ocrText, imageBase64, mimeType = "image/jpeg" } = req.body;
    // Log incoming request body to help debugging network issues
    console.log('[/parse] incoming body:', { ocrText: ocrText ? `${String(ocrText).slice(0,200)}${String(ocrText).length > 200 ? '...':''}` : undefined, hasImage: !!imageBase64 });

    // Check for subscription payment patterns first (more specific)
    if (ocrText && detectSubscriptionPayment(ocrText)) {
      console.log('[/parse] Detected subscription payment pattern, routing to payment parsing');
      return handleSubscriptionPayment(req, res);
    }

    // Check if this is a subscription-related input (creation)
    if (ocrText && detectSubscriptionPattern(ocrText)) {
      console.log('[/parse] Detected subscription pattern, routing to subscription parsing');
      return handleSubscriptionParsing(req, res);
    }

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
            type: {
              type: Type.STRING,
              description: "Type of transaction - income for salary/earnings, expense for purchases/spending",
              enum: ["income", "expense"],
            },
            category: {
              type: Type.STRING,
              description: "The primary category for this transaction. For income use 'Thu nhập', for expenses choose the most relevant category.",
              enum: [
                "Thu nhập",
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
                    description: "The category of this specific item.",
                    enum: [
                      "Thu nhập",
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
          required: ["category", "type"],
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
      'Income': 'Thu nhập',
      'Salary': 'Thu nhập',
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

Trích xuất dữ liệu có cấu trúc từ văn bản.

PHÂN LOẠI GIAO DỊCH - CỰC KỲ QUAN TRỌNG:
- Nếu là HÓA ĐƠN MUA HÀNG/DỊCH VỤ (receipt, invoice) → type: "expense" (chi tiêu)
- Nếu là LƯƠNG, THU NHẬP, TIỀN THƯỞNG, BONUS → type: "income" (thu nhập)
- Nếu là TIỀN QUÀ/BIẾU TẶNG (gift money) → type: "income" (thu nhập)
- Nếu là TIỀN CHO/NHẬN từ gia đình/bạn bè → type: "income" (thu nhập)
- Nếu có từ khóa: "cho", "tặng", "biếu", "thưởng", "lương" → type: "income" (thu nhập)
- Nếu có cụm từ: "mẹ cho", "bố cho", "bạn cho", "anh/chị cho" → type: "income" (thu nhập)
- Nếu không rõ loại → type: "expense" (mặc định)

Hướng dẫn trích xuất:
1. XÁC ĐỊNH LOẠI GIAO DỊCH trước (income hay expense) dựa trên ngữ cảnh
2. Trích xuất tên nguồn (cửa hàng/công ty/người gửi), tổng tiền và danh sách các mặt hàng/khoản mục
3. Với mỗi món hàng/khoản mục, xác định giá tiền riêng và danh mục của nó
4. Phân tích để xác định danh mục CHÍNH:
   - Thu nhập từ lương/công việc/quà tặng → "Thu nhập" 
   - Đồ ăn/đồ uống → "Ăn uống"
   - Vận chuyển/di chuyển → "Di chuyển" 
   - Mua sắm/bán lẻ → "Mua sắm"
   - Y tế/dược phẩm → "Sức khỏe"
   - Giáo dục → "Giáo dục"
   - Phim/game/giải trí → "Giải trí"
   - Khác → "Khác"

5. Trả về JSON với merchant/source, total, type, category và items array với từng giá riêng

CRITICAL: Category MUST be one of these Vietnamese strings:
- "Thu nhập" (for income)
- "Ăn uống"
- "Di chuyển" 
- "Mua sắm"
- "Giải trí"
- "Sức khỏe"
- "Giáo dục"
- "Khác"

CRITICAL: Type MUST be either "income" or "expense".
CRITICAL: All amounts MUST be positive numbers regardless of income/expense type.

DO NOT use English category names or types.`;
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
