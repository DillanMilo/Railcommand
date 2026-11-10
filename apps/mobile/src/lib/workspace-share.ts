import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { WorkspaceFile } from './workspace-policy';

export async function shareWorkspaceFile(userId: string, transfer: WorkspaceFile, base64: string, current: () => boolean) {
  if (!current() || !/^[a-f0-9-]{36}$/i.test(userId)) return;
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  if (!current()) return;
  const directory = new Directory(Paths.document, 'railcommand', userId, 'exports', Crypto.randomUUID());
  const file = new File(directory, transfer.name);
  try {
    directory.create({ intermediates: true, idempotent: true });
    file.write(base64, { encoding: 'base64' });
    if (!current()) return;
    await Sharing.shareAsync(file.uri, { mimeType: transfer.mime, dialogTitle: 'Save or share RailCommand export' });
  } finally { if (directory.exists) directory.delete(); }
}
