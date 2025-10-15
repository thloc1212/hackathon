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
import { Transaction, GeminiTransactionResponse } from '@/types';
import { formatCurrency } from '@/utils/formatters';

const { width, height } = Dimensions.get('window');

// Server URL for Gemini backend
const SERVER_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000' // Android emulator
    : 'http://10.126.7.73:3000'; // iOS simulator

// Mock financial data
const CURRENT_BALANCE = 2450000; // VND

// Mock recent transactions
const RECENT_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    amount: -70000,
    category: 'Food & Drink',
    description: 'Highlands Coffee',
    date: '13/10/2025',
    type: 'expense',
  },
  {
    id: '2',
    amount: 500000,
    category: 'Salary',
    description: 'Monthly Bonus',
    date: '12/10/2025',
    type: 'income',
  },
  {
    id: '3',
    amount: -150000,
    category: 'Transportation',
    description: 'Grab Bike',
    date: '12/10/2025',
    type: 'expense',
  },
  {
    id: '4',
    amount: -45000,
    category: 'Shopping',
    description: 'Circle K',
    date: '11/10/2025',
    type: 'expense',
  },
  {
    id: '5',
    amount: 1200000,
    category: 'Transfer',
    description: 'From Mom',
    date: '10/10/2025',
    type: 'income',
  },
];

interface HomeScreenProps {
  user?: {
    id: string;
    email: string;
    dateOfBirth?: string;
    createdAt: string;
  };
}

export default function HomeScreen({ user }: HomeScreenProps) {
  const colorScheme = 'light'; // Force light mode
  const colors = Colors[colorScheme];
  const [userName, setUserName] = useState('');
  
  // Dashboard state
  const [ocrText, setOcrText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [structuredResponse, setStructuredResponse] = useState<GeminiTransactionResponse | null>(null);

  useEffect(() => {
    if (user?.email) {
      // Extract name from email (before @ symbol)
      const name = user.email.split('@')[0];
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));
    }
  }, [user]);

  const callGemini = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const url = `${SERVER_URL}/parse`;
      const body = JSON.stringify({ ocrText });
      console.log('[client] POST', url, 'body length', body.length);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
      
      // Structure the response and show modal
      setStructuredResponse(data);
      setShowModal(true);
    } catch (err: any) {
      // Log full error for debugging
      console.error('[client] fetch error:', err);
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = () => {
    console.log('Adding transaction:', structuredResponse);
    // TODO: Add transaction logic here
    setShowModal(false);
    setOcrText('');
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
      const res = await fetch(`${SERVER_URL}/ping`);
      const json = await res.json();
      console.log('[client] ping response', json);
      Alert.alert('Ping Success', `ping ok: ${json.ok}`);
    } catch (err) {
      console.error('[client] ping error', err);
      Alert.alert('Ping Error', `ping error: ${err}`);
    }
  };

  const doParseTest = async () => {
    try {
      const url = `${SERVER_URL}/parse-test`;
      const body = JSON.stringify({ test: true, sample: 'abc' });
      console.log('[client] POST', url, 'body', body);
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const json = await res.json();
      console.log('[client] parse-test response', json);
      Alert.alert('Parse Test Success', `parse-test ok: ${JSON.stringify(json)}`);
    } catch (err) {
      console.error('[client] parse-test error', err);
      Alert.alert('Parse Test Error', `parse-test error: ${err}`);
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
            <Text style={dashboardStyles.balanceAmount}>{formatCurrency(CURRENT_BALANCE)}</Text>
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
            style={[dashboardStyles.geminiButton, { backgroundColor: error ? "#FF3D00" : "#5F58C2" }]}
            disabled={loading || !ocrText.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              error ? <Ionicons name="reload" size={25} color="#fff" /> : <Ionicons name="send" size={25} color="#fff" />
            )}
          </Pressable>
        </View>

        {/* Recent Transactions */}
        <View style={dashboardStyles.transactionsSection}>
          <Text style={[dashboardStyles.sectionTitle, { color: colors.text }]}>
            Recent Transactions
          </Text>
          <View style={dashboardStyles.transactionsList}>
            {RECENT_TRANSACTIONS.map((transaction) => (
              <TransactionItem
                key={transaction.id}
                transaction={transaction}
                colorScheme='light'
              />
            ))}
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
                  {structuredResponse.amount && (
                    <View style={dashboardStyles.responseItem}>
                      <Text style={dashboardStyles.responseLabel}>Amount:</Text>
                      <Text style={[dashboardStyles.responseValue, dashboardStyles.amountText]}>
                        {formatCurrency(structuredResponse.amount)}
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
                          • {item.name}: {formatCurrency(item.price)}
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
                style={[dashboardStyles.actionButton, dashboardStyles.addButton]}
                onPress={handleAddTransaction}
              >
                <Text style={dashboardStyles.actionButtonText}>Add Transaction</Text>
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
});