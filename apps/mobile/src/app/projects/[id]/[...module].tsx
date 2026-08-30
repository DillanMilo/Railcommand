import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

const nativeProjectSections: Record<string, string> = {
  submittals: '/(tabs)/submittals',
  rfis: '/(tabs)/rfis',
  'daily-logs': '/(tabs)/logs',
  cameras: '/(tabs)/cameras',
  team: '/team',
};

export default function ProjectModuleDeepLinkScreen() {
  const { id, module } = useLocalSearchParams<{ id?: string; module?: string | string[] }>();
  const { selectProject } = useMobileData();
  const [message, setMessage] = useState('Opening project workspace…');

  useEffect(() => {
    const section = Array.isArray(module) ? module[0] : module;
    const destination = section ? nativeProjectSections[section] : undefined;
    if (!id || !destination) {
      setMessage('This workspace remains available in the connected web app. Returning to your project dashboard…');
      const timeout = setTimeout(() => router.replace('/(tabs)'), 900);
      return () => clearTimeout(timeout);
    }

    let current = true;
    void selectProject(id)
      .then(() => {
        if (current) router.replace(destination as never);
      })
      .catch(() => {
        if (!current) return;
        setMessage('That project could not be opened. Returning to your saved dashboard…');
        setTimeout(() => router.replace('/(tabs)'), 1_200);
      });
    return () => { current = false; };
  }, [id, module, selectProject]);

  return <View style={styles.screen}>
    <ActivityIndicator color={colors.orangeText} />
    <Text accessibilityRole="header" style={styles.title}>RailCommand</Text>
    <Text style={styles.message}>{message}</Text>
  </View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.cream,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 31,
  },
  message: {
    maxWidth: 420,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
