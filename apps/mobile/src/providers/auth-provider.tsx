import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { consumeAuthCallback } from '@/lib/deep-links';
import { parseMobileDeepLink } from '@railcommand/domain';
import { supabase } from '@/lib/supabase';
import { mobileConfig } from '@/lib/config';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<string | null>;
  requestPasswordReset(email: string): Promise<string | null>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
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
        const result = await consumeAuthCallback(url);
        if (result === 'password-reset') router.replace('/reset-password');
        else if (result === 'authenticated') router.replace('/');
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
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error?.message ?? null;
    },
    requestPasswordReset: async (email) => {
      const redirectTo = Linking.createURL('/auth/callback', { queryParams: { next: '/reset-password' } });
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      return error?.message ?? null;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
