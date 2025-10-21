import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Modal, 
  ScrollView, 
  ActivityIndicator,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontFamily, FontWeight } from '@/constants/theme';
import { Subscription } from '@/types';
import { formatCurrency } from '@/utils/formatters';

interface SubscriptionSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  subscriptions: Subscription[];
  suggestedSubscription?: {
    name: string;
    amount?: number;
    category?: string;
    description?: string;
  };
  onSelectSubscription: (subscription: Subscription, customAmount?: number) => void;
  loading?: boolean;
}

export default function SubscriptionSelectionModal({ 
  visible, 
  onClose, 
  subscriptions, 
  suggestedSubscription,
  onSelectSubscription,
  loading = false
}: SubscriptionSelectionModalProps) {
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustomAmount, setShowCustomAmount] = useState(false);

  // Find matching subscription based on AI suggestion
  const suggestedMatch = suggestedSubscription 
    ? subscriptions.find(sub => 
        sub.name.toLowerCase().includes(suggestedSubscription.name.toLowerCase()) ||
        suggestedSubscription.name.toLowerCase().includes(sub.name.toLowerCase())
      )
    : null;

  // Reset and pre-select when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      // Reset state when modal opens
      setSelectedSubscriptionId(null);
      setCustomAmount('');
      setShowCustomAmount(false);
      
      // Pre-select the suggested match if available
      if (suggestedMatch) {
        setSelectedSubscriptionId(suggestedMatch.id);
        if (suggestedSubscription?.amount) {
          setCustomAmount(suggestedSubscription.amount.toString());
          setShowCustomAmount(true);
        }
      }
    }
  }, [visible, suggestedMatch, suggestedSubscription]);

  const handleSelectSubscription = (subscription: Subscription) => {
    setSelectedSubscriptionId(subscription.id);
    setShowCustomAmount(false);
    setCustomAmount('');
  };

  const handleConfirm = () => {
    const selectedSubscription = subscriptions.find(sub => sub.id === selectedSubscriptionId);
    if (!selectedSubscription) return;

    const amount = showCustomAmount && customAmount ? parseFloat(customAmount) : undefined;
    onSelectSubscription(selectedSubscription, amount);
  };

  const handleCustomAmountToggle = () => {
    setShowCustomAmount(!showCustomAmount);
    if (!showCustomAmount) {
      const selectedSub = subscriptions.find(sub => sub.id === selectedSubscriptionId);
      if (selectedSub) {
        setCustomAmount(selectedSub.pricePerMonth.toString());
      }
    } else {
      setCustomAmount('');
    }
  };

  const isValid = selectedSubscriptionId && (!showCustomAmount || (customAmount && parseFloat(customAmount) > 0));

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chọn khoảng trả hàng tháng</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </Pressable>
          </View>

          {/* AI Suggestion Banner */}
          {suggestedSubscription && (
            <View style={styles.suggestionBanner}>
              <LinearGradient
                colors={['#E8E4FF', '#F3F0FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.suggestionGradient}
              >
                <View style={styles.suggestionHeader}>
                  <Ionicons name="sparkles" size={20} color="#8B7FE0" />
                  <Text style={styles.suggestionTitle}>AI Phát hiện</Text>
                </View>
                  <Text style={styles.suggestionText}>
                    Đề xuất: {suggestedSubscription.name}
                    {suggestedSubscription.amount && ` - ${formatCurrency(suggestedSubscription.amount)}`}
                    {suggestedSubscription.category && ` (${suggestedSubscription.category})`}
                  </Text>
                  {suggestedMatch && (
                    <Text style={styles.matchText}>
                      ✓ Tìm thấy dịch vụ phù hợp: {suggestedMatch.name}
                    </Text>
                  )}
              </LinearGradient>
            </View>
          )}

          {/* Subscription List */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Chọn từ danh sách khoảng trả hàng tháng</Text>
            
            {subscriptions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="list-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>Chưa có khoảng trả hàng tháng nào</Text>
                <Text style={styles.emptySubText}>
                  Hãy thêm khoảng trả hàng tháng mới trong tab Categories
                </Text>
              </View>
            ) : (
              <View style={styles.subscriptionsList}>
                {subscriptions.map((subscription) => (
                  <Pressable
                    key={subscription.id}
                    style={[
                      styles.subscriptionItem,
                      selectedSubscriptionId === subscription.id && styles.subscriptionItemSelected,
                      subscription.id === suggestedMatch?.id && styles.subscriptionItemSuggested
                    ]}
                    onPress={() => handleSelectSubscription(subscription)}
                  >
                    <View style={styles.subscriptionLeft}>
                      <Text style={[
                        styles.subscriptionName,
                        selectedSubscriptionId === subscription.id && styles.subscriptionNameSelected
                      ]}>
                        {subscription.name}
                      </Text>
                      {subscription.description && (
                        <Text style={styles.subscriptionDescription}>
                          {subscription.description}
                        </Text>
                      )}
                      <View style={styles.subscriptionMeta}>
                        <Text style={styles.subscriptionPrice}>
                          {formatCurrency(subscription.pricePerMonth)}/tháng
                        </Text>
                        <Text style={styles.subscriptionCategory}>
                          {subscription.category}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.subscriptionRight}>
                      {selectedSubscriptionId === subscription.id ? (
                        <Ionicons name="checkmark-circle" size={24} color="#8B7FE0" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={24} color="#d1d5db" />
                      )}
                      {subscription.id === suggestedMatch?.id && (
                        <Ionicons name="star" size={16} color="#F59E0B" style={styles.suggestionStar} />
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Custom Amount Section */}
            {selectedSubscriptionId && (
              <View style={styles.customAmountSection}>
                <View style={styles.customAmountHeader}>
                  <Text style={styles.sectionTitle}>Số tiền thanh toán</Text>
                  <Pressable
                    style={styles.customAmountToggle}
                    onPress={handleCustomAmountToggle}
                  >
                    <Text style={styles.toggleText}>
                      {showCustomAmount ? 'Dùng giá mặc định' : 'Nhập số tiền khác'}
                    </Text>
                  </Pressable>
                </View>

                {showCustomAmount ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Số tiền tùy chỉnh</Text>
                    <TextInput
                      style={styles.textInput}
                      value={customAmount}
                      onChangeText={setCustomAmount}
                      placeholder="Nhập số tiền"
                      keyboardType="numeric"
                    />
                  </View>
                ) : (
                  <View style={styles.defaultAmount}>
                    <Text style={styles.defaultAmountText}>
                      Sử dụng giá mặc định: {formatCurrency(
                        subscriptions.find(sub => sub.id === selectedSubscriptionId)?.pricePerMonth || 0
                      )}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.actionButton, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </Pressable>
            
            <Pressable
              style={[
                styles.actionButton, 
                styles.confirmButton,
                (!isValid || loading) && { opacity: 0.6 }
              ]}
              onPress={handleConfirm}
              disabled={!isValid || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.confirmButtonText}>Xác nhận thanh toán</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '85%',
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
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  suggestionBanner: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionGradient: {
    padding: 16,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    color: '#8B7FE0',
    marginLeft: 6,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6B46C1',
    marginBottom: 4,
  },
  matchText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#059669',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    color: '#374151',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#6b7280',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
  subscriptionsList: {
    gap: 8,
  },
  subscriptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  subscriptionItemSelected: {
    borderColor: '#8B7FE0',
    backgroundColor: 'rgba(139, 127, 224, 0.05)',
  },
  subscriptionItemSuggested: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  subscriptionLeft: {
    flex: 1,
  },
  subscriptionName: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    color: '#374151',
    marginBottom: 2,
  },
  subscriptionNameSelected: {
    color: '#8B7FE0',
  },
  subscriptionDescription: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6b7280',
    marginBottom: 4,
  },
  subscriptionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subscriptionPrice: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#059669',
  },
  subscriptionCategory: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6b7280',
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  subscriptionRight: {
    alignItems: 'center',
    position: 'relative',
  },
  suggestionStar: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  customAmountSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  customAmountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customAmountToggle: {
    padding: 4,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#8B7FE0',
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
  defaultAmount: {
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  defaultAmountText: {
    fontSize: 16,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#374151',
    textAlign: 'center',
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
  confirmButton: {
    backgroundColor: '#8B7FE0',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
  },
});