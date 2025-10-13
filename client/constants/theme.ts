/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#1f2937',        // Dark gray for good readability
    background: '#ffffff',   // Pure white background
    tint: '#3b82f6',        // Bright blue for accent color
    icon: '#6b7280',        // Medium gray for icons
    tabIconDefault: '#9ca3af', // Light gray for inactive tabs
    tabIconSelected: '#3b82f6', // Bright blue for selected tabs
  },
  dark: {
    text: '#1f2937',        // Same as light - all light colors now
    background: '#ffffff',   // White background
    tint: '#3b82f6',        // Bright blue
    icon: '#6b7280',        // Medium gray
    tabIconDefault: '#9ca3af', // Light gray
    tabIconSelected: '#3b82f6', // Bright blue
  },
};

// Import FontFamily and FontWeight from fonts.ts
import { FontFamily, FontWeight } from './fonts';

export { FontFamily, FontWeight };

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: FontFamily.regular,
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: FontFamily.regular,
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  android: {
    sans: FontFamily.regular,
    serif: 'serif',
    rounded: FontFamily.regular,
    mono: 'monospace',
  },
  default: {
    sans: FontFamily.regular,
    serif: 'serif',
    rounded: FontFamily.regular,
    mono: 'monospace',
  },
  web: {
    sans: `${FontFamily.regular}, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
    serif: "Georgia, 'Times New Roman', serif",
    rounded: `${FontFamily.regular}, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif`,
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
