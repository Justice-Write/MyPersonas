import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';

import { palette } from '@/constants/app-theme';
import { useAuth } from '@/providers/auth-provider';

const icons: Record<string, string> = { chat: '✦', approvals: '✓', feed: '⌁' };

export default function AppTabsLayout() {
  const { loading, session } = useAuth();
  if (!loading && !session) return <Redirect href="/" />;

  return (
    <Tabs
      initialRouteName="chat"
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: palette.background },
        tabBarActiveTintColor: palette.cyan,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: { backgroundColor: '#091728', borderTopColor: palette.border, height: 68, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800' },
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 19 }}>{icons[route.name] ?? '•'}</Text>,
      })}>
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="approvals" options={{ title: 'Approvals' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
    </Tabs>
  );
}
