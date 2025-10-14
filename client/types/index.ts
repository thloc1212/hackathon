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
  category?: string;
}

/**
 * Individual item in a receipt
 */
export interface ReceiptItem {
  name: string;
  price: number; // Changed from string to number for consistency
  quantity?: number; // Changed from string to number for consistency
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
