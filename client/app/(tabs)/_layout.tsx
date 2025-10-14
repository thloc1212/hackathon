import CustomTabBar from '../../components/CustomTabBar';
import { Tabs } from 'expo-router';

export default function RootLayout() {
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
			<Tabs.Screen
				name="home"
				options={{
					title: 'Home',
					tabBarLabel: 'Home',
					
				}}
			/>

			<Tabs.Screen
				name="categories"
				options={{
					title: 'Categories',
					tabBarLabel: 'Categories',
				}}
			/>

			<Tabs.Screen
				name="camera"
				options={{
					title: 'Camera',
					tabBarLabel: 'Camera',
				}}
			/>

			<Tabs.Screen
				name="statistic"
				options={{
					title: 'Statistics',
					tabBarLabel: 'Statistics',
				}}
			/>

			<Tabs.Screen
				name="profile"
				options={{
					title: 'Profile',
					tabBarLabel: 'Profile',
				}}
			/>
		</Tabs>
	);
}