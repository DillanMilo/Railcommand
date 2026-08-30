import { Stack } from 'expo-router';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { parseMobileDeepLink } from '@railcommand/domain';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { MobileDataProvider } from '@/providers/mobile-data-provider';
import { useMobileData } from '@/providers/mobile-data-provider';
import { mobileConfig } from '@/lib/config';
import dmSansRegular from '../../assets/fonts/DMSans_400Regular.ttf';
import dmSansMedium from '../../assets/fonts/DMSans_500Medium.ttf';
import dmSansBold from '../../assets/fonts/DMSans_700Bold.ttf';
import plusJakartaBold from '../../assets/fonts/PlusJakartaSans_700Bold.ttf';
import plusJakartaExtraBold from '../../assets/fonts/PlusJakartaSans_800ExtraBold.ttf';
import jetBrainsMonoSemiBold from '../../assets/fonts/JetBrainsMono_600SemiBold.ttf';
import { PrivacyShield } from '@/components/privacy-shield';

void SplashScreen.preventAutoHideAsync();

function Routes() {
  const { session } = useAuth();
  const { selectProject } = useMobileData();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = async (url: unknown) => {
      if (typeof url !== 'string') return;
      const link = parseMobileDeepLink(url, [mobileConfig.linkHost]);
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
    <Stack.Screen name="invitation/[token]" />
    <Stack.Protected guard={Boolean(session)}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="daily-log/new" />
      <Stack.Screen name="daily-log/[id]" />
      <Stack.Screen name="projects/[id]" />
      <Stack.Screen name="team" />
      <Stack.Screen name="more" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen name="account-deletion" />
    </Stack.Protected>
  </Stack>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular: dmSansRegular,
    DMSans_500Medium: dmSansMedium,
    DMSans_700Bold: dmSansBold,
    PlusJakartaSans_700Bold: plusJakartaBold,
    PlusJakartaSans_800ExtraBold: plusJakartaExtraBold,
    JetBrainsMono_600SemiBold: jetBrainsMonoSemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;
  return <SafeAreaProvider>
    <AuthProvider>
      <MobileDataProvider>
        <StatusBar style="dark" />
        <Routes />
        <PrivacyShield />
      </MobileDataProvider>
    </AuthProvider>
  </SafeAreaProvider>;
}
