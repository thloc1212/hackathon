import React, { useState } from 'react';
import { Platform, SafeAreaView, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, FontFamily, FontWeight } from '@/constants/theme';
import TransactionItem, { Transaction } from '@/components/TransactionItem';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Địa chỉ server Node của bạn (Gemini backend)
const SERVER_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000' // Android emulator
    : 'http://localhost:3000'; // iOS simulator

// Mock user data
const USER_NAME = 'John Doe';
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

export default function HomeScreen() {
  const colorScheme = 'light'; // Force light mode
  const colors = Colors[colorScheme];
  
  const [ocrText, setOcrText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [structuredResponse, setStructuredResponse] = useState<any>(null);
  
  const formatBalance = (amount: number) => {
    return amount.toLocaleString('vi-VN') + 'đ';
  };

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
      alert(`ping ok: ${json.ok}`);
    } catch (err) {
      console.error('[client] ping error', err);
      alert(`ping error: ${err}`);
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
      alert(`parse-test ok: ${JSON.stringify(json)}`);
    } catch (err) {
      console.error('[client] parse-test error', err);
      alert(`parse-test error: ${err}`);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F0F3F8' }]}>
      <StatusBar style="dark" backgroundColor="#F0F3F8" />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={[styles.welcomeText, { color: colors.text }]}>
            Welcome back,
          </Text>
          <Text style={[styles.userName, { color: "#5F58C2" }]}>
            {USER_NAME}!
          </Text>
        </View>

        {/* Balance Block with Linear Gradient */}
        <View style={styles.balanceBlock}>
          <LinearGradient
            colors={['#5F58C2', '#E3E1FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBackground}
          >
            <Text style={styles.balanceTitle}>Current Balance</Text>
            <Text style={styles.balanceAmount}>{formatBalance(CURRENT_BALANCE)}</Text>
          </LinearGradient>
        </View>

        {/* Gemini Input Section */}
        <View style={styles.geminiSection}>
          <TextInput
            multiline
            value={ocrText}
            onChangeText={setOcrText}
            placeholder="Hãy điền biến động mới vào đây..."
            placeholderTextColor={colors.icon}
            style={[styles.textInput, { 
              backgroundColor: colors.background,
              color: colors.text,
              borderColor: colors.icon + '40'
            }]}
          />
          <Pressable
            onPress={callGemini}
            style={[styles.geminiButton, { backgroundColor: error ? "#FF3D00" : "#5F58C2" }]}
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
        <View style={styles.transactionsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Recent Transactions
          </Text>
          <View style={styles.transactionsList}>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Close Button */}
            <Pressable style={styles.closeButton} onPress={handleCloseModal}>
              <Ionicons name="close" size={24} color="#666" />
            </Pressable>

            {/* Modal Header */}
            <Text style={styles.modalTitle}>AI Analysis Result</Text>

            {/* Structured Response Display */}
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {structuredResponse && (
                <View style={styles.responseContainer}>
                  <Text style={styles.responseTitle}>Detected Information:</Text>
                  
                  {/* Merchant */}
                  {structuredResponse.merchant && (
                    <View style={styles.responseItem}>
                      <Text style={styles.responseLabel}>Merchant:</Text>
                      <Text style={styles.responseValue}>{structuredResponse.merchant}</Text>
                    </View>
                  )}

                  {/* Amount */}
                  {structuredResponse.amount && (
                    <View style={styles.responseItem}>
                      <Text style={styles.responseLabel}>Amount:</Text>
                      <Text style={[styles.responseValue, styles.amountText]}>
                        {typeof structuredResponse.amount === 'number' 
                          ? formatBalance(structuredResponse.amount)
                          : structuredResponse.amount}
                      </Text>
                    </View>
                  )}

                  {/* Date */}
                  {structuredResponse.date && (
                    <View style={styles.responseItem}>
                      <Text style={styles.responseLabel}>Date:</Text>
                      <Text style={styles.responseValue}>{structuredResponse.date}</Text>
                    </View>
                  )}

                  {/* Category */}
                  {structuredResponse.category && (
                    <View style={styles.responseItem}>
                      <Text style={styles.responseLabel}>Category:</Text>
                      <Text style={styles.responseValue}>{structuredResponse.category}</Text>
                    </View>
                  )}

                  {/* Items (if receipt) */}
                  {structuredResponse.items && Array.isArray(structuredResponse.items) && (
                    <View style={styles.responseItem}>
                      <Text style={styles.responseLabel}>Items:</Text>
                      {structuredResponse.items.map((item: any, index: number) => (
                        <Text key={index} style={styles.itemText}>
                          • {item.name || item}: {item.price ? formatBalance(item.price) : ''}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Raw response for debugging */}
                  <View style={styles.rawResponse}>
                    <Text style={styles.rawResponseTitle}>Raw Response:</Text>
                    <Text style={styles.rawResponseText}>
                      {JSON.stringify(structuredResponse, null, 2)}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.actionButton, styles.addButton]}
                onPress={handleAddTransaction}
              >
                <Text style={styles.actionButtonText}>Add Transaction</Text>
              </Pressable>
              
              <Pressable
                style={[styles.actionButton, styles.changeButton]}
                onPress={handleChangeTransaction}
              >
                <Text style={styles.actionButtonText}>Change Details</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  geminiButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    
  },
  loader: {
    marginTop: 20,
  },
  errorText: {
    color: '#ef4444',
    marginTop: 16,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
  },
  resultContainer: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  resultText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 16,
  },
  transactionsSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  transactionsList: {
    gap: 8,
  },
  debugSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  debugTitle: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    marginBottom: 12,
  },
  debugButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  debugButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  debugButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
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
