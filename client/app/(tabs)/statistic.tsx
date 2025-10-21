// statistic.tsx

import { Platform, StyleSheet, View, Pressable, ScrollView, TouchableOpacity, useWindowDimensions, SafeAreaView, RefreshControl } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { formatCurrency } from '@/utils/formatters';
import { StatusBar } from 'expo-status-bar';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DateFilter, DateFilterValue } from '@/components/DateFilter';
import TransactionItem from '@/components/TransactionItem';
import SubscriptionSelectionModal from '@/components/SubscriptionSelectionModal';

// Import types mới
import { StatisticData, SpendingSummary, Transaction, Subscription } from '@/types';
import { useApi } from '@/hooks/useApi';
import { useDatabase } from '@/hooks/useDatabase';
import SubscriptionItem from '@/components/SubscriptionItem'; 

// Default category if none available; we'll derive tabs from data at runtime
const DEFAULT_CATEGORY_TABS = ['Tất Cả'];

// Remove mock data - use only real data from database

// Mock Gemini Insight function (fallback)
const fetchInsightFromGemini = async (topCategory: SpendingSummary): Promise<string> => {
  // Logic Gemini:
  const spentIncrease = 570000;
  
  const insight = `Chi tiêu **${topCategory.category}** tháng này tăng 12% (**${formatCurrency(spentIncrease)}**) so với tháng trước. 

**Insight**: Với chi tiêu ${topCategory.category} là Top 1 (${formatCurrency(topCategory.spent)}), bạn nên thử lên kế hoạch nấu ăn tại nhà 3 bữa/tuần để tiết kiệm ít nhất **${formatCurrency(500000)}** trong tháng tới.`;

  return insight;
};


// Removed SpendingItem - now using TransactionItem component

// SpendingInsight component with API integration
const SpendingInsight = ({ topSpending, totalSpent }: { topSpending: SpendingSummary; totalSpent: number }) => {
  const [insight, setInsight] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { getInsight } = useApi();

  useEffect(() => {
    let mounted = true;
    const loadInsight = async () => {
      if (!topSpending) return;
      setIsLoading(true);
      try {
        // Try backend /insight endpoint first using useApi hook
        const response = await getInsight(
          topSpending.category, 
          topSpending.spent, 
          topSpending.percentage, 
          totalSpent
        );
        
        if (response.success && response.data?.insight && mounted) {
          setInsight(response.data.insight);
          return;
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
  }, [topSpending, totalSpent]);
  
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
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất Cả');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showAllSubscriptions, setShowAllSubscriptions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Subscription payment modal state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [suggestedSubscription, setSuggestedSubscription] = useState<any>(null);
  const [addingSubscriptionPayment, setAddingSubscriptionPayment] = useState(false);
  // State for date filter
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ month: null, year: null });
  
  // Use centralized database context
  const { 
    transactions: apiTransactions, 
    subscriptions, 
    stats, 
    loading, 
    refreshData, 
    updateSubscription, 
    deleteSubscription,
    addTransaction: addTransactionToDb,
    updateSubscription: updateSubscriptionInDb
  } = useDatabase();

  // Auto-refresh when component mounts (only once)
  useEffect(() => {
    refreshData(); // Don't pass filter on initial load
  }, []); // Empty dependency to run only once

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData(dateFilter.month, dateFilter.year);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshData, dateFilter]);

  // Handle date filter change
  const handleDateFilterChange = useCallback(async (filter: DateFilterValue) => {
    setDateFilter(filter);
    try {
      await refreshData(filter.month, filter.year);
    } catch (error) {
      console.error('Error applying date filter:', error);
    }
  }, [refreshData]);
  
  // Handle subscription payment
  const handleSubscriptionPayment = async (subscription: Subscription, customAmount?: number) => {
    try {
      setAddingSubscriptionPayment(true);
      
      const amount = customAmount || subscription.pricePerMonth;
      
      // Create transaction for this payment
      const transactionData = {
        amount: amount,
        category: subscription.category,
        description: `${subscription.name} - Thanh toán hàng tháng`,
        date: new Date().toISOString().split('T')[0],
        type: 'expense' as const,
        merchant: subscription.name,
        items: []
      };

      const transactionSuccess = await addTransactionToDb(transactionData);
      
      if (transactionSuccess) {
        // Update subscription payment tracking
        const updatedSubscription = {
          ...subscription,
          paidAmount: subscription.paidAmount + amount,
          currentMonth: subscription.totalMonths 
            ? Math.min(subscription.currentMonth + 1, subscription.totalMonths)
            : subscription.currentMonth + 1 // For unlimited subscriptions, just increment
        };
        
        await updateSubscriptionInDb(subscription.id, updatedSubscription);
        
        alert('Thanh toán thành công!');
        setShowSubscriptionModal(false);
        setSuggestedSubscription(null);
      } else {
        alert('Không thể tạo giao dịch thanh toán');
      }
    } catch (error) {
      console.error('Handle subscription payment error:', error);
      alert('Không thể xử lý thanh toán subscription');
    } finally {
      setAddingSubscriptionPayment(false);
    }
  };
  
  // Handle opening subscription payment modal
  const handlePaySubscription = (subscription: Subscription) => {
    setSuggestedSubscription({
      name: subscription.name,
      amount: subscription.pricePerMonth,
      category: subscription.category,
      description: `Thanh toán ${subscription.name} tháng này`
    });
    setShowSubscriptionModal(true);
  };
  
  // Convert API transactions to UI format and calculate statistics
  const data = useMemo(() => {
    if (!apiTransactions || !Array.isArray(apiTransactions) || !stats) {
      return {
        totalSpent: 0,
        transactions: [],
        topSpending: [],
        insight: ''
      };
    }

    // Use the already converted UI transactions with consistent date format
    const uiTransactions: Transaction[] = apiTransactions.map(t => ({
      ...t,
      date: t.date ? new Date(t.date).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN')
    }));

    // Calculate top spending categories using UI transactions
    const expenseTransactions = uiTransactions.filter(t => t.type === 'expense');
    const categorySpending: Record<string, number> = {};

    // Exclude common income category names (normalized to lowercase)
    const incomeCategorySet = new Set([
      'thu nhập', 'thu nhap', 'income', 'lương', 'luong', 'salary'
    ]);

    expenseTransactions.forEach(t => {
      const category = t.category || 'Khác';
      const key = String(category).trim().toLowerCase();
      if (incomeCategorySet.has(key)) return; // skip income categories like "Thu nhập"
      const amount = typeof t.amount === 'number' ? Math.abs(t.amount) : 0;
      categorySpending[category] = (categorySpending[category] || 0) + amount;
    });

    const topSpending = Object.entries(categorySpending)
      .map(([category, spent]) => ({
        category: category || 'Khác',
        spent: typeof spent === 'number' ? spent : 0,
        percentage: stats.totalExpenses > 0 ? Math.round((spent / stats.totalExpenses) * 100) : 0
      }))
      .sort((a, b) => (b.spent || 0) - (a.spent || 0))
      .slice(0, 3);

    return {
      totalSpent: stats.totalExpenses || 0,
      transactions: uiTransactions,
      topSpending: topSpending,
      insight: '' // Will be loaded by SpendingInsight component
    };
  }, [apiTransactions, stats]);

  // Responsive helpers
  const { width } = useWindowDimensions();
  const scale = Math.min(Math.max(width / 375, 0.85), 1.25);
  const paddingH = Math.max(12, Math.round(width * 0.04));

  // build category tabs from data
  const categoryTabs = useMemo(() => {
    const cats = new Set<string>();
    data.transactions.forEach((t: Transaction) => cats.add(t.category || 'Other'));
    return [...DEFAULT_CATEGORY_TABS, ...Array.from(cats).filter(c => c && c !== 'Tất Cả')];
  }, [data.transactions]);

  // Lọc chỉ lấy giao dịch chi tiêu VÀ theo tab đã chọn
  const filteredTransactions = useMemo(() => {
    // 1. Lọc tất cả các giao dịch là 'expense'
    const expenses = data.transactions.filter((t: Transaction) => t.type === 'expense');
    if (selectedCategory === 'Tất Cả') return expenses;
    return expenses.filter((t: Transaction) => t.category === selectedCategory);
  }, [data.transactions, selectedCategory]);

  const displayedTransactions = showAllTransactions ? filteredTransactions : filteredTransactions.slice(0, 3);
  const totalSpentFormatted = formatCurrency(typeof data.totalSpent === 'number' ? data.totalSpent : 0);
  const topSpendingCategory = data.topSpending && data.topSpending.length > 0 ? data.topSpending[0] : null;

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="dark" backgroundColor="#F0F3F8" />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView 
          style={styles.content} 
          contentContainerStyle={{ paddingHorizontal: paddingH }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#5F58C2']}
              tintColor="#5F58C2"
            />
          }
        >

          {/* Date Filter */}
          <DateFilter
            value={dateFilter}
            onChange={handleDateFilterChange}
            style={styles.dateFilter}
          />

          {/* Tổng Chi Tiêu */}
          <View style={[styles.totalSpentBox, { padding: Math.round(20 * scale), borderRadius: Math.round(16 * scale) }]}>
            <ThemedText style={[styles.totalSpentLabel, { fontSize: Math.round(18 * scale) }]}>Tổng Chi Tiêu</ThemedText>
            <ThemedText 
              style={[styles.totalSpentValue, { fontSize: Math.round(32 * scale) }]}
              numberOfLines={2}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            >
              {totalSpentFormatted}
            </ThemedText>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ThemedText style={styles.loadingText}>Đang tải thống kê...</ThemedText>
            </View>
          ) : data.transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyTitle}>Chưa có giao dịch nào</ThemedText>
              <ThemedText style={styles.emptyText}>
                Bắt đầu thêm giao dịch để xem thống kê chi tiêu của bạn ở đây.
              </ThemedText>
            </View>
          ) : (
            <>
              {/* Mẹo tiết kiệm thông minh (Insights) */}
              {topSpendingCategory && <SpendingInsight topSpending={topSpendingCategory} totalSpent={typeof data.totalSpent === 'number' ? data.totalSpent : 0} />}

              {/* Top 3 */}
              {data.topSpending.length > 0 && (
                <>
                  <ThemedText style={[styles.sectionTitle, { fontSize: Math.round(24 * scale), marginTop: Math.round(40 * scale) }]}>Top 3 chi tiêu</ThemedText>
                  <View style={styles.topSpendingContainer}>
                    {data.topSpending.map((item: SpendingSummary, index: number) => (
                      <ExpoLinearGradient key={index} colors={['#B9B4FF', '#EDE9FF']} start={{x:0,y:0}} end={{x:1,y:0}} style={[styles.topSpendingGradientItem, { padding: Math.round(12 * scale), borderRadius: Math.round(12 * scale) }]}>
                        <View style={[styles.topSpendingInner, { alignItems: 'center' }]}>
                          <ThemedText style={[styles.topSpendingRank, { fontSize: Math.round(16 * scale) }]}>{index + 1}.</ThemedText>
                          <View style={{ flex: 1, marginLeft: Math.round(10 * scale) }}>
                            <ThemedText style={[styles.topSpendingCategory, { fontSize: Math.round(15 * scale) }]}>{item.category || 'Unknown'} {item.percentage || 0}%</ThemedText>
                          </View>
                          <ThemedText style={[styles.topSpendingAmount, { fontSize: Math.round(15 * scale) }]}>-{formatCurrency(typeof item.spent === 'number' ? item.spent : 0)}</ThemedText>
                        </View>
                      </ExpoLinearGradient>
                    ))}
                  </View>
                </>
              )}

              {/* Monthly Subscriptions */}
              <View style={styles.subscriptionsHeader}>
                <ThemedText style={[styles.sectionTitle, { fontSize: Math.round(24 * scale), marginTop: Math.round(40 * scale) }]}>Khoản trả hàng tháng</ThemedText>
                {subscriptions && subscriptions.length > 2 && (
                  <Pressable onPress={() => setShowAllSubscriptions(!showAllSubscriptions)}>
                    <ThemedText style={styles.viewAllSubscriptionsText}>
                      {showAllSubscriptions ? 'Thu gọn' : 'Xem tất cả'}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              <View style={styles.subscriptionsContainer}>
                {subscriptions.length > 0 ? (
                  subscriptions
                    .slice(0, showAllSubscriptions ? subscriptions.length : 2)
                    .map((subscription) => (
                      <SubscriptionItem
                        key={subscription.id}
                        subscription={subscription}
                        onUpdate={refreshData}
                        onDelete={refreshData}
                        onPayment={handlePaySubscription}
                      />
                    ))
                ) : (
                  <ThemedText style={styles.subscriptionsPlaceholder}>
                    Chưa có khoản trả hàng tháng nào. Thêm khoản trả từ trang chủ để theo dõi các khoản thanh toán định kỳ.
                  </ThemedText>
                )}
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

              {/* Transactions List */}
              {displayedTransactions.length > 0 ? (
                <>
                  {displayedTransactions.map((transaction: Transaction) => (
                    <View key={transaction.id} style={{ marginBottom: Math.round(12 * scale) }}>
                      <TransactionItem
                        key={transaction.id}
                        transaction={{
                          ...transaction,
                          amount: transaction.category !== 'Thu nhập' ? -Math.abs(transaction.amount || 0) : (transaction.amount || 0),
                        }}
                        colorScheme='light'
                        onTransactionUpdate={async () => {
                          // Refresh data when transaction is updated or deleted
                          await refreshData();
                        }}
                      />                    
                    </View>
                  ))}
                  {filteredTransactions.length > 3 && (
                    <TouchableOpacity style={styles.viewAllButton} onPress={() => setShowAllTransactions(s => !s)}>
                      <ThemedText style={[styles.viewAllText, { fontSize: Math.round(14 * scale) }]}>{showAllTransactions ? 'Hiển thị ít hơn' : 'Xem tất cả'}</ThemedText>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={styles.noTransactionsContainer}>
                  <ThemedText style={styles.noTransactionsText}>
                    Chưa có giao dịch nào trong danh mục này.
                  </ThemedText>
                </View>
              )}
            </>
          )}

          <View style={{ height: Math.round(100 * scale) }} />
        </ScrollView>
        
        {/* Subscription Selection Modal */}
        <SubscriptionSelectionModal
          visible={showSubscriptionModal}
          onClose={() => {
            setShowSubscriptionModal(false);
            setSuggestedSubscription(null);
          }}
          subscriptions={subscriptions || []}
          suggestedSubscription={suggestedSubscription}
          onSelectSubscription={handleSubscriptionPayment}
          loading={addingSubscriptionPayment}
        />
      </SafeAreaView>
    </ThemedView>
  );
}


// --- Styles ---
// Giữ nguyên Styles từ câu trả lời trước
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F3F8',
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
  dateFilter: {
    marginVertical: 16,
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
    fontSize: 18,
    color: '#5F58C2',
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  totalSpentValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#5F58C2',
    textAlign: 'center',
    flexWrap: 'wrap',
    lineHeight: 38,
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
  noTransactionsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noTransactionsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  subscriptionsContainer: {
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
  subscriptionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllSubscriptionsText: {
    fontSize: 14,
    color: '#5F58C2',
    fontWeight: '500',
  },
  subscriptionsPlaceholder: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});