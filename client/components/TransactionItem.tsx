import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontWeight } from '@/constants/theme';
import { Transaction } from '@/types';

interface TransactionItemProps {
  transaction: Transaction;
  colorScheme?: 'light' | 'dark';
}

export default function TransactionItem({ transaction, colorScheme = 'light' }: TransactionItemProps) {
  const colors = Colors[colorScheme];
  const isPositive = transaction.amount > 0;
  const amountColor = isPositive ? '#10b981' : '#ef4444'; // Green for positive, red for negative
  const icon = isPositive ? 'trending-up' : 'trending-down';
  const iconColor = isPositive ? '#10b981' : '#ef4444';
  
  const formatAmount = (amount: number) => {
    const formattedAmount = Math.abs(amount).toLocaleString('vi-VN');
    return isPositive ? `+${formattedAmount}đ` : `-${formattedAmount}đ`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.leftSection}>
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={icon} size={24} color={iconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.description, { color: colors.text }]} numberOfLines={1}>
            {transaction.description}
          </Text>
          <Text style={[styles.category, { color: colors.icon }]}>
            {transaction.category}
          </Text>
          <Text style={[styles.date, { color: colors.icon }]}>
            {transaction.date}
          </Text>
        </View>
      </View>
      <View style={styles.rightSection}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {formatAmount(transaction.amount)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,

  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  description: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    marginBottom: 2,
  },
  category: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    marginBottom: 2,
  },
  date: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
  },
});