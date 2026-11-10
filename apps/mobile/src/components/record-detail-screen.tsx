import type { MobileRecordAttachment, MobileRecordScope } from '@railcommand/domain';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Screen, StatusBanner } from './ui';
import { BreadcrumbRow, WebActionButton, WebHeader } from './web-shell';
import { RecordBody, recordStyles } from './record-body';
import { mobileApiForUser } from '@/lib/api';
import { mobileConfig } from '@/lib/config';
import { cacheRecord, readCachedRecord, removeCachedRecord } from '@/lib/offline-store';
import { loadRecordDetail, verifiedAttachmentUrl, type RecordReadState } from '@/lib/record-detail';
import { captureOfflineScope } from '@/lib/storage-scope';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/theme';

async function readWithDeadline<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('The connection timed out. Try again.')), 15_000);
    })]);
  } finally { clearTimeout(timer); }
}

export function RecordDetailScreen({ userId, scope, projectName, online }: {
  userId: string; scope: MobileRecordScope; projectName: string; online: boolean;
}) {
  const { sessionRevision, isSessionCurrent } = useAuth();
  const [state, setState] = useState<RecordReadState>({ detail: null, loading: true, cached: false, message: 'Opening record…' });
  const [attempt, setAttempt] = useState(0);
  const [opening, setOpening] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);
  const [imageError, setImageError] = useState(false);
  const active = useRef<(() => boolean) | null>(null);
  const attachmentBusy = useRef(false);
  const forceNextRead = useRef(false);
  const { kind, projectId, recordId } = scope;
  const label = kind === 'rfis' ? 'RFIs' : 'Submittals';
  const list = kind === 'rfis' ? '/(tabs)/rfis' : '/(tabs)/submittals';

  useFocusEffect(useCallback(() => {
    let focused = true;
    let current = true;
    const offlineCurrent = captureOfflineScope(userId);
    const ownerCurrent = () => focused && isSessionCurrent(userId, sessionRevision);
    const isCurrent = () => current && ownerCurrent() && offlineCurrent();
    const api = mobileApiForUser(userId, isCurrent);
    active.current = isCurrent;
    setPreview(null); setOpening(null); attachmentBusy.current = false;
    const requested = { kind, projectId, recordId };
    const force = forceNextRead.current;
    forceNextRead.current = false;
    void loadRecordDetail(requested, online, {
      isCurrent, emit: setState,
      read: () => readCachedRecord(userId, requested, isCurrent),
      save: (detail) => cacheRecord(userId, requested, detail, isCurrent),
      remove: () => removeCachedRecord(userId, requested, isCurrent),
      fetch: () => readWithDeadline(api.getRecordDetail(requested)),
    }, { force });
    const foreground = AppState.addEventListener('change', (status) => {
      if (!ownerCurrent()) return;
      if (status === 'active') setAttempt((value) => value + 1);
      else { current = false; setPreview(null); }
    });
    return () => { focused = false; current = false; active.current = null; foreground.remove(); };
    // A manual refresh or foreground transition intentionally starts a new read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, isSessionCurrent, kind, online, projectId, recordId, sessionRevision, userId]));

  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(() => setPreview(null), 60_000);
    return () => clearTimeout(timer);
  }, [preview]);

  const openAttachment = async (attachment: MobileRecordAttachment) => {
    if (!online) {
      Alert.alert('Attachments require connectivity', 'The record text remains readable offline. Reconnect to verify access and open this attachment.');
      return;
    }
    const isCurrent = active.current;
    if (!isCurrent?.() || attachmentBusy.current) return;
    attachmentBusy.current = true; setOpening(attachment.id);
    try {
      const link = await readWithDeadline(mobileApiForUser(userId, isCurrent).getRecordAttachment(scope, attachment.id));
      if (!isCurrent()) return;
      const url = verifiedAttachmentUrl(link, attachment, scope, mobileConfig.supabaseUrl);
      if (!url) throw new Error('The attachment link could not be verified.');
      if (/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(attachment.fileType) && attachment.size <= 25 * 1024 * 1024) {
        setImageError(false); setPreview({ url, label: attachment.fileName });
      } else {
        Alert.alert('Open attachment in browser?', 'This file is online-only. Any copy saved by the browser is outside RailCommand’s sign-out cleanup.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open', onPress: () => {
            if (!isCurrent() || !verifiedAttachmentUrl(link, attachment, scope, mobileConfig.supabaseUrl)) return;
            void Linking.openURL(url).catch(() => { if (isCurrent()) Alert.alert('Could not open file', 'Return to the attachment and try again.'); });
          } },
        ]);
      }
    } catch {
      if (isCurrent()) Alert.alert('Could not open attachment', 'Check connectivity and refresh the record to verify that you still have access. No saved field work was changed.');
    } finally {
      if (isCurrent()) { attachmentBusy.current = false; setOpening(null); }
    }
  };

  return <Screen>
    <WebHeader projectName={projectName} online={online} onProjectPress={() => router.push('/(tabs)')} />
    <BreadcrumbRow current={state.detail ? `${label} › ${state.detail.record.number}` : label} />
    <WebActionButton title={`‹ Back to ${label}`} onPress={() => router.replace(list)} />
    <StatusBanner title={online ? state.loading ? 'Refreshing record…' : state.message : 'Offline — read-only record'}
      detail={online ? state.loading ? state.message : 'Attachment access is verified separately when you open a file.' : `${state.message} Attachments need connectivity.`}
      tone={!online || state.cached ? 'warning' : 'neutral'} />
    {state.loading ? <ActivityIndicator accessibilityLabel="Loading record" color={colors.orangeText} /> : null}
    {state.detail ? <>
      <RecordBody detail={state.detail} />
      <View style={recordStyles.card}>
        <Text accessibilityRole="header" style={recordStyles.heading}>Attachments ({state.detail.attachments.length})</Text>
        {!state.detail.attachments.length ? <Text style={recordStyles.muted}>No attachments.</Text> : state.detail.attachments.map((attachment) => <Pressable
          key={attachment.id} accessibilityRole="button" accessibilityLabel={`Open ${attachment.fileName}. ${online ? 'Requires an access check.' : 'Online only.'}`}
          accessibilityState={{ disabled: opening !== null }} disabled={opening !== null}
          onPress={() => void openAttachment(attachment)} style={({ pressed }) => [styles.attachment, pressed && styles.pressed]}>
          <Text style={recordStyles.body}>{opening === attachment.id ? 'Opening…' : attachment.fileName}</Text>
          <Text style={recordStyles.muted}>{Math.ceil(attachment.size / 1024)} KB · {online ? 'Open attachment' : 'Online only'}</Text>
        </Pressable>)}
      </View>
      <Text style={recordStyles.muted}>Record text refreshed {new Date(state.detail.fetchedAt).toLocaleString()}. Native creation, editing, responses, and reviews are not available on this detail screen yet.</Text>
    </> : null}
    <WebActionButton title="Refresh record" disabled={!online || state.loading} onPress={() => {
      forceNextRead.current = true;
      setAttempt((value) => value + 1);
    }} />
    <Modal visible={Boolean(preview)} onRequestClose={() => setPreview(null)} animationType="none">
      <SafeAreaView style={styles.preview}>
        <WebActionButton title="Close attachment" onPress={() => setPreview(null)} />
        <Text style={recordStyles.body}>{preview?.label}</Text>
        {imageError ? <StatusBanner title="Image could not load" detail="Close this preview and reopen the attachment when connected." /> : preview ? <Image
          source={{ uri: preview.url }} cachePolicy="none" contentFit="contain" style={styles.image}
          alt={preview.label} accessibilityLabel={preview.label} onError={() => setImageError(true)} /> : null}
      </SafeAreaView>
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  attachment: { minHeight: 56, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 6, gap: 4 },
  pressed: { opacity: 0.75 },
  preview: { flex: 1, backgroundColor: colors.paper, padding: 16, gap: 16 },
  image: { flex: 1, width: '100%' },
});
