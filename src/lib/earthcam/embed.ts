export const EARTHCAM_SHARE_HOST = 'share.earthcam.net';

export type EarthCamEmbedInput = {
  url: string;
  source: 'url' | 'script';
};

function htmlDecode(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractScriptSrc(input: string): string | null {
  const match = input.match(/<script\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*>/i);
  return match?.[2] ? htmlDecode(match[2]) : null;
}

export function extractEarthCamEmbedUrl(input: string): EarthCamEmbedInput {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Paste an EarthCam share URL or embed code.');
  }

  const scriptSrc = extractScriptSrc(trimmed);
  const candidate = scriptSrc ?? trimmed;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('EarthCam embed must be a valid URL or script embed code.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('EarthCam embed URL must use https.');
  }

  if (url.hostname !== EARTHCAM_SHARE_HOST) {
    throw new Error(`EarthCam embed URL must be hosted on ${EARTHCAM_SHARE_HOST}.`);
  }

  return {
    url: url.toString(),
    source: scriptSrc ? 'script' : 'url',
  };
}
