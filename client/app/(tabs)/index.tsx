import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Pressable, 
  StyleSheet,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Ellipse, Defs, RadialGradient, Stop } from 'react-native-svg';
import AuthService from '../../lib/authService';
import RegistrationSuccess from '../../components/RegistrationSuccess';

const { width, height } = Dimensions.get('window');

export default function HomePage() {
  // Authentication state (managed centrally in AuthService)
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  
  // Modal state
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  
  // Form state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  
  // Error state
  const [signInError, setSignInError] = useState('');
  const [signUpError, setSignUpError] = useState('');
  const [isSignInLoading, setIsSignInLoading] = useState(false);
  const [isSignUpLoading, setIsSignUpLoading] = useState(false);

  // Note: Root layout handles loading stored session and showing tabs

  const handleSignIn = () => {
    setSignInError('');
    setShowSignInModal(true);
  };

  const handleSignUp = () => {
    setSignUpError('');
    setShowSignUpModal(true);
  };

  const handleCloseSignInModal = () => {
    setSignInError('');
    setEmail('');
    setOtp('');
    setOtpSent(false);
    setShowSignInModal(false);
  };

  const handleCloseSignUpModal = () => {
    setSignUpError('');
    setSignUpName('');
    setSignUpEmail('');
    setDateOfBirth('');
    setShowSignUpModal(false);
  };

  const handleRegistrationSuccessContinue = () => {
    setShowRegistrationSuccess(false);
    setShowSignInModal(true);
  };

  const handleLogout = () => {
    // logout is handled in HomeScreen via AuthService; nothing to do here
  };

  const handleSignInSubmit = async () => {
    setSignInError('');
    setIsSignInLoading(true);
    
    try {
      if (!otpSent) {
        // Step 1: Request OTP
        if (!email) {
          setSignInError('Please enter your email');
          setIsSignInLoading(false);
          return;
        }

        await AuthService.requestOTP(email);
        setOtpSent(true);
        setSignInError('');
        
      } else {
        // Step 2: Verify OTP and login
        if (!otp) {
          setSignInError('Please enter the OTP code');
          setIsSignInLoading(false);
          return;
        }

        await AuthService.verifyOTP(email, otp);
        
        // Clear form and close modal; RootLayout will detect auth change and show Tabs
        setEmail('');
        setOtp('');
        setOtpSent(false);
        setSignInError('');
        setShowSignInModal(false);
      }
      
    } catch (error) {
      setSignInError((error as Error).message || 'Không thể đăng nhập');
    } finally {
      setIsSignInLoading(false);
    }
  };

  const handleSignUpSubmit = async () => {
    setSignUpError('');
    setIsSignUpLoading(true);
    
    try {
      // Validate required fields
      if (!signUpName || !signUpEmail || !dateOfBirth) {
        setSignUpError('Vui lòng điền đầy đủ thông tin');
        setIsSignUpLoading(false);
        return;
      }

      // Validate name
      if (signUpName.trim().length < 2) {
        setSignUpError('Tên phải có ít nhất 2 ký tự');
        setIsSignUpLoading(false);
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(signUpEmail)) {
        setSignUpError('Vui lòng nhập địa chỉ email hợp lệ');
        setIsSignUpLoading(false);
        return;
      }

      // Validate date of birth format (YYYY-MM-DD or DD/MM/YYYY or MM/DD/YYYY)
      const dateRegex = /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/;
      if (!dateRegex.test(dateOfBirth)) {
        setSignUpError('Vui lòng nhập ngày theo định dạng YYYY-MM-DD hoặc DD/MM/YYYY');
        setIsSignUpLoading(false);
        return;
      }

      const result = await AuthService.signup(signUpName, signUpEmail, dateOfBirth);

      // Show success message and redirect to login
      setRegisteredEmail(signUpEmail);
      setShowRegistrationSuccess(true);

      // Clear form and close modal
      setSignUpName('');
      setSignUpEmail('');
      setDateOfBirth('');
      setSignUpError('');
      setShowSignUpModal(false);
      
    } catch (error) {
      setSignUpError((error as Error).message || 'Không thể tạo tài khoản');
    } finally {
      setIsSignUpLoading(false);
    }
  };

  // Show registration success screen
  if (showRegistrationSuccess) {
    return (
      <RegistrationSuccess 
        onContinue={handleRegistrationSuccessContinue}
        userEmail={registeredEmail}
      />
    );
  }



  // Show landing page with auth modals
  return (
    <LinearGradient
      colors={['#B9B4FF', '#524BBF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      {/* Background Decorative Elements */}
      <View style={[styles.decorativeCircle1, { overflow: 'visible' }]}> 
        <Svg
          width={228.59}
          height={227.91}
          style={{ position: 'absolute', left: 0, top: 0, opacity: 0.7, transform: [{ rotate: '30deg' }] }}
        >
          <Defs>
            <RadialGradient
              id="grad"
              cx="27.44%"
              cy="41.04%"
              rx="70.18%"
              ry="69.66%"
              fx="27.44%"
              fy="41.04%"
            >
              <Stop offset="0" stopColor="#7870DD" stopOpacity="1" />
              <Stop offset="1" stopColor="#241E78" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={114.296}
            cy={113.953}
            rx={114.296}
            ry={113.953}
            fill="url(#grad)"
          />
        </Svg>
      </View>
      <LinearGradient
          colors={['rgba(119.51, 112.24, 221.29, 0)', 'rgba(82.43, 74.70, 190.64, 0.40)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.decorativeCircle2, { opacity: 0.4 }]}
        />
      <View style={[styles.decorativeCircle3, { overflow: 'visible' }]}> 
        <Svg
          width={88.81}
          height={88.55}
          style={{ position: 'absolute', left: 0, top: 0, opacity: 0.95, transform: [{ rotate: '-30.04deg' }] }}
        >
          <Defs>
            <RadialGradient
              id="grad3"
              cx="27.44%"
              cy="41.04%"
              rx="70.18%"
              ry="69.66%"
              fx="27.44%"
              fy="41.04%"
            >
              <Stop offset="0" stopColor="#7870DD" stopOpacity="1" />
              <Stop offset="1" stopColor="#241E78" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={44.4069}
            cy={44.2736}
            rx={44.4069}
            ry={44.2736}
            fill="url(#grad3)"
          />
        </Svg>
      </View>
      
      {/* Main Content */}
      <View style={styles.content}>
        <Text style={styles.welcomeText}>Chào mừng trở lại!</Text>
        <Text style={styles.subtitleText}>
          Chi tiêu hàng ngày của bạn, biến thành{"\n"}những hiểu biết có ý nghĩa với AI.
        </Text>
      </View>
      
      {/* Authentication Buttons */}
      <View style={styles.authButtonsContainer}>
        <Pressable style={styles.signInButton} onPress={handleSignIn}>
          <Text style={styles.signInText}>Đăng nhập</Text>
        </Pressable>
        <Pressable style={styles.signUpButton} onPress={handleSignUp}>
          <Text style={styles.signUpText}>Đăng ký</Text>
        </Pressable>
      </View>

      {/* Sign In Modal */}
      <Modal
        visible={showSignInModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseSignInModal}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseSignInModal}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <ScrollView 
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Modal Content */}
                <View style={styles.signInCard}>
                  <Text style={styles.signInTitle}>Đăng nhập</Text>
                  
                  {!otpSent ? (
                    <>
                      {/* Email Input */}
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Email</Text>
                        <TextInput
                          style={styles.textInput}
                          value={email}
                          onChangeText={setEmail}
                          placeholder="Enter your email"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>

                      {/* Info Message */}
                      <View style={styles.infoContainer}>
                        <Text style={styles.infoText}>
                          Bạn sẽ nhận được mã đăng nhập một lần qua email.
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      {/* OTP Input */}
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Nhập mã OTP</Text>
                        <TextInput
                          style={styles.textInput}
                          value={otp}
                          onChangeText={setOtp}
                          placeholder="Mật mã dùng một lần"
                          placeholderTextColor="#9CA3AF"
                          autoCapitalize="characters"
                          maxLength={8}
                        />
                      </View>

                      {/* Info Message */}
                      <View style={styles.infoContainer}>
                        <Text style={styles.infoText}>
                          Kiểm tra email của bạn ({email}) để lấy mã OTP
                        </Text>
                      </View>

                      {/* Resend OTP */}
                      <Pressable 
                        style={styles.forgotPasswordContainer}
                        onPress={() => {
                          setOtpSent(false);
                          setOtp('');
                          setSignInError('');
                        }}
                      >
                        <Text style={styles.forgotPasswordText}>Sử dụng email khác</Text>
                      </Pressable>
                    </>
                  )}

                  {/* Error Message */}
                  {signInError ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{signInError}</Text>
                    </View>
                  ) : null}

                  {/* Sign In Button */}
                  <Pressable 
                    style={[styles.signInModalButton, isSignInLoading && styles.buttonDisabled]} 
                    onPress={handleSignInSubmit}
                    disabled={isSignInLoading}
                  >
                    <Text style={styles.signInModalButtonText}>
                      {isSignInLoading 
                        ? (otpSent ? 'Đang xác thực...' : 'Đang gửi mã OTP...') 
                        : (otpSent ? 'Xác thực & Đăng nhập' : 'Gửi mã OTP')
                      }
                    </Text>
                  </Pressable>
                  
                  {/* Bottom spacing for mobile */}
                  <View style={styles.bottomSpacer} />
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sign Up Modal */}
      <Modal
        visible={showSignUpModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseSignUpModal}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseSignUpModal}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <ScrollView 
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Modal Content */}
                <View style={styles.signInCard}>
                  <Text style={styles.signInTitle}>Đăng ký</Text>
                  
                  {/* Name Input */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Tên</Text>
                    <TextInput
                      style={styles.textInput}
                      value={signUpName}
                      onChangeText={setSignUpName}
                      placeholder=""
                      autoCapitalize="words"
                    />
                  </View>

                  {/* Email Input */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      style={styles.textInput}
                      value={signUpEmail}
                      onChangeText={setSignUpEmail}
                      placeholder=""
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  {/* Date of Birth Input */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Ngày sinh</Text>
                    <TextInput
                      style={styles.textInput}
                      value={dateOfBirth}
                      onChangeText={setDateOfBirth}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  {/* Info Message */}
                  <View style={styles.infoContainer}>
                    <Text style={styles.infoText}>
                      Bạn sẽ sử dụng mã OTP được gửi đến email để đăng nhập.
                    </Text>
                  </View>

                  {/* Error Message */}
                  {signUpError ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{signUpError}</Text>
                    </View>
                  ) : null}

                  {/* Sign Up Button */}
                  <Pressable 
                    style={[styles.signInModalButton, isSignUpLoading && styles.buttonDisabled]} 
                    onPress={handleSignUpSubmit}
                    disabled={isSignUpLoading}
                  >
                    <Text style={styles.signInModalButtonText}>
                      {isSignUpLoading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
                    </Text>
                  </Pressable>
                  
                  {/* Bottom spacing for mobile */}
                  <View style={styles.bottomSpacer} />
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    flex: 1,
  },
  decorativeCircle1: {
    width: 228.59,
    height: 227.91,
    left: 302.10,
    top: -114,
    position: 'absolute',
    transform: [{ rotate: '30deg' }],
    backgroundColor: 'rgba(119.51, 112.24, 221.29, 0.70)',
    borderRadius: 9999,
  },
  decorativeCircle2: {
    width: 463.14,
    height: 453.93,
    left: -204,
    top: -71,
    position: 'absolute',
    transform: [{ rotate: '-14.07deg' }],
    borderRadius: 9999,
  },
  decorativeCircle3: {
    width: 88.81,
    height: 88.55,
    left: 314,
    top: 77,
    position: 'absolute',
    borderRadius: 9999,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 363,
    textAlign: 'center',
    color: '#0B1179',
    fontSize: 30,
    fontFamily: 'Be Vietnam Pro',
    fontWeight: '600',
    flexWrap: 'wrap',
    wordWrap: 'break-word',
  },
  subtitleText: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    left: 0,
    top: 414,
    textAlign: 'center',
    color: 'white',
    fontSize: 13,
    fontFamily: 'Be Vietnam Pro',
    fontStyle: 'italic',
    fontWeight: '500',
    flexWrap: 'wrap',
    wordWrap: 'break-word',
  },
  authButtonsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 20,
  },
  signInButton: {
    width: 255.50,
    height: 60,
    backgroundColor: '#241E78',
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpButton: {
    width: 255.50,
    height: 60,
    backgroundColor: '#D9D9D9',
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  signUpText: {
    color: '#241E78',
    fontSize: 13,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#F9F5FF',
    borderTopLeftRadius: 53,
    borderTopRightRadius: 53,
    marginTop: height * 0.3,
    minHeight: height * 0.7,
    overflow: 'hidden',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 1,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  signInCard: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  signInTitle: {
    textAlign: 'center',
    color: '#241E78',
    fontSize: 26,
    fontFamily: 'Be Vietnam Pro',
    fontWeight: '600',
    marginBottom: 40,
  },
  inputContainer: {
    width: '100%',
    position: 'relative',
    marginBottom: 30,
  },
  inputLabel: {
    position: 'absolute',
    left: 6,
    top: 0,
    color: '#241E78',
    fontSize: 15,
    fontFamily: 'Be Vietnam Pro',
    fontWeight: '600',
  },
  textInput: {
    width: '100%',
    height: 46,
    marginTop: 30,
    backgroundColor: '#EBE7ED',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  forgotPasswordText: {
    textAlign: 'center',
    color: '#241E78',
    fontSize: 12,
    fontFamily: 'Be Vietnam Pro',
    fontWeight: '600',
  },
  signInModalButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#241E78',
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInModalButtonText: {
    textAlign: 'center',
    color: '#D5D2FF',
    fontSize: 17,
    fontFamily: 'Be Vietnam Pro',
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    fontFamily: 'Be Vietnam Pro',
    fontWeight: '500',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  bottomSpacer: {
    height: 40,
  },
  infoContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#81C784',
  },
  infoText: {
    color: '#2E7D32',
    fontSize: 13,
    fontFamily: 'Be Vietnam Pro',
    fontWeight: '500',
    textAlign: 'center',
  },
});
