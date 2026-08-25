import { Stack } from 'expo-router';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { parseMobileDeepLink } from '@railcommand/domain';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { MobileDataProvider } from '@/providers/mobile-data-provider';
import { useMobileData } from '@/providers/mobile-data-provider';

function Routes() {
  const { session } = useAuth();
  const { selectProject } = useMobileData();
  useEffect(() => {
    const open = async (url: unknown) => {
      if (typeof url !== 'string') return;
      const link = parseMobileDeepLink(url);
      if (link.kind === 'project') { await selectProject(link.projectId); router.push('/(tabs)'); }
      if (link.kind === 'daily_log') { await selectProject(link.projectId); router.push(`/daily-log/${link.dailyLogId}`); }
    };
    void Notifications.getLastNotificationResponseAsync().then(async (response) => {
      await open(response?.notification.request.content.data?.url);
      if (response) await Notifications.clearLastNotificationResponseAsync();
    });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => void open(response.notification.request.content.data?.url));
    return () => subscription.remove();
  }, [selectProject]);
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={!session}>
      <Stack.Screen name="sign-in" />
    </Stack.Protected>
    <Stack.Screen name="auth/callback" />
    <Stack.Screen name="reset-password" />
    <Stack.Protected guard={Boolean(session)}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="daily-log/new" />
      <Stack.Screen name="daily-log/[id]" />
      <Stack.Screen name="team" />
      <Stack.Screen name="invitation/[token]" />
    </Stack.Protected>
  </Stack>;
}

export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><MobileDataProvider><StatusBar style="dark" /><Routes /></MobileDataProvider></AuthProvider></SafeAreaProvider>;
}
