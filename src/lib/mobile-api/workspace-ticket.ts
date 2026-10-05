import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const LIFETIME = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type WorkspaceTicket = { sub: string; tokenHash: string; next: string; exp: number };

export function workspacePath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1500 || /[\\%#\x00-\x20]/.test(value)) return '/dashboard';
  if (!/^\/(dashboard|projects|search|settings|client|admin|invite|onboarding)(?:[/?]|$)/.test(value)) return '/dashboard';
  const parsed = new URL(value, 'https://workspace.invalid');
  return parsed.origin === 'https://workspace.invalid' && parsed.pathname === value.split('?')[0] ? value : '/dashboard';
}
function key(secret: string): Buffer {
  if (secret.length < 32) throw new Error('Workspace is not configured.');
  return createHash('sha256').update('railcommand.workspace.v1\0').update(secret).digest();
}
export function sealWorkspaceTicket(input: Omit<WorkspaceTicket, 'exp'>, secret: string, now = Date.now()): string {
  if (!UUID.test(input.sub) || !input.tokenHash || input.tokenHash.length > 512) throw new Error('Invalid workspace identity.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from('railcommand.workspace.v1'));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ ...input, next: workspacePath(input.next), exp: now + LIFETIME })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function openWorkspaceTicket(value: unknown, secret: string, now = Date.now()): WorkspaceTicket {
  if (typeof value !== 'string' || value.length > 4096 || !/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error('Invalid workspace ticket.');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length < 29) throw new Error('Invalid workspace ticket.');
  const cipher = createDecipheriv('aes-256-gcm', key(secret), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from('railcommand.workspace.v1'));
  cipher.setAuthTag(bytes.subarray(12, 28));
  const result = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString()) as WorkspaceTicket;
  if (!UUID.test(result.sub) || typeof result.tokenHash !== 'string' || !result.tokenHash || result.tokenHash.length > 512 || !Number.isFinite(result.exp) || result.exp <= now || result.exp > now + LIFETIME || workspacePath(result.next) !== result.next) throw new Error('Expired or invalid workspace ticket.');
  return result;
}
export function workspacePostAllowed(request: Request): boolean {
  const origin = request.headers.get('origin');
  return request.headers.get('sec-fetch-site') !== 'cross-site'
    && (!origin || origin === new URL(request.url).origin)
    && request.headers.get('content-type')?.split(';')[0] === 'application/x-www-form-urlencoded';
}
