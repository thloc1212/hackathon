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
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import AuthService from '@/lib/authService';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const PRIMARY_COLOR = '#5F58C2';

// Get server URL from environment variables
const getServerUrl = () => {
  const host = process.env.EXPO_PUBLIC_SERVER_HOST || 'localhost';
  const port = process.env.EXPO_PUBLIC_SERVER_PORT || '3000';
  
  if (Platform.OS === 'android') {
    const androidHost = host === 'localhost' ? '10.0.2.2' : host;
    return `http://${androidHost}:${port}`;
  }
  
  return `http://${host}:${port}`;
};

const SERVER_URL = getServerUrl();

export default function ProfileEditScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme] || { background: '#f0f3f8', text: '#333', card: '#FFF', tint: PRIMARY_COLOR, icon: '#666' };

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        
        const session = AuthService.getCurrentSession();
        if (!session?.id) {
          console.warn('No session available');
          return;
        }

        const response = await fetch(`${SERVER_URL}/auth/profile`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.id}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          const user = result.user;
          setName(user.name || '');
          setEmail(user.email || '');
          setBio(user.bio || '');
          setDateOfBirth(user.dateOfBirth || '');
          setAvatarUri(user.avatarUri || null);
        } else {
          console.error('Failed to load profile:', await response.text());
        }
      } catch (err) {
        console.warn('Failed to load profile for edit', err);
      } finally {
        setLoading(false);
      }
    })();
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

  const save = async () => {
    try {
      const session = AuthService.getCurrentSession();
      if (!session?.id) {
        Alert.alert('Lỗi', 'Phiên đăng nhập không hợp lệ.');
        return;
      }

      const payload = { name, bio, dateOfBirth, avatarUri };
      
      const response = await fetch(`${SERVER_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.id}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Alert.alert('Thành công', 'Thông tin đã được cập nhật');
        router.replace('/(tabs)/profile');
      } else {
        console.error('Failed to save profile:', await response.text());
        Alert.alert('Lỗi', 'Không thể lưu thông tin');
      }
    } catch (err) {
      console.warn('Failed to save profile', err);
      Alert.alert('Lỗi', 'Không thể lưu thông tin');
    }
  };

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
        {/* Avatar and controls (editable) */}
        <View style={styles.avatarCard}>
          <Pressable onPress={pickImage} style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: PRIMARY_COLOR + '3' }]}>
                <ThemedText style={styles.avatarInitial}>{(name && name[0]) || 'U'}</ThemedText>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <IconSymbol name="camera" size={20} color="#FFF" />
            </View>
          </Pressable>

          <View style={styles.avatarActionsVertical}>
          </View>
          <Pressable style={[styles.actionButton, { backgroundColor: PRIMARY_COLOR }]} onPress={removeAvatar}>
            <ThemedText style={styles.actionButtonText}>Xóa Ảnh</ThemedText>
          </Pressable>
        </View>

        {/* Form fields (editable) */}
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Họ và Tên</ThemedText>
            <TextInput
              style={[styles.input, { borderColor: PRIMARY_COLOR + '50', color: colors.text }]}
              placeholder="Nhập họ tên"
              placeholderTextColor={PRIMARY_COLOR + '80'}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={[styles.input, { borderColor: PRIMARY_COLOR + '50', color: colors.text }]}
              placeholder="example@email.com"
              placeholderTextColor={PRIMARY_COLOR + '80'}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Ngày sinh</ThemedText>
            <TextInput
              style={[styles.input, { borderColor: PRIMARY_COLOR + '50', color: colors.text }]}
              placeholder="dd/mm/yyyy"
              placeholderTextColor={PRIMARY_COLOR + '80'}
              keyboardType="numeric"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Tiểu sử/Ghi chú</ThemedText>
            <TextInput
              style={[styles.textArea, { borderColor: PRIMARY_COLOR + '50', color: colors.text }]}
              placeholder="Vài dòng giới thiệu về bạn"
              placeholderTextColor={PRIMARY_COLOR + '80'}
              multiline
              numberOfLines={3}
              value={bio}
              onChangeText={setBio}
            />
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={[styles.button, styles.reloadButton]} onPress={() => router.back()}>
              <ThemedText style={styles.reloadButtonText}>Huỷ</ThemedText>
            </Pressable>
            <Pressable style={[styles.button, styles.saveButton]} onPress={save}>
              <ThemedText style={styles.buttonText}>Lưu</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

// Reuse the same styles as profile.tsx for identical look
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
    paddingTop: 50,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  avatarCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'column',
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
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
    bottom: 20,
    right: 20,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 15,
    padding: 5,
    borderWidth: 2,
    borderColor: '#FFF',
    aspectRatio: 1,
    width: '17%'
  },
  avatarActionsVertical: {
    flex: 1,
    justifyContent: 'space-evenly',
    height: 50,
  },
  actionButton: {
    paddingVertical: 7,
    paddingHorizontal: 25,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,

  },
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
  inputGroup: { marginBottom: 40 },
  label: { marginBottom: 10, fontWeight: 'bold', fontSize: 16, color: PRIMARY_COLOR },
  input: { borderRadius: 10, padding: 16, fontSize: 16, backgroundColor: '#F4F3FF' },
  textArea: { borderRadius: 10, padding: 16, height: 100, textAlignVertical: 'top', fontSize: 16, backgroundColor: '#F4F3FF' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: '30%', marginTop: 70, width: '70%', alignSelf: 'center' },
  button: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveButton: { backgroundColor: PRIMARY_COLOR },
  reloadButton: { backgroundColor: '#EDEDED' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  reloadButtonText: { color: '#4f4f4f', fontWeight: 'bold', fontSize: 16 },
});
