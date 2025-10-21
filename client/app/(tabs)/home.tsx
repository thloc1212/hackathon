import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  Pressable, 
  StyleSheet, 
  Dimensions,
  ScrollView,
  Alert,
  Platform,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl
} from 'react-native';

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
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, FontFamily, FontWeight } from '@/constants/theme';
import TransactionItem from '@/components/TransactionItem';
import SubscriptionSelectionModal from '@/components/SubscriptionSelectionModal';
import SubscriptionCreationModal from '@/components/SubscriptionCreationModal';
import { Transaction } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { Subscription } from '@/types';
import AuthService from '@/lib/authService';
import { useApi, GeminiTransactionResponse } from '@/hooks/useApi';
import { useDatabase } from '@/hooks/useDatabase';
import { detectSubscriptionPayment } from '@/services/geminiService';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const colorScheme = 'light'; // Force light mode
  const colors = Colors[colorScheme];
  const [userName, setUserName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Dashboard state
  const [ocrText, setOcrText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [structuredResponse, setStructuredResponse] = useState<GeminiTransactionResponse | null>(null);
  const [addingTransaction, setAddingTransaction] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editingOcrText, setEditingOcrText] = useState('');
  
  // Subscription payment state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [suggestedSubscription, setSuggestedSubscription] = useState<any>(null);
  const [addingSubscriptionPayment, setAddingSubscriptionPayment] = useState(false);
  const [showAllSubscriptions, setShowAllSubscriptions] = useState(false);
  
  // New subscription creation state
  const [showSubscriptionCreationModal, setShowSubscriptionCreationModal] = useState(false);
  const [newSubscriptionData, setNewSubscriptionData] = useState<any>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  
  // Installment plan confirmation state
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [installmentData, setInstallmentData] = useState<any>(null);
  
  // Database context for centralized data management
  const {
    transactions, 
    subscriptions,
    stats, 
    loading: dbLoading, 
    error: dbError, 
    refreshData,
    addTransaction: addTransactionToDb,
    addSubscription: addSubscriptionToDb,
    updateSubscription: updateSubscriptionInDb
  } = useDatabase();  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshData]);
  
  // API hook for parsing receipts
  const { 
    loading: parseLoading, 
    error: parseError, 
    parseReceipt,
    paySubscription,
    ping,
    parseTest
  } = useApi();

  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    if(currentUser?.name) {
      setUserName(currentUser.name);
    } else if (currentUser?.email) {
      // Extract name from email (before @ symbol)
      const name = currentUser.email.split('@')[0];
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));
    }
  }, []);



  // Data is now managed by the DatabaseProvider context
  // No need for manual data loading

  const callGemini = async () => {
    try {
      setIsProcessingAI(true);
      
      // First, check if this is subscription-related
      const subscriptionDetection = await detectSubscriptionPayment(ocrText, subscriptions || []);
      
      console.log('[home] Subscription detection result:', subscriptionDetection);
      console.log('[home] Input text analyzed:', ocrText);
      
      // If it's a subscription payment, show subscription selection modal
      if (subscriptionDetection.isSubscriptionPayment && subscriptionDetection.confidence && subscriptionDetection.confidence >= 60) {
        console.log('[home] ✅ SUBSCRIPTION PAYMENT detected with confidence:', subscriptionDetection.confidence);
        setSuggestedSubscription({
          name: subscriptionDetection.subscriptionName || '',
          amount: subscriptionDetection.amount,
          category: subscriptionDetection.category,
          description: subscriptionDetection.description
        });
        setShowSubscriptionModal(true);
        return;
      }
      
      // If it's an installment plan, show confirmation modal
      if (subscriptionDetection.isInstallmentPlan && subscriptionDetection.confidence && subscriptionDetection.confidence >= 60) {
        console.log('[home] ✅ INSTALLMENT PLAN detected with confidence:', subscriptionDetection.confidence);
        
        // Create installment data for modal
        const installmentInfo = {
          subscriptionData: {
            name: subscriptionDetection.subscriptionName || 'Khoảng trả góp',
            pricePerMonth: subscriptionDetection.amount || 0, // Monthly installment amount
            totalMonths: subscriptionDetection.duration || 12,
            category: subscriptionDetection.category || 'Khác',
            description: subscriptionDetection.description || `Trả góp ${subscriptionDetection.subscriptionName}`,
            startDate: new Date().toISOString().split('T')[0], // Today
            isActive: true,
            currentMonth: 0, // Starting at month 0
            paidAmount: 0 // No installment payment made yet
          },
          upfrontTransaction: {
            amount: subscriptionDetection.paidAmount || 0,
            category: subscriptionDetection.category || 'Khác',
            description: `${subscriptionDetection.subscriptionName} - Trả trước`,
            date: new Date().toISOString().split('T')[0],
            type: 'expense' as const,
            merchant: subscriptionDetection.subscriptionName || 'Trả góp',
            items: []
          },
          totalAmount: subscriptionDetection.totalAmount,
          paidAmount: subscriptionDetection.paidAmount,
          remainingAmount: subscriptionDetection.remainingAmount
        };
        
        setInstallmentData(installmentInfo);
        setShowInstallmentModal(true);
        return;
      }
      
      // If it's a new subscription creation, show subscription creation modal
      if (subscriptionDetection.isNewSubscription && subscriptionDetection.confidence && subscriptionDetection.confidence >= 60) {
        console.log('[home] ✅ NEW SUBSCRIPTION detected with confidence:', subscriptionDetection.confidence);
        
        // Use duration from Gemini detection, with fallback to manual extraction
        const totalMonths = subscriptionDetection.duration || (() => {
          const durationMatch = ocrText.match(/(\d+)\s*tháng/i);
          return durationMatch ? parseInt(durationMatch[1]) : null; // Default to unlimited if no duration specified
        })();
        
        // Create proper subscription data
        const subscriptionData = {
          name: subscriptionDetection.subscriptionName || 'Khoảng trả hàng tháng mới',
          pricePerMonth: subscriptionDetection.amount || 0,
          totalMonths: totalMonths,
          category: subscriptionDetection.category || 'Khác',
          description: subscriptionDetection.description || 'Khoảng trả hàng tháng mới',
          startDate: new Date().toISOString().split('T')[0], // Today
          isActive: true,
          currentMonth: 0, // Starting at month 0
          paidAmount: 0 // No payment made yet
        };
        
        setNewSubscriptionData(subscriptionData);
        setShowSubscriptionCreationModal(true);
        return;
      }
      
      // If not subscription-related or low confidence, proceed with normal receipt parsing
      console.log('[home] ➡️ NORMAL RECEIPT parsing (not subscription-related or low confidence)');
      const response = await parseReceipt(ocrText);
      
      if (response.success && response.data) {
        // Structure the response and show modal
        setStructuredResponse(response.data);
        // Pre-select all items (all checkboxes ticked by default)
        if (response.data.items && Array.isArray(response.data.items)) {
          setSelectedItems(response.data.items.map((_, index) => index));
        }
        setShowModal(true);
      } else {
        showCrossPlatformAlert('Lỗi', response.error || 'Không thể phân tích hóa đơn');
      }
    } catch (err: any) {
      console.error('[client] Gemini error:', err);
      showCrossPlatformAlert('Lỗi', err?.message || 'Không thể phân tích hóa đơn');
    } finally {
      setIsProcessingAI(false);
    }
  };

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
        
        showCrossPlatformAlert('Thanh toán thành công!', `Đã ghi nhận thanh toán hàng tháng ${subscription.name} - ${formatCurrency(amount)}`);
        setOcrText('');
        setShowSubscriptionModal(false);
        setSuggestedSubscription(null);
      } else {
        showCrossPlatformAlert('Lỗi', 'Không thể tạo giao dịch thanh toán');
      }
    } catch (error) {
      console.error('Handle subscription payment error:', error);
      showCrossPlatformAlert('Lỗi', 'Không thể xử lý thanh toán dịch vụ hàng tháng');
    } finally {
      setAddingSubscriptionPayment(false);
    }
  };



  const handlePaySubscription = (subscription: Subscription) => {
    showCrossPlatformAlert(
      'Xác nhận thanh toán',
      `Bạn có chắc chắn muốn thanh toán ${subscription.name} với số tiền ${subscription.pricePerMonth.toLocaleString('vi-VN')}đ?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xác nhận', 
          onPress: () => processSubscriptionPayment(subscription)
        },
      ]
    );
  };

  const processSubscriptionPayment = async (subscription: Subscription) => {
    try {
      // Update subscription payment
      const paymentResponse = await paySubscription(subscription.id);
      
      if (paymentResponse.success) {
        // Create structured response for the payment to show in transaction modal
        const paymentStructuredResponse = {
          merchant: subscription.name,
          total: subscription.pricePerMonth,
          amount: subscription.pricePerMonth,
          category: subscription.category,
          items: [{
            name: `Thanh toán ${subscription.name}`,
            description: `Thanh toán ${subscription.name} tháng này`,
            price: subscription.pricePerMonth,
            amount: subscription.pricePerMonth,
            quantity: 1,
            category: subscription.category
          }]
        };

        // Set the structured response to show in modal
        setStructuredResponse(paymentStructuredResponse);
        setSelectedItems([0]); // Pre-select the payment item
        setShowModal(true); // Show the transaction modal

        // Force refresh the data to show updated subscription
        await refreshData();
      } else {
        showCrossPlatformAlert('Lỗi', paymentResponse.error || 'Không thể cập nhật trạng thái subscription');
      }
    } catch (error) {
      console.error('Process subscription payment error:', error);
      showCrossPlatformAlert('Lỗi', 'Không thể xử lý thanh toán subscription');
    }
  };

  const handleCreateSubscription = async (subscriptionData: any) => {
    try {
      setIsProcessingAI(true);
      
      console.log('[home] Creating new subscription:', subscriptionData);
      
      const success = await addSubscriptionToDb(subscriptionData);
      
      if (success) {
        showCrossPlatformAlert('Thành công!', `Đã tạo khoảng trả hàng tháng "${subscriptionData.name}" thành công!`);
        setShowSubscriptionCreationModal(false);
        setNewSubscriptionData(null);
        
        // Refresh data to show the new subscription
        await refreshData();
      } else {
        showCrossPlatformAlert('Lỗi', 'Không thể tạo khoảng trả hàng tháng. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Create subscription error:', error);
      showCrossPlatformAlert('Lỗi', 'Có lỗi xảy ra khi tạo khoảng trả hàng tháng');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleCreateInstallmentPlan = async () => {
    if (!installmentData) return;
    
    try {
      setIsProcessingAI(true);
      
      console.log('[home] Creating installment plan:', installmentData);
      
      // Create the subscription first
      const subscriptionSuccess = await addSubscriptionToDb(installmentData.subscriptionData);
      
      if (subscriptionSuccess) {
        // Create upfront payment transaction
        const transactionSuccess = await addTransactionToDb(installmentData.upfrontTransaction);
        
        if (transactionSuccess) {
          showCrossPlatformAlert(
            'Tạo thành công!', 
            `Đã tạo khoảng trả hàng tháng "${installmentData.subscriptionData.name}" với ${installmentData.subscriptionData.totalMonths} tháng (${formatCurrency(installmentData.subscriptionData.pricePerMonth)}/tháng) và ghi nhận khoản trả trước ${formatCurrency(installmentData.upfrontTransaction.amount)}.`
          );
          setOcrText('');
          setShowInstallmentModal(false);
          setInstallmentData(null);
          await refreshData();
        } else {
          showCrossPlatformAlert('Lỗi', 'Đã tạo khoảng trả hàng tháng nhưng không thể ghi nhận khoản trả trước');
        }
      } else {
        showCrossPlatformAlert('Lỗi', 'Không thể tạo khoảng trả hàng tháng');
      }
    } catch (error) {
      console.error('Create installment plan error:', error);
      showCrossPlatformAlert('Lỗi', 'Có lỗi xảy ra khi tạo kế hoạch trả góp');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!structuredResponse || addingTransaction || selectedItems.length === 0) {
      if (selectedItems.length === 0) {
        showCrossPlatformAlert('Chưa chọn mặt hàng', 'Vui lòng chọn ít nhất một mặt hàng để thêm.');
      }
      return;
    }

    setAddingTransaction(true);
    try {
      let successCount = 0;
      let failureCount = 0;

      // Add each selected item as a separate transaction
      for (const itemIndex of selectedItems) {
        const item = structuredResponse.items?.[itemIndex];
        if (!item) continue;

        const transactionData = {
          amount: Math.abs(item.price || item.amount || 0), // Use item's amount
          category: item.category || structuredResponse.category || 'Khác', // Use item's category, fallback to overall category
          description: `${structuredResponse.merchant ? structuredResponse.merchant + ' - ' : ''}${item.name || item.description || 'Item'}`,
          date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
          type: 'expense' as const, // Default to expense for receipts
          merchant: structuredResponse.merchant,
          items: [] // Each transaction is for a single item, no items array needed
        };

        console.log('Adding individual transaction:', transactionData);
        const success = await addTransactionToDb(transactionData);
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }
      }

      if (successCount > 0) {
        showCrossPlatformAlert(
          'Thành công', 
          `Đã thêm ${successCount} giao dịch thành công${failureCount > 0 ? `, ${failureCount} thất bại` : ''}.`
        );
        setShowModal(false);
        setOcrText('');
        setStructuredResponse(null);
        setSelectedItems([]);
      } else {
        showCrossPlatformAlert('Lỗi', 'Không thể thêm bất kỳ giao dịch nào');
      }
    } catch (error) {
      console.error('Add transactions error:', error);
      showCrossPlatformAlert('Lỗi', 'Không thể thêm giao dịch');
    } finally {
      setAddingTransaction(false);
    }
  };

  const handleChangeTransaction = () => {
    setEditMode(true);
    setEditingOcrText(ocrText);
  };

  const handleSaveEdit = async () => {
    if (!editingOcrText.trim()) {
      showCrossPlatformAlert('Lỗi', 'Vui lòng nhập một số văn bản để phân tích');
      return;
    }

    try {
      const response = await parseReceipt(editingOcrText);
      
      if (response.success && response.data) {
        // Update the structured response with new data
        setStructuredResponse(response.data);
        // Pre-select all items again
        if (response.data.items && Array.isArray(response.data.items)) {
          setSelectedItems(response.data.items.map((_, index) => index));
        }
        setEditMode(false);
        setOcrText(editingOcrText); // Update the main OCR text
      } else {
        showCrossPlatformAlert('Lỗi', response.error || 'Không thể phân tích văn bản đã chỉnh sửa');
      }
    } catch (err: any) {
      console.error('[client] Edit Gemini error:', err);
      showCrossPlatformAlert('Lỗi', err?.message || 'Không thể phân tích văn bản đã chỉnh sửa');
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditingOcrText('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedItems([]);
    setEditMode(false);
    setEditingOcrText('');
  };

  const toggleItemSelection = (index: number) => {
    setSelectedItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  // Connectivity checks
  const doPing = async () => {
    try {
      const response = await ping();
      if (response.success && response.data) {
        showCrossPlatformAlert('Ping thành công', `Máy chủ có thể truy cập: ${response.data.ok}`);
      } else {
        showCrossPlatformAlert('Lỗi Ping', response.error || 'Không thể ping máy chủ');
      }
    } catch (err) {
      console.error('[client] ping error', err);
      showCrossPlatformAlert('Lỗi Ping', `lỗi ping: ${err}`);
    }
  };

  const doParseTest = async () => {
    try {
      const response = await parseTest();
      if (response.success) {
        showCrossPlatformAlert('Test phân tích thành công', `Phản hồi: ${JSON.stringify(response.data)}`);
      } else {
        showCrossPlatformAlert('Lỗi test phân tích', response.error || 'Không thể test endpoint phân tích');
      }
    } catch (err) {
      console.error('[client] parse-test error', err);
      showCrossPlatformAlert('Lỗi test phân tích', `lỗi parse-test: ${err}`);
    }
  };

  const handleLogout = async () => {
    try {
      await AuthService.signout();
      showCrossPlatformAlert('Thành công', 'Đăng xuất thành công');
      // The auth service will trigger the auth change listener and navigate automatically
    } catch (error) {
      showCrossPlatformAlert('Lỗi', 'Không thể đăng xuất');
    }
  };

  return (
    <SafeAreaView style={[dashboardStyles.container, { backgroundColor: '#F0F3F8' }]}>
      <StatusBar style="dark" backgroundColor="#F0F3F8" />
      <ScrollView 
        style={dashboardStyles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#5F58C2']}
            tintColor="#5F58C2"
          />
        }
      >
        {/* Welcome Section */}
        <View style={dashboardStyles.welcomeSection}>
          <Text style={[dashboardStyles.welcomeText, { color: colors.text }]}>
            Chào mừng bạn trở lại,
          </Text>
          <Text style={[dashboardStyles.userName, { color: "#5F58C2" }]}>
            {userName}!
          </Text>
          
          {/* Logout moved to Profile screen */}
        </View>

        {/* Balance Block with Linear Gradient */}
        <View style={dashboardStyles.balanceBlock}>
          <LinearGradient
            colors={['#5F58C2', '#E3E1FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={dashboardStyles.gradientBackground}
          >
            <Text style={dashboardStyles.balanceTitle}>Số dư hiện tại</Text>
            <Text style={dashboardStyles.balanceAmount}>{formatCurrency(stats?.balance || 0)}</Text>
          </LinearGradient>
        </View>

        {/* Input Section */}
        <View style={dashboardStyles.inputSections}>
          {/* Natural Language Input for both transactions and subscriptions */}
          <View style={dashboardStyles.inputSection}>
            <Text style={dashboardStyles.inputSectionTitle}>Thêm giao dịch hoặc khoảng trả hàng tháng</Text>
            <View style={dashboardStyles.geminiSection}>
              <TextInput
                multiline
                value={ocrText}
                onChangeText={setOcrText}
                placeholder="Thêm giao dịch hoặc khoảng trả hàng tháng... VD: 'Netflix tháng này', 'mua pizza 120k', 'lương tháng 10'..."
                placeholderTextColor={colors.icon}
                style={[dashboardStyles.textInput, { 
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.icon + '40'
                }]}
              />
              <Pressable
                onPress={callGemini}
                style={[dashboardStyles.geminiButton, { backgroundColor: parseError ? "#FF3D00" : "#5F58C2" }]}
                disabled={parseLoading || isProcessingAI || !ocrText.trim()}
              >
                {(parseLoading || isProcessingAI) ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  parseError ? <Ionicons name="reload" size={25} color="#fff" /> : <Ionicons name="send" size={25} color="#fff" />
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* Upcoming Subscriptions */}
        <View style={dashboardStyles.upcomingSection}>
          <View style={dashboardStyles.sectionHeader}>
            <Text style={dashboardStyles.upcomingSectionTitle}>Khoảng trả hàng tháng</Text>
          </View>
          {subscriptions && subscriptions.length > 0 ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={dashboardStyles.horizontalScrollView}
              contentContainerStyle={dashboardStyles.horizontalScrollContent}
            >
              {subscriptions
                // Sort: Active unpaid subscriptions first, then inactive ones
                .sort((a, b) => {
                  // Check if current month is paid for each subscription
                  const currentDate = new Date();
                  const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11
                  const currentYear = currentDate.getFullYear();
                  
                  // For unlimited subscriptions (totalMonths is null), compare against months since start
                  const getMonthsSinceStart = (subscription: Subscription) => {
                    const startDate = new Date(subscription.startDate);
                    const monthsSince = (currentYear - startDate.getFullYear()) * 12 + 
                                      (currentMonth - (startDate.getMonth() + 1)) + 1;
                    return Math.max(1, monthsSince);
                  };
                  
                  const aMonthsSinceStart = getMonthsSinceStart(a);
                  const bMonthsSinceStart = getMonthsSinceStart(b);
                  
                  // Check if this month is paid (compare paid amount with what should be paid)
                  const aExpectedPaid = a.totalMonths 
                    ? Math.min(aMonthsSinceStart, a.totalMonths) * a.pricePerMonth
                    : aMonthsSinceStart * a.pricePerMonth;
                  const bExpectedPaid = b.totalMonths
                    ? Math.min(bMonthsSinceStart, b.totalMonths) * b.pricePerMonth
                    : bMonthsSinceStart * b.pricePerMonth;
                  
                  const aIsPaid = a.paidAmount >= aExpectedPaid;
                  const bIsPaid = b.paidAmount >= bExpectedPaid;
                  
                  // Sort order: Active unpaid > Active paid > Inactive
                  if (a.isActive && b.isActive) {
                    if (aIsPaid && !bIsPaid) return 1; // b (unpaid) comes first
                    if (!aIsPaid && bIsPaid) return -1; // a (unpaid) comes first
                    return 0; // same payment status
                  }
                  if (a.isActive && !b.isActive) return -1; // active comes first
                  if (!a.isActive && b.isActive) return 1; // active comes first
                  return 0; // both inactive
                })
                .map((subscription) => {
                  // Calculate if current month is paid
                  const currentDate = new Date();
                  const currentMonth = currentDate.getMonth() + 1;
                  const currentYear = currentDate.getFullYear();
                  const startDate = new Date(subscription.startDate);
                  const monthsSinceStart = Math.max(1, 
                    (currentYear - startDate.getFullYear()) * 12 + 
                    (currentMonth - (startDate.getMonth() + 1)) + 1
                  );
                  
                  // For unlimited subscriptions (totalMonths is null), we only check if this month is paid
                  const expectedPaid = subscription.totalMonths 
                    ? Math.min(monthsSinceStart, subscription.totalMonths) * subscription.pricePerMonth
                    : monthsSinceStart * subscription.pricePerMonth;
                  
                  const isCurrentMonthPaid = subscription.paidAmount >= expectedPaid;
                  const amountForThisMonth = isCurrentMonthPaid ? 0 : subscription.pricePerMonth;

                  return (
                    <View key={subscription.id} style={dashboardStyles.subscriptionCard}>
                      <View style={dashboardStyles.subscriptionCardHeader}>
                        <Text style={dashboardStyles.subscriptionCardName} numberOfLines={1}>
                          {subscription.name}
                        </Text>
                        {!subscription.isActive && (
                          <Text style={dashboardStyles.inactiveText}>Không hoạt động</Text>
                        )}
                      </View>
                      
                      <Text style={dashboardStyles.subscriptionCardDate}>
                        {isCurrentMonthPaid ? 'Đã thanh toán tháng này' : 
                         subscription.totalMonths ? `Tháng ${monthsSinceStart}/${subscription.totalMonths}` : 
                         `Tháng ${monthsSinceStart} (Không giới hạn)`}
                      </Text>
                      
                      <Text style={[
                        dashboardStyles.subscriptionCardAmount,
                        isCurrentMonthPaid && dashboardStyles.paidAmount
                      ]}>
                        {formatCurrency(amountForThisMonth)}
                      </Text>
                      
                      {subscription.isActive && !isCurrentMonthPaid && (
                        <Pressable
                          style={dashboardStyles.subscriptionPayButton}
                          onPress={() => {
                            // Open subscription payment modal instead of transaction modal
                            setSuggestedSubscription({
                              name: subscription.name,
                              amount: subscription.pricePerMonth,
                              category: subscription.category,
                              description: `Thanh toán ${subscription.name} tháng này`
                            });
                            setShowSubscriptionModal(true);
                          }}
                        >
                          <Text style={dashboardStyles.subscriptionPayButtonText}>Trả tháng này</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
            </ScrollView>
            ) : (
              <Text style={dashboardStyles.upcomingEmptyText}>
                Chưa có khoảng trả hàng tháng nào
              </Text>
            )}
          </View>

        {/* Recent Transactions */}
        <View style={dashboardStyles.transactionsSection}>
          <Text style={[dashboardStyles.sectionTitle, { color: colors.text }]}>
            Giao dịch gần đây
          </Text>
          <View style={dashboardStyles.transactionsList}>
            {Array.isArray(transactions) && transactions.slice(0, 10).map((transaction) => (
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
            ))}
            {(!Array.isArray(transactions) || transactions.length === 0) && (
              <Text style={[dashboardStyles.emptyText, { color: colors.text }]}>
                Chưa có giao dịch nào. Thêm giao dịch đầu tiên bằng cách phân tích hóa đơn ở trên!
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Gemini Response Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={dashboardStyles.modalOverlay}>
          <View style={dashboardStyles.modalContainer}>
            {/* Modal Header */}
            <View style={dashboardStyles.modalHeader}>
              <Text style={dashboardStyles.modalTitle}>Phân tích hóa đơn</Text>
              <Pressable onPress={handleCloseModal} style={dashboardStyles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </Pressable>
            </View>

            {/* Content - Edit Mode or Display Mode */}
            <ScrollView style={dashboardStyles.modalContent} showsVerticalScrollIndicator={false}>
              {editMode ? (
                <View style={dashboardStyles.editContainer}>
                  <Text style={dashboardStyles.editTitle}>Sửa văn bản hóa đơn</Text>
                  <Text style={dashboardStyles.editSubtitle}>
                    Chỉnh sửa văn bản bên dưới và xử lý lại để có kết quả cập nhật:
                  </Text>
                  
                  <TextInput
                    multiline
                    value={editingOcrText}
                    onChangeText={setEditingOcrText}
                    placeholder="Nhập văn bản hóa đơn..."
                    placeholderTextColor="#64748b"
                    style={dashboardStyles.editTextInput}
                  />
                  
                  <View style={dashboardStyles.editActions}>
                    <Pressable
                      style={[dashboardStyles.editActionButton, dashboardStyles.cancelEditButton]}
                      onPress={handleCancelEdit}
                    >
                      <Text style={dashboardStyles.cancelEditText}>Hủy</Text>
                    </Pressable>
                    
                    <Pressable
                      style={[dashboardStyles.editActionButton, dashboardStyles.saveEditButton, parseLoading && { opacity: 0.6 }]}
                      onPress={handleSaveEdit}
                      disabled={parseLoading}
                    >
                      {parseLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={dashboardStyles.saveEditText}>Xử lý lại</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                structuredResponse && (
                  <View style={dashboardStyles.responseContainer}>
                  {/* Merchant */}
                  {structuredResponse.merchant && (
                    <View style={dashboardStyles.merchantCard}>
                      <View style={dashboardStyles.merchantIconContainer}>
                        <Ionicons name="storefront" size={24} color="#5F58C2" />
                      </View>
                      <View>
                        <Text style={dashboardStyles.merchantLabel}>Cửa hàng</Text>
                        <Text style={dashboardStyles.merchantName}>{structuredResponse.merchant}</Text>
                      </View>
                    </View>
                  )}

                  {/* Total Amount */}
                  {(structuredResponse.amount || structuredResponse.total) && (
                    <View style={dashboardStyles.totalCard}>
                      <Text style={dashboardStyles.totalLabel}>Tổng số tiền</Text>
                      <Text style={dashboardStyles.totalAmount}>
                        {formatCurrency(structuredResponse.amount || structuredResponse.total || 0)}
                      </Text>
                      <View style={dashboardStyles.categoryBadge}>
                        <Text style={dashboardStyles.categoryText}>{structuredResponse.category}</Text>
                      </View>
                    </View>
                  )}

                  {/* Items List */}
                  {structuredResponse.items && Array.isArray(structuredResponse.items) && structuredResponse.items.length > 0 && (
                    <View style={dashboardStyles.itemsSection}>
                      <Text style={dashboardStyles.itemsSectionTitle}>Các mặt hàng tìm thấy</Text>
                      <View style={dashboardStyles.itemsHeader}>
                        <Text style={dashboardStyles.itemsSubtitle}>Chọn các mặt hàng bạn muốn thêm:</Text>
                        <Pressable 
                          style={dashboardStyles.selectAllButton}
                          onPress={() => {
                            if (selectedItems.length === structuredResponse.items?.length) {
                              setSelectedItems([]); // Deselect all
                            } else {
                              setSelectedItems(structuredResponse.items?.map((_, index) => index) || []); // Select all
                            }
                          }}
                        >
                          <Text style={dashboardStyles.selectAllText}>
                            {selectedItems.length === structuredResponse.items?.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                          </Text>
                        </Pressable>
                      </View>
                      
                      <View style={dashboardStyles.itemsList}>
                        {structuredResponse.items.map((item, index: number) => (
                          <Pressable 
                            key={index} 
                            style={[
                              dashboardStyles.itemCard,
                              selectedItems.includes(index) && dashboardStyles.itemCardSelected
                            ]}
                            onPress={() => toggleItemSelection(index)}
                          >
                            <View style={dashboardStyles.checkbox}>
                              {selectedItems.includes(index) ? (
                                <Ionicons name="checkbox" size={24} color="#5F58C2" />
                              ) : (
                                <Ionicons name="square-outline" size={24} color="#cbd5e1" />
                              )}
                            </View>
                            <View style={dashboardStyles.itemInfo}>
                              <Text style={dashboardStyles.itemName}>
                                {item.name || item.description || 'Item'}
                              </Text>
                              <Text style={dashboardStyles.itemPrice}>
                                {formatCurrency(item.price || item.amount || 0)}
                              </Text>
                              {item.quantity && (
                                <Text style={dashboardStyles.itemQuantity}>Số lượng: {item.quantity}</Text>
                              )}
                            </View>
                            <View style={dashboardStyles.itemCategoryBadge}>
                              <Text style={dashboardStyles.itemCategoryText}>{item.category}</Text>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
                )
              )}
            </ScrollView>

            {/* Action Buttons - Only show when not in edit mode */}
            {!editMode && (
              <View style={dashboardStyles.modalActions}>
                <Pressable
                  style={[dashboardStyles.actionButton, dashboardStyles.editButton]}
                  onPress={handleChangeTransaction}
                >
                  <Ionicons name="create-outline" size={18} color="#5F58C2" />
                  <Text style={dashboardStyles.editButtonText}>Sửa văn bản đầu vào</Text>
                </Pressable>
                
                <Pressable
                  style={[dashboardStyles.actionButton, dashboardStyles.addButton, addingTransaction && { opacity: 0.6 }]}
                  onPress={handleAddTransaction}
                  disabled={addingTransaction || selectedItems.length === 0}
                >
                  {addingTransaction ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="add" size={18} color="#fff" />
                      <Text style={dashboardStyles.addButtonText}>
                        Thêm {selectedItems.length} mặt hàng
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

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

      {/* Subscription Creation Modal */}
      <SubscriptionCreationModal
        visible={showSubscriptionCreationModal}
        onClose={() => {
          setShowSubscriptionCreationModal(false);
          setNewSubscriptionData(null);
        }}
        onConfirm={handleCreateSubscription}
        initialData={newSubscriptionData}
        isLoading={isProcessingAI}
      />

      {/* Installment Plan Confirmation Modal */}
      <Modal
        visible={showInstallmentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowInstallmentModal(false);
          setInstallmentData(null);
        }}
      >
        <View style={dashboardStyles.modalOverlay}>
          <View style={dashboardStyles.modalContainer}>
            {/* Header */}
            <View style={dashboardStyles.modalHeader}>
              <Text style={dashboardStyles.modalTitle}>Xác nhận kế hoạch trả góp</Text>
              <Pressable 
                onPress={() => {
                  setShowInstallmentModal(false);
                  setInstallmentData(null);
                }} 
                style={dashboardStyles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </Pressable>
            </View>

            {/* Content */}
            <ScrollView style={dashboardStyles.modalContent} showsVerticalScrollIndicator={false}>
              {installmentData && (
                <View style={dashboardStyles.responseContainer}>
                  {/* Summary Card */}
                  <View style={dashboardStyles.installmentSummaryCard}>
                    <LinearGradient
                      colors={['#E8E4FF', '#F3F0FF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={dashboardStyles.installmentGradient}
                    >
                      <View style={dashboardStyles.installmentHeader}>
                        <Ionicons name="calendar-outline" size={24} color="#8B7FE0" />
                        <Text style={dashboardStyles.installmentTitle}>
                          {installmentData.subscriptionData.name}
                        </Text>
                      </View>
                      <Text style={dashboardStyles.installmentSubtitle}>
                        Kế hoạch trả góp {installmentData.subscriptionData.totalMonths} tháng
                      </Text>
                    </LinearGradient>
                  </View>

                  {/* Details */}
                  <View style={dashboardStyles.installmentDetails}>
                    <View style={dashboardStyles.detailRow}>
                      <Text style={dashboardStyles.detailLabel}>Tổng giá trị:</Text>
                      <Text style={dashboardStyles.detailValue}>
                        {formatCurrency(installmentData.totalAmount || 0)}
                      </Text>
                    </View>
                    <View style={dashboardStyles.detailRow}>
                      <Text style={dashboardStyles.detailLabel}>Đã trả trước:</Text>
                      <Text style={[dashboardStyles.detailValue, { color: '#059669' }]}>
                        {formatCurrency(installmentData.upfrontTransaction.amount)}
                      </Text>
                    </View>
                    <View style={dashboardStyles.detailRow}>
                      <Text style={dashboardStyles.detailLabel}>Còn lại:</Text>
                      <Text style={[dashboardStyles.detailValue, { color: '#dc2626' }]}>
                        {formatCurrency(installmentData.remainingAmount || 0)}
                      </Text>
                    </View>
                    <View style={dashboardStyles.detailRow}>
                      <Text style={dashboardStyles.detailLabel}>Thời gian:</Text>
                      <Text style={dashboardStyles.detailValue}>
                        {installmentData.subscriptionData.totalMonths} tháng
                      </Text>
                    </View>
                    <View style={[dashboardStyles.detailRow, dashboardStyles.detailRowLast]}>
                      <Text style={dashboardStyles.detailLabel}>Hàng tháng:</Text>
                      <Text style={[dashboardStyles.detailValue, dashboardStyles.totalCostText]}>
                        {formatCurrency(installmentData.subscriptionData.pricePerMonth)}
                      </Text>
                    </View>
                  </View>

                  {/* What will be created */}
                  <View style={dashboardStyles.willCreateSection}>
                    <Text style={dashboardStyles.willCreateTitle}>Sẽ được tạo:</Text>
                    <View style={dashboardStyles.willCreateList}>
                      <View style={dashboardStyles.willCreateItem}>
                        <Ionicons name="repeat-outline" size={20} color="#8B7FE0" />
                        <Text style={dashboardStyles.willCreateText}>
                          Khoảng trả hàng tháng: {installmentData.subscriptionData.name}
                        </Text>
                      </View>
                      <View style={dashboardStyles.willCreateItem}>
                        <Ionicons name="receipt-outline" size={20} color="#059669" />
                        <Text style={dashboardStyles.willCreateText}>
                          Giao dịch trả trước: {formatCurrency(installmentData.upfrontTransaction.amount)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Actions */}
            <View style={dashboardStyles.modalActions}>
              <Pressable
                style={[dashboardStyles.actionButton, dashboardStyles.cancelButton]}
                onPress={() => {
                  setShowInstallmentModal(false);
                  setInstallmentData(null);
                }}
              >
                <Text style={dashboardStyles.cancelButtonText}>Hủy</Text>
              </Pressable>
              
              <Pressable
                style={[
                  dashboardStyles.actionButton, 
                  dashboardStyles.addButton,
                  isProcessingAI && { opacity: 0.6 }
                ]}
                onPress={handleCreateInstallmentPlan}
                disabled={isProcessingAI}
              >
                {isProcessingAI ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={dashboardStyles.addButtonText}>Tạo kế hoạch trả góp</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const dashboardStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F3F8',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F0F3F8',
  },
  welcomeSection: {
    paddingHorizontal: 40,
    paddingTop: 65,
    paddingBottom: 16,
  },
  welcomeText: {
    fontSize: 18,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
  },
  userName: {
    fontSize: 28,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: 'rgba(95, 88, 194, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(95, 88, 194, 0.3)',
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  logoutText: {
    color: '#5F58C2',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    marginBottom: 16,
  },
  balanceBlock: {
    marginHorizontal: 20,
    borderRadius: 16,
    marginBottom: 18,
    overflow: 'hidden',
  },
  gradientBackground: {
    padding: 24,
    borderRadius: 16,
  },
  balanceTitle: {
    color: 'white',
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    opacity: 0.9,
  },
  balanceAmount: {
    color: 'white',
    fontSize: 28,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    marginTop: 8,
  },
  geminiSection: {
    marginBottom: 20,
    flexDirection: 'row',
    gap: 12,
  },
  textInput: {
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 16,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    marginBottom: 16,
    flex: 1,
  },
  geminiButton: {
    borderRadius: 40,
    alignItems: 'center',
    width: 48,
    height: 48,
    justifyContent: 'center',
    backgroundColor: '#5F58C2',
  },
  transactionsSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  transactionsList: {
    gap: 8,
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
    height: '60%',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 10,
    color: '#1f2937',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  responseContainer: {
    gap: 16,
    paddingBottom: 35,
  },
  // Merchant Card
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  merchantIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(95, 88, 194, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  merchantLabel: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  merchantName: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    color: '#1e293b',
    marginTop: 2,
  },
  // Total Card
  totalCard: {
    backgroundColor: 'rgba(95, 88, 194, 0.05)',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(95, 88, 194, 0.2)',
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: 28,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#5F58C2',
    marginTop: 4,
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: 'rgba(95, 88, 194, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(95, 88, 194, 0.3)',
  },
  categoryText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#5F58C2',
  },
  // Items Section
  itemsSection: {
    marginTop: 8,
  },
  itemsSectionTitle: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
    marginBottom: 4,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemsSubtitle: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#64748b',
    flex: 1,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(95, 88, 194, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(95, 88, 194, 0.3)',
  },
  selectAllText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#5F58C2',
  },
  itemsList: {
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  itemCardSelected: {
    borderColor: '#5F58C2',
    backgroundColor: 'rgba(95, 88, 194, 0.02)',
  },
  checkbox: {
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    color: '#1e293b',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#059669',
  },
  itemQuantity: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#64748b',
    marginTop: 2,
  },
  itemCategoryBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemCategoryText: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#475569',
  },
  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: 'white',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  editButton: {
    backgroundColor: 'rgba(95, 88, 194, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(95, 88, 194, 0.3)',
  },
  addButton: {
    backgroundColor: '#5F58C2',
  },
  editButtonText: {
    color: '#5F58C2',
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    opacity: 0.6,
    marginTop: 20,
    marginBottom: 20,
  },
  // Edit Mode Styles
  editContainer: {
    gap: 16,
  },
  editTitle: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#1e293b',
    textAlign: 'center',
  },
  editSubtitle: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  editTextInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    backgroundColor: '#f9fafb',
    color: '#1f2937',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelEditButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  saveEditButton: {
    backgroundColor: '#5F58C2',
  },
  cancelEditText: {
    color: '#374151',
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
  },
  saveEditText: {
    color: 'white',
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
  },
  // Input Sections
  inputSections: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputSectionTitle: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#1f2937',
    marginBottom: 12,
  },
  // Subscription Input
  subscriptionInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  subscriptionTextInput: {
    borderRadius: 12,
    padding: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 16,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    flex: 1,
  },
  subscriptionButton: {
    borderRadius: 40,
    alignItems: 'center',
    width: 48,
    height: 48,
    justifyContent: 'center',
  },
  // Upcoming Subscriptions
  upcomingSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  upcomingSectionTitle: {
    fontSize: 20,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#1f2937',
    marginBottom: 16,
  },
  upcomingList: {
    gap: 12,
  },
  upcomingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 127, 224, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 127, 224, 0.2)',
  },
  upcomingItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  upcomingItemRight: {
    alignItems: 'flex-end',
  },
  upcomingItemName: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    color: '#4C1D95',
    marginBottom: 4,
  },
  upcomingItemDate: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6B46C1',
  },
  upcomingItemAmount: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#8B7FE0',
    marginBottom: 8,
  },
  payButton: {
    backgroundColor: '#8B7FE0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  payButtonText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: 'white',
  },
  
  // Subscription Confirmation Modal Styles
  subscriptionDetailsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#64748b',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#1f2937',
    flex: 2,
    textAlign: 'right',
  },
  totalCostText: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#dc2626',
  },
  
  upcomingEmptyText: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  // New styles for enhanced subscription display
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#8B7FE0',
  },
  inactiveText: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#ef4444',
    marginTop: 2,
  },
  paidAmount: {
    color: '#10b981',
    textDecorationLine: 'line-through',
  },
  
  // Installment Modal Styles
  installmentSummaryCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  installmentGradient: {
    padding: 20,
  },
  installmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  installmentTitle: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#8B7FE0',
    marginLeft: 12,
    flex: 1,
  },
  installmentSubtitle: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6B46C1',
  },
  installmentDetails: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  willCreateSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  willCreateTitle: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    color: '#374151',
    marginBottom: 12,
  },
  willCreateList: {
    gap: 8,
  },
  willCreateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  willCreateText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6b7280',
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
  },
  
  // Horizontal Scroll Subscription Cards
  horizontalScrollView: {
    paddingLeft: 20,
  },
  horizontalScrollContent: {
    paddingRight: 20,
    gap: 12,
  },
  subscriptionCard: {
    width: 180,
    backgroundColor: 'rgba(139, 127, 224, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 127, 224, 0.2)',
  },
  subscriptionCardHeader: {
    marginBottom: 8,
  },
  subscriptionCardName: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    color: '#4C1D95',
    marginBottom: 4,
  },
  subscriptionCardDate: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#6B46C1',
    marginBottom: 12,
  },
  subscriptionCardAmount: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#8B7FE0',
    marginBottom: 12,
    textAlign: 'center',
  },
  subscriptionPayButton: {
    backgroundColor: '#8B7FE0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  subscriptionPayButtonText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: 'white',
    textAlign: 'center',
  },
});