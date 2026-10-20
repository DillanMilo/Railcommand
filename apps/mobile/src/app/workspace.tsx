import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation, useFocusEffect } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '@/providers/auth-provider';
import { useMobileData } from '@/providers/mobile-data-provider';
import { mobileApiForUser } from '@/lib/api';
import { mobileConfig } from '@/lib/config';
import { appendWorkspaceChunk, beginWorkspaceFile, finishWorkspaceFile, sameWorkspaceOrigin, workspaceDestination, workspaceHandoffSource, workspaceToolRequest, type WorkspaceSource, type WorkspaceFile } from '@/lib/workspace-policy';
import { shareWorkspaceFile } from '@/lib/workspace-share';
import { colors, fonts } from '@/theme';

export default function WorkspaceScreen() {
  const { session, sessionRevision } = useAuth();
  if (!session) return null;
  // Even A -> B -> A destroys A's previous page, cookies and in-memory exports.
  return <AccountWorkspace key={sessionRevision} userId={session.user.id} revision={sessionRevision} />;
}
function AccountWorkspace({ userId, revision }: { userId: string; revision: number }) {
  const params = useLocalSearchParams<{ path?: string; request?: string }>();
  const path = workspaceDestination(params.path);
  const request = `${params.request ?? ''}:${path}`;
  const handledRequest = useRef(request);
  const [ready, setReady] = useState(false);
  const clientNavigation = useRef(false);
  const { isSessionCurrent } = useAuth();
  const { online, selectProject, refresh } = useMobileData();
  const navigation = useNavigation();
  const mounted = useRef(true);
  const current = useCallback(() => mounted.current && isSessionCurrent(userId, revision), [isSessionCurrent, userId, revision]);
  const web = useRef<WebView>(null);
  const transfer = useRef<WorkspaceFile | null>(null);
  const workspaceProject = useRef<string | null>(null);
  const sharing = useRef(false);
  const [source, setSource] = useState<WorkspaceSource>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dirtyRef = useRef(false);
  const started = useRef(false);
  const origin = new URL(mobileConfig.apiBaseUrl).origin;
  const confirmLeave = useCallback((action: () => void) => {
    if (!dirtyRef.current) { action(); return; }
    Alert.alert('Leave this page?', 'Any unsaved workspace changes may be lost. Saved field drafts and queued logs remain on this device.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Leave page', style: 'destructive', onPress: action },
    ]);
  }, []);
  usePreventRemove(dirty, ({ data }) => confirmLeave(() => navigation.dispatch(data.action)));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; transfer.current = null; }; }, []);
  useEffect(() => {
    if (!online || started.current) return;
    started.current = true;
    setLoading(true); setError('');
    void mobileApiForUser(userId, current).createWorkspaceSession(path).then((result) => {
      if (!current()) return;
      if (result.userId !== userId || typeof result.ticket !== 'string' || result.ticket.length > 4096) throw new Error('The workspace identity could not be verified.');
      setSource(workspaceHandoffSource(origin, result.ticket));
    }).catch((reason: unknown) => {
      if (current()) { setLoading(false); setError(reason instanceof Error ? reason.message : 'Could not open the workspace.'); }
    });
  }, [attempt, current, online, origin, path, userId]);
  useEffect(() => {
    web.current?.injectJavaScript(`window.railcommandWorkspaceOnline=${online};window.railcommandNativeTools=true;true;`);
  }, [online]);
  useEffect(() => {
    if (!ready || !online || !current() || handledRequest.current === request) return;
    handledRequest.current = request;
    if (clientNavigation.current) {
      // The web bridge checks its own current dirty/offline state before routing.
      web.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('railcommand:navigate',{detail:${JSON.stringify({ path })}}));true;`);
    } else {
      // Older web deployments still navigate with their isolated session.
      confirmLeave(() => {
        if (current()) web.current?.injectJavaScript(`window.location.assign(${JSON.stringify(origin + path)});true;`);
      });
    }
  }, [confirmLeave, current, online, origin, path, ready, request]);
  const openFieldTools = useCallback(async (destination: '/(tabs)' | '/railbot' = '/(tabs)') => {
    try {
      const projectId = workspaceProject.current;
      if (projectId) {
        await selectProject(projectId);
      }
      if (current()) {
        router.push(destination);
        // Show the selected project immediately; refresh without blocking navigation.
        if (online && projectId) void refresh(projectId).catch(() => {
          if (current()) Alert.alert('Project refresh failed', 'Saved field data is retained. Retry from Field tools.');
        });
      }
    } catch { if (current()) Alert.alert('Could not open this project', 'Reconnect and try again. Field tools have not been opened in a different project.'); }
  }, [current, online, refresh, selectProject]);
  const goBack = useCallback(() => {
    if (!online) { Alert.alert('Workspace is online-only', 'Reconnect before navigating. This page stays open.'); return; }
    confirmLeave(() => { if (canGoBack) web.current?.goBack(); else void openFieldTools(); });
  }, [canGoBack, confirmLeave, online, openFieldTools]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => subscription.remove();
  }, [goBack]));
  const isStoredFile = (url: string) => {
    try { const parsed = new URL(url); return parsed.origin === new URL(mobileConfig.supabaseUrl).origin && parsed.pathname.startsWith('/storage/v1/object/'); } catch { return false; }
  };
  const external = (url: string) => {
    if (isStoredFile(url)) { download(url); return; }
    let parsed: URL; try { parsed = new URL(url); } catch { return; }
    if (!['https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return;
    Alert.alert('Open outside RailCommand?', parsed.protocol === 'https:' ? parsed.hostname : 'Open the system app for this link.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Open', onPress: () => { void Linking.openURL(url).catch(() => Alert.alert('Could not open link')); } }]);
  };
  const onMessage = (event: WebViewMessageEvent) => {
    if (!current() || !sameWorkspaceOrigin(event.nativeEvent.url, origin) || event.nativeEvent.data.length > 270000) return;
    try {
      const message = JSON.parse(event.nativeEvent.data) as Record<string, unknown>;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'dirty') { dirtyRef.current = message.value === true; setDirty(dirtyRef.current); }
      if (message.type === 'ready') {
        clientNavigation.current = message.clientNavigation === true;
        setReady(true);
        workspaceProject.current = typeof message.path === 'string' ? /^\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/|$)/i.exec(message.path)?.[1] ?? null : null;
        setLoading(false); setError('');
      }
      if (message.type === 'account') router.push('/(tabs)/account');
      const tool = workspaceToolRequest(message);
      if (tool) {
        workspaceProject.current = tool.projectId;
        void openFieldTools(tool.destination);
      }
      if (message.type === 'file-start') {
        if (sharing.current || transfer.current) throw new Error('Finish the current export before starting another.');
        transfer.current = beginWorkspaceFile(message);
      }
      if (message.type === 'file-chunk') {
        if (!transfer.current) throw new Error('Please export the file again.');
        appendWorkspaceChunk(transfer.current, message);
      }
      if (message.type === 'file-end') {
        if (!transfer.current) throw new Error('Please export the file again.');
        const file = transfer.current;
        const base64 = finishWorkspaceFile(file, message.id);
        transfer.current = null; sharing.current = true;
        void shareWorkspaceFile(userId, file, base64, current).catch((reason: unknown) => {
          if (current()) Alert.alert('Could not export file', reason instanceof Error ? reason.message : 'Try exporting again.');
        }).finally(() => { sharing.current = false; });
      }
    } catch (reason) {
      transfer.current = null;
      Alert.alert('Workspace message could not be completed', reason instanceof Error ? reason.message : 'Please try again.');
    }
  };
  const download = (url: string) => {
    web.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('railcommand:download',{detail:${JSON.stringify({ url })}}));true;`);
  };
  return <SafeAreaView edges={['top', 'bottom']} style={styles.page}>
    {!online ? <Text accessibilityLiveRegion="polite" style={[styles.notice, styles.offline]}>Offline · Your open page is retained. Use Field tools for offline logs.</Text> : null}
    {error ? <View style={styles.error}><Text style={styles.body}>{error}</Text><Pressable disabled={!online} onPress={() => confirmLeave(() => { transfer.current = null; dirtyRef.current = false; setDirty(false); setReady(false); setSource(undefined); started.current = false; setAttempt((value) => value + 1); })} style={styles.button}><Text style={styles.buttonText}>Reconnect workspace</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void openFieldTools()} style={styles.button}><Text style={styles.buttonText}>Open Field tools</Text></Pressable></View> : null}
    {loading ? <ActivityIndicator accessibilityLabel="Opening workspace" style={styles.loading} /> : null}
    {source ? <View style={styles.webContainer}>
      <WebView ref={web} source={source} style={styles.web}
        incognito cacheEnabled={false} cacheMode="LOAD_NO_CACHE" sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
        originWhitelist={['*']} allowsBackForwardNavigationGestures={false} allowsLinkPreview={false}
        setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false}
        allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false} mixedContentMode="never"
        injectedJavaScriptBeforeContentLoaded={`window.railcommandWorkspaceOnline=${online};window.railcommandNativeTools=true;true;`}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={(request) => {
          if (!current()) return false;
          if (request.isTopFrame === false) return request.url === 'about:blank' || request.url.startsWith('https://'); // Embedded maps/cameras do not navigate the main page.
          if (request.url === 'about:blank') return true;
          if (!online) return false;
          if (sameWorkspaceOrigin(request.url, origin)) {
            if (new URL(request.url).pathname === '/login') { setError('Your workspace session ended. Reconnect to continue.'); return false; }
            return true;
          }
          external(request.url); return false;
        }}
        onOpenWindow={({ nativeEvent }) => { if (sameWorkspaceOrigin(nativeEvent.targetUrl, origin)) web.current?.injectJavaScript(`window.location.assign(${JSON.stringify(nativeEvent.targetUrl)});true;`); else external(nativeEvent.targetUrl); }}
        onFileDownload={({ nativeEvent }) => download(nativeEvent.downloadUrl)}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack && !state.url.includes('/auth/mobile-session'))}
        onLoadEnd={() => { setLoading(false); web.current?.injectJavaScript(`window.railcommandWorkspaceOnline=${online};window.railcommandNativeTools=true;true;`); }}
        onHttpError={({ nativeEvent }) => { if (nativeEvent.url.includes('/auth/mobile-session')) { setLoading(false); setError('Workspace sign-in could not be completed. Reconnect to try again.'); } }}
        onError={() => { setLoading(false); setError('The workspace could not load. Check connectivity. Reconnecting may discard unsaved workspace changes.'); }}
        onContentProcessDidTerminate={() => setError('iOS closed the workspace page to free memory. Saved field drafts and queued work remain on this device. Reconnect to reopen the workspace.')}
      />
      {!online ? <View style={styles.offlineCover}><Text style={styles.offlineTitle}>Workspace paused while offline</Text><Text style={styles.body}>Your open page is retained. Reconnect to continue, or open Field tools to work on offline daily logs.</Text><Pressable accessibilityRole="button" onPress={() => void openFieldTools()} style={styles.button}><Text style={styles.buttonText}>Open Field tools</Text></Pressable></View> : null}
    </View> : !loading ? <View style={styles.empty}><Text style={styles.body}>{online ? 'Open the workspace to use your existing web features.' : 'Connect to open the workspace. Your saved projects and daily-log queue are available in Field tools.'}</Text><Pressable accessibilityRole="button" onPress={() => void openFieldTools()} style={styles.button}><Text style={styles.buttonText}>Open Field tools</Text></Pressable></View> : null}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  button: { paddingVertical: 13, paddingHorizontal: 9, minHeight: 44 }, buttonText: { color: colors.orangeText, fontFamily: fonts.bodyMedium, fontSize: 13 },
  notice: { padding: 8, color: colors.muted, backgroundColor: '#F1F5F9', fontSize: 11, fontFamily: fonts.body }, offline: { backgroundColor: '#FEF3C7', color: '#78350F' },
  webContainer: { flex: 1 }, web: { flex: 1 }, loading: { padding: 12 }, error: { padding: 12, backgroundColor: '#FFF1F2' }, body: { color: colors.ink, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 }, empty: { padding: 24 },
  offlineCover: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(248,250,252,0.94)', padding: 28, justifyContent: 'center' }, offlineTitle: { color: colors.ink, fontFamily: fonts.heading, fontSize: 20, marginBottom: 12 },
});
