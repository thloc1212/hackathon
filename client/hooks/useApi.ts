import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AuthService from '@/lib/authService';

// Get server URL from environment variables
const getServerUrl = () => {
  const host = process.env.EXPO_PUBLIC_SERVER_HOST || 'localhost';
  const port = process.env.EXPO_PUBLIC_SERVER_PORT || '3000';
  
  if (Platform.OS === 'android') {
    // For Android emulator, localhost needs to be mapped to 10.0.2.2
    const androidHost = host === 'localhost' ? '10.0.2.2' : host;
    return `http://${androidHost}:${port}`;
  }
  
  return `http://${host}:${port}`;
};

const SERVER_URL = getServerUrl();

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
  merchant?: string;
  items?: Array<{
    name: string;
    price: number;
    quantity?: number;
    category?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface GeminiTransactionResponse {
  merchant?: string;
  total?: number;
  amount?: number;
  date?: string;
  category?: string;
  items?: Array<{
    name?: string;
    description?: string;
    price?: number;
    amount?: number;
    quantity?: number;
    category?: string;
  }>;
  // Subscription properties when isSubscription is true
  isSubscription?: boolean;
  name?: string;
  description?: string;
  pricePerMonth?: number;
  totalMonths?: number;
  startDate?: string;
  // Subscription payment properties when isSubscriptionPayment is true
  isSubscriptionPayment?: boolean;
  serviceName?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  description?: string;
  pricePerMonth: number;
  currentMonth: number;
  totalMonths: number | null; // Allow null for unlimited subscriptions
  paidAmount: number;
  category: string;
  startDate: string;
  nextPaymentDate: string;
  isActive: boolean;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> => {
    try {
      setLoading(true);
      setError(null);

      const session = AuthService.getCurrentSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add existing headers
      if (options.headers) {
        Object.assign(headers, options.headers);
      }

      // Add authorization header if session exists
      if (session?.id) {
        headers['Authorization'] = `Bearer ${session.id}`;
      }

      console.log(`[API] ${options.method || 'GET'} ${SERVER_URL}${endpoint}`);
      if (options.body) {
        console.log('[API] Request body:', options.body);
      }

      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();
      console.log(`[API] Response (${response.status}):`, data);

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      // Handle server responses that already have success/data structure
      if (data.success && data.data !== undefined) {
        return {
          success: true,
          data: data.data, // Extract the actual data from server response
          message: data.message,
        };
      }

      return {
        success: true,
        data,
        message: data.message,
      };
    } catch (err: any) {
      console.error(`[API] Error in ${endpoint}:`, err);
      const errorMessage = err?.message || String(err);
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  };

  // Transaction API methods
  const addTransaction = useCallback(async (transactionData: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Transaction>> => {
    return makeRequest<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }, []);

  const getTransactions = useCallback(async (limit?: number, offset?: number): Promise<ApiResponse<Transaction[]>> => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    const queryString = params.toString();
    const endpoint = `/transactions${queryString ? `?${queryString}` : ''}`;
    
    return makeRequest<Transaction[]>(endpoint, {
      method: 'GET',
    });
  }, []);

  const getTransactionById = useCallback(async (id: string): Promise<ApiResponse<Transaction>> => {
    return makeRequest<Transaction>(`/transactions/${id}`, {
      method: 'GET',
    });
  }, []);

  const updateTransaction = useCallback(async (id: string, updateData: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>): Promise<ApiResponse<Transaction>> => {
    return makeRequest<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }, []);

  const deleteTransaction = useCallback(async (id: string): Promise<ApiResponse<void>> => {
    return makeRequest<void>(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }, []);

  const getUserStats = useCallback(async (): Promise<ApiResponse<{
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    categorySummary: Record<string, number>;
  }>> => {
    return makeRequest('/transactions/stats', {
      method: 'GET',
    });
  }, []);

  // Gemini AI methods
  const parseReceipt = useCallback(async (ocrText?: string, imageBase64?: string, mimeType?: string): Promise<ApiResponse<GeminiTransactionResponse>> => {
    return makeRequest<GeminiTransactionResponse>('/parse', {
      method: 'POST',
      body: JSON.stringify({
        ocrText,
        imageBase64,
        mimeType: mimeType || 'image/jpeg',
      }),
    });
  }, []);

  const getInsight = useCallback(async (category: string, spent: number, percentage: number, totalSpent: number): Promise<ApiResponse<{ insight: string }>> => {
    return makeRequest<{ insight: string }>('/insight', {
      method: 'POST',
      body: JSON.stringify({
        category,
        spent,
        percentage,
        totalSpent,
      }),
    });
  }, []);

  // Connectivity methods
  const ping = useCallback(async (): Promise<ApiResponse<{ ok: boolean; time: number }>> => {
    return makeRequest<{ ok: boolean; time: number }>('/ping', {
      method: 'GET',
    });
  }, []);

  const parseTest = useCallback(async (): Promise<ApiResponse<any>> => {
    return makeRequest('/parse-test', {
      method: 'POST',
      body: JSON.stringify({ test: true, sample: 'abc' }),
    });
  }, []);

  // Subscription API methods
  const addSubscription = useCallback(async (subscriptionData: Omit<Subscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Subscription>> => {
    return makeRequest<Subscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(subscriptionData),
    });
  }, []);

  const getSubscriptions = useCallback(async (): Promise<ApiResponse<Subscription[]>> => {
    return makeRequest<Subscription[]>('/subscriptions', {
      method: 'GET',
    });
  }, []);

  const getSubscriptionById = useCallback(async (id: string): Promise<ApiResponse<Subscription>> => {
    return makeRequest<Subscription>(`/subscriptions/${id}`, {
      method: 'GET',
    });
  }, []);

  const updateSubscription = useCallback(async (id: string, updateData: Partial<Omit<Subscription, 'id' | 'userId' | 'createdAt'>>): Promise<ApiResponse<Subscription>> => {
    return makeRequest<Subscription>(`/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }, []);

  const deleteSubscription = useCallback(async (id: string): Promise<ApiResponse<void>> => {
    return makeRequest<void>(`/subscriptions/${id}`, {
      method: 'DELETE',
    });
  }, []);

  const paySubscription = useCallback(async (id: string): Promise<ApiResponse<Subscription>> => {
    return makeRequest<Subscription>(`/subscriptions/${id}/pay`, {
      method: 'POST',
    });
  }, []);

  const parseSubscription = useCallback(async (text: string): Promise<ApiResponse<{
    name: string;
    pricePerMonth: number;
    totalMonths: number;
    category: string;
    startDate: string;
    description?: string;
  }>> => {
    return makeRequest('/subscriptions/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }, []);

  return {
    loading,
    error,
    // Transaction methods
    addTransaction,
    getTransactions,
    getTransactionById,
    updateTransaction,
    deleteTransaction,
    getUserStats,
    // Subscription methods
    addSubscription,
    getSubscriptions,
    getSubscriptionById,
    updateSubscription,
    deleteSubscription,
    paySubscription,
    parseSubscription,
    // Gemini methods
    parseReceipt,
    getInsight,
    // Utility methods
    ping,
    parseTest,
  };
};