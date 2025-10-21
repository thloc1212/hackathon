import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useApi, Transaction as ApiTransaction, Subscription as ApiSubscription } from './useApi';
import { Transaction as UITransaction, Subscription as UISubscription } from '@/types';

export interface UserStats {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  categorySummary: Record<string, number>;
  transactionCount?: number;
}

export interface DatabaseContextType {
  // Data
  transactions: UITransaction[]; // Use UI Transaction format for components
  subscriptions: UISubscription[];
  stats: UserStats | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshData: (month?: number | null, year?: number | null) => Promise<void>;
  addTransaction: (transaction: Omit<ApiTransaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  updateTransaction: (id: string, data: Partial<ApiTransaction>) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
  addSubscription: (subscription: Omit<ApiSubscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  updateSubscription: (id: string, data: Partial<ApiSubscription>) => Promise<boolean>;
  deleteSubscription: (id: string) => Promise<boolean>;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

interface DatabaseProviderProps {
  children: ReactNode;
  user?: {
    id: string;
    email: string;
    dateOfBirth?: string;
    createdAt: string;
  } | null;
}

export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ children, user }) => {
  const [transactions, setTransactions] = useState<UITransaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<UISubscription[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<{ month: number | null; year: number | null }>({ month: null, year: null });

  const api = useApi();

  // Convert API transaction format to UI transaction format
  const convertApiToUITransaction = (apiTransaction: ApiTransaction): UITransaction => ({
    id: apiTransaction.id,
    amount: apiTransaction.amount,
    category: apiTransaction.category,
    description: apiTransaction.description,
    date: apiTransaction.date,
    type: apiTransaction.type,
    note: apiTransaction.merchant || undefined,
  });

  // Category mapping from English to Vietnamese
  const mapCategoryToVietnamese = (category: string): string => {
    const categoryMap: { [key: string]: string } = {
      'Video Streaming': 'Giải trí',
      'Entertainment': 'Giải trí',
      'Gaming': 'Giải trí',
      'Shopping': 'Mua sắm',
      'Health': 'Sức khỏe',
      'Education': 'Giáo dục',
      'Transport': 'Di chuyển',
      'Food': 'Ăn uống',
      'Other': 'Khác'
    };
    return categoryMap[category] || category;
  };

  // Convert API subscription format to UI subscription format
  const convertApiToUISubscription = (apiSubscription: ApiSubscription): UISubscription => ({
    id: apiSubscription.id,
    name: apiSubscription.name,
    description: apiSubscription.description,
    pricePerMonth: apiSubscription.pricePerMonth,
    currentMonth: apiSubscription.currentMonth,
    totalMonths: apiSubscription.totalMonths,
    paidAmount: apiSubscription.paidAmount,
    category: mapCategoryToVietnamese(apiSubscription.category),
    startDate: apiSubscription.startDate,
    nextPaymentDate: apiSubscription.nextPaymentDate,
    isActive: apiSubscription.isActive,
    color: apiSubscription.color,
  });

  const refreshData = async (month?: number | null, year?: number | null) => {
    if (!user) {
      setTransactions([]);
      setSubscriptions([]);
      setStats(null);
      return;
    }

    // Determine filter values to use
    const filterMonth = month !== undefined ? month : null;
    const filterYear = year !== undefined ? year : null;

    console.log(`[useDatabase] refreshData called with:`, { month, year, filterMonth, filterYear });

    // Update current filter
    setCurrentFilter({ month: filterMonth, year: filterYear });

    try {
      setLoading(true);
      setError(null);

      // Load transactions with filter
      const transactionsResponse = await api.getTransactions(undefined, undefined, filterMonth, filterYear);
      
      if (transactionsResponse.success && transactionsResponse.data) {
        const apiTransactions = Array.isArray(transactionsResponse.data) 
          ? transactionsResponse.data 
          : [];
        const uiTransactions = apiTransactions.map(convertApiToUITransaction);
        setTransactions(uiTransactions);
      } else {
        setTransactions([]);
        setError(transactionsResponse.error || 'Failed to load transactions');
      }

      // Load subscriptions
      const subscriptionsResponse = await api.getSubscriptions();
      
      if (subscriptionsResponse.success && subscriptionsResponse.data) {
        const apiSubscriptions = Array.isArray(subscriptionsResponse.data) 
          ? subscriptionsResponse.data 
          : [];
        console.log('Raw API subscriptions:', apiSubscriptions);
        const uiSubscriptions = apiSubscriptions.map(convertApiToUISubscription);
        console.log('Converted UI subscriptions:', uiSubscriptions);
        setSubscriptions(uiSubscriptions);
      } else {
        console.log('Failed to load subscriptions:', subscriptionsResponse.error);
        setSubscriptions([]);
      }
      // Load stats with filter
      const statsResponse = await api.getUserStats(filterMonth, filterYear);
      
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      } else {
        setStats({
          totalIncome: 0,
          totalExpenses: 0,
          balance: 0,
          categorySummary: {}
        });
        setError(statsResponse.error || 'Failed to load stats');
      }
    } catch (err: any) {
      console.error('Error refreshing data:', err);
      setError(err?.message || 'Unknown error occurred');
      setTransactions([]);
      setSubscriptions([]);
      setStats({
        totalIncome: 0,
        totalExpenses: 0,
        balance: 0,
        categorySummary: {}
      });
    } finally {
      setLoading(false);
    }
  };

  const addTransaction = async (transactionData: Omit<ApiTransaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
    try {
      const response = await api.addTransaction(transactionData);
      if (response.success) {
        await refreshData(currentFilter.month, currentFilter.year); // Refresh with current filter
        return true;
      } else {
        setError(response.error || 'Failed to add transaction');
        return false;
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to add transaction');
      return false;
    }
  };

  const updateTransaction = async (id: string, updateData: Partial<ApiTransaction>): Promise<boolean> => {
    try {
      const response = await api.updateTransaction(id, updateData);
      if (response.success) {
        await refreshData(currentFilter.month, currentFilter.year); // Refresh with current filter
        return true;
      } else {
        setError(response.error || 'Failed to update transaction');
        return false;
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update transaction');
      return false;
    }
  };

  const deleteTransaction = async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteTransaction(id);
      if (response.success) {
        await refreshData(currentFilter.month, currentFilter.year); // Refresh with current filter
        return true;
      } else {
        setError(response.error || 'Failed to delete transaction');
        return false;
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete transaction');
      return false;
    }
  };

  const addSubscription = async (subscriptionData: Omit<ApiSubscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
    try {
      const response = await api.addSubscription(subscriptionData);
      if (response.success) {
        await refreshData(); // Refresh all data after adding
        return true;
      } else {
        setError(response.error || 'Failed to add subscription');
        return false;
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to add subscription');
      return false;
    }
  };

  const updateSubscription = async (id: string, updateData: Partial<ApiSubscription>): Promise<boolean> => {
    try {
      const response = await api.updateSubscription(id, updateData);
      if (response.success) {
        await refreshData(); // Refresh all data after updating
        return true;
      } else {
        setError(response.error || 'Failed to update subscription');
        return false;
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update subscription');
      return false;
    }
  };

  const deleteSubscription = async (id: string): Promise<boolean> => {
    try {
      const response = await api.deleteSubscription(id);
      if (response.success) {
        await refreshData(); // Refresh all data after deleting
        return true;
      } else {
        setError(response.error || 'Failed to delete subscription');
        return false;
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete subscription');
      return false;
    }
  };

  // Auto-refresh when user changes
  useEffect(() => {
    if (user?.id) {
      refreshData(); // Call without parameters for initial load
    }
  }, [user?.id]);

  const contextValue: DatabaseContextType = {
    transactions,
    subscriptions,
    stats,
    loading,
    error,
    refreshData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addSubscription,
    updateSubscription,
    deleteSubscription,
  };

  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = (): DatabaseContextType => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};