import * as Font from 'expo-font';
import { Platform } from 'react-native';

export const loadFonts = async () => {
  try {
    // Try to load BeVietnamPro fonts if they exist
    // If fonts don't exist, this will fail gracefully
    console.log('Attempting to load BeVietnamPro fonts...');
    
    // For now, we'll skip font loading until actual font files are downloaded
    // Uncomment the lines below after downloading the font files
    
    /*
    await Font.loadAsync({
      'BeVietnamPro-Regular': require('../assets/fonts/BeVietnamPro-Regular.ttf'),
      'BeVietnamPro-Medium': require('../assets/fonts/BeVietnamPro-Medium.ttf'),
      'BeVietnamPro-SemiBold': require('../assets/fonts/BeVietnamPro-SemiBold.ttf'),
      'BeVietnamPro-Bold': require('../assets/fonts/BeVietnamPro-Bold.ttf'),
    });
    */
    
    console.log('Font loading completed (using system fonts as fallback)');
  } catch (error) {
    console.warn('Failed to load custom fonts, using system fonts:', error);
  }
};

// Use system fonts with proper font weights as fallback
export const FontFamily = Platform.select({
  ios: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  android: {
    regular: 'sans-serif',
    medium: 'sans-serif-medium',
    semiBold: 'sans-serif-medium',
    bold: 'sans-serif',
  },
  web: {
    regular: 'system-ui',
    medium: 'system-ui',
    semiBold: 'system-ui',
    bold: 'system-ui',
  },
  default: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
});

// Font weights to be used with fontWeight style property
export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};