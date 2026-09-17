export const MAX_WORKSPACE_FILE = 20 * 1024 * 1024;
export const WORKSPACE_CHUNK = 262144;
export function workspaceDestination(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1500 || /[\\%#\x00-\x20]/.test(value)) return '/dashboard';
  if (!/^\/(dashboard|projects|search|settings|client|admin|invite|onboarding)(?:[/?]|$)/.test(value)) return '/dashboard';
  const parsed = new URL(value, 'https://workspace.invalid');
  return parsed.origin === 'https://workspace.invalid' && parsed.pathname === value.split('?')[0] ? value : '/dashboard';
}
export function sameWorkspaceOrigin(url: string, origin: string): boolean {
  try { return new URL(url).origin === new URL(origin).origin && new URL(url).protocol === 'https:'; } catch { return false; }
}
export type WorkspaceFile = { id: string; name: string; mime: string; size: number; chunks: string[]; next: number; received: number };
export function beginWorkspaceFile(message: Record<string, unknown>): WorkspaceFile {
  if (typeof message.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(message.id) || !Number.isSafeInteger(message.size) || Number(message.size) < 1 || Number(message.size) > MAX_WORKSPACE_FILE) throw new Error('This file is too large for mobile export. Use the website for files over 20 MB.');
  const name = typeof message.name === 'string' ? message.name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(-120) : 'railcommand-export';
  const mime = typeof message.mime === 'string' && /^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+(?:;charset=[a-zA-Z0-9-]+)?$/.test(message.mime) ? message.mime.split(';')[0] : 'application/octet-stream';
  return { id: message.id, name: name.replace(/^\.+/, '') || 'railcommand-export', mime, size: Number(message.size), chunks: [], next: 0, received: 0 };
}
export function appendWorkspaceChunk(file: WorkspaceFile, message: Record<string, unknown>) {
  const chunk = message.data;
  if (message.id !== file.id || message.index !== file.next || typeof chunk !== 'string' || chunk.length < 4 || chunk.length > WORKSPACE_CHUNK || chunk.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(chunk) || file.chunks.at(-1)?.includes('=') || file.received + chunk.length > 4 * Math.ceil(file.size / 3)) throw new Error('The export was incomplete. Please export it again.');
  file.chunks.push(chunk); file.received += chunk.length; file.next++;
}
export function finishWorkspaceFile(file: WorkspaceFile, id: unknown): string {
  const base64 = file.chunks.join('');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  if (id !== file.id || base64.length / 4 * 3 - padding !== file.size) throw new Error('The export was incomplete. Please export it again.');
  return base64;
}
