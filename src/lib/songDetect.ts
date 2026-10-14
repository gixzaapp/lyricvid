import { getLyricsById, searchLyrics } from '@/lib/lrclib';
import { getShazamClipSeconds, recognizeWithShazam, type SongMatch } from '@/lib/shazam';
import type { LrclibTrack } from '@/types';

export type DetectedSong = {
  match: SongMatch;
  tracks: LrclibTrack[];
};

export function clipStartSeconds(currentTime: number, mediaDuration: number, clipSeconds: number) {
  if (mediaDuration > 0) {
    const latestStart = Math.max(0, mediaDuration - clipSeconds);
    return Math.max(0, Math.min(currentTime, latestStart));
  }
  return Math.max(0, currentTime);
}

export async function detectSongFromMedia(input: {
  sourceUri: string;
  currentTime: number;
  mediaDuration: number;
}): Promise<DetectedSong> {
  const clipSeconds = getShazamClipSeconds();
  const start = clipStartSeconds(input.currentTime, input.mediaDuration, clipSeconds);
  const match = await recognizeWithShazam({
    sourceUri: input.sourceUri,
    startSeconds: start,
    durationSeconds: clipSeconds,
  });
  if (!match) {
    throw new Error('detect.unrecognized');
  }

  const found = await searchLyrics({
    trackName: match.title,
    artistName: match.artist,
  });
  const tracks = [...found].sort((a, b) => {
    const sync = Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics));
    if (sync !== 0) return sync;
    return (b.duration || 0) - (a.duration || 0);
  });

  return { match, tracks };
}

export async function loadDetectedTrack(item: LrclibTrack) {
  return getLyricsById(item.id);
}
