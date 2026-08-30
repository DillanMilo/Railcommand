const QUOTA_ERROR_NAMES = new Set([
  'QuotaExceededError',
  'NS_ERROR_DOM_QUOTA_REACHED',
]);

export function isOfflineStorageQuotaError(error: unknown): boolean {
  let current = error;
  const visited = new Set<unknown>();

  while (current && !visited.has(current)) {
    visited.add(current);
    if (current instanceof DOMException && QUOTA_ERROR_NAMES.has(current.name)) return true;
    if (current instanceof Error) {
      if (QUOTA_ERROR_NAMES.has(current.name)) return true;
      if (/quota|storage.+full|disk.+full/i.test(current.message)) return true;
      current = current.cause;
      continue;
    }
    if (typeof current === 'object') {
      const record = current as { name?: unknown; message?: unknown; cause?: unknown };
      if (typeof record.name === 'string' && QUOTA_ERROR_NAMES.has(record.name)) return true;
      if (typeof record.message === 'string' && /quota|storage.+full|disk.+full/i.test(record.message)) {
        return true;
      }
      current = record.cause;
      continue;
    }
    break;
  }

  return false;
}

export function getOfflineStorageErrorMessage(error: unknown): string {
  if (isOfflineStorageQuotaError(error)) {
    return 'This device is nearly full and could not save the latest offline changes. Keep this page open, remove unneeded device storage or photos, and try again.';
  }
  return error instanceof Error
    ? error.message
    : 'RailCommand could not save the latest changes on this device.';
}
