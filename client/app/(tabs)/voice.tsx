import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontWeight } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ReceiptInfo } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { useApi } from '@/hooks/useApi';
import { useDatabase } from '@/hooks/useDatabase';

const { width, height } = Dimensions.get('window');

// Cross-platform alert function (reused from camera.tsx)
const showCrossPlatformAlert = (title: string, message: string, buttons: Array<{text: string, onPress?: () => void}> = [{text: 'OK'}]) => {
  if (Platform.OS === 'web') {
    // For web/desktop users
    const buttonText = buttons.map(btn => btn.text).join(' / ');
    const result = window.confirm(`${title}\n\n${message}\n\n(${buttonText})`);
    
    if (result && buttons[0]?.onPress) {
      buttons[0].onPress();
    } else if (!result && buttons[1]?.onPress) {
      buttons[1].onPress();
    }
  } else {
    // For mobile app users (iOS/Android)
    Alert.alert(title, message, buttons.map(btn => ({
      text: btn.text,
      onPress: btn.onPress,
    })), { cancelable: false });
  }
};

// Type for speech recognition (similar to voice_server)
type SpeechRecognition = any;

export default function VoiceScreen() {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [receiptData, setReceiptData] = useState<ReceiptInfo | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [editMode, setEditMode] = useState(false);
  
  const [addingTransactions, setAddingTransactions] = useState(false);
  const [status, setStatus] = useState<string>('Nhấn nút và bắt đầu nói.');
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  
  // Reference for speech recognition
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  const colorScheme = useColorScheme();
  const { parseReceipt } = useApi();
  const { addTransaction: addTransactionToDb } = useDatabase();
  const isFocused = useIsFocused();

  // Check for browser support and initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any)?.SpeechRecognition || 
                               (window as any)?.webkitSpeechRecognition;
    
    const checkPermission = async () => {
      if (Platform.OS === 'web') {
        if (!SpeechRecognitionAPI) {
          showCrossPlatformAlert(
            'Không hỗ trợ',
            'Trình duyệt của bạn không hỗ trợ nhận dạng giọng nói. Vui lòng thử với Chrome, Edge hoặc Safari mới nhất.'
          );
          setPermissionGranted(false);
          return;
        }
        
        // For web, we'll check permission when user tries to record
        setPermissionGranted(true);
      } else {
        // For mobile, we would need to use a native module for speech recognition
        // For now, we'll show a message that it's web-only
        showCrossPlatformAlert(
          'Chức năng giới hạn',
          'Tính năng này hiện chỉ hoạt động trên trình duyệt web. Vui lòng sử dụng phiên bản web của ứng dụng.'
        );
        setPermissionGranted(false);
      }
    };
    
    checkPermission();
    
    // Clean up recognition on unmount
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Error stopping recognition on unmount:', e);
        }
      }
    };
  }, []);
  
  // Set up the recognition object when component mounts
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const SpeechRecognitionAPI = (window as any)?.SpeechRecognition || 
                               (window as any)?.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) return;
    
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'vi-VN'; // Vietnamese language
    
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript + ' ');
      }
      
      // Show interim results for better UX
      if (interimTranscript) {
        setStatus(`Đang nghe: ${interimTranscript}`);
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setError(`Lỗi nhận dạng giọng nói: ${event.error}`);
      
      if (event.error === 'not-allowed') {
        setPermissionGranted(false);
        showCrossPlatformAlert(
          'Quyền truy cập bị từ chối',
          'Bạn đã từ chối quyền truy cập micrô. Vui lòng cấp quyền và thử lại.'
        );
      }
    };
    
    recognition.onend = () => {
      if (isRecording) {
        // Restart recognition if it stops unexpectedly while recording
        try {
          recognition.start();
        } catch (e) {
          console.error('Failed to restart recognition:', e);
          setIsRecording(false);
        }
      }
    };
    
    recognitionRef.current = recognition;
  }, [isRecording]);
  
  const toggleRecording = () => {
    if (!recognitionRef.current) {
      showCrossPlatformAlert('Lỗi', 'Không thể khởi tạo nhận dạng giọng nói.');
      return;
    }
    
    if (isRecording) {
      // Stop recording
      try {
        recognitionRef.current.stop();
        setIsRecording(false);
        setStatus('Đang xử lý hóa đơn của bạn...');
        processVoiceInput();
      } catch (e) {
        console.error('Error stopping recording:', e);
        setError('Lỗi dừng ghi âm');
      }
    } else {
      // Start recording
      try {
        setTranscript('');
        setReceiptData(null);
        setError(null);
        setShowPanel(false);
        setSelectedItems([]);
        recognitionRef.current.start();
        setIsRecording(true);
        setStatus('Đang nghe... Vui lòng đọc các mục trên hóa đơn.');
      } catch (e) {
        console.error('Error starting recording:', e);
        
        if ((e as Error).message?.includes('permission')) {
          setPermissionGranted(false);
          showCrossPlatformAlert(
            'Cần quyền truy cập micrô',
            'Vui lòng cấp quyền truy cập micrô để sử dụng tính năng này.'
          );
        } else {
          setError('Lỗi bắt đầu ghi âm');
        }
      }
    }
  };
  
  const processVoiceInput = async () => {
    if (!transcript.trim()) {
      setError('Không phát hiện thấy giọng nói. Vui lòng thử lại.');
      setStatus('Nhấn nút và bắt đầu nói.');
      return;
    }
    
    setIsProcessing(true);
    try {
      console.log('Processing voice transcript:', transcript);
      
      // Using local parseReceipt function similar to camera.tsx
      // Import and use the generateReceiptJson function from geminiService
      // Import the generateReceiptJson function from geminiService
      console.log('Starting Gemini API call...');
      const { generateReceiptJson } = await import('@/services/geminiService');
      const data = await generateReceiptJson(transcript);
      console.log('Gemini API response received:', data);
      
      // Map to ReceiptInfo format based on actual API response structure
      console.log('Mapping data to ReceiptInfo format:', JSON.stringify(data));
      
      const mapped: ReceiptInfo = {
        // Map directly from the actual response structure
        total: typeof data.total === 'number' ? data.total : 0,
        merchant: data.merchant || data.merchant_name || 'Không xác định',
        date: data.date || data.transaction_date || new Date().toISOString().split('T')[0],
        // Use the category directly from the API if available
        category: data.category || (Array.isArray(data.items) ? determineOverallCategory(data.items) : 'Khác'),
        items: Array.isArray(data.items) ? data.items.map((item: { 
          name?: string; 
          description?: string; 
          price?: number; 
          quantity?: number;
          category?: string;
        }) => ({
          // Properly map field names - support both name and description fields
          name: item.name || item.description || 'Không xác định',
          price: typeof item.price === 'number' ? item.price : 0,
          quantity: typeof item.quantity === 'number' ? item.quantity : 1,
          // Use category from the API response if available
          category: item.category || determineSingleItemCategory(item.name || item.description)
        })) : []
      };
      
      setReceiptData(mapped);
      // Pre-select all items (all checkboxes ticked by default)
      if (mapped.items && Array.isArray(mapped.items)) {
        setSelectedItems(mapped.items.map((_, index) => index));
      }
      setShowPanel(true);
    } catch (error) {
      console.error('Error processing voice input:', error);
      
      let errorMessage = 'Failed to process receipt';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      showCrossPlatformAlert('Lỗi xử lý', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Helper function to determine overall receipt category
  const determineOverallCategory = (items: any[]): string => {
    if (!Array.isArray(items) || items.length === 0) {
      return "Khác";
    }
    
    const categoryMap: Record<string, number> = {};
    
    // Count items in each category
    items.forEach(item => {
      if (!item) return; // Skip if item is null or undefined
      
      const category = determineSingleItemCategory(item.description);
      categoryMap[category] = (categoryMap[category] || 0) + 1;
    });
    
    // Find category with most items
    let maxCategory = "Khác";
    let maxCount = 0;
    
    Object.entries(categoryMap).forEach(([category, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxCategory = category;
      }
    });
    
    return maxCategory;
  };
  
  // Helper function to determine item category (simple heuristic)
  const determineSingleItemCategory = (name: string | undefined): string => {
    // Handle undefined or empty name
    if (!name) {
      return "Khác";
    }
    
    const lowerName = name.toLowerCase();
    
    // Very simplified categorization logic (would be more sophisticated in real app)
    if (lowerName.includes('cơm') || lowerName.includes('phở') || 
        lowerName.includes('bánh') || lowerName.includes('cafe')) {
      return "Ăn uống";
    } 
    else if (lowerName.includes('taxi') || lowerName.includes('grab') || 
             lowerName.includes('xe') || lowerName.includes('bus')) {
      return "Di chuyển";
    }
    else if (lowerName.includes('áo') || lowerName.includes('quần') || 
             lowerName.includes('giày') || lowerName.includes('túi')) {
      return "Mua sắm";
    }
    else if (lowerName.includes('phim') || lowerName.includes('game') || 
             lowerName.includes('concert') || lowerName.includes('tiệc')) {
      return "Giải trí";
    }
    else if (lowerName.includes('thuốc') || lowerName.includes('khám') || 
             lowerName.includes('bệnh') || lowerName.includes('vitamin')) {
      return "Sức khỏe";
    }
    else if (lowerName.includes('sách') || lowerName.includes('học') || 
             lowerName.includes('khóa') || lowerName.includes('trường')) {
      return "Giáo dục";
    }
    
    return "Khác";
  };
  
  const resetCapture = () => {
    setTranscript('');
    setReceiptData(null);
    setShowPanel(false);
    setSelectedItems([]);
    setEditMode(false);
  };
  
  const toggleItemSelection = (index: number) => {
    setSelectedItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };
  
  const handleAddTransactions = async () => {
    console.log('handleAddTransactions called');
    
    if (!receiptData || addingTransactions || selectedItems.length === 0) {
      if (selectedItems.length === 0) {
        showCrossPlatformAlert('Chọn ít nhất một mục', 'Hãy chọn ít nhất một mặt hàng để thêm');
      }
      return;
    }

    console.log('Starting to add transactions for', selectedItems.length, 'items');
    setAddingTransactions(true);
    try {
      let successCount = 0;
      let failureCount = 0;

      // Add each selected item as a separate transaction
      for (const itemIndex of selectedItems) {
        const item = receiptData.items[itemIndex];
        if (!item) continue;

        // Calculate total price (quantity * price)
        const itemTotal = (item.quantity || 1) * item.price;

        const transaction = {
          amount: -itemTotal, // Negative for expenses
          category: item.category || receiptData.category || 'Khác',
          description: item.name,
          date: receiptData.date || new Date().toISOString().split('T')[0],
          type: 'expense' as const,
          merchant: receiptData.merchant,
          items: [
            {
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              category: item.category
            }
          ]
        };

        console.log('Adding transaction:', transaction);
        const result = await addTransactionToDb(transaction);
        
        if (result) {
          successCount++;
        } else {
          failureCount++;
        }
      }

      // Show appropriate message based on results
      if (failureCount === 0) {
        showCrossPlatformAlert(
          'Hoàn tất',
          `Đã thêm thành công ${successCount} giao dịch.`,
          [{ 
            text: 'OK', 
            onPress: resetCapture 
          }]
        );
      } else if (successCount === 0) {
        showCrossPlatformAlert('Lỗi', 'Không thể thêm giao dịch nào. Vui lòng thử lại sau.');
      } else {
        showCrossPlatformAlert(
          'Hoàn tất một phần',
          `Đã thêm thành công ${successCount} giao dịch, ${failureCount} giao dịch thất bại.`,
          [{ 
            text: 'OK', 
            onPress: resetCapture 
          }]
        );
      }
    } catch (error) {
      console.error('Error adding transactions:', error);
      showCrossPlatformAlert('Lỗi', 'Đã xảy ra lỗi khi thêm giao dịch.');
    } finally {
      setAddingTransactions(false);
    }
  };
  
  if (!permissionGranted && permissionGranted !== null) {
    return (
      <View style={styles.container}>
        <View style={styles.instructionContainer}>
          <Text style={[styles.instructionText, { color: colorScheme === 'dark' ? 'white' : 'black' }]}>
            Tính năng này cần quyền truy cập micrô để hoạt động.
          </Text>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => setPermissionGranted(null)}
          >
            <Text style={styles.buttonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  if (showPanel && receiptData) {
    return (
      <View style={[
        styles.container, 
        { backgroundColor: colorScheme === 'dark' ? 'black' : 'white' }
      ]}>
        <View style={[
          styles.receiptPanel,
          { backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : 'white' }
        ]}>
          <View style={[
            styles.panelHeader,
            { borderBottomColor: colorScheme === 'dark' ? '#333' : '#eee' }
          ]}>
            <Text style={[
              styles.panelTitle,
              { color: colorScheme === 'dark' ? 'white' : 'black' }
            ]}>Chi tiết hóa đơn</Text>
            <TouchableOpacity onPress={resetCapture}>
              <Text style={[
                styles.closeButton,
                { color: colorScheme === 'dark' ? 'white' : 'black' }
              ]}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.receiptContent}>
            <View style={styles.responseContainer}>
              {receiptData.merchant && (
                <View style={styles.merchantCard}>
                  <View style={styles.merchantIconContainer}>
                    <Ionicons name="business-outline" size={24} color="#5F58C2" />
                  </View>
                  <View>
                    <Text style={[
                      styles.merchantLabel,
                      { color: colorScheme === 'dark' ? '#a0a0a0' : '#64748b' }
                    ]}>CỬA HÀNG</Text>
                    <Text style={[
                      styles.merchantName,
                      { color: colorScheme === 'dark' ? 'white' : 'black' }
                    ]}>{receiptData.merchant}</Text>
                  </View>
                </View>
              )}
              
              <View style={styles.totalCard}>
                <Text style={[
                  styles.totalLabel,
                  { color: colorScheme === 'dark' ? '#a0a0a0' : '#64748b' }
                ]}>TỔNG TIỀN</Text>
                <Text style={styles.totalAmount}>
                  {formatCurrency(receiptData.total)}
                </Text>
                
                {receiptData.category && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{receiptData.category}</Text>
                  </View>
                )}
              </View>

              <View style={styles.itemsSection}>
                <View style={styles.itemsHeader}>
                  <View>
                    <Text style={[
                      styles.itemsSectionTitle,
                      { color: colorScheme === 'dark' ? 'white' : 'black' }
                    ]}>Các mục trong hóa đơn</Text>
                    <Text style={[
                      styles.itemsSubtitle,
                      { color: colorScheme === 'dark' ? '#a0a0a0' : '#64748b' }
                    ]}>Chọn các mục muốn thêm vào chi tiêu</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.selectAllButton}
                    onPress={() => {
                      if (receiptData.items.length === selectedItems.length) {
                        setSelectedItems([]);
                      } else {
                        setSelectedItems(receiptData.items.map((_, i) => i));
                      }
                    }}
                  >
                    <Text style={styles.selectAllText}>
                      {receiptData.items.length === selectedItems.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.itemsList}>
                  {receiptData.items.map((item, index) => (
                    <TouchableOpacity
                      key={`item-${index}`}
                      style={[
                        styles.itemCard,
                        selectedItems.includes(index) ? styles.itemCardSelected : {},
                      ]}
                      onPress={() => toggleItemSelection(index)}
                    >
                      <View style={styles.checkbox}>
                        <Ionicons
                          name={selectedItems.includes(index) ? "checkbox" : "square-outline"}
                          size={24}
                          color="#5F58C2"
                        />
                      </View>
                      
                      <View style={styles.itemInfo}>
                        <Text style={[
                          styles.itemName,
                          { color: colorScheme === 'dark' ? 'white' : 'black' }
                        ]}>{item.name}</Text>
                        
                        {item.quantity && item.quantity > 1 ? (
                          <Text style={[
                            { fontSize: 12, marginBottom: 4 },
                            { color: colorScheme === 'dark' ? '#a0a0a0' : '#64748b' }
                          ]}>SL: {item.quantity} x {formatCurrency(item.price)}</Text>
                        ) : null}
                      </View>
                      
                      <View>
                        <Text style={[
                          styles.itemPrice,
                          { color: colorScheme === 'dark' ? 'white' : 'black' }
                        ]}>{formatCurrency((item.quantity || 1) * item.price)}</Text>
                        
                        {item.category && (
                          <View style={styles.itemCategoryBadge}>
                            <Text style={styles.itemCategoryText}>{item.category}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
          
          <View style={[
            styles.modalActions,
            { 
              borderTopColor: colorScheme === 'dark' ? '#333' : '#f1f5f9',
              backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : 'white'
            }
          ]}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => setEditMode(!editMode)}
              disabled={addingTransactions}
            >
              <Ionicons name="create-outline" size={18} color="#5F58C2" />
              <Text style={styles.editButtonText}>Sửa</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.addButton]}
              onPress={handleAddTransactions}
              disabled={addingTransactions || selectedItems.length === 0}
            >
              {addingTransactions ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={18} color="white" />
                  <Text style={styles.addButtonText}>Thêm vào chi tiêu</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[
      styles.container, 
      { backgroundColor: colorScheme === 'dark' ? 'black' : '#f5f5f7' }
    ]}>
      {isFocused && (
        <View style={styles.voiceControls}>
          <View style={styles.instructionContainer}>
            <Text style={[
              styles.instructionText,
              { color: colorScheme === 'dark' ? 'white' : 'black' }
            ]}>
              {status}
            </Text>
            
            {error && (
              <Text style={[
                styles.errorText,
                { color: colorScheme === 'dark' ? '#ff6b6b' : '#d32f2f' }
              ]}>
                {error}
              </Text>
            )}
          </View>
          
          <TouchableOpacity 
            style={[
              styles.recordButton,
              isRecording ? styles.recordingButton : {}
            ]} 
            onPress={toggleRecording}
          >
            <Ionicons 
              name={isRecording ? "stop" : "mic"} 
              size={32} 
              color="white" 
            />
            {isRecording && (
              <View style={styles.recordingIndicator} />
            )}
          </TouchableOpacity>
          
          <View style={styles.transcriptContainer}>
            <Text style={[
              styles.transcriptTitle,
              { color: colorScheme === 'dark' ? '#a0a0a0' : '#64748b' }
            ]}>
              Bản ghi
            </Text>
            <ScrollView style={[
              styles.transcriptBox,
              { backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : 'white' }
            ]}>
              <Text style={[
                styles.transcriptText,
                { color: colorScheme === 'dark' ? 'white' : 'black' }
              ]}>
                {transcript || 'Bản ghi sẽ hiển thị ở đây sau khi bạn nói...'}
              </Text>
            </ScrollView>
          </View>
          
          {isProcessing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#5F58C2" />
              <Text style={[
                styles.processingText,
                { color: colorScheme === 'dark' ? 'white' : 'black' }
              ]}>
                Đang xử lý hóa đơn của bạn...
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  voiceControls: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionContainer: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: FontFamily.medium,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    fontFamily: FontFamily.regular,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#5F58C2',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  recordingButton: {
    backgroundColor: '#d32f2f',
  },
  recordingIndicator: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: '#d32f2f',
    opacity: 0.7,
    // Note: animation property is removed as it's not supported in React Native StyleSheet
  },
  transcriptContainer: {
    width: '100%',
    flex: 1,
    marginTop: 20,
  },
  transcriptTitle: {
    fontSize: 14,
    marginBottom: 8,
    fontFamily: FontFamily.medium,
  },
  transcriptBox: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
  },
  transcriptText: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
  processingContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  processingText: {
    marginLeft: 10,
    fontSize: 16,
    color: 'white',
    fontFamily: FontFamily.medium,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: FontFamily.medium,
  },
  // Receipt panel styles (reused from camera.tsx)
  receiptPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: FontFamily.bold,
  },
  receiptContent: {
    flex: 1,
    padding: 20,
  },
  closeButton: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  // Response styles (reused from camera.tsx)
  responseContainer: {
    gap: 16,
  },
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  merchantName: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    marginTop: 2,
  },
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
  itemsSection: {
    marginTop: 8,
  },
  itemsSectionTitle: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
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
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
  },
  itemCategoryBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  itemCategoryText: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    color: '#475569',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
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
});
