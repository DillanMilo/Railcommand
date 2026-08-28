import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { BrandHeader, Card, Screen, SecondaryButton, uiStyles } from '@/components/ui';
import { consumeAuthCallback } from '@/lib/deep-links';

export default function CallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    token_hash?: string | string[];
    type?: string | string[];
    next?: string | string[];
    access_token?: string | string[];
    refresh_token?: string | string[];
  }>();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const first = useCallback((value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value, []);
  const callbackUrl = useMemo(() => {
    const url = new URL('railcommand://auth/callback');
    for (const key of ['code', 'token_hash', 'type', 'next'] as const) {
      const value = first(params[key]);
      if (value) url.searchParams.set(key, value);
    }
    const accessToken = first(params.access_token);
    const refreshToken = first(params.refresh_token);
    if (accessToken && refreshToken) {
      url.hash = new URLSearchParams({
        access_token: accessToken,
        refresh_token: refreshToken,
        ...(first(params.type) ? { type: first(params.type)! } : {}),
      }).toString();
    }
    return url.toString();
  }, [first, params]);
  const leaveCallback = useCallback(() => router.replace('/sign-in'), []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void consumeAuthCallback(callbackUrl)
      .then((result) => {
        if (result === 'password-reset') router.replace('/reset-password');
        else if (result === 'authenticated') router.replace('/(tabs)');
        else setError('This RailCommand link is not supported.');
      })
      .catch(() => setError('This password reset link is invalid, expired, or has already been used.'));
  }, [callbackUrl]);

  return <Screen>
    <BrandHeader eyebrow="SECURE LINK" title="RailCommand" />
    <Card>
    {!error ? <ActivityIndicator /> : null}
    <Text accessibilityLiveRegion="polite" style={uiStyles.muted}>{error ?? 'Verifying your RailCommand link…'}</Text>
    {error ? <SecondaryButton title="Request a new reset link" onPress={leaveCallback} /> : null}
    </Card>
  </Screen>;
}
