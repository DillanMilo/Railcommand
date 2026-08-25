import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, Text } from 'react-native';
import { BrandHeader, Card, PrimaryButton, Screen, SecondaryButton, SectionTitle, StatusPill, uiStyles } from '@/components/ui';
import { mobileApi } from '@/lib/api';
import { registerForFieldNotifications } from '@/lib/device';
import { inspectExpoUnsynced, purgeExpoUser } from '@/lib/offline-store';
import { useAuth } from '@/providers/auth-provider';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors } from '@/theme';

export default function AccountScreen() {
  const { session, signOut } = useAuth();
  const { online } = useMobileData();
  const [status, setStatus] = useState('Session credentials are stored in the device Keychain or Keystore.');
  const [busy, setBusy] = useState(false);
  const userId = session?.user.id;

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

  const registerPush = async () => {
    setBusy(true); setStatus('Requesting notification permission…');
    try { const registration = await registerForFieldNotifications(); await mobileApi.registerPushDevice(registration); setStatus('This device is registered for field notifications.'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not register notifications.'); }
    finally { setBusy(false); }
  };

  const requestDeletion = () => {
    if (!online) { setStatus('Account deletion requests require connectivity. No request was lost or submitted.'); return; }
    Alert.alert('Request account deletion?', 'RailCommand will create a reviewable request. The approved 30-day retention period applies; this does not immediately erase records.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: () => Alert.alert('Confirm deletion request', 'Submit this request for account deletion and retention review?', [
        { text: 'Keep account', style: 'cancel' },
        { text: 'Submit request', style: 'destructive', onPress: async () => {
          setBusy(true);
          try { const result = await mobileApi.requestAccountDeletion({ clientRequestId: Crypto.randomUUID() });
            setStatus(`Deletion request ${result.duplicate ? 'already exists' : 'submitted'}. Scheduled review date: ${new Date(result.scheduledFor).toLocaleDateString()}.`); }
          catch (error) { setStatus(error instanceof Error ? error.message : 'Could not submit the deletion request.'); }
          finally { setBusy(false); }
        } },
      ]) },
    ]);
  };

  return <Screen>
    <BrandHeader eyebrow="PROFILE & PRIVACY" title="Account" right={<StatusPill online={online} />} />
    <Card><SectionTitle>{session?.user.email ?? 'Signed-in user'}</SectionTitle><Text style={styles.status}>{status}</Text></Card>
    <Card><SectionTitle>Field notifications</SectionTitle>
      <Text style={uiStyles.muted}>RailCommand will ask before enabling alerts. Registration requires connectivity and a physical device; denial leaves the rest of the app usable.</Text>
      <PrimaryButton title="Enable field notifications" disabled={!online} busy={busy} onPress={() => void registerPush()} />
    </Card>
    <Card><SectionTitle>Help and privacy</SectionTitle>
      <SecondaryButton title="Privacy policy" onPress={() => void Linking.openURL('https://railcommand.io/privacy')} />
      <SecondaryButton title="Contact support" onPress={() => void Linking.openURL('mailto:support@railcommand.io?subject=RailCommand%20mobile%20support')} />
      <SecondaryButton title="Request account deletion" disabled={!online || busy} onPress={requestDeletion} />
      {!online ? <Text style={styles.offline}>Deletion requests are online-only and will never be silently queued.</Text> : null}
    </Card>
    <PrimaryButton title="Safe sign-out" tone="danger" busy={busy} onPress={() => void beginSignOut()} />
  </Screen>;
}

const styles = StyleSheet.create({ status: { color: colors.ink, lineHeight: 20 }, offline: { color: colors.warning, fontWeight: '700', lineHeight: 19 } });
