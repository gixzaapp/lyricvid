export type AuddMatch = {
  title: string;
  artist: string;
  album: string;
};

type AuddErrorBody = {
  error_code?: number;
  error_message?: string;
};

type AuddResult = {
  title?: string;
  artist?: string;
  album?: string;
};

type AuddResponse = {
  status?: string;
  result?: AuddResult | AuddResult[] | null;
  error?: AuddErrorBody;
};

const DEFAULT_API_URL = 'https://api.audd.io/';
const DEFAULT_CLIP_SECONDS = 12;

export function getAuddApiToken() {
  return process.env.EXPO_PUBLIC_AUDD_API_TOKEN ?? '';
}

export function getAuddApiUrl() {
  const url = process.env.EXPO_PUBLIC_AUDD_API_URL ?? DEFAULT_API_URL;
  return url.endsWith('/') ? url : `${url}/`;
}

export function getAuddClipSeconds() {
  const parsed = Number(process.env.EXPO_PUBLIC_AUDD_CLIP_SECONDS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CLIP_SECONDS;
  }
  return Math.min(20, Math.max(6, parsed));
}

export function isAuddEnabled() {
  const flag = process.env.EXPO_PUBLIC_AUDD_ENABLED;
  if (flag === '0' || flag === 'false') {
    return false;
  }
  return getAuddApiToken().trim().length > 0;
}

export async function recognizeWithAudd(fileUri: string): Promise<AuddMatch | null> {
  const token = getAuddApiToken().trim();
  if (!token) {
    throw new Error('Set EXPO_PUBLIC_AUDD_API_TOKEN in .env to enable song detection.');
  }

  const form = new FormData();
  form.append('api_token', token);
  form.append('file', {
    uri: fileUri,
    name: fileNameForUri(fileUri),
    type: mimeForUri(fileUri),
  } as unknown as Blob);

  const response = await fetch(getAuddApiUrl(), {
    method: 'POST',
    body: form,
  });

  let payload: AuddResponse;
  try {
    payload = (await response.json()) as AuddResponse;
  } catch {
    throw new Error('AudD returned an invalid response.');
  }

  if (payload.status === 'error' || payload.error) {
    throw new Error(payload.error?.error_message || `AudD request failed (${response.status}).`);
  }

  const raw = Array.isArray(payload.result) ? payload.result[0] : payload.result;
  const title = raw?.title?.trim();
  const artist = raw?.artist?.trim();
  if (!title || !artist) {
    return null;
  }

  return {
    title,
    artist,
    album: raw?.album?.trim() ?? '',
  };
}

function fileNameForUri(uri: string) {
  const name = uri.split('/').pop()?.split('?')[0] ?? 'clip.m4a';
  return name || 'clip.m4a';
}

function mimeForUri(uri: string) {
  const lower = fileNameForUri(uri).toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  return 'audio/mp4';
}
