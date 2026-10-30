/** DFR display only. Keep ISO dates in storage, inputs, and queued payloads. */
export const MAX_PHOTO_CAPTION_LENGTH = 500;

export function formatDfrDate(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return '—';
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return '—';
  return `${month}/${day}/${year}`;
}

export function formatDfrTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${formatDfrDate(day)}, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

export function dfrPhotoLabel(reportDate: string, caption?: string | null): string {
  return caption?.trim() || formatDfrDate(reportDate);
}

export function isValidPhotoCaption(value: unknown): value is string | null | undefined {
  return value == null || (typeof value === 'string' && value.length <= MAX_PHOTO_CAPTION_LENGTH);
}

/** Preserve partial/invalid input locally; validation still gates submission. */
export function dfrDateInputToIso(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return value;
  const iso = `${match[3]}-${match[1]}-${match[2]}`;
  return formatDfrDate(iso) === '—' ? value : iso;
}

export function formatDfrDateInput(value: string): string {
  return formatDfrDate(value) === '—' ? value : formatDfrDate(value);
}
