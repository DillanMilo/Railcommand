import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { mobileApiForUser } from "./api";
import { captureOfflineScope } from "./storage-scope";
import { exportAndShareInventoryCsv } from "./inventory-export";

export async function shareNativeInventoryCsv(
  userId: string,
  projectId: string,
  isCurrent: () => boolean,
  online: () => boolean,
) {
  if (!/^[a-f0-9-]{36}$/i.test(userId))
    throw new Error("Sign in before exporting.");
  const storageCurrent = captureOfflineScope(userId);
  const current = () => isCurrent() && storageCurrent();
  const requireCurrent = () => {
    if (!current() || !online())
      throw new Error("Account or connection changed; export cancelled.");
  };
  const api = mobileApiForUser(userId, current);
  await exportAndShareInventoryCsv(projectId, {
    current,
    online,
    sharingAvailable: () =>
      Platform.OS === "web"
        ? Promise.resolve(false)
        : Sharing.isAvailableAsync(),
    read: () => api.exportInventoryCsv(projectId),
    createFile: () => {
      requireCurrent();
      // Existing safe sign-out cleanup also owns this user-scoped exports folder.
      const dir = new Directory(
        Paths.document,
        "railcommand",
        userId,
        "exports",
      );
      const file = new File(dir, `material-costs-${Crypto.randomUUID()}.csv`);
      return {
        uri: file.uri,
        write: (csv: string) => {
          requireCurrent();
          dir.create({ intermediates: true, idempotent: true });
          file.write(csv);
        },
        remove: () => {
          if (file.exists) file.delete();
        },
      };
    },
    share: (uri) => {
      requireCurrent();
      return Sharing.shareAsync(uri, {
        mimeType: "text/csv",
        UTI: "public.comma-separated-values-text",
        dialogTitle: "Save material cost CSV",
      });
    },
  });
}
