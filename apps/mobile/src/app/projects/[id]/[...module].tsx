import { openWorkspace } from '@/lib/workspace-navigation';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SecondaryButton } from '@/components/ui';
import { resolveProjectRoute } from '@/lib/project-routes';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function ProjectModuleDeepLinkScreen() {
  const { id, module } = useLocalSearchParams<{ id?: string; module?: string | string[] }>();
  const { selectProject, online } = useMobileData();
  const selectProjectRef = useRef(selectProject);
  useLayoutEffect(() => { selectProjectRef.current = selectProject; }, [selectProject]);
  const modulePath = Array.isArray(module) ? module.join('/') : module;
  const route = resolveProjectRoute(id, modulePath);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const next = resolveProjectRoute(id, modulePath);
    if (next.kind === 'invalid' || (next.kind === 'unimplemented' && !online)) return;
    let current = true;
    setFailed(false);
    void selectProjectRef.current(next.projectId)
      .then(() => {
        if (!current) return;
        if (next.kind === 'native') router.replace(next.destination as never);
        else openWorkspace(next.path);
      })
      .catch(() => {
        if (!current) return;
        setFailed(true);
      });
    return () => { current = false; };
  }, [id, modulePath, attempt, online]);

  const opening = (route.kind === 'native' || (route.kind === 'unimplemented' && online)) && !failed;
  return <View style={styles.screen}>
    {opening ? <ActivityIndicator color={colors.orangeText} /> : null}
    <Text accessibilityRole="header" style={styles.title}>RailCommand</Text>
    <Text accessibilityLiveRegion="polite" style={styles.message}>{opening
      ? 'Opening project workspace…'
      : failed ? 'That project could not be opened. Check connectivity and project access, then try again. Your saved work is unchanged.'
        : route.kind === 'invalid' ? 'This project link is not valid.'
          : 'This workspace screen is online-only. Reconnect to open it. Your saved field work is unchanged.'}</Text>
    {route.kind === 'unimplemented' ? <Text selectable style={styles.path}>{route.path}</Text> : null}
    {failed ? <SecondaryButton title="Retry opening project" onPress={() => setAttempt((value) => value + 1)} /> : null}
    {!opening ? <SecondaryButton title="Back to dashboard" onPress={() => router.replace('/(tabs)')} /> : null}
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
  path: { maxWidth: 420, color: colors.muted, fontFamily: fonts.mono, fontSize: 11, lineHeight: 17 },
});
