import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Text } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width } = Dimensions.get('window');

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colorScheme = useColorScheme();
  
  const getIcon = (routeName: string, focused: boolean) => {
    switch (routeName) {
      case 'index':
        return focused ? '🏠' : '🏘️';
      case 'camera':
        return '📷';
      case 'explore':
        return focused ? '🔍' : '🔎';
      case 'profile':
        return focused ? '👤' : '👥';
      default:
        return '○';
    }
  };

  return (
    <View style={[styles.tabContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      {/* Left rounded rectangle */}
      <View style={styles.leftRoundedRect} />
      
      {/* Tab buttons */}
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const isMiddle = route.name === 'camera'; // Camera tab (middle)

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (isMiddle) {
          // Special styling for middle (camera) tab
          return (
            <View key={route.key} style={styles.middleTabContainer}>
              <View style={styles.middleTabCircle}>
                <TouchableOpacity
                  style={styles.middleTabButton}
                  onPress={onPress}
                >
                  <View style={styles.cameraIconContainer}>
                    <Text style={styles.cameraIcon}>📷</Text>
                  </View>
                  <View style={styles.cameraIconLine} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabButton}
            onPress={onPress}
          >
            <Text style={[
              styles.tabIcon,
              { color: isFocused ? Colors[colorScheme ?? 'light'].tint : '#000' }
            ]}>
              {getIcon(route.name, isFocused)}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Right icons */}
      <TouchableOpacity style={styles.rightIcon}>
        <Text style={styles.rightIconText}>📤</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.rightIcon}>
        <Text style={styles.rightIconText}>⚙️</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    height: 80,
    alignItems: 'center',
    paddingHorizontal: 20,
    position: 'relative',
    borderTopWidth: 1,
    borderTopColor: '#E4E4E4',
  },
  leftRoundedRect: {
    width: 69,
    height: 51,
    backgroundColor: '#E4E4E4',
    borderRadius: 17,
    position: 'absolute',
    left: 18,
    top: 15,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  middleTabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  middleTabCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#5F58C2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    top: -10,
  },
  middleTabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  cameraIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconLine: {
    width: 5,
    height: 2,
    backgroundColor: '#F0F3F8',
    marginTop: 2,
    borderRadius: 1,
  },
  rightIcon: {
    marginLeft: 10,
    padding: 8,
  },
  cameraIcon: {
    fontSize: 16,
    color: '#F0F3F8',
    textAlign: 'center',
  },
  tabIcon: {
    fontSize: 24,
  },
  rightIconText: {
    fontSize: 18,
  },
});