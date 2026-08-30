import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { parseMobileDeepLink } from '@railcommand/domain';
import { supabase } from '@/lib/supabase';
import { mobileConfig } from '@/lib/config';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  googleEnabled: boolean;
  signIn(email: string, password: string): Promise<string | null>;
  signInWithGoogle(): Promise<string | null>;
  requestPasswordReset(email: string): Promise<string | null>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(new URL('/auth/v1/settings', mobileConfig.supabaseUrl), {
      headers: { apikey: mobileConfig.publishableKey },
      signal: controller.signal,
    })
      .then(async (response) => response.ok ? response.json() as Promise<{ external?: { google?: boolean } }> : null)
      .then((settings) => setGoogleEnabled(settings?.external?.google === true))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url) return;
      try {
        const link = parseMobileDeepLink(url, [mobileConfig.linkHost]);
        if (link.kind === 'invitation') {
          const current = (await supabase.auth.getSession()).data.session;
          if (current) router.replace(`/invitation/${link.token}`);
          else router.replace({ pathname: '/sign-in', params: { inviteToken: link.token } });
          return;
        }
        // Expo Router owns auth-callback navigation. The callback screen
        // performs the one-time exchange so cold starts cannot race a second
        // listener and consume the same PKCE code twice.
        if (link.kind === 'auth_callback') return;
      } catch {
        router.replace({ pathname: '/sign-in', params: { error: 'That sign-in link is invalid or expired.' } });
      }
    };
    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', ({ url }) => void handle(url));
    return () => subscription.remove();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    loading,
    googleEnabled,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error?.message ?? null;
    },
    signInWithGoogle: async () => {
      if (!googleEnabled) return 'Google sign-in is not enabled for this RailCommand environment.';
      const redirectTo = new URL('/auth/callback', `https://${mobileConfig.linkHost}`).toString();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) return error.message;
      if (!data.url) return 'Google sign-in could not be started.';
      try {
        await Linking.openURL(data.url);
        return null;
      } catch {
        return 'Google sign-in could not open the secure browser.';
      }
    },
    requestPasswordReset: async (email) => {
      const redirectTo = new URL('/auth/callback', `https://${mobileConfig.linkHost}`);
      redirectTo.searchParams.set('type', 'recovery');
      redirectTo.searchParams.set('next', '/reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectTo.toString(),
      });
      return error?.message ?? null;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
  }), [googleEnabled, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
