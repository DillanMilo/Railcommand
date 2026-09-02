import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { parseMobileDeepLink } from '@railcommand/domain';
import { supabase } from '@/lib/supabase';
import { mobileConfig } from '@/lib/config';

type AuthContextValue = {
  session: Session | null;
  sessionRevision: number;
  isSessionCurrent(userId: string | null, revision: number): boolean;
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
  const [sessionRevision, setSessionRevision] = useState(0);
  const owner = useRef({ userId: null as string | null, revision: 0 });
  const [loading, setLoading] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    let current = true;
    let authEventObserved = false;
    const accept = (next: Session | null) => {
      if (!current) return;
      const userId = next?.user.id ?? null;
      if (userId !== owner.current.userId) {
        owner.current = { userId, revision: owner.current.revision + 1 };
        setSessionRevision(owner.current.revision);
      }
      setSession(next);
      setLoading(false);
    };
    void supabase.auth.getSession().then(({ data }) => {
      if (!authEventObserved) accept(data.session);
    }).catch(() => { if (current && !authEventObserved) setLoading(false); });
    // Synchronous invalidation also covers A -> B -> A events batched before a
    // React render; comparing only the final user ID would revive old requests.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventObserved = true;
      accept(next);
    });
    return () => {
      current = false;
      owner.current = { userId: null, revision: owner.current.revision + 1 };
      data.subscription.unsubscribe();
    };
  }, []);

  const isSessionCurrent = useCallback((userId: string | null, revision: number) =>
    owner.current.userId === userId && owner.current.revision === revision, []);

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
    sessionRevision,
    isSessionCurrent,
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
  }), [googleEnabled, isSessionCurrent, loading, session, sessionRevision]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
