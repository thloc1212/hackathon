import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATABASE_DIR = path.join(__dirname, '../database');

class Database {
  constructor() {
    this.ensureDatabaseDir();
  }

  async ensureDatabaseDir() {
    try {
      await fs.access(DATABASE_DIR);
    } catch {
      await fs.mkdir(DATABASE_DIR, { recursive: true });
    }
  }

  async readFile(filename) {
    try {
      const filePath = path.join(DATABASE_DIR, filename);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async writeFile(filename, data) {
    const filePath = path.join(DATABASE_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async getUsers() {
    return await this.readFile('users.json');
  }

  async saveUsers(users) {
    await this.writeFile('users.json', users);
  }

  async getSessions() {
    return await this.readFile('sessions.json');
  }

  async saveSessions(sessions) {
    await this.writeFile('sessions.json', sessions);
  }

  async getTransactions() {
    return await this.readFile('transactions.json');
  }

  async saveTransactions(transactions) {
    await this.writeFile('transactions.json', transactions);
  }

  async getOtps() {
    return await this.readFile('otps.json');
  }

  async saveOtps(otps) {
    await this.writeFile('otps.json', otps);
  }

  async createUser(userData) {
    const users = await this.getUsers();
    const newUser = {
      id: this.generateId(),
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(newUser);
    await this.saveUsers(users);
    return newUser;
  }

  async findUserByEmail(email) {
    const users = await this.getUsers();
    return users.find(user => user.email === email);
  }

  async findUserById(id) {
    const users = await this.getUsers();
    return users.find(user => user.id === id);
  }

  async updateUser(id, updateData) {
    const users = await this.getUsers();
    const userIndex = users.findIndex(user => user.id === id);
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    users[userIndex] = {
      ...users[userIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    await this.saveUsers(users);
    return users[userIndex];
  }

  async deleteUser(id) {
    const users = await this.getUsers();
    const filteredUsers = users.filter(user => user.id !== id);
    await this.saveUsers(filteredUsers);
  }

  async createSession(sessionData) {
    const sessions = await this.getSessions();
    const newSession = {
      id: this.generateId(),
      ...sessionData,
      createdAt: new Date().toISOString()
    };
    sessions.push(newSession);
    await this.saveSessions(sessions);
    return newSession;
  }

  async findSessionById(id) {
    const sessions = await this.getSessions();
    return sessions.find(session => session.id === id);
  }

  async deleteSession(id) {
    const sessions = await this.getSessions();
    const filteredSessions = sessions.filter(session => session.id !== id);
    await this.saveSessions(filteredSessions);
  }

  async deleteExpiredSessions() {
    const sessions = await this.getSessions();
    const now = new Date().getTime();
    const activeSessions = sessions.filter(session => {
      return new Date(session.expiresAt).getTime() > now;
    });
    await this.saveSessions(activeSessions);
  }

  // Transaction methods
  async createTransaction(transactionData) {
    const transactions = await this.getTransactions();
    const newTransaction = {
      id: this.generateId(),
      ...transactionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    transactions.push(newTransaction);
    await this.saveTransactions(transactions);
    return newTransaction;
  }

  async findTransactionsByUserId(userId, limit = null, offset = 0, month = null, year = null) {
    const transactions = await this.getTransactions();
    let userTransactions = transactions
      .filter(transaction => transaction.userId === userId);

    console.log(`[findTransactionsByUserId] Filter params (raw):`, { month, year, monthType: typeof month, yearType: typeof year });

    // Convert month and year to numbers if they are strings
    const filterMonth = month !== null && month !== undefined ? parseInt(month, 10) : null;
    const filterYear = year !== null && year !== undefined ? parseInt(year, 10) : null;

    console.log(`[findTransactionsByUserId] Filter params (converted):`, { filterMonth, filterYear });

    // Apply date filters if provided
    if (filterMonth !== null || filterYear !== null) {
      userTransactions = userTransactions.filter(transaction => {
        // Use transaction.date first, fallback to createdAt, then current date
        const dateString = transaction.date || transaction.createdAt || new Date().toISOString();
        const transactionDate = new Date(dateString);
        
        // Check if date is valid
        if (isNaN(transactionDate.getTime())) {
          console.warn(`[findTransactionsByUserId] Invalid date for transaction ${transaction.id}: ${dateString}`);
          return false;
        }

        const transactionMonth = transactionDate.getMonth() + 1; // getMonth() returns 0-11
        const transactionYear = transactionDate.getFullYear();

        let matchesMonth = true;
        let matchesYear = true;

        if (filterMonth !== null) {
          matchesMonth = transactionMonth === filterMonth;
        }

        if (filterYear !== null) {
          matchesYear = transactionYear === filterYear;
        }

        const matches = matchesMonth && matchesYear;
        
        console.log(`[findTransactionsByUserId] Transaction ${transaction.id} check:`, {
          dateString,
          transactionMonth,
          transactionYear,
          filterMonth,
          filterYear,
          matchesMonth,
          matchesYear,
          matches
        });

        return matches;
      });
    }

    console.log(`[findTransactionsByUserId] After filter: ${userTransactions.length} transactions`);

    userTransactions = userTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort by newest first

    if (limit) {
      return userTransactions.slice(offset, offset + limit);
    }
    
    return userTransactions.slice(offset);
  }

  async findTransactionById(id) {
    const transactions = await this.getTransactions();
    return transactions.find(transaction => transaction.id === id);
  }

  async updateTransaction(id, updateData) {
    const transactions = await this.getTransactions();
    const transactionIndex = transactions.findIndex(transaction => transaction.id === id);
    if (transactionIndex === -1) {
      throw new Error('Transaction not found');
    }
    transactions[transactionIndex] = {
      ...transactions[transactionIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    await this.saveTransactions(transactions);
    return transactions[transactionIndex];
  }

  async deleteTransaction(id) {
    const transactions = await this.getTransactions();
    const filteredTransactions = transactions.filter(transaction => transaction.id !== id);
    await this.saveTransactions(filteredTransactions);
  }

  async getUserTransactionStats(userId, month = null, year = null) {
    console.log(`[getUserTransactionStats] Getting stats for user ${userId} with filter (raw):`, { month, year, monthType: typeof month, yearType: typeof year });
    
    // Convert to numbers to ensure consistent filtering
    const filterMonth = month !== null && month !== undefined ? parseInt(month, 10) : null;
    const filterYear = year !== null && year !== undefined ? parseInt(year, 10) : null;
    
    console.log(`[getUserTransactionStats] Getting stats with filter (converted):`, { filterMonth, filterYear });
    
    const transactions = await this.findTransactionsByUserId(userId, null, 0, filterMonth, filterYear);
    
    console.log(`[getUserTransactionStats] Found ${transactions.length} transactions after filtering`);
    
    let totalIncome = 0;
    let totalExpenses = 0;
    const categorySummary = {};

    transactions.forEach(transaction => {
      if (transaction.category === 'Thu nhập') {
        totalIncome += transaction.amount;
      } else{
        totalExpenses += Math.abs(transaction.amount);
      }

      // Category summary
      const category = transaction.category || 'Khác';
      if (!categorySummary[category]) {
        categorySummary[category] = 0;
      }
      categorySummary[category] += Math.abs(transaction.amount);
    });

    const stats = {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      categorySummary,
      transactionCount: transactions.length
    };

    console.log(`[getUserTransactionStats] Calculated stats:`, stats);

    return stats;
  }

  // Budget methods
  async getUserBudgets(userId) {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user.categoryBudgets || {};
  }

  async updateUserBudgets(userId, budgets) {
    const users = await this.getUsers();
    const userIndex = users.findIndex(user => user.id === userId);
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    users[userIndex] = {
      ...users[userIndex],
      categoryBudgets: budgets,
      updatedAt: new Date().toISOString()
    };
    await this.saveUsers(users);
    return users[userIndex].categoryBudgets;
  }

  // OTP methods
  async createOtp(email, otp) {
    const otps = await this.getOtps();
    // Remove any existing OTP for this email
    const filteredOtps = otps.filter(item => item.email !== email);
    
    const newOtp = {
      id: this.generateId(),
      email: email.toLowerCase().trim(),
      otp,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
    };
    
    filteredOtps.push(newOtp);
    await this.saveOtps(filteredOtps);
    return newOtp;
  }

  async findOtpByEmail(email) {
    const otps = await this.getOtps();
    const otp = otps.find(item => item.email === email.toLowerCase().trim());
    
    // Check if OTP is expired
    if (otp && new Date(otp.expiresAt) < new Date()) {
      await this.deleteOtp(otp.id);
      return null;
    }
    
    return otp;
  }

  async deleteOtp(id) {
    const otps = await this.getOtps();
    const filteredOtps = otps.filter(item => item.id !== id);
    await this.saveOtps(filteredOtps);
  }

  async deleteExpiredOtps() {
    const otps = await this.getOtps();
    const now = new Date();
    const activeOtps = otps.filter(otp => new Date(otp.expiresAt) > now);
    await this.saveOtps(activeOtps);
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export default new Database();