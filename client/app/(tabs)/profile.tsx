import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import AuthService from '@/lib/authService';

// Giả định các import này đã được cấu hình trong dự án của bạn
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Giả định các hook/constants này đã tồn tại
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme'; 

const STORAGE_KEY = '@app_profile_v1';
const PRIMARY_COLOR = '#5F58C2';
// --- MÀN HÌNH CHÍNH ---

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  // Giả định một cấu trúc Colors cơ bản
  const colors = Colors[colorScheme] || { 
    background: '#f0f3f8', 
    text: '#333', 
    card: '#FFF', 
    tint: PRIMARY_COLOR, 
    icon: '#666' 
  };

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();


  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadProfile();
    }
  }, [isFocused]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setName(parsed.name || '');
      setEmail(parsed.email || '');
      setBio(parsed.bio || '');
      setDateOfBirth(parsed.dateOfBirth || '');
      setAvatarUri(parsed.avatarUri || null);
    } catch (err) {
      console.warn('Failed to load profile', err);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      const payload = { name, email, bio, dateOfBirth, avatarUri };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      Alert.alert('Thành công', 'Thông tin đã được lưu.');
    } catch (err) {
      console.warn('Failed to save profile', err);
      Alert.alert('Lỗi', 'Không thể lưu thông tin.');
    }
  };

  useEffect(() => {
    // load auth user if present
    const u = AuthService.getCurrentUser();
    if (u && u.email) setEmail(u.email);
  }, []);

  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Cần quyền truy cập', 'Cần quyền truy cập thư viện ảnh để chọn ảnh đại diện.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      const anyRes: any = result;
      if (anyRes.canceled === true || anyRes.cancelled === true) return;
      if (anyRes.assets && anyRes.assets.length > 0) {
        setAvatarUri(anyRes.assets[0].uri);
      } else if (anyRes.uri) {
        setAvatarUri(anyRes.uri);
      }
    } catch (err) {
      console.warn('Image pick error', err);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  const removeAvatar = () => setAvatarUri(null);

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer]}> 
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}> 
      <ThemedText style={styles.title}>Thông tin cá nhân</ThemedText>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Phần Avatar (chỉ hiển thị, không chỉnh sửa) */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: PRIMARY_COLOR + '3' }]}> 
                <ThemedText style={styles.avatarInitial}>{(name && name[0]) || 'U'}</ThemedText>
              </View>
            )}
          </View>
        </View>


        {/* Phần Form */}
        <View style={styles.formCard}>
          {/* Tên (chỉ hiển thị) */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Họ và Tên</ThemedText>
            <ThemedText style={[styles.input, { color: colors.text, backgroundColor: '#F4F3FF' }]}>{name || '-'}</ThemedText>
          </View>

          {/* Email (chỉ hiển thị) */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <ThemedText style={[styles.input, { color: colors.text, backgroundColor: '#F4F3FF' }]}>{email || '-'}</ThemedText>
          </View>

          {/* Ngày sinh (chỉ hiển thị) */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Ngày sinh</ThemedText>
            <ThemedText style={[styles.input, { color: colors.text, backgroundColor: '#F4F3FF' }]}>{dateOfBirth || '-'}</ThemedText>
          </View>

          {/* Bio/Ghi chú (chỉ hiển thị) */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Tiểu sử/Ghi chú</ThemedText>
            <ThemedText style={[styles.textArea, { color: colors.text, backgroundColor: '#F4F3FF' }]}>{bio || '-'}</ThemedText>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable style={[styles.button, styles.reloadButton]} onPress={() => router.push('./profile-edit')}>
              <ThemedText style={styles.reloadButtonText}>Chỉnh sửa</ThemedText>
            </Pressable>
            <Pressable style={[styles.button, styles.saveButton]} onPress={async () => {
              // logout
              try {
                await AuthService.signout();
                Alert.alert('Đã đăng xuất');
                // router will be handled by AuthService listeners in layout, but as fallback redirect to landing
                try { router.replace('/'); } catch (e) { /* noop */ }
              } catch (err) {
                console.warn('Logout failed', err);
                Alert.alert('Lỗi', 'Đăng xuất thất bại');
              }
            }}>
              <ThemedText style={styles.buttonText}>Đăng xuất</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

// --- STYLES ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    backgroundColor: '#f0f3f8', 
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  
  // --- Avatar Card ---
  avatarCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'column',
    alignItems: 'center', // Căn chỉnh theo chiều ngang (vertical axis)
    elevation: 2,
    width: '40%',
    alignSelf: 'center',
  },
  avatarWrapper: {
    width: 200,
    height: 200,
    borderRadius: 50,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#ECEBFF',
  },
  avatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 15,
    padding: 5,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  // Đã SỬA: Container bao bọc 2 nút
  avatarActionsVertical: {
    flex: 1, // Chiếm hết không gian còn lại
    justifyContent: 'space-evenly', // Căn đều khoảng cách giữa các nút theo chiều dọc
    height: 100, // Chiều cao bằng với Avatar
  },
  actionButton: {
    paddingVertical: 7, // Giảm padding để vừa vặn hơn khi căn dọc
    paddingHorizontal: 25,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  // --- Form Card ---
  formCard: {
    backgroundColor: '#FDFDFD',
    borderRadius: 40,
    paddingHorizontal: 30,
    paddingVertical: 50,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 40,
  },
  label: {
    marginBottom: 10,
    fontWeight: 'bold',
    fontSize: 16,
    color: PRIMARY_COLOR,
  },
  input: {
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F4F3FF',
  },
  textArea: {
    borderRadius: 10,
    padding: 16,
    height: 100,
    textAlignVertical: 'top',
    fontSize: 16,
    backgroundColor: '#F4F3FF',
  },

  // --- Actions Row ---
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: '30%',
    marginTop: 70,
    width: '70%',
    alignSelf: 'center',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  reloadButton: {
    backgroundColor: '#EDEDED',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  reloadButtonText: {
    color: '#4f4f4f',
    fontWeight: 'bold',
    fontSize: 16,
  },
});