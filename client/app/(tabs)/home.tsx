import React, { useState, useEffect } from 'react';
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
  Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, FontFamily, FontWeight } from '@/constants/theme';
import TransactionItem from '@/components/TransactionItem';
import { Transaction } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import AuthService from '@/lib/authService';
import { useApi, GeminiTransactionResponse } from '@/hooks/useApi';
import { useDatabase } from '@/hooks/useDatabase';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const colorScheme = 'light'; // Force light mode
  const colors = Colors[colorScheme];
  const [userName, setUserName] = useState('');
  
  // Dashboard state
  const [ocrText, setOcrText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [structuredResponse, setStructuredResponse] = useState<GeminiTransactionResponse | null>(null);
  const [addingTransaction, setAddingTransaction] = useState(false);
  
  // Database context for centralized data management
  const { 
    transactions, 
    stats, 
    loading: dbLoading, 
    error: dbError, 
    refreshData,
    addTransaction: addTransactionToDb
  } = useDatabase();
  
  // API hook for parsing receipts
  const { 
    loading: parseLoading, 
    error: parseError, 
    parseReceipt,
    ping,
    parseTest
  } = useApi();

  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    if (currentUser?.email) {
      // Extract name from email (before @ symbol)
      const name = currentUser.email.split('@')[0];
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));
    }
  }, []);



  // Data is now managed by the DatabaseProvider context
  // No need for manual data loading

  const callGemini = async () => {
    try {
      const response = await parseReceipt(ocrText);
      
      if (response.success && response.data) {
        // Structure the response and show modal
        setStructuredResponse(response.data);
        setShowModal(true);
      } else {
        Alert.alert('Error', response.error || 'Failed to parse receipt');
      }
    } catch (err: any) {
      console.error('[client] Gemini error:', err);
      Alert.alert('Error', err?.message || 'Failed to parse receipt');
    }
  };

  const handleAddTransaction = async () => {
    if (!structuredResponse || addingTransaction) return;

    setAddingTransaction(true);
    try {
      // Convert Gemini response to transaction format
      const transactionData = {
        amount: Math.abs(structuredResponse.amount || structuredResponse.total || 0), // Ensure positive amount
        category: structuredResponse.category || 'Other', // Use AI-determined category, fallback to 'Other'
        description: structuredResponse.merchant || 'Transaction',
        date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
        type: 'expense' as const, // Default to expense for receipts
        merchant: structuredResponse.merchant,
        items: structuredResponse.items?.map(item => ({
          name: item.name || item.description || 'Item',
          price: item.price || item.amount || 0,
          quantity: item.quantity || 1,
          category: item.category
        })) || []
      };

      console.log('Adding transaction:', transactionData);
      const success = await addTransactionToDb(transactionData);
      
      if (success) {
        Alert.alert('Success', 'Transaction added successfully');
        setShowModal(false);
        setOcrText('');
        setStructuredResponse(null);
        // Refresh data will be called automatically by the DatabaseProvider
      } else {
        Alert.alert('Error', dbError || 'Failed to add transaction');
      }
    } catch (error) {
      console.error('Add transaction error:', error);
      Alert.alert('Error', 'Failed to add transaction');
    } finally {
      setAddingTransaction(false);
    }
  };

  const handleChangeTransaction = () => {
    console.log('Changing transaction:', structuredResponse);
    // TODO: Change transaction logic here
    setShowModal(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Connectivity checks
  const doPing = async () => {
    try {
      const response = await ping();
      if (response.success && response.data) {
        Alert.alert('Ping Success', `Server is reachable: ${response.data.ok}`);
      } else {
        Alert.alert('Ping Error', response.error || 'Failed to ping server');
      }
    } catch (err) {
      console.error('[client] ping error', err);
      Alert.alert('Ping Error', `ping error: ${err}`);
    }
  };

  const doParseTest = async () => {
    try {
      const response = await parseTest();
      if (response.success) {
        Alert.alert('Parse Test Success', `Response: ${JSON.stringify(response.data)}`);
      } else {
        Alert.alert('Parse Test Error', response.error || 'Failed to test parse endpoint');
      }
    } catch (err) {
      console.error('[client] parse-test error', err);
      Alert.alert('Parse Test Error', `parse-test error: ${err}`);
    }
  };

  const handleLogout = async () => {
    try {
      await AuthService.signout();
      Alert.alert('Success', 'Logged out successfully');
      // The auth service will trigger the auth change listener and navigate automatically
    } catch (error) {
      Alert.alert('Error', 'Failed to logout');
    }
  };

  return (
    <SafeAreaView style={[dashboardStyles.container, { backgroundColor: '#F0F3F8' }]}>
      <StatusBar style="dark" backgroundColor="#F0F3F8" />
      <ScrollView style={dashboardStyles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={dashboardStyles.welcomeSection}>
          <Text style={[dashboardStyles.welcomeText, { color: colors.text }]}>
            Welcome back,
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
            <Text style={dashboardStyles.balanceTitle}>Current Balance</Text>
            <Text style={dashboardStyles.balanceAmount}>{formatCurrency(stats?.balance || 0)}</Text>
          </LinearGradient>
        </View>

        {/* Gemini Input Section */}
        <View style={dashboardStyles.geminiSection}>
          <TextInput
            multiline
            value={ocrText}
            onChangeText={setOcrText}
            placeholder="Hãy điền biến động mới vào đây..."
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
            disabled={parseLoading || !ocrText.trim()}
          >
            {parseLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              parseError ? <Ionicons name="reload" size={25} color="#fff" /> : <Ionicons name="send" size={25} color="#fff" />
            )}
          </Pressable>
        </View>

        {/* Recent Transactions */}
        <View style={dashboardStyles.transactionsSection}>
          <Text style={[dashboardStyles.sectionTitle, { color: colors.text }]}>
            Recent Transactions
          </Text>
          <View style={dashboardStyles.transactionsList}>
            {Array.isArray(transactions) && transactions.map((transaction) => (
              <TransactionItem
                key={transaction.id}
                transaction={{
                  ...transaction,
                  amount: transaction.type === 'expense' ? -Math.abs(transaction.amount || 0) : (transaction.amount || 0),
                  date: transaction.date ? new Date(transaction.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
                }}
                colorScheme='light'
              />
            ))}
            {(!Array.isArray(transactions) || transactions.length === 0) && (
              <Text style={[dashboardStyles.emptyText, { color: colors.text }]}>
                No transactions yet. Add your first transaction by parsing a receipt above!
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
            {/* Close Button */}
            <Pressable style={dashboardStyles.closeButton} onPress={handleCloseModal}>
              <Ionicons name="close" size={24} color="#666" />
            </Pressable>

            {/* Modal Header */}
            <Text style={dashboardStyles.modalTitle}>AI Analysis Result</Text>

            {/* Structured Response Display */}
            <ScrollView style={dashboardStyles.modalContent} showsVerticalScrollIndicator={false}>
              {structuredResponse && (
                <View style={dashboardStyles.responseContainer}>
                  <Text style={dashboardStyles.responseTitle}>Detected Information:</Text>
                  
                  {/* Merchant */}
                  {structuredResponse.merchant && (
                    <View style={dashboardStyles.responseItem}>
                      <Text style={dashboardStyles.responseLabel}>Merchant:</Text>
                      <Text style={dashboardStyles.responseValue}>{structuredResponse.merchant}</Text>
                    </View>
                  )}

                  {/* Amount */}
                  {(structuredResponse.amount || structuredResponse.total) && (
                    <View style={dashboardStyles.responseItem}>
                      <Text style={dashboardStyles.responseLabel}>Amount:</Text>
                      <Text style={[dashboardStyles.responseValue, dashboardStyles.amountText]}>
                        {formatCurrency(structuredResponse.amount || structuredResponse.total || 0)}
                      </Text>
                    </View>
                  )}

                  {/* Date */}
                  {structuredResponse.date && (
                    <View style={dashboardStyles.responseItem}>
                      <Text style={dashboardStyles.responseLabel}>Date:</Text>
                      <Text style={dashboardStyles.responseValue}>{structuredResponse.date}</Text>
                    </View>
                  )}

                  {/* Category */}
                  {structuredResponse.category && (
                    <View style={dashboardStyles.responseItem}>
                      <Text style={dashboardStyles.responseLabel}>Category:</Text>
                      <Text style={dashboardStyles.responseValue}>{structuredResponse.category}</Text>
                    </View>
                  )}

                  {/* Items (if receipt) */}
                  {structuredResponse.items && Array.isArray(structuredResponse.items) && structuredResponse.items.length > 0 && (
                    <View style={dashboardStyles.responseItem}>
                      <Text style={dashboardStyles.responseLabel}>Items:</Text>
                      {structuredResponse.items.map((item, index: number) => (
                        <Text key={index} style={dashboardStyles.itemText}>
                          • {item.name || item.description || 'Item'}: {formatCurrency(item.price || item.amount || 0)}
                          {item.quantity && ` (x${item.quantity})`}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Raw response for debugging */}
                  <View style={dashboardStyles.rawResponse}>
                    <Text style={dashboardStyles.rawResponseTitle}>Raw Response:</Text>
                    <Text style={dashboardStyles.rawResponseText}>
                      {JSON.stringify(structuredResponse, null, 2)}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={dashboardStyles.modalActions}>
              <Pressable
                style={[dashboardStyles.actionButton, dashboardStyles.addButton, addingTransaction && { opacity: 0.6 }]}
                onPress={handleAddTransaction}
                disabled={addingTransaction}
              >
                {addingTransaction ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={dashboardStyles.actionButtonText}>Add Transaction</Text>
                )}
              </Pressable>
              
              <Pressable
                style={[dashboardStyles.actionButton, dashboardStyles.changeButton]}
                onPress={handleChangeTransaction}
              >
                <Text style={dashboardStyles.actionButtonText}>Change Details</Text>
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
    paddingHorizontal: 20,
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
    padding: 20,
    marginHorizontal: 20,
    maxHeight: '80%',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 1,
    padding: 5,
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
    marginBottom: 20,
  },
  responseContainer: {
    gap: 12,
  },
  responseTitle: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    color: '#374151',
    marginBottom: 8,
  },
  responseItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#5F58C2',
  },
  responseLabel: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  responseValue: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#1f2937',
    marginTop: 4,
  },
  amountText: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: '#5F58C2',
  },
  itemText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    color: '#374151',
    marginTop: 2,
    marginLeft: 8,
  },
  rawResponse: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  rawResponseTitle: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    color: '#6b7280',
    marginBottom: 8,
  },
  rawResponseText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#374151',
    lineHeight: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addButton: {
    backgroundColor: '#10b981',
  },
  changeButton: {
    backgroundColor: '#f59e0b',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
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
});