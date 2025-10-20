import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface RegistrationSuccessProps {
  onContinue: () => void;
  userEmail?: string;
}

export default function RegistrationSuccess({ onContinue, userEmail }: RegistrationSuccessProps) {
  return (
    <LinearGradient
      colors={['#B9B4FF', '#524BBF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.checkIcon}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        </View>

        {/* Success Message */}
        <Text style={styles.title}>Đăng ký thành công!</Text>
        <Text style={styles.subtitle}>
          Chào mừng bạn đến với nền tảng của chúng tôi! Tài khoản của bạn đã được tạo thành công.
        </Text>
        
        {userEmail && (
          <Text style={styles.emailText}>
            Đã đăng ký với: {userEmail}
          </Text>
        )}

        {/* Continue Button */}
        <Pressable style={styles.continueButton} onPress={onContinue}>
          <Text style={styles.continueButtonText}>Tiếp tục đăng nhập</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: 40,
  },
  checkIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  checkMark: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.9,
    lineHeight: 24,
  },
  emailText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.8,
    fontStyle: 'italic',
  },
  continueButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  continueButtonText: {
    color: '#524BBF',
    fontSize: 16,
    fontWeight: '600',
  },
});