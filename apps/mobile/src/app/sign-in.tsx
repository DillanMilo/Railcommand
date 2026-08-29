import { useLocalSearchParams, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
import { Field, PrimaryButton, Screen, SecondaryButton } from '@/components/ui';
import { mobileConfig } from '@/lib/config';
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
  const openBrowserPage = async (path: string, failureTitle: string) => {
    try {
      const url = path.startsWith('https://') ? path : new URL(path, mobileConfig.apiBaseUrl).toString();
      await Linking.openURL(url);
    } catch {
      Alert.alert(failureTitle, 'Nothing was changed. Check connectivity and try again.');
    }
  };
  return <Screen>
    <View pointerEvents="none" style={styles.orangeRail} />
    <View style={styles.brand}>
      <Image source={railCommandMark} style={styles.mark} resizeMode="cover" accessible={false} alt="" />
      <Text style={styles.brandByline}>BY A5 RAIL</Text>
    </View>
    <View style={styles.intro}>
      <Text style={styles.eyebrow}>SECURE PROJECT ACCESS</Text>
      <Text accessibilityRole="header" style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to continue to your projects</Text>
    </View>
    <View style={styles.form}>
      <View style={styles.modeRow}><View style={styles.mode}><Text style={styles.modeText}>SIGN IN</Text></View><Pressable accessibilityRole="link" onPress={() => void openBrowserPage('https://railcommand.io/#pricing', 'Could not open pricing')} style={styles.pricing}><Text style={styles.pricingText}>SEE PRICING</Text></Pressable></View>
      <Pressable accessibilityRole="link" accessibilityLabel="Explore demo project on staging web" onPress={() => void openBrowserPage('/login?demo=1', 'Could not open the demo')} style={({ pressed }) => [styles.demo, pressed && styles.pressed]}><Text style={styles.demoIcon}>▷</Text><Text style={styles.demoText}>Explore Demo Project</Text></Pressable>
      <Text style={styles.demoDetail}>Private browser sandbox — resets on refresh and expires after 3 days</Text>
      <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or sign in to your account</Text><View style={styles.dividerLine} /></View>
      <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
      <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email"
        placeholder="you@company.com" autoFocus returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => passwordRef.current?.focus()} />
      <Field ref={passwordRef} label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"
        placeholder="Enter your password" returnKeyType="go" onSubmitEditing={() => { if (email && password && !pending) void submit(); }} />
      <PrimaryButton title="Sign in" onPress={() => void submit()} busy={pending === 'sign-in'} disabled={!email || !password || pending !== null} />
      <SecondaryButton title={pending === 'reset' ? 'Requesting reset link…' : 'Forgot password?'} disabled={pending !== null} onPress={() => void reset()} />
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  orangeRail: { position: 'absolute', left: -16, top: 0, bottom: 0, width: 3, backgroundColor: colors.orange },
  brand: { alignItems: 'center', gap: 8, marginBottom: 18 },
  mark: { width: 66, height: 66, backgroundColor: colors.ink },
  brandByline: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 14, letterSpacing: 1.45 },
  intro: { gap: 7, paddingBottom: 6 },
  eyebrow: { color: colors.orangeText, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.6 },
  title: { color: colors.ink, fontFamily: fonts.headingHeavy, fontSize: 38, lineHeight: 41, letterSpacing: -1.9 },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  form: { gap: 14, paddingTop: 8 },
  modeRow: { flexDirection: 'row' },
  mode: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.ink },
  modeText: { color: colors.white, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.45 },
  pricing: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  pricingText: { color: colors.muted, fontFamily: fonts.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.45 },
  demo: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.paper, shadowColor: colors.orange, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 2 },
  demoIcon: { color: colors.ink, fontFamily: fonts.body, fontSize: 22 },
  demoText: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20 },
  demoDetail: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
  message: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, borderLeftWidth: 2, borderLeftColor: colors.orange, paddingLeft: 10 },
});
