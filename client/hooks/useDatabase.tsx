import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useApi, Transaction as ApiTransaction } from './useApi';
import { Transaction as UITransaction } from '@/types';

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
  stats: UserStats | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshData: (month?: number | null, year?: number | null) => Promise<void>;
  addTransaction: (transaction: Omit<ApiTransaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  updateTransaction: (id: string, data: Partial<ApiTransaction>) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
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

  const refreshData = async (month?: number | null, year?: number | null) => {
    if (!user) {
      setTransactions([]);
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

  // Auto-refresh when user changes - but only if no filter is set
  useEffect(() => {
    if (user?.id) {
      refreshData(); // Call without parameters for initial load
    }
  }, [user?.id]);

  const contextValue: DatabaseContextType = {
    transactions,
    stats,
    loading,
    error,
    refreshData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
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