import * as Font from 'expo-font';
import { Platform } from 'react-native';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
  BeVietnamPro_400Regular_Italic,
  BeVietnamPro_500Medium_Italic,
} from '@expo-google-fonts/be-vietnam-pro';

export const loadFonts = async () => {
  try {
    console.log('Loading Be Vietnam Pro fonts from Google Fonts...');
    
    await Font.loadAsync({
      'BeVietnamPro-Regular': BeVietnamPro_400Regular,
      'BeVietnamPro-Medium': BeVietnamPro_500Medium,
      'BeVietnamPro-SemiBold': BeVietnamPro_600SemiBold,
      'BeVietnamPro-Bold': BeVietnamPro_700Bold,
      'BeVietnamPro-Regular-Italic': BeVietnamPro_400Regular_Italic,
      'BeVietnamPro-Medium-Italic': BeVietnamPro_500Medium_Italic,
      'Be Vietnam Pro': BeVietnamPro_400Regular,
    });
    
    console.log('Google Fonts loaded successfully');
  } catch (error) {
    console.warn('Failed to load Google Fonts, using system fonts:', error);
  }
};


// Updated FontFamily to use Google Fonts
export const FontFamily = {
  regular: 'BeVietnamPro-Regular',
  medium: 'BeVietnamPro-Medium',
  semiBold: 'BeVietnamPro-SemiBold',
  bold: 'BeVietnamPro-Bold',
  regularItalic: 'BeVietnamPro-Regular-Italic',
  mediumItalic: 'BeVietnamPro-Medium-Italic',
};

// Font weights to be used with fontWeight style property
export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};