import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '@/providers/auth-provider';

export default function CallbackScreen() {
  const { session, loading } = useAuth();
  const leaveCallback = useCallback(() => router.replace(session ? '/(tabs)' : '/sign-in'), [session]);

  useEffect(() => {
    if (loading) return;
    const fallback = setTimeout(leaveCallback, 8000);
    return () => clearTimeout(fallback);
  }, [leaveCallback, loading]);

  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
    <ActivityIndicator />
    <Text>Verifying your RailCommand link…</Text>
    <Pressable accessibilityRole="button" onPress={leaveCallback} style={{ padding: 14 }}>
      <Text style={{ fontWeight: '700' }}>Return to RailCommand</Text>
    </Pressable>
  </View>;
}
