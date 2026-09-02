// A purge ends every previously captured cache/outbox lifetime, even when the
// same account remains signed in (for example after a deletion request).
const scopes = new Map<string, { generation: number; purging: boolean }>();

export function captureOfflineScope(userId: string): () => boolean {
  const generation = scopes.get(userId)?.generation ?? 0;
  return () => (scopes.get(userId)?.generation ?? 0) === generation && !scopes.get(userId)?.purging;
}

export function beginOfflinePurge(userId: string): () => void {
  if (scopes.get(userId)?.purging) throw new Error('Device cleanup is already in progress.');
  const scope = { generation: (scopes.get(userId)?.generation ?? 0) + 1, purging: true };
  scopes.set(userId, scope);
  return () => { scope.purging = false; };
}
