import CustomTabBar from '../../components/CustomTabBar';
import { Tabs } from 'expo-router';

export default function RootLayout() {
	return (
		<Tabs
			tabBar={(props) => <CustomTabBar {...props} />}
			screenOptions={{
				tabBarActiveTintColor: '#ff00c3',
				tabBarInactiveTintColor: '#727272',
				headerShown: false,
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Home',
					tabBarLabel: 'Home',
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
				name="explore"
				options={{
					title: 'Explore',
					tabBarLabel: 'Explore',
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