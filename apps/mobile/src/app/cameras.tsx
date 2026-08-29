import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Screen, StatusBanner } from '@/components/ui';
import { BreadcrumbRow, ModuleHeading, WebActionButton, WebEmpty, WebHeader } from '@/components/web-shell';
import { mobileConfig } from '@/lib/config';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

const isAllowedEarthCamNavigation = (value: string) => {
  if (value === 'about:blank') return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'share.earthcam.net';
  } catch {
    return false;
  }
};

export default function CamerasScreen() {
  const { activeProjectId, bootstrap, online } = useMobileData();
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  const embeds = bootstrap?.earthCamEmbeds ?? [];
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());

  const manageOnWeb = async () => {
    if (!online || !activeProjectId) {
      Alert.alert('EarthCam management is online-only', 'Saved feed names remain visible, but live streams and feed administration require connectivity.');
      return;
    }
    try {
      await Linking.openURL(new URL(`/projects/${activeProjectId}/cameras`, mobileConfig.apiBaseUrl).toString());
    } catch {
      Alert.alert('Could not open Cameras on web', 'The app did not change any feed settings. Check connectivity and try again.');
    }
  };

  const openFeedExternally = async (label: string, url: string) => {
    if (!isAllowedEarthCamNavigation(url)) {
      Alert.alert('EarthCam link blocked', 'RailCommand only opens approved HTTPS EarthCam share links.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open EarthCam', `${label} remains unchanged. Check connectivity and try again.`);
    }
  };

  return <Screen>
    <WebHeader projectName={project?.name ?? 'Select project'} online={online} onProjectPress={() => router.push('/(tabs)')} />
    <BreadcrumbRow current="Cameras" />
    <ModuleHeading
      title="Cameras"
      count={embeds.length}
      subtitle="Live EarthCam feeds stream from EarthCam. RailCommand only stores the project embed link."
      badges={<Text style={styles.beta}>Beta</Text>}
      actions={<WebActionButton title="Manage feeds on web" onPress={() => void manageOnWeb()} disabled={!activeProjectId} icon={<SymbolView accessible={false} name={{ ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' }} tintColor={colors.ink} size={18} />} />}
    />
    {!online ? <StatusBanner tone="warning" title="EarthCam live video requires connectivity" detail="Feed labels are cached for offline reference. RailCommand never presents a stale video as live and never queues camera administration." /> : null}
    {embeds.length === 0 ? <View style={styles.emptyCard}>
      <View style={styles.cameraIcon}><SymbolView accessible={false} name={{ ios: 'video', android: 'videocam', web: 'videocam' }} tintColor={colors.orange} size={27} /></View>
      <Text style={styles.emptyTitle}>Add an EarthCam feed</Text>
      <Text style={styles.emptyDetail}>Add a project EarthCam share link from RailCommand web. The feed will appear here after the next secure synchronization.</Text>
      <WebActionButton title="Open Cameras on web" primary onPress={() => void manageOnWeb()} disabled={!online || !activeProjectId} />
    </View> : <View style={styles.feedList}>{embeds.map((embed) => <View key={embed.id} style={styles.feedCard}>
      <View style={styles.feedHeader}>
        <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={styles.feedTitle}>{embed.label}</Text><Text numberOfLines={1} style={styles.feedHost}>share.earthcam.net</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${embed.label} in EarthCam`} disabled={!online} onPress={() => void openFeedExternally(embed.label, embed.url)} style={({ pressed }) => [styles.external, !online && styles.disabled, pressed && styles.pressed]}>
          <SymbolView accessible={false} name={{ ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' }} tintColor={colors.muted} size={20} />
        </Pressable>
      </View>
      {online && !failedIds.has(embed.id) ? <View style={styles.frame}>
        <WebView
          source={{ uri: embed.url }}
          accessibilityLabel={`Live EarthCam feed: ${embed.label}`}
          originWhitelist={['https://share.earthcam.net/*']}
          onShouldStartLoadWithRequest={(request) => isAllowedEarthCamNavigation(request.url)}
          onError={() => setFailedIds((current) => new Set(current).add(embed.id))}
          javaScriptEnabled
          domStorageEnabled={false}
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction
          style={styles.webview}
        />
      </View> : <WebEmpty>{online ? 'This EarthCam feed could not be loaded. Use the external-link button to open it securely.' : 'Live feed unavailable while offline.'}</WebEmpty>}
    </View>)}</View>}
  </Screen>;
}

const styles = StyleSheet.create({
  beta: { color: colors.orangeText, backgroundColor: '#FFF1E8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 15 },
  emptyCard: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.paper },
  cameraIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1E8' },
  emptyTitle: { color: colors.ink, fontFamily: fonts.heading, fontSize: 18, lineHeight: 24 },
  emptyDetail: { maxWidth: 520, color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  feedList: { gap: 16 },
  feedCard: { overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  feedHeader: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  feedTitle: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21 },
  feedHost: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  external: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  frame: { height: 224, margin: 14, marginTop: 0, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
});
