import { Platform, StyleSheet, View, Pressable, ScrollView, TextInput, Modal, TouchableOpacity, Alert } from 'react-native';
import { useMemo, useState, useCallback, useEffect } from 'react';
import Svg, { Path, G } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SpendingCategory, SpendingData } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { useDatabase } from '@/hooks/useDatabase';
import AuthService from '@/lib/authService';

// Hàm chuyển đổi độ sang radian
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

// Hàm tạo đường dẫn SVG cho cung tròn
const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
};

const COLORS = [
  '#EB1463', // Red
  '#45B7D1', // Teal
  '#007DEB', // Blue
  '#1AC625', // Green
  '#FDBE00', // Yellow
  '#FF6B6B', // Pink
  '#5F58C2', // Purple
];

// Default categories matching Gemini's Vietnamese categories
const DEFAULT_CATEGORIES = [
  { name: 'Ăn uống', color: '#EB1463' },
  { name: 'Di chuyển', color: '#45B7D1' },
  { name: 'Mua sắm', color: '#007DEB' },
  { name: 'Giải trí', color: '#1AC625' },
  { name: 'Sức khỏe', color: '#FDBE00' },
  { name: 'Giáo dục', color: '#FF6B6B' },
  { name: 'Khác', color: '#5F58C2' },
];

// Get server URL from environment variables
const getServerUrl = () => {
  const host = process.env.EXPO_PUBLIC_SERVER_HOST || 'localhost';
  const port = process.env.EXPO_PUBLIC_SERVER_PORT || '3000';
  
  if (Platform.OS === 'android') {
    const androidHost = host === 'localhost' ? '10.0.2.2' : host;
    return `http://${androidHost}:${port}`;
  }
  
  return `http://${host}:${port}`;
};

const SERVER_URL = getServerUrl();

// Default budget for categories
const DEFAULT_BUDGET = 500000; // 500k

const BudgetProgress = ({ categories }: { categories: SpendingCategory[] }) => {
  // Tính toán các segment dựa trên tỷ lệ chi tiêu
  const calculateSegments = (cats: SpendingCategory[]) => {
    const totalSpent = cats.reduce((sum, cat) => sum + cat.spent, 0);
    let currentAngle = -90; // Bắt đầu từ trên cùng
    
    // Nếu chỉ có 1 category có chi tiêu > 0
    const spendingCategories = cats.filter(cat => cat.spent > 0);
    if (spendingCategories.length === 1) {
      return cats.map(cat => {
        if (cat.spent > 0) {
          return {
            ...cat,
            startAngle: -90,
            segmentAngle: 360,
            spentPercentage: 100
          };
        }
        return {
          ...cat,
          startAngle: -90,
          segmentAngle: 0,
          spentPercentage: 0
        };
      });
    }
    
    // Xử lý bình thường cho nhiều categories
    return cats.map(cat => {
      const spentPercentage = totalSpent > 0 ? (cat.spent / totalSpent) * 100 : 0;
      const segmentAngle = (spentPercentage / 100) * 360;
      const startAngle = currentAngle;
      
      currentAngle += segmentAngle;
      
      return {
        ...cat,
        startAngle,
        segmentAngle,
        spentPercentage
      };
    });
  };

  // Sắp xếp categories theo % đã chi từ cao xuống thấp và tính toán góc
  const sortedCategories = calculateSegments([...categories].sort((a, b) => {
    const percentA = (a.spent / a.budget) * 100;
    const percentB = (b.spent / b.budget) * 100;
    return percentB - percentA;
  }));

  // Tổng budget và spent
  const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);
  const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
  const totalPercentage = Math.round((totalSpent / totalBudget) * 100);

  const radius = 80; // Bán kính vòng tròn
  const strokeWidth = 20; // Độ dày của vòng tròn
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * normalizedRadius;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.totalContainer}>
        <View style={styles.totalContent}>
          <View style={styles.totalItem}>
            <IconSymbol name="creditcard" size={24} color="#6B4EFF" />
            <View style={styles.totalTextContainer}>
              <ThemedText style={styles.totalLabel}>Tổng ngân sách</ThemedText>
              <ThemedText style={styles.totalValue}>{formatCurrency(totalBudget)}</ThemedText>
            </View>
          </View>
          <View style={styles.totalProgressContainer}>
            <View style={styles.totalProgressBar}>
              <View style={[styles.totalProgressFill, { width: `${Math.min(totalPercentage, 100)}%` }]} />
            </View>
            <ThemedText style={styles.totalPercent}>{totalPercentage}%</ThemedText>
          </View>
          <View style={styles.totalSubItems}>
            <View style={styles.totalSubItem}>
              <View style={styles.totalSubItemRow}>
                <View style={[styles.totalDot, { backgroundColor: '#FF6B6B' }]} />
                <ThemedText style={styles.totalSubLabel}>Đã chi</ThemedText>
              </View>
              <ThemedText style={[styles.totalSubValue, { color: '#FF6B6B' }]} numberOfLines={1}>{formatCurrency(totalSpent)}</ThemedText>
            </View>
            <View style={styles.totalSubItem}>
              <View style={styles.totalSubItemRow}>
                <View style={[styles.totalDot, { backgroundColor: '#4ECDC4' }]} />
                <ThemedText style={styles.totalSubLabel}>Còn lại</ThemedText>
              </View>
              <ThemedText style={[styles.totalSubValue, { color: '#4ECDC4' }]} numberOfLines={1}>{formatCurrency(totalBudget - totalSpent)}</ThemedText>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.progressCircle}>
        <Svg height={radius * 2} width={radius * 2} style={StyleSheet.absoluteFill}>
          {/* Vẽ các phần chi tiêu */}
          {sortedCategories.map((category, index) => {
            const { startAngle, segmentAngle } = category;
            
            // Tạo đường dẫn cho phần hình pie
            const startPoint = polarToCartesian(radius, radius, radius, startAngle);
            const endPoint = polarToCartesian(radius, radius, radius, startAngle + segmentAngle);
            const largeArcFlag = segmentAngle <= 180 ? "0" : "1";
            
            const pathData = [
              "M", radius, radius, // Di chuyển đến tâm
              "L", startPoint.x, startPoint.y, // Vẽ line từ tâm đến điểm bắt đầu
              "A", radius, radius, 0, largeArcFlag, 1, endPoint.x, endPoint.y, // Vẽ cung tròn
              "Z" // Đóng path bằng cách nối về tâm
            ].join(" ");
            
            return (
              <Path
                key={category.id}
                d={pathData}
                fill={category.color}
                opacity={0.8}
              />
            );
          })}
        </Svg>

      </View>
    </View>
  );
};

const CategoryModal = ({ 
  visible, 
  onClose, 
  onSave, 
  initialData 
}: { 
  visible: boolean; 
  onClose: () => void; 
  onSave: (data: Omit<SpendingCategory, 'id'>) => void;
  initialData: SpendingCategory;
}) => {
  const [spent, setSpent] = useState(initialData.spent.toString());
  const [budget, setBudget] = useState(initialData.budget.toString());
  const [selectedColor, setSelectedColor] = useState(initialData.color);

  useEffect(() => {
    if (visible) {
      setSpent(initialData.spent.toString());
      setBudget(initialData.budget.toString());
      setSelectedColor(initialData.color);
    }
  }, [visible, initialData]);

  const handleSave = () => {
    onSave({
      ...initialData,
      spent: parseInt(spent, 10) || 0,
      budget: parseInt(budget, 10) || 0,
      color: selectedColor,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Cập nhật chi tiêu</ThemedText>
          </View>
          
          <View style={styles.categoryInfo}>
            <ThemedText style={styles.categoryName}>{initialData.name}</ThemedText>
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>Ngân sách</ThemedText>
            <TextInput
              style={styles.input}
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
              placeholder="Nhập ngân sách"
            />
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>Số tiền đã chi</ThemedText>
            <TextInput
              style={styles.input}
              value={spent}
              onChangeText={setSpent}
              keyboardType="numeric"
              placeholder="Nhập số tiền đã chi"
            />
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>Màu sắc</ThemedText>
            <View style={styles.colorPicker}>
              {COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.selectedColor,
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>
          </View>

          <View style={styles.modalButtons}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <ThemedText style={styles.buttonText}>Huỷ</ThemedText>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <ThemedText style={[styles.buttonText, { color: '#FFF' }]}>Lưu</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
};

const SpendingCard = ({ 
  category,
  onEdit
}: { 
  category: SpendingCategory;
  onEdit: (category: SpendingCategory) => void;
}) => {
  const percentage = Math.min((category.spent / category.budget) * 100, 100);
  
  return (
    <Pressable 
      style={[styles.categoryCard, { backgroundColor: category.color + '20' }]}
      onPress={() => onEdit(category)}
    >
      <View style={styles.categoryHeader}>
        <ThemedText style={styles.categoryTitle}>{category.name}</ThemedText>
        <ThemedText style={styles.budgetAmount}>{category.budget.toLocaleString()}đ</ThemedText>
      </View>
      <ThemedText style={styles.categoryAmount}>
        {category.spent.toLocaleString()}đ/{category.budget.toLocaleString()}đ
      </ThemedText>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${Math.min(percentage, 100)}%`, backgroundColor: category.color }]} />
      </View>
    </Pressable>
  );
};

export default function CategoriesScreen() {
  // Get real data from database context
  const { transactions, stats, loading } = useDatabase();

  // State for user-defined budgets
  const [userBudgets, setUserBudgets] = useState<Record<string, number>>({});
  const [budgetsLoaded, setBudgetsLoaded] = useState(false);

  // Get current user
  const currentUser = AuthService.getCurrentUser();
  const session = AuthService.getCurrentSession();

  // Load user budgets from server on mount
  useEffect(() => {
    const loadBudgets = async () => {
      try {
        if (!session?.id) {
          console.warn('No session available for loading budgets');
          setBudgetsLoaded(true);
          return;
        }
        
        const response = await fetch(`${SERVER_URL}/budgets`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.id}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          setUserBudgets(result.data || {});
        } else {
          console.error('Failed to load budgets:', await response.text());
        }
        
        setBudgetsLoaded(true);
      } catch (error) {
        console.error('Error loading budgets:', error);
        setBudgetsLoaded(true);
      }
    };
    loadBudgets();
  }, [session?.id]);

  // Save user budgets to server
  const saveBudgets = async (budgets: Record<string, number>) => {
    try {
      if (!session?.id) {
        console.warn('No session available for saving budgets');
        return;
      }
      
      const response = await fetch(`${SERVER_URL}/budgets`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.id}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ budgets }),
      });

      if (response.ok) {
        const result = await response.json();
        setUserBudgets(result.data || budgets);
      } else {
        console.error('Failed to save budgets:', await response.text());
        Alert.alert('Lỗi', 'Không thể lưu ngân sách. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Error saving budgets:', error);
      Alert.alert('Lỗi', 'Không thể lưu ngân sách. Vui lòng thử lại.');
    }
  };

  // Generate categories from real transaction data
  const realCategories = useMemo(() => {
    if (!budgetsLoaded) return []; // Wait for budgets to load

    const categorySpending = stats?.categorySummary || {};
    const generatedCategories: SpendingCategory[] = [];

    // Start with all default categories
    DEFAULT_CATEGORIES.forEach((defaultCat, index) => {
      const spent = categorySpending[defaultCat.name] || 0;
      // Use user-defined budget if exists, otherwise use default
      const budget = userBudgets[defaultCat.name] || DEFAULT_BUDGET;
      
      generatedCategories.push({
        id: defaultCat.name.toLowerCase().replace(/\s+/g, '-'),
        name: defaultCat.name,
        budget: budget, // Use stored budget, not calculated from spending
        spent: spent,
        color: defaultCat.color
      });
    });

    // Add any additional categories from spending data that aren't in defaults
    Object.entries(categorySpending).forEach(([categoryName, spent]) => {
      const existsInDefaults = DEFAULT_CATEGORIES.some(def => def.name === categoryName);
      if (!existsInDefaults && spent > 0) {
        const budget = userBudgets[categoryName] || Math.max(spent * 1.5, 100000);
        generatedCategories.push({
          id: categoryName.toLowerCase().replace(/\s+/g, '-'),
          name: categoryName,
          budget: budget,
          spent: spent,
          color: COLORS[generatedCategories.length % COLORS.length]
        });
      }
    });

    return generatedCategories;
  }, [stats, userBudgets, budgetsLoaded]);

  const [spendingData, setSpendingData] = useState<SpendingData>({
    totalBudget: 0,
    categories: [],
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SpendingCategory | null>(null);

  // Update spending data when real data changes
  useEffect(() => {
    const totalBudget = realCategories.reduce((sum, cat) => sum + cat.budget, 0);
    setSpendingData({
      totalBudget,
      categories: realCategories,
    });
  }, [realCategories]);

  const updateTotalBudget = useCallback((categories: SpendingCategory[]) => {
    const total = categories.reduce((acc, cat) => acc + cat.budget, 0);
    return total;
  }, []);

  const handleAddCategory = (categoryData: Omit<SpendingCategory, 'id'>) => {
    const newCategory = {
      ...categoryData,
      id: Date.now().toString(),
    };

    setSpendingData(prev => {
      const newCategories = [...prev.categories, newCategory];
      return {
        categories: newCategories,
        totalBudget: updateTotalBudget(newCategories),
      };
    });
  };

  const handleEditCategory = (categoryData: Omit<SpendingCategory, 'id'>) => {
    if (!editingCategory) return;

    if (categoryData.deleted) {
      handleDeleteCategory(editingCategory.id);
    } else {
      setSpendingData(prev => {
        const newCategories = prev.categories.map(cat =>
          cat.id === editingCategory.id
            ? { ...cat, ...categoryData }
            : cat
        );
        return {
          categories: newCategories,
          totalBudget: updateTotalBudget(newCategories),
        };
      });
    }
  };

  const handleDeleteCategory = (id: string) => {
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc muốn xóa danh mục này?",
      [
        {
          text: "Hủy",
          style: "cancel"
        },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => {
            setSpendingData(prev => {
              const newCategories = prev.categories.filter(cat => cat.id !== id);
              return {
                categories: newCategories,
                totalBudget: updateTotalBudget(newCategories),
              };
            });
          }
        }
      ]
    );
  };

  const totalSpent = useMemo(() => {
    return spendingData.categories.reduce((acc, cat) => acc + cat.spent, 0);
  }, [spendingData.categories]);

  const spentPercentage = (totalSpent / spendingData.totalBudget) * 100;

  const openEditModal = (category: SpendingCategory) => {
    setEditingCategory(category);
    setModalVisible(true);
  };

  const handleEditSpent = (categoryData: Omit<SpendingCategory, 'id'>) => {
    if (!editingCategory) return;
    
    // Save the new budget to server database
    const newBudgets = {
      ...userBudgets,
      [editingCategory.name]: categoryData.budget
    };
    saveBudgets(newBudgets);
    
    setSpendingData(prev => ({
      ...prev,
      categories: prev.categories.map(cat => 
        cat.id === editingCategory.id
          ? { 
              ...cat, 
              spent: categoryData.spent,
              budget: categoryData.budget,
              color: categoryData.color
            }
          : cat
      )
    }));
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText style={styles.title}>Danh Mục</ThemedText>
        </View>
      </View>
      
      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>Loading categories...</ThemedText>
          </View>
        ) : spendingData.categories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyTitle}>No Categories Yet</ThemedText>
            <ThemedText style={styles.emptyText}>
              Start adding transactions to see your spending categories here.
            </ThemedText>
          </View>
        ) : (
          <>
            <BudgetProgress categories={spendingData.categories} />
            
            <View style={styles.categoriesContainer}>
              {spendingData.categories.map(category => (
                <SpendingCard
                  key={category.id}
                  category={category}
                  onEdit={openEditModal}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {editingCategory && (
        <CategoryModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSave={handleEditSpent}
          initialData={editingCategory}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  categoryInfo: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  categoryBudget: {
    fontSize: 14,
    color: '#666',
  },
  budgetAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  totalContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalContent: {
    gap: 16,
  },
  totalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  totalTextContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6B4EFF',
  },
  totalProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  totalProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  totalProgressFill: {
    height: '100%',
    backgroundColor: '#6B4EFF',
    borderRadius: 4,
  },
  totalPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B4EFF',
    minWidth: 45,
  },
  totalSubItems: {
    flexDirection: 'column',
    gap: 12,
  },
  totalSubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  totalSubItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  totalSubLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalSubValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalDivider: {
    backgroundColor: '#E5E5E5',
    marginHorizontal: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  budgetSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  budgetItem: {
    flex: 1,
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  budgetValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  budgetDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#E5E5E5',
    marginHorizontal: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  totalBudget: {
    fontSize: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  progressRings: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  content: {
    flex: 1,
  },
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  progressCircle: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6B4EFF',
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
  },
  categoriesContainer: {
    gap: 16,
    paddingBottom: 80, // Space for FAB
  },
  categoryCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryAmount: {
    fontSize: 14,
    color: '#666',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6B4EFF',
    borderRadius: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6B4EFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6B4EFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 8,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
  },
});