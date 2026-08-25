import { Tabs } from 'expo-router';
import { colors } from '@/theme';

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.orange, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { minHeight: 64, paddingTop: 7, paddingBottom: 8 } }}>
    <Tabs.Screen name="index" options={{ title: 'Overview' }} />
    <Tabs.Screen name="logs" options={{ title: 'Logs' }} />
    <Tabs.Screen name="sync" options={{ title: 'Sync' }} />
    <Tabs.Screen name="account" options={{ title: 'Account' }} />
  </Tabs>;
}
