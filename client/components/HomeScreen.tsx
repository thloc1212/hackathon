import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Pressable, 
  StyleSheet, 
  Dimensions,
  ScrollView,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AuthService from '../lib/authService';

const { width, height } = Dimensions.get('window');

interface HomeScreenProps {
  user?: {
    id: string;
    email: string;
    dateOfBirth?: string;
    createdAt: string;
  };
  onLogout: () => void;
}

export default function HomeScreen({ user, onLogout }: HomeScreenProps) {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (user?.email) {
      // Extract name from email (before @ symbol)
      const name = user.email.split('@')[0];
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await AuthService.signout();
      Alert.alert('Success', 'Logged out successfully');
      onLogout();
    } catch (error) {
      Alert.alert('Error', 'Failed to logout');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <LinearGradient
      colors={['#B9B4FF', '#524BBF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.nameText}>{userName}!</Text>
          
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Dashboard</Text>
            <Text style={styles.cardSubtitle}>
              Transform your daily spending into meaningful insights with AI
            </Text>
          </View>

          {/* User Info Card */}
          <View style={styles.userInfoCard}>
            <Text style={styles.userInfoTitle}>Account Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
            {user?.dateOfBirth && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date of Birth:</Text>
                <Text style={styles.infoValue}>{user.dateOfBirth}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member since:</Text>
              <Text style={styles.infoValue}>
                {user?.createdAt ? formatDate(user.createdAt) : 'N/A'}
              </Text>
            </View>
          </View>

          {/* Feature Cards */}
          <View style={styles.featuresContainer}>
            <Pressable style={styles.featureCard}>
              <Text style={styles.featureTitle}>📊 Analytics</Text>
              <Text style={styles.featureDescription}>
                View your spending patterns and insights
              </Text>
            </Pressable>

            <Pressable style={styles.featureCard}>
              <Text style={styles.featureTitle}>💡 AI Insights</Text>
              <Text style={styles.featureDescription}>
                Get personalized financial recommendations
              </Text>
            </Pressable>

            <Pressable style={styles.featureCard}>
              <Text style={styles.featureTitle}>🎯 Goals</Text>
              <Text style={styles.featureDescription}>
                Set and track your financial goals
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 24,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  nameText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  mainContent: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.8,
    lineHeight: 24,
  },
  userInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  userInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.7,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  featuresContainer: {
    gap: 12,
  },
  featureCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
    lineHeight: 20,
  },
});