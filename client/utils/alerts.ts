import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert function that works on both mobile and web
 * Uses native Alert on mobile (iOS/Android) and window.confirm on web
 */
export const showCrossPlatformAlert = (
  title: string, 
  message: string, 
  buttons: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }> = [{text: 'OK'}]
) => {
  if (Platform.OS === 'web') {
    // For web/desktop users
    const buttonText = buttons.map(btn => btn.text).join(' / ');
    const result = window.confirm(`${title}\n\n${message}\n\n(${buttonText})`);
    
    if (result && buttons[0]?.onPress) {
      buttons[0].onPress();
    } else if (!result && buttons[1]?.onPress) {
      buttons[1].onPress();
    }
  } else {
    // For mobile app users (iOS/Android)
    Alert.alert(title, message, buttons.map(btn => ({
      text: btn.text,
      onPress: btn.onPress,
      style: btn.style,
    })), { cancelable: false });
  }
};