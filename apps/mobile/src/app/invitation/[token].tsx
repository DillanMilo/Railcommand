import type { MobileInvitation } from '@railcommand/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BrandHeader, Card, PrimaryButton, Screen, SectionTitle, uiStyles } from '@/components/ui';
import { mobileApi } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { useMobileData } from '@/providers/mobile-data-provider';
import { colors } from '@/theme';

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
  return <Screen><BrandHeader eyebrow="PROJECT INVITATION" title="You’re invited" />
    <Card>{invitation ? <><SectionTitle>{invitation.projectName}</SectionTitle>
      <Text style={styles.role}>Role: {invitation.role.replace('_', ' ')}</Text>
      <Text style={uiStyles.muted}>This invitation is for {invitation.email}. Acceptance requires connectivity and is revalidated by the server.</Text>
      <PrimaryButton title="Accept invitation" busy={busy} onPress={() => void accept()} />
      <Text style={styles.message}>{message}</Text></> : <Text style={styles.message}>{message}</Text>}</Card>
  </Screen>;
}

const styles = StyleSheet.create({ role: { color: colors.orange, textTransform: 'capitalize', fontWeight: '900' }, message: { color: colors.muted, lineHeight: 20 } });
