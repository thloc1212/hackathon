import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontFamily, FontWeight } from '@/constants/theme';

// Cross-platform alert function
const showCrossPlatformAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    alert(`${title}\n\n${message}`);
  }
};

interface SubscriptionCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (subscriptionData: any) => void;
  initialData?: any;
  isLoading?: boolean;
}

const CATEGORIES = [
  'Ăn uống',
  'Di chuyển',
  'Mua sắm',
  'Giải trí',
  'Sức khỏe',
  'Giáo dục',
  'Khác',
];

export default function SubscriptionCreationModal({
  visible,
  onClose,
  onConfirm,
  initialData,
  isLoading = false
}: SubscriptionCreationModalProps) {
  const [name, setName] = useState('');
  const [pricePerMonth, setPricePerMonth] = useState('');
  const [totalMonths, setTotalMonths] = useState('');
  const [category, setCategory] = useState('Khác');
  const [description, setDescription] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [isLimitedDuration, setIsLimitedDuration] = useState(false);

  // Update states when initialData changes
  React.useEffect(() => {
    console.log('[SubscriptionCreationModal] initialData changed:', initialData);
    if (initialData) {
      console.log('[SubscriptionCreationModal] Prefilling form with:', {
        name: initialData.name,
        pricePerMonth: initialData.pricePerMonth,
        totalMonths: initialData.totalMonths,
        category: initialData.category,
        description: initialData.description
      });
      setName(initialData.name || '');
      setPricePerMonth(initialData.pricePerMonth?.toString() || '');
      setTotalMonths(initialData.totalMonths?.toString() || '');
      setCategory(initialData.category || 'Khác');
      setDescription(initialData.description || '');
      setPaidAmount(initialData.paidAmount?.toString() || '0');
      setStartDate(initialData.startDate || new Date().toISOString().split('T')[0]);
      // Set limited duration checkbox based on whether totalMonths exists
      setIsLimitedDuration(initialData.totalMonths !== null && initialData.totalMonths !== undefined);
    } else {
      console.log('[SubscriptionCreationModal] No initialData, resetting to defaults');
      // Reset to defaults when no initial data
      setName('');
      setPricePerMonth('');
      setTotalMonths('');
      setCategory('Khác');
      setDescription('');
      setPaidAmount('0');
      setStartDate(new Date().toISOString().split('T')[0]);
      setIsLimitedDuration(false);
    }
  }, [initialData]);

  const handleConfirm = () => {
    if (!name.trim()) {
      showCrossPlatformAlert('Lỗi', 'Vui lòng nhập tên khoảng trả');
      return;
    }
    
    if (!pricePerMonth.trim() || isNaN(Number(pricePerMonth)) || Number(pricePerMonth) <= 0) {
      showCrossPlatformAlert('Lỗi', 'Vui lòng nhập giá hợp lệ');
      return;
    }
    
    // Only validate totalMonths if limited duration is enabled
    if (isLimitedDuration && (!totalMonths.trim() || isNaN(Number(totalMonths)) || Number(totalMonths) <= 0)) {
      showCrossPlatformAlert('Lỗi', 'Vui lòng nhập số tháng hợp lệ cho thời hạn có giới hạn');
      return;
    }

    if (paidAmount && (isNaN(Number(paidAmount)) || Number(paidAmount) < 0)) {
      showCrossPlatformAlert('Lỗi', 'Số tiền đã trả không được âm');
      return;
    }

    const startDateObj = new Date(startDate);
    const nextMonth = new Date(startDateObj);
    nextMonth.setMonth(startDateObj.getMonth() + 1);

    const subscriptionData = {
      name: name.trim(),
      description: description.trim() || name.trim(),
      pricePerMonth: Number(pricePerMonth),
      currentMonth: 0,
      // Server requires totalMonths to be a number, for unlimited use a large number (e.g., 999)
      totalMonths: isLimitedDuration ? Number(totalMonths) : 999, // 999 months (about 83 years) essentially means unlimited
      paidAmount: paidAmount ? Number(paidAmount) : 0,
      category,
      startDate: startDate,
      nextPaymentDate: nextMonth.toISOString().split('T')[0],
      isActive: true,
    };

    onConfirm(subscriptionData);
  };

  const handleCategorySelect = (selectedCategory: string) => {
    setCategory(selectedCategory);
    setShowCategoryDropdown(false);
  };

  const handleLimitedDurationToggle = () => {
    const newLimitedDuration = !isLimitedDuration;
    setIsLimitedDuration(newLimitedDuration);
    
    if (newLimitedDuration) {
      // When enabling limited duration, set a default value
      setTotalMonths('12');
    } else {
      // When disabling limited duration, clear the value
      setTotalMonths('');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#E8E4FF', '#F3F0FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBackground}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerLeft}>
                <Text style={styles.modalTitle}>Tạo khoảng trả hàng tháng mới</Text>
                <Text style={styles.modalSubtitle}>Thêm khoảng trả định kỳ</Text>
              </View>
              <TouchableOpacity onPress={onClose} disabled={isLoading} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#6B46C1" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Service Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tên khoảng trả *</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ví dụ: Netflix, Spotify, Google One"
                  placeholderTextColor="#9CA3AF"
                  editable={!isLoading}
                />
              </View>

              {/* Price Per Month */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Giá mỗi tháng *</Text>
                <View style={styles.priceInputContainer}>
                  <TextInput
                    style={styles.priceInput}
                    value={pricePerMonth}
                    onChangeText={setPricePerMonth}
                    placeholder="50000"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                  <Text style={styles.currencyLabel}>VNĐ</Text>
                </View>
              </View>

              {/* Duration Section */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Thời hạn</Text>
                
                {/* Limited Duration Checkbox */}
                <Pressable
                  style={styles.checkboxContainer}
                  onPress={handleLimitedDurationToggle}
                  disabled={isLoading}
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
                  <View style={styles.durationContainer}>
                    <TextInput
                      style={styles.durationInput}
                      value={totalMonths}
                      onChangeText={setTotalMonths}
                      placeholder="12"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                    <Text style={styles.durationLabel}>tháng</Text>
                  </View>
                )}

                {/* Info text */}
                <Text style={styles.durationInfoText}>
                  {isLimitedDuration 
                    ? 'Khoảng trả sẽ kết thúc sau số tháng đã chỉ định'
                    : 'Khoảng trả sẽ tiếp tục vô thời hạn'
                  }
                </Text>
              </View>

              {/* Paid Amount */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Số tiền đã trả</Text>
                <View style={styles.priceInputContainer}>
                  <TextInput
                    style={styles.priceInput}
                    value={paidAmount}
                    onChangeText={setPaidAmount}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                  <Text style={styles.currencyLabel}>VNĐ</Text>
                </View>
              </View>

              {/* Start Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ngày bắt đầu</Text>
                <TextInput
                  style={styles.textInput}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  editable={!isLoading}
                />
              </View>

              {/* Category */}
              <View style={[styles.inputGroup, { zIndex: 1000 }]}>
                <Text style={styles.inputLabel}>Danh mục</Text>
                <View style={styles.categoryContainer}>
                  <Pressable
                    style={styles.categoryButton}
                    onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    disabled={isLoading}
                  >
                    <Text style={styles.categoryButtonText}>{category}</Text>
                    <Ionicons 
                      name={showCategoryDropdown ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#6B46C1" 
                    />
                  </Pressable>

                  {showCategoryDropdown && (
                    <View style={styles.categoryDropdown}>
                      <ScrollView style={styles.categoryList} nestedScrollEnabled>
                        {CATEGORIES.map((cat) => (
                          <Pressable
                            key={cat}
                            style={[
                              styles.categoryItem,
                              category === cat && styles.categoryItemSelected
                            ]}
                            onPress={() => handleCategorySelect(cat)}
                          >
                            <Text style={[
                              styles.categoryItemText,
                              category === cat && styles.categoryItemTextSelected
                            ]}>
                              {cat}
                            </Text>
                            {category === cat && (
                              <Ionicons name="checkmark" size={20} color="#8B7FE0" />
                            )}
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              {/* Description */}
              <View style={[styles.inputGroup, { zIndex: 1 }]}>
                <Text style={styles.inputLabel}>Mô tả (tùy chọn)</Text>
                <TextInput
                  style={styles.textArea}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Thêm mô tả cho khoảng trả này..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={2}
                  editable={!isLoading}
                />
              </View>

              {/* Info Section */}
              <View style={[styles.infoSection, { zIndex: 1 }]}>
                <View style={styles.infoRow}>
                  <Ionicons name="information-circle-outline" size={18} color="#6B46C1" />
                  <Text style={styles.infoText}>
                    {isLimitedDuration && totalMonths 
                      ? `Khoảng trả ${totalMonths} tháng` 
                      : 'Khoảng trả không giới hạn thời gian'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={18} color="#6B46C1" />
                  <Text style={styles.infoText}>
                    Thanh toán tiếp theo vào {new Date(new Date(startDate).getTime() + 30*24*60*60*1000).toLocaleDateString('vi-VN')}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmButton, isLoading && styles.confirmButtonDisabled]}
                onPress={handleConfirm}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmButtonText}>Tạo khoảng trả</Text>
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>
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
    marginHorizontal: 16,
    width: '92%',
    maxHeight: '85%',
    borderRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  gradientBackground: {
    borderRadius: 20,
    overflow: 'hidden',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 127, 224, 0.2)',
  },
  headerLeft: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#4C1D95',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6B46C1',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
    paddingBottom: 0,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#4C1D95',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(139, 127, 224, 0.3)',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#4C1D95',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(139, 127, 224, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#4C1D95',
  },
  currencyLabel: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#8B7FE0',
    marginLeft: 8,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(139, 127, 224, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  durationInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#4C1D95',
  },
  durationLabel: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#8B7FE0',
    marginLeft: 8,
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
    color: '#4C1D95',
  },
  durationInfoText: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6B46C1',
    marginTop: 8,
    fontStyle: 'italic',
  },
  categoryContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(139, 127, 224, 0.3)',
    borderRadius: 12,
    padding: 12,
  },
  categoryButtonText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#4C1D95',
  },
  categoryDropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'rgba(139, 127, 224, 0.3)',
    borderRadius: 12,
    maxHeight: 150,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 9999,
  },
  categoryList: {
    maxHeight: 150,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 127, 224, 0.1)',
  },
  categoryItemSelected: {
    backgroundColor: 'rgba(139, 127, 224, 0.1)',
  },
  categoryItemText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#4C1D95',
  },
  categoryItemTextSelected: {
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#8B7FE0',
  },
  textArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(139, 127, 224, 0.3)',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#4C1D95',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  infoSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 127, 224, 0.2)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6B46C1',
    marginLeft: 6,
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 127, 224, 0.2)',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(139, 127, 224, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#6B46C1',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#8B7FE0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: 'white',
  },
});