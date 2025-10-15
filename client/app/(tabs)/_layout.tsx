import React, { useEffect, useState } from 'react';
import CustomTabBar from '../../components/CustomTabBar';
import { Tabs, useRouter } from 'expo-router';
import AuthService from '../../lib/authService';
import Landing from './index';

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(AuthService.isAuthenticated());
  const router = useRouter();

  useEffect(() => {
    // attempt to load any stored session
    AuthService.loadStoredSession().then(() => {
      setIsAuthenticated(AuthService.isAuthenticated());
    });

    const unsubscribe = AuthService.onAuthChange((user: any, session: any) => {
      const auth = !!(user && session);
      setIsAuthenticated(auth);
      if (auth) {
        // navigate to the home tab after successful auth
        try {
          router.replace('/(tabs)/home');
        } catch (e) {
          // ignore routing errors in some environments
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (!isAuthenticated) {
    return <Landing />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: '#5F58C2',
        tabBarInactiveTintColor: '#727272',
        headerShown: false,
        tabBarStyle: { backgroundColor: '#F0F3F8', position: 'absolute', borderTopWidth: 0, elevation: 0 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="categories" options={{ title: 'Categories', tabBarLabel: 'Categories' }} />
      <Tabs.Screen name="camera" options={{ title: 'Camera', tabBarLabel: 'Camera' }} />
      <Tabs.Screen name="statistic" options={{ title: 'Statistics', tabBarLabel: 'Statistics' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile' }} />
    </Tabs>
  );
}