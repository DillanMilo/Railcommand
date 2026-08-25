import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { parseMobileDeepLink, type MobileDeepLink } from '@railcommand/domain';
import { supabase } from './supabase';

async function restoreAuthCallback(link: MobileDeepLink): Promise<void> {
  if (link.kind !== 'auth_callback') return;
  if (link.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(link.code);
    if (error) throw error;
    return;
  }
  if (link.accessToken && link.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: link.accessToken,
      refresh_token: link.refreshToken,
    });
    if (error) throw error;
  }
}

export async function registerMobileDeepLinks(
  onLink: (link: MobileDeepLink) => void,
  onError: (error: unknown) => void = () => undefined,
): Promise<PluginListenerHandle> {
  const processLink = async (url: string) => {
    const link = parseMobileDeepLink(url);
    try {
      await restoreAuthCallback(link);
      onLink(link);
    } catch (error) {
      onError(error);
    }
  };
  const handle = await App.addListener('appUrlOpen', ({ url }) => {
    void processLink(url);
  });
  const launch = await App.getLaunchUrl();
  if (launch?.url) await processLink(launch.url);
  return handle;
}
