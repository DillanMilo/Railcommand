import type { MobileInvitation } from '@railcommand/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BrandHeader, Card, PageHeading, PrimaryButton, Screen, SectionTitle, StatusBanner, uiStyles } from '@/components/ui';
import { mobileApi } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors, fonts } from '@/theme';

export default function InvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session, loading } = useAuth();
  const { refresh } = useMobileData();
  const [invitation, setInvitation] = useState<MobileInvitation | null>(null);
  const [message, setMessage] = useState('Verifying invitation…');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (loading || !token) return;
    if (!session) {
      router.replace(`/sign-in?inviteToken=${encodeURIComponent(token)}`);
      return;
    }
    let current = true;
    void mobileApi.getInvitation(token).then((result) => {
      if (!current) return;
      setInvitation(result);
      setMessage('Invitation verified.');
    }).catch((error) => {
      if (current) setMessage(error instanceof Error ? error.message : 'Invitation unavailable.');
    });
    return () => { current = false; };
  }, [loading, session, token]);
  const accept = async () => {
    if (!token) return;
    setBusy(true); setMessage('Accepting invitation…');
    try {
      const result = await mobileApi.acceptInvitation(token);
      setMessage('Invitation accepted. Opening project…');
      await refresh(result.projectId).catch(() => undefined);
      router.replace('/(tabs)');
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not accept this invitation.'); setBusy(false); }
  };
  const invitationTone = invitation ? 'success' : message === 'Verifying invitation…' ? 'neutral' : 'danger';
  return <Screen><BrandHeader eyebrow="RAILCOMMAND ACCESS" title="Project invitation" />
    <PageHeading eyebrow="PROJECT ACCESS / INVITATION" title="You’re Invited" detail="Review the verified project and role before joining." />
    <StatusBanner tone={invitationTone} title={invitation ? 'Invitation verified' : 'Secure link verification'} detail={message} />
    <Card>{invitation ? <><Text style={styles.eyebrow}>PROJECT</Text><SectionTitle>{invitation.projectName}</SectionTitle>
      <Text style={styles.role}>Role: {invitation.role.replace('_', ' ')}</Text>
      <Text style={uiStyles.muted}>This invitation is for {invitation.email}. Acceptance requires connectivity and is revalidated by the server.</Text>
      <PrimaryButton title="Accept invitation" busy={busy} onPress={() => void accept()} />
      </> : <Text style={styles.message}>Keep this screen open while RailCommand verifies the secure invitation.</Text>}</Card>
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.2 },
  role: { color: colors.orangeText, textTransform: 'capitalize', fontFamily: fonts.bodyBold },
  message: { color: colors.muted, fontFamily: fonts.body, lineHeight: 20 },
});
