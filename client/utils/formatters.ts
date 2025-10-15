/**
 * Shared utility functions for formatting data across the application
 */

/**
 * Format number as Vietnamese currency
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "1,000,000đ")
 */
export const formatCurrency = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0đ';
  }
  return Math.abs(amount).toLocaleString('vi-VN') + 'đ';
};

/**
 * Format date string to Vietnamese locale
 * @param dateString - Date string in ISO or DD/MM/YYYY format
 * @returns Formatted date string
 */
export const formatDate = (dateString: string): string => {
  try {
    // If already in DD/MM/YYYY format, return as is
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
      return dateString;
    }
    
    // Otherwise parse and format
    return new Date(dateString).toLocaleDateString('vi-VN');
  } catch (error) {
    return dateString;
  }
};

/**
 * Format date to long format (e.g., "October 14, 2025")
 * @param dateString - Date string to format
 * @returns Formatted date string in long format
 */
export const formatDateLong = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
};

/**
 * Format transaction amount with sign and currency
 * @param amount - The amount (positive for income, negative for expense)
 * @param showSign - Whether to show + or - sign
 * @returns Formatted amount with sign
 */
export const formatTransactionAmount = (amount: number | undefined | null, showSign: boolean = true): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return showSign ? '+0đ' : '0đ';
  }
  
  const isPositive = amount > 0;
  const formattedAmount = Math.abs(amount).toLocaleString('vi-VN');
  
  if (!showSign) {
    return formattedAmount + 'đ';
  }
  
  return isPositive ? `+${formattedAmount}đ` : `-${formattedAmount}đ`;
};
