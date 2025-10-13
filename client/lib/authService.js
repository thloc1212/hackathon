import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SERVER_URL = Platform.OS === 'android' 
  ? 'http://10.0.2.2:3000' 
  : 'http://localhost:3000';

const SESSION_KEY = 'user_session';

class AuthService {
  constructor() {
    this.user = null;
    this.session = null;
  }

  async signup(email, password, dateOfBirth) {
    try {
      const response = await fetch(`${SERVER_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          dateOfBirth,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      return {
        success: true,
        user: data.user,
        message: data.message,
      };
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  }

  async signin(email, password) {
    try {
      const response = await fetch(`${SERVER_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signin failed');
      }

      // Store session data
      this.user = data.user;
      this.session = data.session;

      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({
        user: data.user,
        session: data.session,
      }));

      return {
        success: true,
        user: data.user,
        session: data.session,
        message: data.message,
      };
    } catch (error) {
      console.error('Signin error:', error);
      throw error;
    }
  }

  async signout() {
    try {
      if (this.session?.id) {
        await fetch(`${SERVER_URL}/auth/signout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: this.session.id,
          }),
        });
      }

      // Clear local data
      this.user = null;
      this.session = null;
      await AsyncStorage.removeItem(SESSION_KEY);

      return { success: true };
    } catch (error) {
      console.error('Signout error:', error);
      // Even if server request fails, clear local data
      this.user = null;
      this.session = null;
      await AsyncStorage.removeItem(SESSION_KEY);
      throw error;
    }
  }

  async loadStoredSession() {
    try {
      const storedData = await AsyncStorage.getItem(SESSION_KEY);
      if (!storedData) {
        return null;
      }

      const { user, session } = JSON.parse(storedData);

      // Verify session with server
      const isValid = await this.verifySession(session.id);
      if (isValid) {
        this.user = user;
        this.session = session;
        return { user, session };
      } else {
        // Invalid session, clear storage
        await AsyncStorage.removeItem(SESSION_KEY);
        return null;
      }
    } catch (error) {
      console.error('Load session error:', error);
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  async verifySession(sessionId) {
    try {
      const response = await fetch(`${SERVER_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.user = data.user;
        this.session = data.session;
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Verify session error:', error);
      return false;
    }
  }

  async getProfile() {
    try {
      if (!this.session?.id) {
        throw new Error('No active session');
      }

      const response = await fetch(`${SERVER_URL}/auth/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.session.id}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get profile');
      }

      this.user = data.user;
      return data.user;
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }

  getCurrentUser() {
    return this.user;
  }

  getCurrentSession() {
    return this.session;
  }

  isAuthenticated() {
    return !!(this.user && this.session);
  }
}

export default new AuthService();