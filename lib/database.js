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

  async getSubscriptions() {
    return await this.readFile('subscriptions.json');
  }

  async saveSubscriptions(subscriptions) {
    await this.writeFile('subscriptions.json', subscriptions);
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

  async findTransactionsByUserId(userId, limit = null, offset = 0) {
    const transactions = await this.getTransactions();
    const userTransactions = transactions
      .filter(transaction => transaction.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort by newest first

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

  async getUserTransactionStats(userId) {
    const transactions = await this.findTransactionsByUserId(userId);
    
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

    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      categorySummary,
      transactionCount: transactions.length
    };
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

  // Subscription methods
  async createSubscription(subscriptionData) {
    const subscriptions = await this.getSubscriptions();
    const newSubscription = {
      id: this.generateId(),
      ...subscriptionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    subscriptions.push(newSubscription);
    await this.saveSubscriptions(subscriptions);
    return newSubscription;
  }

  async findSubscriptionsByUserId(userId) {
    const subscriptions = await this.getSubscriptions();
    return subscriptions
      .filter(subscription => subscription.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort by newest first
  }

  async findSubscriptionById(id) {
    const subscriptions = await this.getSubscriptions();
    return subscriptions.find(subscription => subscription.id === id);
  }

  async updateSubscription(id, updateData) {
    const subscriptions = await this.getSubscriptions();
    const subscriptionIndex = subscriptions.findIndex(subscription => subscription.id === id);
    if (subscriptionIndex === -1) {
      throw new Error('Subscription not found');
    }
    subscriptions[subscriptionIndex] = {
      ...subscriptions[subscriptionIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    await this.saveSubscriptions(subscriptions);
    return subscriptions[subscriptionIndex];
  }

  async deleteSubscription(id) {
    const subscriptions = await this.getSubscriptions();
    const filteredSubscriptions = subscriptions.filter(subscription => subscription.id !== id);
    await this.saveSubscriptions(filteredSubscriptions);
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export default new Database();