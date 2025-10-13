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

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export default new Database();