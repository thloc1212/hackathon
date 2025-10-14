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
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width, height } = Dimensions.get('window');

interface ReceiptData {
  total: string;
  items: Array<{
    name: string;
    price: string;
    quantity?: string;
  }>;
  date?: string;
  merchant?: string;
}

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
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
        const photo = await cameraRef.current.takePictureAsync();
        if (photo?.uri) {
          setCapturedImage(photo.uri);
          processImage(photo.uri);
        }
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
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
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
        processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const processImage = async (imageUri: string) => {
    setIsProcessing(true);
    try {
      // TODO: Replace this with actual OCR implementation from GitHub
      // Placeholder processing simulation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock receipt data - will be replaced with actual OCR results
      const mockReceiptData: ReceiptData = {
        total: '$45.67',
        merchant: 'Sample Store',
        date: new Date().toLocaleDateString(),
        items: [
          { name: 'Coffee', price: '$4.50', quantity: '1' },
          { name: 'Sandwich', price: '$8.99', quantity: '1' },
          { name: 'Water', price: '$2.18', quantity: '2' },
          { name: 'Tax', price: '$2.00' },
        ]
      };

      setReceiptData(mockReceiptData);
      setShowPanel(true);
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process receipt');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setReceiptData(null);
    setShowPanel(false);
  };

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
                Receipt Information
              </Text>
              <TouchableOpacity onPress={() => setShowPanel(false)}>
                <Text style={[styles.closeButton, { color: Colors[colorScheme ?? 'light'].text }]}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.receiptContent}>
              {receiptData.merchant && (
                <View style={styles.receiptRow}>
                  <Text style={[styles.receiptLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Merchant:
                  </Text>
                  <Text style={[styles.receiptValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {receiptData.merchant}
                  </Text>
                </View>
              )}
              
              {receiptData.date && (
                <View style={styles.receiptRow}>
                  <Text style={[styles.receiptLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Date:
                  </Text>
                  <Text style={[styles.receiptValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {receiptData.date}
                  </Text>
                </View>
              )}

              <Text style={[styles.itemsHeader, { color: Colors[colorScheme ?? 'light'].text }]}>
                Items:
              </Text>
              
              {receiptData.items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={[styles.itemName, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {item.quantity ? `${item.quantity}x ` : ''}{item.name}
                  </Text>
                  <Text style={[styles.itemPrice, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {item.price}
                  </Text>
                </View>
              ))}
              
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Total:
                </Text>
                <Text style={[styles.totalValue, { color: Colors[colorScheme ?? 'light'].tint }]}>
                  {receiptData.total}
                </Text>
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <Text style={styles.buttonIcon}>🔄</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.albumButton} onPress={pickImage}>
            <Text style={styles.buttonIcon}>📷</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
      
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
  itemsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemName: {
    fontSize: 14,
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#333',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  buttonIcon: {
    fontSize: 24,
    color: 'white',
  },
});