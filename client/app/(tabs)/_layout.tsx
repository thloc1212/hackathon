import React, { useEffect, useState } from 'react';
import CustomTabBar from '../../components/CustomTabBar';
import { Tabs, useRouter } from 'expo-router';
import AuthService from '../../lib/authService';
import Landing from './index';
import { DatabaseProvider } from '../../hooks/useDatabase';

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(AuthService.isAuthenticated());
  const [user, setUser] = useState<any>(AuthService.getCurrentUser());
  const router = useRouter();

  useEffect(() => {
    // attempt to load any stored session
    AuthService.loadStoredSession().then(() => {
      setIsAuthenticated(AuthService.isAuthenticated());
      setUser(AuthService.getCurrentUser());
    });

    const unsubscribe = AuthService.onAuthChange((user: any, session: any) => {
      const auth = !!(user && session);
      setIsAuthenticated(auth);
      setUser(user);
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
    <DatabaseProvider user={user}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          tabBarActiveTintColor: '#5F58C2',
          tabBarInactiveTintColor: '#727272',
          headerShown: false,
          tabBarStyle: { backgroundColor: '#F0F3F8', position: 'absolute', borderTopWidth: 0, elevation: 0 },
        }}
      >
        <Tabs.Screen name="home" options={{ title: 'Trang chủ', tabBarLabel: 'Trang chủ' }} />
        <Tabs.Screen name="categories" options={{ title: 'Danh mục', tabBarLabel: 'Danh mục' }} />
        <Tabs.Screen name="camera" options={{ title: 'Camera', tabBarLabel: 'Camera' }} />
        <Tabs.Screen name="statistic" options={{ title: 'Thống kê', tabBarLabel: 'Thống kê' }} />
        <Tabs.Screen name="profile" options={{ title: 'Hồ sơ', tabBarLabel: 'Hồ sơ' }} />
      </Tabs>
    </DatabaseProvider>
  );
}