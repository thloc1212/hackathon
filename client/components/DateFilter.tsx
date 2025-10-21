import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

export interface DateFilterValue {
  month: number | null; // 1-12, null for all months
  year: number | null;  // null for all years
}

interface DateFilterProps {
  value: DateFilterValue;
  onChange: (filter: DateFilterValue) => void;
  style?: any;
}

const MONTHS = [
  { value: null, label: 'Tất cả tháng' },
  { value: 1, label: 'Tháng 1' },
  { value: 2, label: 'Tháng 2' },
  { value: 3, label: 'Tháng 3' },
  { value: 4, label: 'Tháng 4' },
  { value: 5, label: 'Tháng 5' },
  { value: 6, label: 'Tháng 6' },
  { value: 7, label: 'Tháng 7' },
  { value: 8, label: 'Tháng 8' },
  { value: 9, label: 'Tháng 9' },
  { value: 10, label: 'Tháng 10' },
  { value: 11, label: 'Tháng 11' },
  { value: 12, label: 'Tháng 12' },
];

// Generate years from current year back to 2020
const getCurrentYear = () => new Date().getFullYear();
const YEARS = [
  { value: null, label: 'Tất cả năm' },
  ...Array.from({ length: getCurrentYear() - 2019 }, (_, i) => {
    const year = getCurrentYear() - i;
    return { value: year, label: `Năm ${year}` };
  }),
];

export const DateFilter: React.FC<DateFilterProps> = ({ value, onChange, style }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempValue, setTempValue] = useState<DateFilterValue>(value);

  const getDisplayText = () => {
    if (!value.month && !value.year) {
      return 'Tất cả thời gian';
    }
    
    let text = '';
    if (value.month) {
      text += `Tháng ${value.month}`;
    }
    if (value.year) {
      text += `${text ? ', ' : ''}Năm ${value.year}`;
    }
    
    return text || 'Tất cả thời gian';
  };

  const handleSave = () => {
    onChange(tempValue);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setModalVisible(false);
  };

  const handleReset = () => {
    const resetValue = { month: null, year: null };
    setTempValue(resetValue);
    onChange(resetValue);
    setModalVisible(false);
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => {
          setTempValue(value);
          setModalVisible(true);
        }}
      >
        <IconSymbol name="calendar" size={20} color="#5F58C2" />
        <ThemedText style={styles.filterText}>{getDisplayText()}</ThemedText>
        <IconSymbol name="chevron.down" size={16} color="#5F58C2" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Lọc theo thời gian</ThemedText>
              <TouchableOpacity onPress={handleCancel}>
                <IconSymbol name="xmark" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Month Selection */}
              <View style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Tháng</ThemedText>
                <View style={styles.optionsContainer}>
                  {MONTHS.map((month) => (
                    <Pressable
                      key={month.value || 'all-months'}
                      style={[
                        styles.optionButton,
                        tempValue.month === month.value && styles.optionSelected,
                      ]}
                      onPress={() => setTempValue(prev => ({ ...prev, month: month.value }))}
                    >
                      <ThemedText
                        style={[
                          styles.optionText,
                          tempValue.month === month.value && styles.optionTextSelected,
                        ]}
                      >
                        {month.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Year Selection */}
              <View style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Năm</ThemedText>
                <View style={styles.optionsContainer}>
                  {YEARS.map((year) => (
                    <Pressable
                      key={year.value || 'all-years'}
                      style={[
                        styles.optionButton,
                        tempValue.year === year.value && styles.optionSelected,
                      ]}
                      onPress={() => setTempValue(prev => ({ ...prev, year: year.value }))}
                    >
                      <ThemedText
                        style={[
                          styles.optionText,
                          tempValue.year === year.value && styles.optionTextSelected,
                        ]}
                      >
                        {year.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <ThemedText style={styles.resetButtonText}>Đặt lại</ThemedText>
              </TouchableOpacity>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                  <ThemedText style={styles.cancelButtonText}>Hủy</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <ThemedText style={styles.saveButtonText}>Áp dụng</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#5F58C2',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  sectionContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: '#5F58C2',
    borderColor: '#5F58C2',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  optionTextSelected: {
    color: '#fff',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF6B6B',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#5F58C2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});