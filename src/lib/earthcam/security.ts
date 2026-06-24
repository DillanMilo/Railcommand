import crypto from 'node:crypto';

type EncryptedParts = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export type EarthCamAccessPayload = {
  url: string;
  projectId: string;
  subjectId: string;
  subjectType: 'camera' | 'evidence';
  expiresAt: string;
};

function getSecretMaterial(): string {
  return process.env.EARTHCAM_ENCRYPTION_KEY || process.env.EARTHCAM_SIGNING_SECRET || '';
}

function getLegacySecretMaterial(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function getKey(): Buffer {
  const secret = getSecretMaterial();
  if (!secret) {
    throw new Error('EARTHCAM_ENCRYPTION_KEY is required before storing or signing EarthCam credentials');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function getConfiguredKey(): Buffer | null {
  const secret = getSecretMaterial();
  return secret ? crypto.createHash('sha256').update(secret).digest() : null;
}

function getLegacyKey(): Buffer | null {
  const secret = getLegacySecretMaterial();
  return secret ? crypto.createHash('sha256').update(secret).digest() : null;
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function encryptSecret(value: string): EncryptedParts {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: toBase64Url(ciphertext),
    iv: toBase64Url(iv),
    tag: toBase64Url(tag),
  };
}

export function decryptSecret(parts: {
  ciphertext?: string | null;
  iv?: string | null;
  tag?: string | null;
}): string | null {
  if (!parts.ciphertext || !parts.iv || !parts.tag) return null;

  const keys = [getConfiguredKey(), getLegacyKey()].filter((key): key is Buffer => Boolean(key));

  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, fromBase64Url(parts.iv));
      decipher.setAuthTag(fromBase64Url(parts.tag));

      return Buffer.concat([
        decipher.update(fromBase64Url(parts.ciphertext)),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Try the legacy key during rotation from service-role-derived encryption.
    }
  }

  return null;
}

export function createEarthCamAccessToken(payload: EarthCamAccessPayload): string {
  const encrypted = encryptSecret(JSON.stringify(payload));
  return `${encrypted.iv}.${encrypted.tag}.${encrypted.ciphertext}`;
}

export function signEarthCamTargetUrl(url: string, signingSecret: string, expiresAt: string): string {
  const target = new URL(url);
  const expires = String(Math.floor(new Date(expiresAt).getTime() / 1000));
  target.searchParams.set('rc_expires', expires);

  const signatureBase = `${target.origin}${target.pathname}?${target.searchParams.toString()}`;
  const signature = crypto
    .createHmac('sha256', signingSecret)
    .update(signatureBase)
    .digest('base64url');

  target.searchParams.set('rc_signature', signature);
  return target.toString();
}

export function readEarthCamAccessToken(token: string): EarthCamAccessPayload | null {
  const [iv, tag, ciphertext] = token.split('.');
  if (!iv || !tag || !ciphertext) return null;

  try {
    const payload = JSON.parse(decryptSecret({ ciphertext, iv, tag }) ?? '{}') as EarthCamAccessPayload;
    if (!payload.url || !payload.expiresAt) return null;
    if (new Date(payload.expiresAt).getTime() <= Date.now()) return null;

    const url = new URL(payload.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

    return payload;
  } catch {
    return null;
  }
}
