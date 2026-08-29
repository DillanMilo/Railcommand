import { useLocalSearchParams, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, type TextInput } from 'react-native';
import { Field, PrimaryButton, Screen, SecondaryButton } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { colors, fonts } from '@/theme';
import railCommandMark from '../../assets/images/icon.png';

export default function SignInScreen() {
  const params = useLocalSearchParams<{ error?: string; inviteToken?: string }>();
  const { signIn, requestPasswordReset } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [message, setMessage] = useState(params.error ?? 'Use your approved RailCommand organization account.');
  const [pending, setPending] = useState<'sign-in' | 'reset' | null>(null);
  const submit = async () => {
    if (pending) return;
    setPending('sign-in');
    try {
      const error = await signIn(email, password);
      if (error) setMessage(error);
      else if (params.inviteToken) router.replace(`/invitation/${params.inviteToken}`);
      else router.replace('/');
    } catch {
      setMessage('Sign-in could not reach RailCommand. Check connectivity and try again.');
    } finally { setPending(null); }
  };
  const reset = async () => {
    if (pending) return;
    if (!email.trim()) { setMessage('Enter your email first.'); return; }
    setPending('reset'); setMessage('Requesting password-reset instructions…');
    try {
      const error = await requestPasswordReset(email);
      setMessage(error ?? 'Password-reset instructions were sent if the account exists.');
    } catch {
      setMessage('Password recovery could not reach RailCommand. Check connectivity and try again.');
    } finally { setPending(null); }
  };
  return <Screen>
    <View pointerEvents="none" style={styles.orangeRail} />
    <View style={styles.brand}>
      <Image source={railCommandMark} style={styles.mark} resizeMode="cover" accessible={false} alt="" />
      <View><Text style={styles.brandName}>RailCommand</Text><Text style={styles.brandByline}>BY A5 RAIL</Text></View>
    </View>
    <View style={styles.intro}>
      <Text style={styles.eyebrow}>SECURE PROJECT ACCESS</Text>
      <Text accessibilityRole="header" style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to continue to your projects</Text>
    </View>
    <View style={styles.form}>
      <View style={styles.mode}><Text style={styles.modeText}>SIGN IN</Text></View>
      <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email"
        placeholder="you@company.com" autoFocus returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => passwordRef.current?.focus()} />
      <Field ref={passwordRef} label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"
        placeholder="Enter your password" returnKeyType="go" onSubmitEditing={() => { if (email && password && !pending) void submit(); }} />
      <PrimaryButton title="Sign in" onPress={() => void submit()} busy={pending === 'sign-in'} disabled={!email || !password || pending !== null} />
      <SecondaryButton title={pending === 'reset' ? 'Requesting reset link…' : 'Forgot password?'} disabled={pending !== null} onPress={() => void reset()} />
    </View>
    <View style={styles.security}>
      <Text style={styles.securityTitle}>US-ONLY ACCESS CONTROLS</Text>
      <Text style={styles.detail}>Invitations and password-reset links return securely through railcommand:// or verified railcommand.io links.</Text>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  orangeRail: { position: 'absolute', left: -16, top: 0, bottom: 0, width: 3, backgroundColor: colors.orange },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 18 },
  mark: { width: 44, height: 44, backgroundColor: colors.ink },
  brandName: { color: colors.ink, fontFamily: fonts.headingHeavy, fontSize: 20, lineHeight: 24, letterSpacing: -0.5 },
  brandByline: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 8, lineHeight: 12, letterSpacing: 1.45 },
  intro: { gap: 7, paddingBottom: 6 },
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.6 },
  title: { color: colors.ink, fontFamily: fonts.headingHeavy, fontSize: 38, lineHeight: 41, letterSpacing: -1.9 },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  form: { gap: 14, paddingTop: 8 },
  mode: { minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.ink },
  modeText: { color: colors.white, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.45 },
  message: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, borderLeftWidth: 2, borderLeftColor: colors.orange, paddingLeft: 10 },
  security: { gap: 5, padding: 12, borderWidth: 1, borderColor: '#9BD8C5', backgroundColor: '#EFFBF7' },
  securityTitle: { color: colors.success, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.25 },
  detail: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
});
