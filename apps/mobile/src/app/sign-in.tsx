import { useLocalSearchParams, router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, type TextInput } from 'react-native';
import { BrandHeader, Card, Field, PrimaryButton, Screen, SecondaryButton } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { colors, fonts } from '@/theme';

export default function SignInScreen() {
  const params = useLocalSearchParams<{ error?: string; inviteToken?: string }>();
  const { signIn, requestPasswordReset } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [message, setMessage] = useState(params.error ?? 'Use your approved RailCommand organization account.');
  const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); const error = await signIn(email, password); setBusy(false);
    if (error) setMessage(error); else if (params.inviteToken) router.replace(`/invitation/${params.inviteToken}`); else router.replace('/'); };
  const reset = async () => { if (!email.trim()) { setMessage('Enter your email first.'); return; }
    const error = await requestPasswordReset(email); setMessage(error ?? 'Password-reset instructions were sent if the account exists.'); };
  return <Screen><BrandHeader eyebrow="FIELD APPLICATION" title="RailCommand" />
    <Card><Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email"
        autoFocus returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => passwordRef.current?.focus()} />
      <Field ref={passwordRef} label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"
        returnKeyType="go" onSubmitEditing={() => { if (email && password && !busy) void submit(); }} />
      <PrimaryButton title="Sign in" onPress={() => void submit()} busy={busy} disabled={!email || !password} />
      <SecondaryButton title="Send password-reset link" onPress={() => void reset()} /></Card>
    <Text style={styles.detail}>Invitations and password-reset links return securely through railcommand:// or verified railcommand.io links.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  message: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  detail: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
});
