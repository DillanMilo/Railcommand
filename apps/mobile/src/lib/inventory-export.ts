import {
  prepareInventoryCsv,
  type InventoryCsvReport,
} from "@railcommand/domain";
export type InventoryCsvShareDependencies = {
  current(): boolean;
  online(): boolean;
  sharingAvailable(): Promise<boolean>;
  read(): Promise<InventoryCsvReport>;
  createFile(): { uri: string; write(csv: string): void; remove(): void };
  share(uri: string): Promise<void>;
};
export async function exportAndShareInventoryCsv(
  projectId: string,
  deps: InventoryCsvShareDependencies,
) {
  const report = await prepareInventoryCsv(projectId, {
    ...deps,
    read: async () => {
      if (!(await deps.sharingAvailable()))
        throw new Error("File sharing is unavailable on this device.");
      if (!deps.current() || !deps.online())
        throw new Error("Account or connection changed; export cancelled.");
      return deps.read();
    },
  });
  const file = deps.createFile();
  try {
    file.write(report.csv);
    if (!deps.current() || !deps.online())
      throw new Error("Account or connection changed; export cancelled.");
    await deps.share(file.uri);
  } finally {
    file.remove();
  }
}
