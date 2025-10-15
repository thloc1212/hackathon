import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontWeight } from '@/constants/theme';
import { Transaction } from '@/types';
import { useApi } from '@/hooks/useApi';

const CATEGORIES = [
  'Thu nhập',
  'Ăn uống',
  'Di chuyển',
  'Mua sắm',
  'Giải trí',
  'Sức khỏe',
  'Giáo dục',
  'Khác',
];

interface TransactionItemProps {
  transaction: Transaction;
  colorScheme?: 'light' | 'dark';
  onTransactionUpdate?: (updatedTransaction: Transaction) => void;
}

export default function TransactionItem({ transaction, colorScheme = 'light', onTransactionUpdate }: TransactionItemProps) {
  const colors = Colors[colorScheme];
  const isPositive = transaction.amount > 0;
  const amountColor = isPositive ? '#10b981' : '#ef4444'; // Green for positive, red for negative
  const icon = isPositive ? 'trending-up' : 'trending-down';
  const iconColor = isPositive ? '#10b981' : '#ef4444';
  
  // Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDescription, setEditDescription] = useState(transaction.description);
  const [editAmount, setEditAmount] = useState(Math.abs(transaction.amount).toString());
  const [editCategory, setEditCategory] = useState(transaction.category);
  const [saving, setSaving] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  const { updateTransaction } = useApi();
  
  const formatAmount = (amount: number) => {
    const formattedAmount = Math.abs(amount).toLocaleString('vi-VN');
    return isPositive ? `+${formattedAmount}đ` : `-${formattedAmount}đ`;
  };

  const handleEdit = () => {
    setShowEditModal(true);
    setEditDescription(transaction.description);
    setEditAmount(Math.abs(transaction.amount).toString());
    setEditCategory(transaction.category);
  };

  const handleSave = async () => {
    if (!editDescription.trim() || !editAmount.trim() || !editCategory.trim()) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        description: editDescription.trim(),
        amount: transaction.type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
        category: editCategory.trim(),
      };

      const response = await updateTransaction(transaction.id, updateData);
      
      if (response.success && response.data) {
        Alert.alert('Success', 'Transaction updated successfully');
        setShowEditModal(false);
        
        if (onTransactionUpdate) {
          onTransactionUpdate(response.data);
        }
      } else {
        Alert.alert('Error', response.error || 'Failed to update transaction');
      }
    } catch (error) {
      console.error('Update transaction error:', error);
      Alert.alert('Error', 'Failed to update transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowEditModal(false);
    setShowCategoryDropdown(false);
    setEditDescription(transaction.description);
    setEditAmount(Math.abs(transaction.amount).toString());
    setEditCategory(transaction.category);
  };

  const handleCategorySelect = (category: string) => {
    setEditCategory(category);
    setShowCategoryDropdown(false);
  };

  return (
    <>
      <Pressable 
        style={[styles.container, { backgroundColor: colors.background }]}
        onPress={handleEdit}
        android_ripple={{ color: colors.icon + '20' }}
      >
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
          <Ionicons name="chevron-forward" size={16} color={colors.icon} style={styles.chevron} />
        </View>
      </Pressable>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Transaction</Text>
              <Pressable onPress={handleCancel} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </Pressable>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.textInput}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Transaction description"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount</Text>
                <TextInput
                  style={styles.textInput}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <Pressable
                  style={styles.dropdownButton}
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                  <Text style={styles.dropdownButtonText}>{editCategory}</Text>
                  <Ionicons 
                    name={showCategoryDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#666" 
                  />
                </Pressable>
                
                {showCategoryDropdown && (
                  <View style={styles.dropdown}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                      {CATEGORIES.map((category) => (
                        <Pressable
                          key={category}
                          style={[
                            styles.dropdownItem,
                            editCategory === category && styles.dropdownItemSelected
                          ]}
                          onPress={() => handleCategorySelect(category)}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            editCategory === category && styles.dropdownItemTextSelected
                          ]}>
                            {category}
                          </Text>
                          {editCategory === category && (
                            <Ionicons name="checkmark" size={20} color="#5F58C2" />
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              
              <Pressable
                style={[styles.actionButton, styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    flexDirection: 'row',
    alignContent: 'center',
    gap: 8,
  },
  amount: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
  },
  chevron: {
    marginTop: 2,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    marginHorizontal: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    backgroundColor: '#f9fafb',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  saveButton: {
    backgroundColor: '#5F58C2',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
  },
  // Dropdown Styles
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  dropdownButtonText: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#374151',
    flex: 1,
  },
  dropdown: {
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: 'white',
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(95, 88, 194, 0.1)',
  },
  dropdownItemText: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#374151',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#5F58C2',
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
  },
});