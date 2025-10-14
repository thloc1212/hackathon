import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function StatisticScreen() {
  const colorScheme = useColorScheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>
          Statistics
        </Text>
        <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
          Analytics and data insights
        </Text>
        
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
            <Text style={styles.statNumber}>42</Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: '#FF6B6B' }]}>
            <Text style={styles.statNumber}>$1,234</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: '#4ECDC4' }]}>
            <Text style={styles.statNumber}>15</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  statsContainer: {
    width: '100%',
    gap: 15,
  },
  statCard: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
});