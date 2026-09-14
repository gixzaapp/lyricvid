import type { LrclibTrack } from '@/types';

const BASE_URL = 'https://lrclib.net';
const CLIENT = 'LyricVid/1.0 (https://github.com/lyricvid)';

const headers = {
  Accept: 'application/json',
  'User-Agent': CLIENT,
  'X-User-Agent': CLIENT,
  'Lrclib-Client': CLIENT,
};

export class LrclibError extends Error {
  status?: number;
  retryAfter?: number;
  vars?: { seconds?: number; status?: number };

  constructor(message: string, status?: number, retryAfter?: number, vars?: { seconds?: number; status?: number }) {
    super(message);
    this.name = 'LrclibError';
    this.status = status;
    this.retryAfter = retryAfter;
    this.vars = vars;
  }
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { headers });

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After') ?? '1');
    throw new LrclibError('search.rateLimit', 429, retryAfter, { seconds: retryAfter || 1 });
  }

  if (response.status === 404) {
    throw new LrclibError('search.trackNotFound', 404);
  }

  if (!response.ok) {
    throw new LrclibError('search.requestFailed', response.status, undefined, { status: response.status });
  }

  return (await response.json()) as T;
}

function toTrack(raw: Partial<LrclibTrack> & { name?: string; lyricsfile?: string | null }): LrclibTrack {
  return {
    id: raw.id ?? 0,
    trackName: raw.trackName ?? raw.name ?? 'search.unknownTrack',
    artistName: raw.artistName ?? 'search.unknownArtist',
    albumName: raw.albumName ?? '',
    duration: raw.duration ?? 0,
    instrumental: Boolean(raw.instrumental),
    plainLyrics: raw.plainLyrics ?? null,
    syncedLyrics: raw.syncedLyrics ?? null,
    lyricsfile: raw.lyricsfile ?? null,
  };
}

export async function searchLyrics(input: {
  query?: string;
  trackName?: string;
  artistName?: string;
}) {
  const params = new URLSearchParams();
  const trackName = input.trackName?.trim();
  const artistName = input.artistName?.trim();
  const query = input.query?.trim();

  if (query) {
    params.set('q', query);
  } else if (trackName && artistName) {
    params.set('track_name', trackName);
    params.set('artist_name', artistName);
  } else if (trackName) {
    params.set('q', trackName);
  } else {
    return [];
  }

  const results = await request<Array<Partial<LrclibTrack> & { name?: string }>>(
    `/api/search?${params.toString()}`,
  );
  return results.map(toTrack);
}

export async function getLyricsById(id: number) {
  const result = await request<Partial<LrclibTrack> & { name?: string }>(`/api/get/${id}`);
  return toTrack(result);
}
