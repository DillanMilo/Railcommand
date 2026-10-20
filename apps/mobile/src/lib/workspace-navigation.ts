import { router } from 'expo-router';
import { workspaceDestination } from './workspace-policy';

let request = 0;
/** Return to the account-scoped workspace instead of stacking a new WebView. */
export function openWorkspace(path = '/dashboard') {
  router.dismissTo({ pathname: '/workspace', params: { path: workspaceDestination(path), request: String(++request) } });
}
