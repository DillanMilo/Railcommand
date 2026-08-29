import { Directory, File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { BrandHeader, Card, PageHeading, PrimaryButton, Screen, SecondaryButton, SectionTitle, StatusBanner, StatusPill, uiStyles } from '@/components/ui';
import { mobileApi } from '@/lib/api';
import { mobileConfig } from '@/lib/config';
import { registerForFieldNotifications } from '@/lib/device';
import { inspectExpoUnsynced, purgeExpoUser } from '@/lib/offline-store';
import { useAuth } from '@/providers/auth-provider';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function AccountScreen() {
  const { qaPush } = useLocalSearchParams<{ qaPush?: string }>();
  const { session, signOut } = useAuth();
  const { activeProjectId, bootstrap, online } = useMobileData();
  const [status, setStatus] = useState('Session credentials are stored in the device Keychain or Keystore.');
  const [busy, setBusy] = useState(false);
  const pushQaRan = useRef(false);
  const userId = session?.user.id;
  const email = session?.user.email ?? 'Signed-in user';
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);

  const finishSignOut = async () => {
    if (!userId) return;
    setBusy(true);
    try { await purgeExpoUser(userId); await signOut(); router.replace('/sign-in'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not sign out safely.'); }
    finally { setBusy(false); }
  };

  const beginSignOut = async () => {
    if (!userId) return;
    const unsynced = await inspectExpoUnsynced(userId);
    const total = unsynced.drafts + unsynced.outbox + unsynced.photos;
    if (!total) {
      Alert.alert('Sign out?', 'Saved project cache will be removed from this device.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Sign out', onPress: () => void finishSignOut() },
      ]);
      return;
    }
    Alert.alert('Unsynchronized field work', `This device has ${unsynced.drafts} draft(s), ${unsynced.outbox} queued log(s), and ${unsynced.photos} photo(s).`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Review Sync Center', onPress: () => router.push('/(tabs)/sync') },
      { text: 'Discard…', style: 'destructive', onPress: () => Alert.alert('Permanently discard device work?', 'This cannot be recovered. Server data is not affected.', [
        { text: 'Keep my work', style: 'cancel' }, { text: 'Permanent discard', style: 'destructive', onPress: () => void finishSignOut() },
      ]) },
    ]);
  };

  const registerPush = useCallback(async (recordQaEvidence = false) => {
    setBusy(true); setStatus('Requesting notification permission…');
    try {
      const registration = await registerForFieldNotifications();
      await mobileApi.registerPushDevice(registration);
      if (recordQaEvidence && userId) {
        const evidenceDirectory = new Directory(Paths.document, 'railcommand', userId, 'qa');
        evidenceDirectory.create({ idempotent: true, intermediates: true });
        new File(evidenceDirectory, 'push-result.json').write(JSON.stringify({
          registered: true,
          platform: registration.platform,
          appProfile: registration.appProfile,
          deviceName: registration.deviceName,
          recordedAt: new Date().toISOString(),
        }));
      }
      setStatus('This device is registered for field notifications.');
    }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not register notifications.'); }
    finally { setBusy(false); }
  }, [userId]);

  useEffect(() => {
    if (
      mobileConfig.profile !== 'development'
      || qaPush !== '1'
      || pushQaRan.current
      || !userId
      || !online
    ) return;
    pushQaRan.current = true;
    void registerPush(true);
  }, [online, qaPush, registerPush, userId]);

  const openExternal = async (url: string, label: string, requiresOnline = false) => {
    if (requiresOnline && !online) {
      setStatus(`${label} is online-only. Reconnect and try again.`);
      return;
    }
    try { await Linking.openURL(url); }
    catch { setStatus(`${label} could not be opened on this device. Contact support@railcommand.io if the problem continues.`); }
  };
  const sessionTone = /could not|failed|unavailable/i.test(status) ? 'danger' : online ? 'success' : 'warning';

  return <Screen>
    <BrandHeader eyebrow="ACTIVE PROJECT" title={project?.name ?? 'RailCommand'} right={<StatusPill online={online} />} />
    <PageHeading eyebrow="SETTINGS / PROFILE & PRIVACY" title="Account" detail="Manage this device session, support, privacy, and notifications." />
    <Card><Text style={styles.eyebrow}>SIGNED-IN USER</Text><View style={styles.identity}>
      <View style={styles.avatar}><Text style={styles.initial}>{email.charAt(0).toUpperCase()}</Text></View>
      <View style={{ flex: 1 }}><SectionTitle>{email}</SectionTitle><Text style={uiStyles.muted}>Organization access is verified again when queued work synchronizes.</Text></View>
    </View></Card>
    <StatusBanner tone={sessionTone} title={online ? 'Secure device session active' : 'Offline device session'} detail={status} />
    <Card><Text style={styles.eyebrow}>DEVICE SERVICES</Text><SectionTitle>Field Notifications</SectionTitle>
      <Text style={uiStyles.muted}>RailCommand will ask before enabling alerts. Registration requires connectivity and a physical device; denial leaves the rest of the app usable.</Text>
      <PrimaryButton title="Enable field notifications" disabled={!online} busy={busy} onPress={() => void registerPush()} />
    </Card>
    <Card><Text style={styles.eyebrow}>SUPPORT & COMPLIANCE</Text><SectionTitle>Help and Privacy</SectionTitle>
      <SecondaryButton title="Privacy policy" onPress={() => void openExternal('https://railcommand.io/privacy', 'Privacy policy', true)} />
      <SecondaryButton title="Contact support" onPress={() => void openExternal('mailto:support@railcommand.io?subject=RailCommand%20mobile%20support', 'Support email')} />
      <SecondaryButton title="Request account deletion" disabled={busy} onPress={() => router.push('/account-deletion')} />
      {!online ? <Text style={styles.offline}>Deletion requests are online-only and will never be silently queued.</Text> : null}
    </Card>
    <Card><Text style={styles.eyebrow}>DEVICE SECURITY</Text><SectionTitle>Safe Sign-out</SectionTitle>
      <Text style={uiStyles.muted}>RailCommand checks for drafts and queued work before removing this user’s private device database.</Text>
      <PrimaryButton title="Safe sign-out" tone="danger" busy={busy} onPress={() => void beginSignOut()} />
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.2 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  initial: { color: colors.white, fontFamily: fonts.heading, fontSize: 16 },
  offline: { color: colors.warning, fontFamily: fonts.bodyBold, lineHeight: 19 },
});
