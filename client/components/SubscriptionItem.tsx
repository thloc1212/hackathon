import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, Alert, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontFamily, FontWeight } from '@/constants/theme';
import { Subscription } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { useDatabase } from '@/hooks/useDatabase';

// Cross-platform alert function
const showCrossPlatformAlert = (title: string, message: string, buttons: Array<{text: string, onPress?: () => void, style?: 'default' | 'cancel' | 'destructive'}> = [{text: 'OK'}]) => {
  if (Platform.OS === 'web') {
    // For web/desktop users
    const buttonText = buttons.map(btn => btn.text).join(' / ');
    const result = window.confirm(`${title}\n\n${message}\n\n(${buttonText})`);
    
    if (result && buttons[1]?.onPress) {
      buttons[1].onPress();
    } else if (!result && buttons[0]?.onPress) {
      buttons[0].onPress();
    }
  } else {
    // For mobile app users (iOS/Android)
    Alert.alert(title, message, buttons.map(btn => ({
      text: btn.text,
      onPress: btn.onPress,
      style: btn.style,
    })), { cancelable: false });
  }
};

interface SubscriptionItemProps {
  subscription: Subscription;
  onUpdate?: () => void;
  onDelete?: () => void;
  onPayment?: (subscription: Subscription) => void; // New prop for payment handling
}

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

export default function SubscriptionItem({ subscription, onUpdate, onDelete, onPayment }: SubscriptionItemProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(subscription.name);
  const [editDescription, setEditDescription] = useState(subscription.description || '');
  const [editPricePerMonth, setEditPricePerMonth] = useState(subscription.pricePerMonth.toString());
  const [editTotalMonths, setEditTotalMonths] = useState(subscription.totalMonths?.toString() || '');
  const [editCategory, setEditCategory] = useState(subscription.category);
  const [editStartDate, setEditStartDate] = useState(subscription.startDate);
  const [editIsActive, setEditIsActive] = useState(subscription.isActive);
  // Consider subscription unlimited if totalMonths is 999 or higher
  const [isLimitedDuration, setIsLimitedDuration] = useState(subscription.totalMonths !== null && subscription.totalMonths < 999);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const { updateSubscription, deleteSubscription } = useDatabase();

  // Calculate derived values with improved payment status detection
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const startDate = new Date(subscription.startDate);
  
  // Calculate how many months since subscription started
  const monthsSinceStart = Math.max(1, 
    (currentYear - startDate.getFullYear()) * 12 + 
    (currentMonth - (startDate.getMonth() + 1)) + 1
  );
  
  // How much should have been paid by now (handle unlimited subscriptions)
  const expectedPaidAmount = subscription.totalMonths 
    ? Math.min(monthsSinceStart, subscription.totalMonths) * subscription.pricePerMonth
    : monthsSinceStart * subscription.pricePerMonth;
  
  // Check if current month is paid
  const isCurrentMonthPaid = subscription.paidAmount >= expectedPaidAmount;
  
  // Amount needed for this month (0 if already paid)
  const needToPayThisMonth = isCurrentMonthPaid ? 0 : subscription.pricePerMonth;
  
  // Remaining amount for the entire subscription (unlimited subscriptions show 0)
  // Consider subscription unlimited if totalMonths is 999 or higher
  const totalMonths = subscription.totalMonths || 0;
  const isUnlimited = totalMonths >= 999;
  
  const amountLeft = !isUnlimited
    ? Math.max(0, (totalMonths * subscription.pricePerMonth) - subscription.paidAmount)
    : 0; // For unlimited subscriptions, we don't show remaining amount
  
  const progressPercentage = !isUnlimited
    ? (Math.min(monthsSinceStart, totalMonths) / totalMonths) * 100
    : (monthsSinceStart / Math.max(monthsSinceStart, 12)) * 100; // For unlimited, use a sliding window

  const handleEdit = () => {
    setShowEditModal(true);
    setEditName(subscription.name);
    setEditDescription(subscription.description || '');
    setEditPricePerMonth(subscription.pricePerMonth.toString());
    setEditTotalMonths(subscription.totalMonths?.toString() || '');
    setEditCategory(subscription.category);
    setEditStartDate(subscription.startDate);
    setEditIsActive(subscription.isActive);
    const totalMonths = subscription.totalMonths || 0;
    setIsLimitedDuration(totalMonths > 0 && totalMonths < 999);
  };

  const handleSave = async () => {
    if (!editName.trim() || !editPricePerMonth.trim() || !editCategory.trim() || !editStartDate.trim()) {
      showCrossPlatformAlert('Lỗi', 'Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    // Only validate totalMonths if limited duration is enabled
    if (isLimitedDuration && (!editTotalMonths.trim() || isNaN(parseInt(editTotalMonths)) || parseInt(editTotalMonths) <= 0)) {
      showCrossPlatformAlert('Lỗi', 'Vui lòng nhập tổng số tháng hợp lệ cho thời hạn có giới hạn');
      return;
    }

    const pricePerMonth = parseFloat(editPricePerMonth);
    // Use 999 for unlimited subscriptions (matches convention in other components)
    const totalMonths = isLimitedDuration ? parseInt(editTotalMonths) : 999;

    if (isNaN(pricePerMonth) || pricePerMonth <= 0) {
      showCrossPlatformAlert('Lỗi', 'Vui lòng nhập giá hợp lệ');
      return;
    }

    if (isLimitedDuration && totalMonths && totalMonths < subscription.currentMonth) {
      showCrossPlatformAlert('Lỗi', 'Tổng số tháng phải lớn hơn tháng hiện tại');
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(editStartDate)) {
      showCrossPlatformAlert('Lỗi', 'Ngày bắt đầu phải có định dạng YYYY-MM-DD');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        name: editName.trim(),
        description: editDescription.trim(),
        pricePerMonth: pricePerMonth,
        totalMonths: totalMonths,
        category: editCategory.trim(),
        startDate: editStartDate,
        isActive: editIsActive,
      };

      const success = await updateSubscription(subscription.id, updateData);

      if (success) {
        setShowEditModal(false);
        showCrossPlatformAlert('Thành công', 'Khoản trả đã được cập nhật');
        if (onUpdate) {
          onUpdate();
        }
      } else {
        showCrossPlatformAlert('Lỗi', 'Không thể cập nhật khoản trả');
      }
    } catch (error) {
      console.error('Update subscription error:', error);
      showCrossPlatformAlert('Lỗi', 'Không thể cập nhật khoản trả');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowEditModal(false);
    setShowCategoryDropdown(false);
    setEditName(subscription.name);
    setEditDescription(subscription.description || '');
    setEditPricePerMonth(subscription.pricePerMonth.toString());
    setEditTotalMonths(subscription.totalMonths?.toString() || '');
    setEditCategory(subscription.category);
    setEditStartDate(subscription.startDate);
    setEditIsActive(subscription.isActive);
    setIsLimitedDuration(subscription.totalMonths !== null);
  };

  const handleCategorySelect = (category: string) => {
    setEditCategory(category);
    setShowCategoryDropdown(false);
  };

  const handleLimitedDurationToggle = () => {
    const newLimitedDuration = !isLimitedDuration;
    setIsLimitedDuration(newLimitedDuration);
    
    if (newLimitedDuration) {
      // When enabling limited duration, set a default value
      setEditTotalMonths('12');
    } else {
      // When disabling limited duration, clear the value
      setEditTotalMonths('');
    }
  };

  const handleDeletePress = () => {
    showCrossPlatformAlert(
      'Xác nhận xóa',
      `Bạn có chắc chắn muốn xóa khoản trả hàng tháng "${subscription.name}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xóa', 
          style: 'destructive',
          onPress: () => processDelete()
        },
      ]
    );
  };

  const processDelete = async () => {
    setDeleting(true);
    try {
      const success = await deleteSubscription(subscription.id);
      
      if (success) {
        showCrossPlatformAlert('Thành công', 'Khoản trả đã được xóa');
        if (onDelete) {
          onDelete();
        }
      } else {
        showCrossPlatformAlert('Lỗi', 'Không thể xóa khoản trả hàng tháng');
      }
    } catch (error) {
      console.error('Delete subscription error:', error);
      showCrossPlatformAlert('Lỗi', 'Không thể xóa khoản trả hàng tháng');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Pressable onPress={handleEdit} style={styles.container}>
        <LinearGradient
          colors={['#E8E4FF', '#F3F0FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.subscriptionName} numberOfLines={1}>
                {subscription.name}
              </Text>
              {subscription.description && (
                <Text style={styles.subscriptionDescription} numberOfLines={1}>
                  {subscription.description}
                </Text>
              )}
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {subscription.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {subscription.totalMonths 
                ? `Tháng ${Math.min(monthsSinceStart, subscription.totalMonths)}/${subscription.totalMonths}`
                : `Tháng ${monthsSinceStart} (Không giới hạn)`}
              {isCurrentMonthPaid && ' (Đã thanh toán)'}
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressFill, { width: `${progressPercentage}%` }]} 
              />
            </View>
          </View>

          {/* Financial Info */}
          <View style={styles.financialInfo}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Giá/tháng</Text>
                <Text style={styles.infoValue}>
                  {formatCurrency(subscription.pricePerMonth)}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Đã trả</Text>
                <Text style={styles.infoValuePaid}>
                  {formatCurrency(subscription.paidAmount)}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Còn lại</Text>
                <Text style={styles.infoValueRemaining}>
                  {formatCurrency(Math.max(0, amountLeft))}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Tháng này</Text>
                <Text style={[
                  needToPayThisMonth === 0 ? styles.infoValuePaid : styles.infoValueCurrent,
                  needToPayThisMonth === 0 && { textDecorationLine: 'line-through' }
                ]}>
                  {formatCurrency(needToPayThisMonth)}
                </Text>
              </View>
            </View>
          </View>

          {/* Category and Actions */}
          <View style={styles.footer}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{subscription.category}</Text>
            </View>
            <View style={styles.footerActions}>
              {subscription.isActive && needToPayThisMonth > 0 && onPayment && (
                <Pressable
                  style={styles.payButton}
                  onPress={() => onPayment(subscription)}
                >
                  <Text style={styles.payButtonText}>Trả tháng này</Text>
                </Pressable>
              )}
              <Ionicons name="chevron-forward" size={16} color="#8B7FE0" />
            </View>
          </View>
        </LinearGradient>
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
              <Text style={styles.modalTitle}>Chỉnh sửa khoản trả hàng tháng</Text>
              <View style={styles.headerActions}>
                <Pressable 
                  onPress={handleDeletePress} 
                  style={[styles.deleteButton, deleting && { opacity: 0.6 }]}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  )}
                </Pressable>
                <Pressable onPress={handleCancel} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#666" />
                </Pressable>
              </View>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tên khoản trả *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Tên khoản trả hàng tháng"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mô tả</Text>
                <TextInput
                  style={styles.textInput}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Mô tả (tùy chọn)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Giá mỗi tháng *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editPricePerMonth}
                  onChangeText={setEditPricePerMonth}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tổng số tháng</Text>
                
                {/* Limited Duration Checkbox */}
                <Pressable
                  style={styles.checkboxContainer}
                  onPress={handleLimitedDurationToggle}
                >
                  <View style={styles.checkbox}>
                    {isLimitedDuration ? (
                      <Ionicons name="checkbox" size={24} color="#8B7FE0" />
                    ) : (
                      <Ionicons name="square-outline" size={24} color="#9CA3AF" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Có thời hạn giới hạn</Text>
                </Pressable>

                {/* Duration Input - Only show when limited duration is enabled */}
                {isLimitedDuration && (
                  <TextInput
                    style={styles.textInput}
                    value={editTotalMonths}
                    onChangeText={setEditTotalMonths}
                    placeholder="12"
                    keyboardType="numeric"
                  />
                )}

                {/* Info text */}
                <Text style={styles.durationInfoText}>
                  {isLimitedDuration 
                    ? 'Khoản trả sẽ kết thúc sau số tháng đã chỉ định'
                    : 'Khoản trả sẽ tiếp tục vô thời hạn'
                  }
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ngày bắt đầu *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editStartDate}
                  onChangeText={setEditStartDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Trạng thái</Text>
                <Pressable
                  style={[styles.statusToggle, editIsActive ? styles.statusToggleActive : styles.statusToggleInactive]}
                  onPress={() => setEditIsActive(!editIsActive)}
                >
                  <View style={[styles.statusToggleIndicator, editIsActive && styles.statusToggleIndicatorActive]}>
                    <Ionicons 
                      name={editIsActive ? "checkmark" : "close"} 
                      size={16} 
                      color={editIsActive ? "#10b981" : "#ef4444"} 
                    />
                  </View>
                  <Text style={[styles.statusToggleText, editIsActive ? styles.statusToggleTextActive : styles.statusToggleTextInactive]}>
                    {editIsActive ? 'Đang hoạt động' : 'Tạm dừng'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Danh mục *</Text>
                
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
                            <Ionicons name="checkmark" size={20} color="#8B7FE0" />
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
                
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
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Thông tin hiện tại</Text>
                <Text style={styles.infoSectionText}>
                  Tháng hiện tại: {subscription.currentMonth}{subscription.totalMonths ? `/${subscription.totalMonths}` : ' (Không giới hạn)'}
                </Text>
                <Text style={styles.infoSectionText}>
                  Đã thanh toán: {formatCurrency(subscription.paidAmount)}
                </Text>
                <Text style={styles.infoSectionText}>
                  Ngày bắt đầu: {new Date(subscription.startDate).toLocaleDateString('vi-VN')}
                </Text>
                <Text style={styles.infoSectionText}>
                  Thanh toán tiếp theo: {new Date(subscription.nextPaymentDate).toLocaleDateString('vi-VN')}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </Pressable>
              
              <Pressable
                style={[styles.actionButton, styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
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
    marginVertical: 8,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gradientBackground: {
    padding: 20,
    borderRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  subscriptionName: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#4C1D95',
    marginBottom: 4,
  },
  subscriptionDescription: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6B46C1',
  },
  statusBadge: {
    backgroundColor: 'rgba(139, 127, 224, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 127, 224, 0.4)',
  },
  statusText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#8B7FE0',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#6B46C1',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(139, 127, 224, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B7FE0',
    borderRadius: 4,
  },
  financialInfo: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6B46C1',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#4C1D95',
  },
  infoValuePaid: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#059669',
  },
  infoValueRemaining: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#DC2626',
  },
  infoValueCurrent: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#F59E0B',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(139, 127, 224, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#4C1D95',
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
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
    bottom: 70,
    left: 0,
    right: 0,
    marginBottom: 8,
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
    backgroundColor: 'rgba(139, 127, 224, 0.1)',
  },
  dropdownItemText: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#374151',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#8B7FE0',
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
  },
  infoSection: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  infoSectionTitle: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#374151',
    marginBottom: 12,
  },
  infoSectionText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6b7280',
    marginBottom: 4,
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
    backgroundColor: '#8B7FE0',
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
  // Status Toggle Styles
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  statusToggleActive: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  statusToggleInactive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  statusToggleIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  statusToggleIndicatorActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
  },
  statusToggleText: {
    fontSize: 16,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  statusToggleTextActive: {
    color: '#10b981',
  },
  statusToggleTextInactive: {
    color: '#ef4444',
  },
  
  // New styles for payment functionality
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payButton: {
    backgroundColor: '#8B7FE0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  payButtonText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: 'white',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    marginRight: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#374151',
  },
  durationInfoText: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
});