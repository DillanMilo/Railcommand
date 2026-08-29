import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { MobileAccountDeletionResult } from '@railcommand/domain';
import {
  BrandHeader,
  Card,
  Field,
  PageHeading,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
  StatusBanner,
  StatusPill,
  uiStyles,
} from '@/components/ui';
import { mobileApi } from '@/lib/api';
import { inspectExpoUnsynced, purgeExpoUser } from '@/lib/offline-store';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

type LocalWork = { drafts: number; outbox: number; photos: number };
const EMPTY_LOCAL_WORK: LocalWork = { drafts: 0, outbox: 0, photos: 0 };

export default function AccountDeletionScreen() {
  const { session, signOut } = useAuth();
  const { activeProjectId, bootstrap, online } = useMobileData();
  const userId = session?.user.id;
  const [localWork, setLocalWork] = useState<LocalWork>(EMPTY_LOCAL_WORK);
  const [activeRequest, setActiveRequest] = useState<MobileAccountDeletionResult | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Review what happens before submitting a deletion request.');

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const work = await inspectExpoUnsynced(userId);
      setLocalWork(work);
      if (online) setActiveRequest(await mobileApi.getAccountDeletionRequest());
    } catch {
      setStatus('RailCommand could not safely inspect this device. No deletion request was submitted.');
    }
  }, [online, userId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const confirmPassword = async (): Promise<boolean> => {
    const email = session?.user.email;
    if (!email || !password) {
      setStatus('Enter your current password to confirm your identity.');
      return false;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || data.user?.id !== userId) {
      setStatus('The current password could not be confirmed. Nothing was submitted.');
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!userId || !online) {
      setStatus('Connect to the internet before requesting account deletion. No request is queued offline.');
      return;
    }
    setBusy(true);
    try {
      const work = await inspectExpoUnsynced(userId);
      setLocalWork(work);
      if (work.drafts + work.outbox + work.photos > 0) {
        setStatus('Synchronize, reopen, or permanently discard all device work before continuing.');
        return;
      }
      if (!await confirmPassword()) return;
      const result = await mobileApi.requestAccountDeletion({
        clientRequestId: Crypto.randomUUID(),
        localWork: work,
      });
      await purgeExpoUser(userId);
      await signOut();
      router.replace({
        pathname: '/sign-in',
        params: {
          error: `Deletion request received. Recovery remains available until ${new Date(result.scheduledFor).toLocaleDateString()}.`,
        },
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not submit the deletion request.');
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async () => {
    if (!activeRequest || !online) return;
    setBusy(true);
    try {
      if (!await confirmPassword()) return;
      await mobileApi.cancelAccountDeletion(activeRequest.id);
      setActiveRequest(null);
      setPassword('');
      setStatus('Account deletion was canceled. Your RailCommand account remains active.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not cancel the deletion request.');
    } finally {
      setBusy(false);
    }
  };

  const discardDeviceWork = () => {
    if (!userId) return;
    Alert.alert(
      'Permanently discard device work?',
      `This device has ${localWork.drafts} draft(s), ${localWork.outbox} queued item(s), and ${localWork.photos} photo(s). Server records are not affected.`,
      [
        { text: 'Keep my work', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => Alert.alert(
            'Final confirmation',
            'This local work cannot be recovered after it is discarded.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Permanent discard',
                style: 'destructive',
                onPress: () => void purgeExpoUser(userId).then(refresh).then(() => {
                  setStatus('Device work was permanently discarded. Server records were not changed.');
                }).catch(() => setStatus('Could not discard device work safely.')),
              },
            ],
          ),
        },
      ],
    );
  };

  const localTotal = localWork.drafts + localWork.outbox + localWork.photos;
  const canCancel = activeRequest?.status === 'pending' || activeRequest?.status === 'reviewing';
  const requestTitle = activeRequest?.status === 'failed'
    ? 'Deletion processing delayed'
    : activeRequest?.status === 'processing'
      ? 'Deletion processing'
      : 'Deletion request pending';
  const project = bootstrap?.projects.find((item) => item.id === activeProjectId);
  return <Screen>
    <BrandHeader eyebrow="ACTIVE PROJECT" title={project?.name ?? 'RailCommand'} right={<StatusPill online={online} />} />
    <PageHeading eyebrow="SETTINGS / PRIVACY CONTROL" title="Delete Account" badge="30-DAY RECOVERY"
      detail="Review organization records, device work, identity verification, and the recovery period before submitting." />
    <StatusBanner tone={!online ? 'warning' : activeRequest?.status === 'failed' ? 'danger' : 'neutral'}
      title={!online ? 'Account deletion is online-only' : activeRequest ? requestTitle : 'No request has been submitted'}
      detail={!online ? 'Account deletion is online-only and is never silently queued.' : status} />
    <Card>
      <Text style={styles.eyebrow}>RETENTION & RECOVERY</Text>
      <SectionTitle>{activeRequest ? requestTitle : 'Before you continue'}</SectionTitle>
      {activeRequest ? <Text style={uiStyles.muted}>
        Your request is scheduled for {new Date(activeRequest.scheduledFor).toLocaleDateString()}.
        {canCancel
          ? ' Reconfirm your password below if you want to cancel during the recovery period.'
          : activeRequest.status === 'failed'
            ? ' RailCommand will retry automatically. Contact support if this state remains visible.'
            : ' Identity processing has started and the request can no longer be canceled.'}
      </Text> : <>
        <Text style={styles.copy}>Deleted after 30 days: sign-in identity, personal profile fields, push tokens, and active sessions.</Text>
        <Text style={styles.copy}>Retained or anonymized: organization-owned project records, photos, safety records, and audit history required by contract or law.</Text>
        <Text style={styles.copy}>Sole organization administrators must transfer administration or request organization closure first.</Text>
      </>}
    </Card>
    <Card>
      <Text style={styles.eyebrow}>DEVICE INVENTORY</Text><SectionTitle>Work Stored on This Device</SectionTitle>
      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricValue}>{localWork.drafts}</Text><Text style={styles.metricLabel}>DRAFTS</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{localWork.outbox}</Text><Text style={styles.metricLabel}>QUEUED</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{localWork.photos}</Text><Text style={styles.metricLabel}>PHOTOS</Text></View>
      </View>
      {localTotal > 0 ? <>
        <Text style={styles.warning}>Nothing will be silently deleted. Synchronize or review this work before requesting deletion.</Text>
        <SecondaryButton title="Review Sync Center" onPress={() => router.push('/(tabs)/sync')} />
        <SecondaryButton title="Permanently discard device work" onPress={discardDeviceWork} />
      </> : <Text style={styles.ready}>This device has no unsynchronized field work.</Text>}
    </Card>
    <Card>
      <Text style={styles.eyebrow}>SECURE ACTION</Text><SectionTitle>Confirm Your Identity</SectionTitle>
      <Field
        label="Current password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
      />
      <Text style={styles.status}>{status}</Text>
      {activeRequest && canCancel
        ? <PrimaryButton title="Cancel deletion request" tone="dark" busy={busy} disabled={!online || !password} onPress={() => void cancelRequest()} />
        : activeRequest
          ? <Text style={styles.status}>No further action is required on this device.</Text>
        : <PrimaryButton title="Request account deletion" tone="danger" busy={busy} disabled={!online || !password || localTotal > 0} onPress={() => void submit()} />}
    </Card>
    {!online ? <Text style={styles.warning}>Account deletion is online-only and is never silently queued.</Text> : null}
    <SecondaryButton title="Back to Account" onPress={() => router.back()} />
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.2 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 72, justifyContent: 'space-between', padding: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  metricValue: { color: colors.ink, fontFamily: fonts.headingHeavy, fontSize: 24, lineHeight: 29 },
  metricLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 7, lineHeight: 10, letterSpacing: 0.8 },
  copy: { color: colors.ink, fontFamily: fonts.body, lineHeight: 20 },
  status: { color: colors.muted, fontFamily: fonts.body, lineHeight: 20 },
  warning: { color: colors.warning, fontFamily: fonts.bodyBold, lineHeight: 20 },
  ready: { color: colors.success, fontFamily: fonts.bodyBold, lineHeight: 20 },
});
