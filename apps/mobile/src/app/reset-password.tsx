import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { BrandHeader, Card, Field, PrimaryButton, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState(''); const [message, setMessage] = useState('Choose a new password for your organization account.');
  const submit = async () => { const { error } = await supabase.auth.updateUser({ password });
    if (error) setMessage(error.message); else router.replace('/'); };
  return <Screen><BrandHeader eyebrow="ACCOUNT RECOVERY" title="Reset password" /><Card><Text accessibilityLiveRegion="polite" style={uiStyles.muted}>{message}</Text><Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
    <PrimaryButton title="Update password" onPress={() => void submit()} disabled={password.length < 8} /></Card></Screen>;
}
