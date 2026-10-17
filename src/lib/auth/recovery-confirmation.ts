// Shared with Edge middleware; keep this module free of Node/server-only imports.
export const RECOVERY_CONFIRMATION_HEADER = 'x-rc-recovery-confirmation';
export const RECOVERY_CONFIRMATION_TTL_SECONDS = 15 * 60;

export function recoveryConfirmationCookieName(): string {
  return process.env.NODE_ENV === 'production'
    ? '__Host-rc-recovery-confirmation'
    : 'rc-recovery-confirmation';
}

export function createRecoveryConfirmationNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

export function isRecoveryConfirmationNonce(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}
