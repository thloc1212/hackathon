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
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editingOcrText, setEditingOcrText] = useState('');
  
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
        // Pre-select all items (all checkboxes ticked by default)
        if (response.data.items && Array.isArray(response.data.items)) {
          setSelectedItems(response.data.items.map((_, index) => index));
        }
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
    if (!structuredResponse || addingTransaction || selectedItems.length === 0) {
      if (selectedItems.length === 0) {
        Alert.alert('No Items Selected', 'Please select at least one item to add.');
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
        Alert.alert(
          'Success', 
          `${successCount} transaction${successCount > 1 ? 's' : ''} added successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}.`
        );
        setShowModal(false);
        setOcrText('');
        setStructuredResponse(null);
        setSelectedItems([]);
      } else {
        Alert.alert('Error', 'Failed to add any transactions');
      }
    } catch (error) {
      console.error('Add transactions error:', error);
      Alert.alert('Error', 'Failed to add transactions');
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
      Alert.alert('Error', 'Please enter some text to parse');
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
        Alert.alert('Error', response.error || 'Failed to parse edited text');
      }
    } catch (err: any) {
      console.error('[client] Edit Gemini error:', err);
      Alert.alert('Error', err?.message || 'Failed to parse edited text');
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
            {Array.isArray(transactions) && transactions.slice(0, 10).map((transaction) => (
              <TransactionItem
                key={transaction.id}
                transaction={{
                  ...transaction,
                  amount: transaction.category !== 'Thu nhập' ? -Math.abs(transaction.amount || 0) : (transaction.amount || 0),
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
            {/* Modal Header */}
            <View style={dashboardStyles.modalHeader}>
              <Text style={dashboardStyles.modalTitle}>Receipt Analysis</Text>
              <Pressable onPress={handleCloseModal} style={dashboardStyles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </Pressable>
            </View>

            {/* Content - Edit Mode or Display Mode */}
            <ScrollView style={dashboardStyles.modalContent} showsVerticalScrollIndicator={false}>
              {editMode ? (
                <View style={dashboardStyles.editContainer}>
                  <Text style={dashboardStyles.editTitle}>Edit Receipt Text</Text>
                  <Text style={dashboardStyles.editSubtitle}>
                    Modify the text below and reprocess to get updated results:
                  </Text>
                  
                  <TextInput
                    multiline
                    value={editingOcrText}
                    onChangeText={setEditingOcrText}
                    placeholder="Enter receipt text..."
                    placeholderTextColor="#64748b"
                    style={dashboardStyles.editTextInput}
                  />
                  
                  <View style={dashboardStyles.editActions}>
                    <Pressable
                      style={[dashboardStyles.editActionButton, dashboardStyles.cancelEditButton]}
                      onPress={handleCancelEdit}
                    >
                      <Text style={dashboardStyles.cancelEditText}>Cancel</Text>
                    </Pressable>
                    
                    <Pressable
                      style={[dashboardStyles.editActionButton, dashboardStyles.saveEditButton, parseLoading && { opacity: 0.6 }]}
                      onPress={handleSaveEdit}
                      disabled={parseLoading}
                    >
                      {parseLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={dashboardStyles.saveEditText}>Reprocess</Text>
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
                        <Text style={dashboardStyles.merchantLabel}>Store</Text>
                        <Text style={dashboardStyles.merchantName}>{structuredResponse.merchant}</Text>
                      </View>
                    </View>
                  )}

                  {/* Total Amount */}
                  {(structuredResponse.amount || structuredResponse.total) && (
                    <View style={dashboardStyles.totalCard}>
                      <Text style={dashboardStyles.totalLabel}>Total Amount</Text>
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
                      <Text style={dashboardStyles.itemsSectionTitle}>Items Found</Text>
                      <View style={dashboardStyles.itemsHeader}>
                        <Text style={dashboardStyles.itemsSubtitle}>Select which items you want to add:</Text>
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
                            {selectedItems.length === structuredResponse.items?.length ? 'Deselect All' : 'Select All'}
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
                                <Text style={dashboardStyles.itemQuantity}>Qty: {item.quantity}</Text>
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
                  <Text style={dashboardStyles.editButtonText}>Edit Input Text</Text>
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
                        Add {selectedItems.length} Item{selectedItems.length !== 1 ? 's' : ''}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
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
    marginHorizontal: 20,
    maxHeight: '85%',
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
});