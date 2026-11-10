import { useCallback } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { mobileApiForUser } from '@/lib/api';
import { mobileConfig } from '@/lib/config';
import { createAppUpdateChecker, openTestFlight } from '@/lib/app-update';

const checkForUpdate = createAppUpdateChecker();

const safeByDefault = () => true;

/** Render only on safe, focused screens. Workspace editing/export state disables
 * the check; native creation/review forms do not mount this component. */

export function AppUpdatePrompt({ enabled, canPrompt = safeByDefault }: { enabled: boolean; canPrompt?: () => boolean }) {
  const { session, sessionRevision, isSessionCurrent } = useAuth();
  const userId = session?.user.id;
  useFocusEffect(useCallback(() => {
    let focused = true;
    const current = () => focused && enabled && !!userId
      && AppState.currentState === 'active' && canPrompt() && isSessionCurrent(userId, sessionRevision);
    const check = () => {
      if (!userId || !current()) return;
      const client = mobileApiForUser(userId, current);
      void checkForUpdate({
        installed: { platform: Platform.OS, profile: mobileConfig.profile,
          applicationId: Application.applicationId, buildNumber: Application.nativeBuildVersion },
        isCurrent: current,
        fetchRelease: (signal) => client.getAppRelease(signal),
        show: () => Alert.alert('Update available',
          'A new version of RailCommand is ready in TestFlight. Save any open work before updating. Saved drafts and queued work stay on this device.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Update', onPress: () => {
              // The user chooses to leave; never reload, reset or install here.
              void openTestFlight((url) => Linking.openURL(url)).catch(() => {
                Alert.alert('Could not open TestFlight', 'Open TestFlight and select RailCommand to update. Your saved work is unchanged.');
              });
            } },
          ]),
      });
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') check(); });
    return () => { focused = false; subscription.remove(); };
  }, [canPrompt, enabled, isSessionCurrent, sessionRevision, userId]));
  return null;
}
