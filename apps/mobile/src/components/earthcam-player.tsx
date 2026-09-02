import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SecondaryButton } from '@/components/ui';
import { EARTHCAM_DISPATCH_ORIGINS, earthCamPlayerState, isAllowedEarthCamNavigation } from '@/lib/earthcam-player';
import { colors, fonts } from '@/theme';

export function EarthCamPlayer({ label, url, online }: { label: string; url: string; online: boolean }) {
  // Changing URL or reconnecting creates a fresh player. A transient error cannot
  // leave a feed permanently failed, or carry failure into a different feed.
  return <FeedSession key={`${url}:${online}`} label={label} url={url} online={online} />;
}

function FeedSession({ label, url, online }: { label: string; url: string; online: boolean }) {
  const [failed, setFailed] = useState(false);
  const state = earthCamPlayerState(online, url, failed);
  if (state !== 'playable') {
    return <View style={styles.fallback}>
      <Text accessibilityLiveRegion="polite" style={styles.message}>{
        state === 'offline' ? 'Live feed unavailable while offline.'
          : state === 'blocked' ? 'This feed URL is blocked. Only approved HTTPS EarthCam share links can load.'
            : 'This EarthCam feed could not be loaded. Retry here or use the external-link button.'
      }</Text>
      {state === 'failed' ? <SecondaryButton title="Retry live feed" onPress={() => setFailed(false)} /> : null}
    </View>;
  }
  return <View style={styles.frame}>
    <WebView
      source={{ uri: url }}
      accessibilityLabel={`Live EarthCam feed: ${label}`}
      originWhitelist={EARTHCAM_DISPATCH_ORIGINS}
      onShouldStartLoadWithRequest={(request) => isAllowedEarthCamNavigation(request.url)}
      // New-window requests must not bypass the navigation validator. The feed
      // card's explicit external-link control is the only browser handoff.
      onOpenWindow={() => {}}
      setSupportMultipleWindows
      javaScriptCanOpenWindowsAutomatically={false}
      onError={() => setFailed(true)}
      onHttpError={(event) => { if (event.nativeEvent.url === url) setFailed(true); }}
      onContentProcessDidTerminate={() => setFailed(true)}
      onRenderProcessGone={() => setFailed(true)}
      startInLoadingState
      renderLoading={() => <View style={styles.loading}><ActivityIndicator color={colors.orange} accessibilityLabel="Loading live EarthCam feed" /></View>}
      javaScriptEnabled
      domStorageEnabled={false}
      sharedCookiesEnabled={false}
      thirdPartyCookiesEnabled={false}
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      mixedContentMode="never"
      cacheEnabled={false}
      cacheMode="LOAD_NO_CACHE"
      webviewDebuggingEnabled={false}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      style={styles.webview}
    />
  </View>;
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 16 / 9, margin: 14, marginTop: 0, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  fallback: { gap: 12, padding: 20, alignItems: 'center' },
  message: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
