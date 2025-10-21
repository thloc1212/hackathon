/**
 * Centralized type definitions for the application
 */

/**
 * Standard Transaction interface used across all screens
 * Ensures consistent data format for financial transactions
 */
export interface Transaction {
  id: string;
  amount: number; // Positive for income, negative for expense
  category: string;
  description: string;
  date: string; // Format: DD/MM/YYYY or ISO string
  type: 'income' | 'expense';
  note?: string; // Optional additional details
}

/**
 * Receipt information from OCR/Camera scanning
 */
export interface ReceiptInfo {
  merchant?: string;
  total: number; // Changed from string to number for consistency
  date?: string;
  items: ReceiptItem[];
  category?: string; // AI-determined primary category for the transaction
}

/**
 * Individual item in a receipt
 */
export interface ReceiptItem {
  name: string;
  price: number; // Changed from string to number for consistency
  quantity?: number; // Changed from string to number for consistency
  category?: string; // Category of the individual item
}

/**
 * Spending category for budget tracking
 */
export interface SpendingCategory {
  id: string;
  name: string;
  budget: number;
  spent: number;
  color: string;
  deleted?: boolean;
}

/**
 * Overall spending data structure
 */
export interface SpendingData {
  totalBudget: number;
  categories: SpendingCategory[];
}

/**
 * AI/Gemini response structure for transaction parsing
 */
export interface GeminiTransactionResponse {
  merchant?: string;
  amount: number;
  date?: string;
  category?: string;
  description?: string;
  items?: ReceiptItem[];
  raw?: any; // For debugging
}

export interface SpendingSummary {
  category: string;
  percentage: number; // 35 (cho 35%)
  spent: number;
}

export interface StatisticData {
  totalSpent: number;
  transactions: Transaction[];
  topSpending: SpendingSummary[];
  insight: string; // Mẹo tiết kiệm
}

/**
 * Monthly subscription interface for recurring payments
 */
export interface Subscription {
  id: string;
  name: string; // Subscription name (e.g., "Netflix", "Spotify")
  description?: string; // Optional description
  pricePerMonth: number; // Monthly price
  currentMonth: number; // Current month in the subscription (1-based)
  totalMonths: number | null; // Total months for the subscription (null for unlimited)
  paidAmount: number; // How much has already been paid
  category: string; // Category (e.g., "Entertainment", "Software", "Utilities")
  startDate: string; // When the subscription started (YYYY-MM-DD format)
  nextPaymentDate: string; // When the next payment is due (YYYY-MM-DD format)
  isActive: boolean; // Whether the subscription is active
  color?: string; // Optional color for UI display
}

/**
 * Subscription payment tracking for each month
 */
export interface SubscriptionPayment {
  id: string;
  subscriptionId: string;
  month: number; // Which month this payment is for (1-based)
  amount: number; // Amount paid for this month
  paymentDate: string; // When this payment was made (YYYY-MM-DD format)
  isPaid: boolean; // Whether this month has been paid
}