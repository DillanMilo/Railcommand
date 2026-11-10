import type { MobilePdfReport, MobilePdfReportRequest } from '@railcommand/domain';

type TemporaryPdf = { uri: string; write(base64: string): void; remove(): void };
export type ReportExportDependencies = {
  isCurrent(): boolean;
  isSharingAvailable(): Promise<boolean>;
  fetchReport(input: MobilePdfReportRequest): Promise<MobilePdfReport>;
  createFile(): TemporaryPdf;
  share(uri: string): Promise<void>;
};

export function validatePdfPayload(report: MobilePdfReport, expectedCount: number): void {
  if (report.mimeType !== 'application/pdf' || report.recordCount !== expectedCount
    || !Number.isInteger(report.byteLength) || report.byteLength <= 0 || report.byteLength > 2 * 1024 * 1024
    || typeof report.base64 !== 'string' || report.base64.length > 2_796_204
    || !report.base64.startsWith('JVBERi0') || report.base64.length % 4 !== 0
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(report.base64)) {
    throw new Error('The report response was invalid. No file was shared.');
  }
  const padding = report.base64.endsWith('==') ? 2 : report.base64.endsWith('=') ? 1 : 0;
  if (report.base64.length * 3 / 4 - padding !== report.byteLength) {
    throw new Error('The PDF download was incomplete. Export again when connected.');
  }
}

export async function exportAndSharePdf(input: MobilePdfReportRequest, deps: ReportExportDependencies): Promise<void> {
  const assertCurrent = () => {
    if (!deps.isCurrent()) throw new Error('Export cancelled because the account or project changed.');
  };
  assertCurrent();
  if (!await deps.isSharingAvailable()) throw new Error('PDF sharing is unavailable on this device.');
  assertCurrent();
  const report = await deps.fetchReport(input);
  assertCurrent();
  validatePdfPayload(report, input.recordIds.length);
  const file = deps.createFile();
  try {
    file.write(report.base64);
    assertCurrent();
    await deps.share(file.uri);
  } finally {
    // Cleanup also covers partial writes, a dismissed share sheet, and failures.
    file.remove();
  }
}
