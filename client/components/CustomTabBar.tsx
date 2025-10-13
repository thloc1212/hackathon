import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Text } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width } = Dimensions.get('window');

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colorScheme = useColorScheme();
  
  const getIcon = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
    switch (routeName) {
      case 'index':
        return focused ? 'home' : 'home-outline';
      case 'menu':
        return focused ? 'menu' : 'menu-outline';
      case 'camera':
        return focused ? 'camera' : 'camera-outline';
      case 'statistic':
        return focused ? 'bar-chart' : 'bar-chart-outline';
      case 'profile':
        return focused ? 'person' : 'person-outline';
      default:
        return 'ellipse-outline';
    }
  };

  return (
    <View style={styles.tabContainer}>
      {/* Responsive SVG Background */}
      <Svg 
        width="100%" 
        height={71} 
        viewBox="0 0 411 71" 
        style={styles.svgBackground}
      >
        <Path 
          d="M138.744 0.328697C152.023 0.328887 163.305 8.87414 167.394 20.7652H167.477C172.919 35.6325 187.865 46.311 205.453 46.3111C223.041 46.311 237.988 35.6325 243.43 20.7652H243.606C247.695 8.87413 258.977 0.328886 272.256 0.328697H380.71C396.826 0.328697 410.001 12.9147 410.944 28.7935H411V71.1265H0V28.7935H0.0556641C0.999285 12.9147 14.1742 0.328697 30.29 0.328697H138.744Z" 
          fill="white"
        />
      </Svg>

      {/* White side sections with rounded top corners (overlaying SVG) */}
      <View style={styles.leftSection}>
        {/* Left tabs (index 0, 1) */}
        {state.routes.slice(0, 2).map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          
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

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.sideTabButton}
              onPress={onPress}
            >
              <Ionicons
                name={getIcon(route.name, isFocused)}
                size={24}
                color={isFocused ? '#5F58C2' : '#888888'}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Mock center space with placeholder icon */}
      <View style={styles.centerMockSpace}>
        <Ionicons 
          name="ellipse-outline" 
          size={40} 
          color="#E0E0E0" 
        />
      </View>
      
      <View style={styles.rightSection}>
        {/* Right tabs (index 3, 4) */}
        {state.routes.slice(3, 5).map((route, index) => {
          const { options } = descriptors[route.key];
          const actualIndex = index + 3; // Adjust for actual index
          const isFocused = state.index === actualIndex;
          
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

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.sideTabButton}
              onPress={onPress}
            >
              <Ionicons
                name={getIcon(route.name, isFocused)}
                size={24}
                color={isFocused ? '#5F58C2' : '#888888'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Fixed camera button in center */}
      <View style={styles.fixedCameraContainer}>
        {(() => {
          const cameraRoute = state.routes[2]; // Camera is always at index 2
          const isCameraFocused = state.index === 2;
          
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: cameraRoute.key,
              canPreventDefault: true,
            });
            if (!isCameraFocused && !event.defaultPrevented) {
              navigation.navigate('camera');
            }
          };

          return (
            <View style={styles.middleTabCircle}>
              <TouchableOpacity
                style={styles.middleTabButton}
                onPress={onPress}
              >
                <View style={styles.cameraIconContainer}>
                  <Ionicons name="camera" size={28} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </View>
          );
        })()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    height: 80,
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#F0F3F8',
    width: '100%',
    paddingBottom: 10,
  },
  svgBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },

  leftSection: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingLeft: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginRight: 5,
    height: '100%',
    position: 'relative',
    top: 10,
    zIndex: 2,
  },
  centerMockSpace: {
    width: 80,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    position: 'relative',
    top: 10,
    zIndex: 2,
    opacity: 0,
  },
  rightSection: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingRight: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopRightRadius: 25,
    borderTopLeftRadius: 25,
    marginLeft: 5,
    height: '100%',
    position: 'relative',
    top: 10,
    zIndex: 2,
  },
  sideTabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  fixedCameraContainer: {
    position: 'absolute',
    left: '50%',
    marginLeft: -35, // Half of camera button width
    top: -20,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },


  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  middleTabContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  middleTabCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#5F58C2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5F58C2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
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


});