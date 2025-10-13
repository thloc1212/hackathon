const { betterAuth } = require('better-auth');
const bcrypt = require('bcryptjs');
const database = require('./database');

const auth = betterAuth({
  database: {
    // Custom adapter for JSON file storage
    async findUser(id) {
      return await database.findUserById(id);
    },

    async findUserByEmail(email) {
      return await database.findUserByEmail(email);
    },

    async createUser(userData) {
      // Hash password before storing
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      return await database.createUser({
        ...userData,
        password: hashedPassword
      });
    },

    async updateUser(id, userData) {
      // Hash password if it's being updated
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }
      
      return await database.updateUser(id, userData);
    },

    async deleteUser(id) {
      await database.deleteUser(id);
    },

    async createSession(sessionData) {
      return await database.createSession(sessionData);
    },

    async findSession(id) {
      return await database.findSessionById(id);
    },

    async updateSession(id, sessionData) {
      // For simplicity, we'll delete and recreate the session
      await database.deleteSession(id);
      return await database.createSession({ id, ...sessionData });
    },

    async deleteSession(id) {
      await database.deleteSession(id);
    },

    async cleanup() {
      await database.deleteExpiredSessions();
    }
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Simplified for this example
    
    // Custom password validation
    async validatePassword(password, hashedPassword) {
      return await bcrypt.compare(password, hashedPassword);
    }
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  advanced: {
    generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
  }
});

module.exports = auth;