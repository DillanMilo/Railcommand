import type { MobileEarthCamEmbed } from '@railcommand/domain';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Field, PrimaryButton, Screen, SecondaryButton, StatusBanner } from '@/components/ui';
import { BreadcrumbRow, ModuleHeading, WebActionButton, WebEmpty, WebHeader } from '@/components/web-shell';
import { mobileApi } from '@/lib/api';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

const SAMPLE_EARTHCAM_URL = 'https://share.earthcam.net/tJ90CoLmq7TzrY396Yd88CKvRQt1vEA9ny7MYZgQXUg';

type FeedForm = {
  id?: string;
  label: string;
  embedInput: string;
};

const emptyForm: FeedForm = { label: '', embedInput: '' };

const isAllowedEarthCamNavigation = (value: string) => {
  if (value === 'about:blank') return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'share.earthcam.net';
  } catch {
    return false;
  }
};

const readableError = (error: unknown, fallback: string) => error instanceof Error
  ? error.message
  : fallback;

export default function CamerasScreen() {
  const { activeProjectId, bootstrap, online, refresh } = useMobileData();
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  const embeds = bootstrap?.earthCamEmbeds ?? [];
  const canView = project?.canViewEarthCam === true;
  const canManage = project?.canManageEarthCam === true;
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FeedForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const openForm = (embed?: MobileEarthCamEmbed) => {
    if (!canManage) {
      Alert.alert('Permission required', 'Your RailCommand project role cannot manage EarthCam feeds.');
      return;
    }
    if (!online) {
      Alert.alert('EarthCam management is online-only', 'Feed labels remain readable offline. Adding or editing a feed is never silently queued.');
      return;
    }
    setFormError('');
    setForm(embed
      ? { id: embed.id, label: embed.label, embedInput: embed.url }
      : emptyForm);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setFormError('');
    setForm(emptyForm);
  };

  const saveFeed = async () => {
    if (!activeProjectId || !canManage) return;
    if (!online) {
      setFormError('Connectivity was lost. Your entered label and EarthCam link remain here; reconnect and try again.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const saved = await mobileApi.saveEarthCamEmbed({
        projectId: activeProjectId,
        ...(form.id ? { id: form.id } : {}),
        label: form.label,
        embedInput: form.embedInput,
      });
      setFailedIds((current) => {
        const next = new Set(current);
        next.delete(saved.id);
        return next;
      });
      await refresh(activeProjectId);
      setFormOpen(false);
      setForm(emptyForm);
    } catch (error) {
      setFormError(readableError(error, 'Could not save this EarthCam feed. Your input remains unchanged.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmRemoveFeed = async (embed: MobileEarthCamEmbed) => {
    if (!activeProjectId || !canManage) return;
    if (!online) {
      Alert.alert('EarthCam management is online-only', 'The feed was not removed or queued. Reconnect before trying again.');
      return;
    }
    setSaving(true);
    try {
      await mobileApi.deleteEarthCamEmbed({ projectId: activeProjectId, id: embed.id });
      await refresh(activeProjectId);
    } catch (error) {
      Alert.alert('Could not remove EarthCam feed', readableError(error, 'The feed remains unchanged.'));
    } finally {
      setSaving(false);
    }
  };

  const removeFeed = (embed: MobileEarthCamEmbed) => {
    if (!canManage) return;
    if (!online) {
      Alert.alert('EarthCam management is online-only', 'The feed was not removed or queued. Reconnect before trying again.');
      return;
    }
    Alert.alert(
      'Remove EarthCam Feed?',
      `This removes ${embed.label} from this RailCommand project. It does not delete or modify anything in EarthCam.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove Feed', style: 'destructive', onPress: () => void confirmRemoveFeed(embed) },
      ],
    );
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

  return <>
    <Screen>
      <WebHeader projectName={project?.name ?? 'Select project'} online={online} onProjectPress={() => router.push('/(tabs)')} />
      <BreadcrumbRow current="Cameras" />
      <ModuleHeading
        title="Cameras"
        count={embeds.length}
        subtitle="Live EarthCam feeds stream from EarthCam. RailCommand only stores the project embed link."
        badges={<Text style={styles.beta}>Beta</Text>}
        actions={canManage ? <WebActionButton
          title="Add EarthCam Feed"
          primary
          onPress={() => openForm()}
          disabled={!online || !activeProjectId || saving}
          icon={<SymbolView accessible={false} name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={colors.white} size={18} />}
        /> : undefined}
      />
      {!canView ? <StatusBanner
        tone="warning"
        title="Camera access unavailable"
        detail="Your current project role does not have permission to view EarthCam feeds."
      /> : null}
      {canView && !online ? <StatusBanner
        tone="warning"
        title="EarthCam live video requires connectivity"
        detail="Feed labels are cached for offline reference. RailCommand never presents stale video as live and never queues camera administration."
      /> : null}
      {canView && embeds.length === 0 ? <View style={styles.emptyCard}>
        <View style={styles.cameraIcon}><SymbolView accessible={false} name={{ ios: 'video', android: 'videocam', web: 'videocam' }} tintColor={colors.orange} size={27} /></View>
        <Text style={styles.emptyTitle}>Add an EarthCam feed</Text>
        <Text style={styles.emptyDetail}>Paste the EarthCam share link or Broadway Media Player embed code generated from the customer&apos;s EarthCam project.</Text>
        {canManage ? <WebActionButton title="Add EarthCam Feed" primary onPress={() => openForm()} disabled={!online || saving} /> : null}
      </View> : null}
      {canView && embeds.length > 0 ? <View style={styles.feedList}>{embeds.map((embed) => <View key={embed.id} style={styles.feedCard}>
        <View style={styles.feedHeader}>
          <View style={styles.feedName}><Text numberOfLines={1} style={styles.feedTitle}>{embed.label}</Text><Text numberOfLines={1} style={styles.feedHost}>share.earthcam.net</Text></View>
          <View style={styles.feedActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open ${embed.label} in EarthCam`} disabled={!online} onPress={() => void openFeedExternally(embed.label, embed.url)} style={({ pressed }) => [styles.iconButton, !online && styles.disabled, pressed && styles.pressed]}>
              <SymbolView accessible={false} name={{ ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' }} tintColor={colors.muted} size={19} />
            </Pressable>
            {canManage ? <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${embed.label}`} disabled={!online || saving} onPress={() => openForm(embed)} style={({ pressed }) => [styles.iconButton, (!online || saving) && styles.disabled, pressed && styles.pressed]}>
              <SymbolView accessible={false} name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor={colors.muted} size={18} />
            </Pressable> : null}
            {canManage ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${embed.label}`} disabled={!online || saving} onPress={() => removeFeed(embed)} style={({ pressed }) => [styles.iconButton, (!online || saving) && styles.disabled, pressed && styles.pressed]}>
              <SymbolView accessible={false} name={{ ios: 'trash', android: 'delete', web: 'delete' }} tintColor={colors.danger} size={18} />
            </Pressable> : null}
          </View>
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
      </View>)}</View> : null}
    </Screen>

    <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeForm}>
      <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleWrap}>
              <Text accessibilityRole="header" style={styles.modalTitle}>{form.id ? 'Edit EarthCam Feed' : 'Add EarthCam Feed'}</Text>
              <Text style={styles.modalSubtitle}>RailCommand stores only the approved EarthCam URL reference.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close EarthCam feed form" disabled={saving} onPress={closeForm} style={({ pressed }) => [styles.modalClose, saving && styles.disabled, pressed && styles.pressed]}>
              <SymbolView accessible={false} name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={colors.ink} size={19} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
            {!online ? <StatusBanner
              tone="warning"
              title="Waiting for connectivity"
              detail="Your entered label and link remain in this form. EarthCam administration is never queued."
            /> : null}
            <Field
              label="Label"
              value={form.label}
              onChangeText={(label) => setForm((current) => ({ ...current, label }))}
              placeholder="North Yard Camera"
              editable={!saving}
              maxLength={120}
            />
            <Field
              label="EarthCam share URL or embed code"
              value={form.embedInput}
              onChangeText={(embedInput) => setForm((current) => ({ ...current, embedInput }))}
              placeholder={SAMPLE_EARTHCAM_URL}
              editable={!saving}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={4_000}
            />
            {formError ? <StatusBanner tone="danger" title="Feed not saved" detail={formError} /> : null}
            <View style={styles.sampleCard}>
              <Text style={styles.sampleEyebrow}>EXAMPLE FEED</Text>
              <Text style={styles.sampleTitle}>EarthCam Sample Feed</Text>
              <Text style={styles.sampleDetail}>Use this sample to preview how an EarthCam share feed renders in RailCommand.</Text>
              <SecondaryButton title="Use Sample" disabled={saving} onPress={() => {
                setForm((current) => ({ ...current, label: current.label || 'EarthCam Sample Feed', embedInput: SAMPLE_EARTHCAM_URL }));
                setFormError('');
              }} />
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <View style={styles.footerButton}><SecondaryButton title="Cancel" onPress={closeForm} disabled={saving} /></View>
            <View style={styles.footerButton}><PrimaryButton title="Save Feed" onPress={() => void saveFeed()} disabled={!online || !form.embedInput.trim()} busy={saving} /></View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  beta: { color: colors.orangeText, backgroundColor: '#FFF1E8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 15 },
  emptyCard: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.paper },
  cameraIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1E8' },
  emptyTitle: { color: colors.ink, fontFamily: fonts.heading, fontSize: 18, lineHeight: 24 },
  emptyDetail: { maxWidth: 520, color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  feedList: { gap: 16 },
  feedCard: { overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  feedHeader: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  feedName: { flex: 1, minWidth: 0 },
  feedTitle: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21 },
  feedHost: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  feedActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  frame: { height: 224, margin: 14, marginTop: 0, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  modalSafe: { flex: 1, backgroundColor: colors.cream },
  modalKeyboard: { flex: 1 },
  modalHeader: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
  modalTitleWrap: { flex: 1, minWidth: 0, gap: 3 },
  modalTitle: { color: colors.ink, fontFamily: fonts.heading, fontSize: 20, lineHeight: 27 },
  modalSubtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  modalClose: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.controlLine, backgroundColor: colors.paper },
  formContent: { gap: 18, padding: 16, paddingBottom: 28 },
  sampleCard: { gap: 8, padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.paper },
  sampleEyebrow: { color: colors.muted, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.1 },
  sampleTitle: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20 },
  sampleDetail: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  modalFooter: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper },
  footerButton: { flex: 1 },
});
