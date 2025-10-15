// statistic.tsx

import { Platform, StyleSheet, View, Pressable, ScrollView, TouchableOpacity, useWindowDimensions, SafeAreaView } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { formatCurrency } from '@/utils/formatters';
import { StatusBar } from 'expo-status-bar';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Import types mới
import { StatisticData, SpendingSummary, Transaction } from '@/types'; 

// Default category if none available; we'll derive tabs from data at runtime
const DEFAULT_CATEGORY_TABS = ['Tất Cả'];

// Tính toán lại totalSpent cho Mock Data: (500k + 1.5M + 50k) = 2.050.000
const MOCK_TOTAL_SPENT = 2050000; 

const mockStatisticData: StatisticData = {
  totalSpent: 2999000,
  transactions: [
    // Giao dịch Chi Tiêu
    { id: 't1', type: 'expense', category: 'Ăn Uống', amount: -500000, description: 'Hát Kara', date: '15/10/2025' },
    { id: 't2', type: 'expense', category: 'Siêu Thị', amount: -1500000, description: 'Mua sắm gia đình', date: '14/10/2025' },
    { id: 't3', type: 'expense', category: 'Di Chuyển', amount: -50000, description: 'Grab đi làm', date: '13/10/2025' },
    // Thêm một giao dịch Thu Nhập để kiểm tra logic lọc
    { id: 't4', type: 'income', category: 'Lương', amount: 20000000, description: 'Lương tháng 10', date: '01/10/2025' },
  ],
  topSpending: [
    { category: 'Ăn Uống', percentage: 35, spent: 5320000 },
    { category: 'Di Chuyển', percentage: 20, spent: 3040000 },
    { category: 'Quà tặng', percentage: 15, spent: 2240000 },
  ],
  insight: 'Gợi ý mặc định: Cố gắng giảm 10% chi tiêu nơi mua sắm.',
};

// Mock Gemini Insight function
const fetchInsightFromGemini = async (topCategory: SpendingSummary): Promise<string> => {
  // Logic Gemini:
  const spentIncrease = 570000;
  
  const insight = `Chi tiêu **${topCategory.category}** tháng này tăng 12% (**${formatCurrency(spentIncrease)} VND**) so với tháng trước. 

**Insight**: Với chi tiêu ${topCategory.category} là Top 1 (${formatCurrency(topCategory.spent)} VND), bạn nên thử lên kế hoạch nấu ăn tại nhà 3 bữa/tuần để tiết kiệm ít nhất **${formatCurrency(500000)} VND** trong tháng tới.`;

  return insight;
};


const SpendingItem = ({ transaction }: { transaction: Transaction }) => {
  // Lấy giá trị tuyệt đối để hiển thị số tiền chi tiêu
  const displayAmount = transaction.amount;

  // Chỉ hiển thị giao dịch chi tiêu
  if (transaction.type === 'income') return null;

  return (
    <View style={styles.spendingItemCard}>
      <View style={styles.spendingItemLeft}>
        <View style={styles.categoryIconPlaceholder} />
        <View>
          {/* Số tiền luôn hiển thị là số âm (chi tiêu) */}
          <ThemedText style={styles.spendingAmount}>
            {formatCurrency(displayAmount)} VND 
          </ThemedText>
          <ThemedText style={styles.spendingDescription}>
            Nội Dung: {transaction.description}
          </ThemedText>
        </View>
      </View>
    </View>
  );
};

// ... SpendingInsight component (Không thay đổi) ...
const SpendingInsight = ({ topSpending }: { topSpending: SpendingSummary }) => {
  const [insight, setInsight] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadInsight = async () => {
      if (!topSpending) return;
      setIsLoading(true);
      try {
        // Try backend /insight endpoint first
        const res = await fetch('http://localhost:3000/insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: topSpending.category, spent: topSpending.spent, percentage: topSpending.percentage, totalSpent: MOCK_TOTAL_SPENT }),
        });
        if (res.ok) {
          const json = await res.json();
          if (mounted && json?.insight) {
            setInsight(json.insight);
            return;
          }
        }

        // Fallback to local generator
        const local = await fetchInsightFromGemini(topSpending);
        if (mounted) setInsight(local);
      } catch (error) {
        console.error('Error fetching insight:', error);
        if (mounted) setInsight('Không thể tải mẹo tiết kiệm thông minh.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadInsight();
    return () => { mounted = false; };
  }, [topSpending]);
  
  const renderInsightText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean);
    
    return (
      <ThemedText style={styles.insightText}>
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <ThemedText key={index} style={styles.insightTextBold}>
                {part.slice(2, -2)}
              </ThemedText>
            );
          }
          return part;
        })}
      </ThemedText>
    );
  };
  
  return (
    <View style={styles.insightContainer}>
      <ThemedText style={styles.insightTitle}>
        Mẹo tiết kiệm thông minh
      </ThemedText>
      {isLoading ? (
        <ThemedText style={styles.insightText}>Đang tải gợi ý...</ThemedText>
      ) : (
        renderInsightText(insight)
      )}
    </View>
  );
};


// --- Main Screen ---

export default function StatisticScreen() {
  const [data, setData] = useState<StatisticData>(mockStatisticData);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất Cả');
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  // Responsive helpers
  const { width } = useWindowDimensions();
  const scale = Math.min(Math.max(width / 375, 0.85), 1.25);
  const paddingH = Math.max(12, Math.round(width * 0.04));

  // build category tabs from data
  const categoryTabs = useMemo(() => {
    const cats = new Set<string>();
    data.transactions.forEach((t) => cats.add(t.category || 'Other'));
    return [...DEFAULT_CATEGORY_TABS, ...Array.from(cats).filter(c => c && c !== 'Tất Cả')];
  }, [data.transactions]);

  // Lọc chỉ lấy giao dịch chi tiêu VÀ theo tab đã chọn
  const filteredTransactions = useMemo(() => {
    // 1. Lọc tất cả các giao dịch là 'expense'
    const expenses = data.transactions.filter(t => t.type === 'expense');
    if (selectedCategory === 'Tất Cả') return expenses;
    return expenses.filter(t => t.category === selectedCategory);
  }, [data.transactions, selectedCategory]);

  const displayedTransactions = showAllTransactions ? filteredTransactions : filteredTransactions.slice(0, 3);
  const totalSpentFormatted = formatCurrency(data.totalSpent);
  const topSpendingCategory = data.topSpending[0];

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="dark" backgroundColor="#F0F3F8" />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView style={styles.content} contentContainerStyle={{ paddingHorizontal: paddingH }}>

          {/* Tổng Chi Tiêu */}
          <View style={[styles.totalSpentBox, { padding: Math.round(20 * scale), borderRadius: Math.round(16 * scale) }]}>
            <ThemedText style={[styles.totalSpentLabel, { fontSize: Math.round(20 * scale) }]}>Tổng Chi Tiêu</ThemedText>
            <ThemedText style={[styles.totalSpentValue, { fontSize: Math.round(35 * scale) }]}>
              {totalSpentFormatted} VND
            </ThemedText>
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
              {categoryTabs.map((tab) => (
                <Pressable
                  key={tab}
                  style={[
                    styles.tabButton,
                    selectedCategory === tab && styles.tabSelected,
                    { paddingHorizontal: Math.round(12 * scale), paddingVertical: Math.round(6 * scale) }
                  ]}
                  onPress={() => setSelectedCategory(tab)}
                >
                  <ThemedText style={[styles.tabText, { fontSize: Math.round(14 * scale) }, selectedCategory === tab ? styles.tabTextSelected : styles.tabTextUnselected]}>
                    {tab}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Transactions */}
          {displayedTransactions.map(transaction => (
            <View key={transaction.id} style={{ marginBottom: Math.round(12 * scale) }}>
              <SpendingItem transaction={transaction} />
            </View>
          ))}
          {filteredTransactions.length > 3 && (
            <TouchableOpacity style={styles.viewAllButton} onPress={() => setShowAllTransactions(s => !s)}>
              <ThemedText style={[styles.viewAllText, { fontSize: Math.round(14 * scale) }]}>{showAllTransactions ? 'Show less' : 'View All'}</ThemedText>
            </TouchableOpacity>
          )}

          {/* Top 3 */}
          <ThemedText style={[styles.sectionTitle, { fontSize: Math.round(24 * scale), marginTop: Math.round(40 * scale) }]}>Top 3 chi tiêu</ThemedText>
          <View style={styles.topSpendingContainer}>
            {data.topSpending.map((item, index) => (
              <ExpoLinearGradient key={index} colors={['#B9B4FF', '#EDE9FF']} start={{x:0,y:0}} end={{x:1,y:0}} style={[styles.topSpendingGradientItem, { padding: Math.round(12 * scale), borderRadius: Math.round(12 * scale) }]}>
                <View style={[styles.topSpendingInner, { alignItems: 'center' }]}>
                  <ThemedText style={[styles.topSpendingRank, { fontSize: Math.round(16 * scale) }]}>{index + 1}.</ThemedText>
                  <View style={{ flex: 1, marginLeft: Math.round(10 * scale) }}>
                    <ThemedText style={[styles.topSpendingCategory, { fontSize: Math.round(15 * scale) }]}>{item.category} {item.percentage}%</ThemedText>
                  </View>
                  <ThemedText style={[styles.topSpendingAmount, { fontSize: Math.round(15 * scale) }]}>-{formatCurrency(item.spent)} VND</ThemedText>
                </View>
              </ExpoLinearGradient>
            ))}
          </View>

          <SpendingInsight topSpending={topSpendingCategory} />

          <View style={{ height: Math.round(100 * scale) }} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}


// --- Styles ---
// Giữ nguyên Styles từ câu trả lời trước
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    marginVertical: 15,
    marginTop: 50,
    color: '#5F58C2',
  },
  totalSpentBox: {
    backgroundColor: '#E6E0FF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 30,
  },
  totalSpentLabel: {
    fontSize: 20,
    color: '#5F58C2',
    fontWeight: '500',
    marginBottom: 20,
  },
  totalSpentValue: {
    fontSize: 35,
    fontWeight: 'bold',
    color: '#5F58C2',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F0F0F0',
  },
  tabSelected: {
    backgroundColor: '#5F58C2',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextSelected: {
    color: '#FFF',
  },
  tabTextUnselected: {
    color: '#666',
  },
  spendingItemCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  spendingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    marginRight: 12,
  },
  spendingAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F60000',
  },
  spendingDescription: {
    fontSize: 14,
    color: '#666',
  },
  viewAllButton: {
    padding: 8,
    alignSelf: 'center',
    marginVertical: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: '#6B4EFF',
  },
  topSpendingContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    padding: 16,
    marginBottom: 24,
  },
  topSpendingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  topSpendingRank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6B4EFF',
    minWidth: 20,
  },
  topSpendingCategory: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 10,
    color: '#333',
  },
  topSpendingAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F60000',
  },
  insightContainer: {
    backgroundColor: '#241E78',
    borderRadius: 12,
    padding: 30,
    marginBottom: 24,
    marginTop: 30,
  },
  insightTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD45B',
    marginBottom: 20,
  },
  insightText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#fff',
  },
  insightTextBold: {
    fontWeight: 'bold',
    color: '#0DE31B',
  },
  gradientBarContainer: {
    width: 80,
    height: 12,
    borderRadius: 8,
    backgroundColor: '#EEE',
    overflow: 'hidden',
    marginLeft: 12,
  },
  gradientBar: {
    height: '100%',
    borderRadius: 8,
  },
  topSpendingGradientItem: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  topSpendingInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerNavBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingBottom: 20,
  },
  cameraButtonPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6B4EFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});