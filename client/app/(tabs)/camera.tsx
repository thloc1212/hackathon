import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontWeight } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ReceiptInfo } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { useApi } from '@/hooks/useApi';
import { useDatabase } from '@/hooks/useDatabase';

const { width, height } = Dimensions.get('window');

// Cross-platform alert function
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

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptInfo | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [editMode, setEditMode] = useState(false);

  const [addingTransactions, setAddingTransactions] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const colorScheme = useColorScheme();
  const { parseReceipt } = useApi();
  const { addTransaction: addTransactionToDb } = useDatabase();
  const isFocused = useIsFocused();

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showCrossPlatformAlert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
      }
    })();
  }, []);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={[styles.message, { color: Colors[colorScheme ?? 'light'].text }]}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false, // We'll read base64 separately for better control
          skipProcessing: false,
          // For iOS, ensure we get a compatible format
          ...(Platform.OS === 'ios' && {
            exif: false, // Reduce file size and potential processing issues
          }),
        });
        
        if (photo?.uri) {
          console.log('Photo captured successfully:', photo.uri);
          setCapturedImage(photo.uri);
          processImage(photo.uri);
        } else {
          throw new Error('No image URI received from camera');
        }
      } catch (error) {
        console.error('Error taking picture:', error);
        showCrossPlatformAlert('Error', 'Failed to capture photo. Please try again.');
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        // Force JPEG format for better compatibility
        ...(Platform.OS === 'ios' && {
          allowsMultipleSelection: false,
          selectionLimit: 1,
        }),
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
        processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showCrossPlatformAlert('Error', 'Failed to pick image from library');
    }
  };

  const processImage = async (imageUri: string) => {
    setIsProcessing(true);
    try {
      console.log('Processing image URI:', imageUri);
      console.log('Platform:', Platform.OS);
      
      // Read file as base64. FileSystem.readAsStringAsync works with file:// URIs.
      let base64: string | null = null;
      
      try {
        // For iOS, handle different URI schemes properly
        if (Platform.OS === 'ios' && imageUri.startsWith('ph://')) {
          console.log('iOS Photos URI detected, using fetch method');
          const resp = await fetch(imageUri);
          const blob = await resp.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          base64 = btoa(binary);
        } else {
          // Standard file:// URI handling
          base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' as any });
        }
      } catch (fsErr) {
        console.log('FileSystem read failed, trying fetch method:', fsErr);
        // Fallback: Use fetch for content:// URIs (Android) or other URI schemes
        try {
          const resp = await fetch(imageUri);
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
          }
          const blob = await resp.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          base64 = btoa(binary);
        } catch (fallbackErr) {
          console.error('Both FileSystem and fetch methods failed:', fsErr, fallbackErr);
          throw new Error('Unable to read image data. Please try taking a new photo.');
        }
      }

      if (!base64) {
        throw new Error('Failed to read image as base64');
      }

      console.log('Base64 length:', base64.length);

      // Improved mime type detection for iOS
      const guessMimeType = (uri: string) => {
        // Check for explicit format parameters in iOS URIs
        if (uri.includes('ext=HEIC') || uri.includes('ext=heic')) {
          return 'image/heic';
        }
        if (uri.includes('ext=PNG') || uri.includes('ext=png')) {
          return 'image/png';
        }
        
        // Check file extension
        const m = uri.match(/\.(\w+)(\?.*)?$/);
        const ext = m ? m[1].toLowerCase() : '';
        if (ext === 'png') return 'image/png';
        if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
        if (ext === 'heic' || ext === 'heif') return 'image/heic';
        
        // Default to JPEG for compatibility
        return 'image/jpeg';
      };

      const mimeType = guessMimeType(imageUri);
      console.log('Detected MIME type:', mimeType);

      // Use local parseReceipt instead of remote endpoint
      const { parseReceipt } = await import('@/services/geminiService');
      console.log('Starting Gemini API call...');
      const data = await parseReceipt(base64, mimeType);
      console.log('Gemini API response received:', data);

      // Data from parseReceipt already matches ReceiptInfo shape
      const mapped: ReceiptInfo = {
        total: data.total,
        merchant: data.merchant,
        date: data.date,
        category: data.category, // Include AI-determined category
        items: data.items, // Items already have the correct structure from geminiService
      };

      setReceiptData(mapped);
      // Pre-select all items (all checkboxes ticked by default)
      if (mapped.items && Array.isArray(mapped.items)) {
        setSelectedItems(mapped.items.map((_, index) => index));
      }
      setShowPanel(true);
    } catch (error) {
      console.error('Error processing image:', error);
      
      let errorMessage = 'Failed to process receipt';
      if (error instanceof Error) {
        // Use the more specific error message from geminiService
        errorMessage = error.message;
      }
      
      // Add platform-specific guidance
      if (Platform.OS === 'ios') {
        errorMessage += '\n\nFor iOS: Try taking a new photo directly with the camera instead of selecting from the photo library.';
      }
      
      showCrossPlatformAlert('Processing Error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetCapture = () => {
    setCapturedImage(null);
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
        console.log('No items selected, showing alert');
        showCrossPlatformAlert('No Items Selected', 'Please select at least one item to add.');
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

        const transactionData = {
          amount: Math.abs(item.price || 0), // Use item's amount
          category: item.category || receiptData.category || 'Khác', // Use item's category, fallback to overall category
          description: `${receiptData.merchant ? receiptData.merchant + ' - ' : ''}${item.name || 'Item'}`,
          date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
          type: 'expense' as const, // Default to expense for receipts
          merchant: receiptData.merchant,
          items: [] // Each transaction is for a single item, no items array needed
        };

        console.log('Adding individual transaction:', transactionData);
        const success = await addTransactionToDb(transactionData);
        console.log(`Transaction ${itemIndex} result:`, success);
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }
      }

      console.log(`Final results - Success: ${successCount}, Failure: ${failureCount}`);

      // Use requestAnimationFrame to ensure we're on the main thread after state updates
      requestAnimationFrame(() => {
        if (successCount > 0) {
          // Show success message and return to camera
          console.log('About to show success alert');
          showCrossPlatformAlert(
            'Success ✓', 
            `${successCount} transaction${successCount > 1 ? 's' : ''} added successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}!`,
            [{ 
              text: 'Take Another Photo',
              onPress: () => {
                console.log('Success: Resetting capture');
                resetCapture(); // Return to camera screen
              }
            }]
          );
        } else {
          // Show error message and stay on current screen
          console.log('About to show error alert');
          showCrossPlatformAlert(
            'Error ⚠️', 
            'Failed to add any transactions. Please check your connection and try again.',
            [{ 
              text: 'Retry', 
              onPress: () => {
                console.log('Error: Staying on current screen for retry');
                // Stay on current screen to allow retry
              }
            }]
          );
        }
      });
    } catch (error) {
      console.error('Add transactions error:', error);
      // Use requestAnimationFrame to ensure proper timing
      requestAnimationFrame(() => {
        console.log('About to show exception alert');
        showCrossPlatformAlert(
          'Error ⚠️', 
          'An unexpected error occurred while adding transactions. Please try again.',
          [{ 
            text: 'OK', 
            onPress: () => {
              console.log('Exception: Staying on current screen for retry');
              // Stay on current screen to allow retry
            }
          }]
        );
      });
    } finally {
      setAddingTransactions(false);
    }
  };

  // Removed OCR text editing functionality - users can't edit OCR text anymore

  if (capturedImage) {
    return (
      <View style={styles.container}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: capturedImage }} style={styles.capturedImage} />
          
          <View style={styles.imageControls}>
            <TouchableOpacity onPress={resetCapture} style={styles.controlButton}>
              <Text style={styles.controlButtonText}>← Retake</Text>
            </TouchableOpacity>
            
            {isProcessing && (
              <View style={styles.processingContainer}>
                <Text style={styles.processingText}>Processing receipt...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Receipt Information Panel */}
        {showPanel && receiptData && (
          <View style={[styles.receiptPanel, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
            <View style={styles.panelHeader}>
              <Text style={[styles.panelTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                Receipt Analysis
              </Text>
              <TouchableOpacity onPress={() => setShowPanel(false)}>
                <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.receiptContent} showsVerticalScrollIndicator={false}>
                <View style={styles.responseContainer}>
                  {/* Merchant Card */}
                  {receiptData.merchant && (
                    <View style={styles.merchantCard}>
                      <View style={styles.merchantIconContainer}>
                        <Ionicons name="storefront" size={24} color="#5F58C2" />
                      </View>
                      <View>
                        <Text style={[styles.merchantLabel, { color: Colors[colorScheme ?? 'light'].icon }]}>
                          Store
                        </Text>
                        <Text style={[styles.merchantName, { color: Colors[colorScheme ?? 'light'].text }]}>
                          {receiptData.merchant}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Total Amount Card */}
                  <View style={styles.totalCard}>
                    <Text style={[styles.totalLabel, { color: Colors[colorScheme ?? 'light'].icon }]}>
                      Total Amount
                    </Text>
                    <Text style={styles.totalAmount}>
                      {formatCurrency(receiptData.total)}
                    </Text>
                    {receiptData.category && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{receiptData.category}</Text>
                      </View>
                    )}
                  </View>

                  {/* Items Selection */}
                  {receiptData.items && Array.isArray(receiptData.items) && receiptData.items.length > 0 && (
                    <View style={styles.itemsSection}>
                      <Text style={[styles.itemsSectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                        Items Found
                      </Text>
                      
                      <View style={styles.itemsHeader}>
                        <Text style={[styles.itemsSubtitle, { color: Colors[colorScheme ?? 'light'].icon }]}>
                          Select which items you want to add:
                        </Text>
                        <Pressable 
                          style={styles.selectAllButton}
                          onPress={() => {
                            if (selectedItems.length === receiptData.items?.length) {
                              setSelectedItems([]); // Deselect all
                            } else {
                              setSelectedItems(receiptData.items?.map((_, index) => index) || []); // Select all
                            }
                          }}
                        >
                          <Text style={styles.selectAllText}>
                            {selectedItems.length === receiptData.items?.length ? 'Deselect All' : 'Select All'}
                          </Text>
                        </Pressable>
                      </View>
                      
                      <View style={styles.itemsList}>
                        {receiptData.items.map((item, index: number) => (
                          <Pressable 
                            key={index} 
                            style={[
                              styles.itemCard,
                              selectedItems.includes(index) && styles.itemCardSelected
                            ]}
                            onPress={() => toggleItemSelection(index)}
                          >
                            <View style={styles.checkbox}>
                              {selectedItems.includes(index) ? (
                                <Ionicons name="checkbox" size={24} color="#5F58C2" />
                              ) : (
                                <Ionicons name="square-outline" size={24} color="#cbd5e1" />
                              )}
                            </View>
                            <View style={styles.itemInfo}>
                              <Text style={[styles.itemName, { color: Colors[colorScheme ?? 'light'].text }]}>
                                {item.quantity ? `${item.quantity}x ` : ''}{item.name}
                              </Text>
                              <Text style={[styles.itemPrice, { color: '#059669' }]}>
                                {formatCurrency(item.price)}
                              </Text>
                            </View>
                            {item.category && (
                              <View style={styles.itemCategoryBadge}>
                                <Text style={styles.itemCategoryText}>{item.category}</Text>
                              </View>
                            )}
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
            </ScrollView>

            {/* Action Buttons */}
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.actionButton, styles.addButton, addingTransactions && { opacity: 0.6 }]}
                  onPress={handleAddTransactions}
                  disabled={addingTransactions || selectedItems.length === 0}
                >
                  {addingTransactions ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="add" size={18} color="#fff" />
                      <Text style={styles.addButtonText}>
                        Add {selectedItems.length} Item{selectedItems.length !== 1 ? 's' : ''}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isFocused && (
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
              <Ionicons name="camera-reverse" size={24} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.albumButton} onPress={pickImage}>
              <Ionicons name="images" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </CameraView>
      )}
      
      <View style={[styles.instructionContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <Text style={[styles.instructionText, { color: Colors[colorScheme ?? 'light'].text }]}>
          Point camera at receipt and tap capture, or choose from album
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  cameraControls: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 32,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  flipButton: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  albumButton: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
  },
  instructionContainer: {
    padding: 16,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
  },
  imageContainer: {
    flex: 1,
  },
  capturedImage: {
    flex: 1,
    width: '100%',
  },
  imageControls: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  controlButtonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 16,
  },
  processingContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  processingText: {
    color: 'white',
    fontSize: 16,
  },
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
    borderBottomColor: '#eee',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  receiptContent: {
    flex: 1,
    padding: 20,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  receiptLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  receiptValue: {
    fontSize: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  // New styles for item selection interface
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
  // Edit Mode Styles
  editContainer: {
    gap: 16,
  },
  editTitle: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  editSubtitle: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    textAlign: 'center',
    marginBottom: 8,
  },
});