# BeVietnamPro Font Installation Instructions

## Current Status ✅ 
**App is working with system fonts as fallback**

The app is currently configured to use system fonts (iOS System / Android Roboto) until you download the BeVietnamPro fonts.

## Font Files Needed (Optional Enhancement)

To use BeVietnamPro fonts, download these files and place them in this directory:

1. **BeVietnamPro-Regular.ttf**
2. **BeVietnamPro-Medium.ttf**  
3. **BeVietnamPro-SemiBold.ttf**
4. **BeVietnamPro-Bold.ttf**

## Where to Download

You can download the BeVietnamPro font family from:
- **Google Fonts**: https://fonts.google.com/specimen/Be+Vietnam+Pro
- **GitHub**: https://github.com/google/fonts/tree/main/ofl/bevietnam

## Installation Steps

1. Download the font files from Google Fonts
2. Place them in `d:\hackathon\client\assets\fonts\`
3. Make sure the file names match exactly:
   - BeVietnamPro-Regular.ttf
   - BeVietnamPro-Medium.ttf
   - BeVietnamPro-SemiBold.ttf
   - BeVietnamPro-Bold.ttf
4. **Enable custom fonts** by editing `constants/fonts.ts`:
   - Uncomment the Font.loadAsync() code block
   - Update the FontFamily export to use BeVietnamPro font names
5. Restart your Expo development server: `npm start`

## Note
The app will work perfectly without downloading these fonts - it will use beautiful system fonts as fallback!