import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { MobilePdfReportRequest } from '@railcommand/domain';
import { mobileApiForUser } from './api';
import { exportAndSharePdf } from './report-export';
import { captureOfflineScope } from './storage-scope';

export async function shareNativePdfReport(userId: string, input: MobilePdfReportRequest, isCurrent: () => boolean) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('Sign in before exporting a report.');
  }
  const offlineCurrent = captureOfflineScope(userId);
  const current = () => isCurrent() && offlineCurrent();
  const requireCurrent = () => {
    if (!current()) throw new Error('Export cancelled because the account, project, or device storage changed.');
  };
  const api = mobileApiForUser(userId, current);
  await exportAndSharePdf(input, {
    isCurrent: current,
    isSharingAvailable: () => Platform.OS === 'web' ? Promise.resolve(false) : Sharing.isAvailableAsync(),
    fetchReport: (selection) => api.exportPdfReport(selection),
    createFile: () => {
      requireCurrent();
      // A local generated filename, never a server-supplied path. The user's
      // existing safe-sign-out cleanup owns this directory as well as photos.
      const directory = new Directory(Paths.document, 'railcommand', userId, 'exports');
      const file = new File(directory, `${input.kind}-report-${Crypto.randomUUID()}.pdf`);
      return {
        uri: file.uri,
        write: (base64) => {
          requireCurrent();
          directory.create({ intermediates: true, idempotent: true });
          file.write(base64, { encoding: 'base64' });
        },
        remove: () => { if (file.exists) file.delete(); },
      };
    },
    share: (uri) => {
      requireCurrent();
      return Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Export RailCommand report' });
    },
  });
}
