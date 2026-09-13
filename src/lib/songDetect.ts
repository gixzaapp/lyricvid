import { requireOptionalNativeModule } from 'expo-modules-core';
import { deleteAsync, getInfoAsync } from 'expo-file-system/legacy';

import { getAuddClipSeconds, recognizeWithAudd, type AuddMatch } from '@/lib/audd';
import { getLyricsById, searchLyrics } from '@/lib/lrclib';
import type { LrclibTrack } from '@/types';

type NativeExport = {
  extractAudioClip: (sourceUri: string, startSeconds: number, durationSeconds: number) => Promise<string>;
};

const nativeExport = requireOptionalNativeModule<NativeExport>('VideoLyricExport');
const SMALL_AUDIO_BYTES = 8 * 1024 * 1024;

export type DetectedSong = {
  match: AuddMatch;
  tracks: LrclibTrack[];
};

export function clipStartSeconds(currentTime: number, mediaDuration: number, clipSeconds: number) {
  if (mediaDuration > 0) {
    const latestStart = Math.max(0, mediaDuration - clipSeconds);
    return Math.max(0, Math.min(currentTime, latestStart));
  }
  return Math.max(0, currentTime);
}

async function extractClip(sourceUri: string, startSeconds: number, durationSeconds: number) {
  if (nativeExport?.extractAudioClip) {
    return nativeExport.extractAudioClip(sourceUri, startSeconds, durationSeconds);
  }

  const info = await getInfoAsync(sourceUri);
  const size = 'size' in info && typeof info.size === 'number' ? info.size : 0;
  const isSmallAudio = /\.(mp3|m4a|aac|wav)$/i.test(sourceUri) && size > 0 && size <= SMALL_AUDIO_BYTES;
  if (isSmallAudio) {
    return sourceUri;
  }

  throw new Error(
    'Song detection needs the AI LyricVid app build so it can cut a short audio clip. Expo Go cannot do this.',
  );
}

export async function detectSongFromMedia(input: {
  sourceUri: string;
  currentTime: number;
  mediaDuration: number;
}): Promise<DetectedSong> {
  const clipSeconds = getAuddClipSeconds();
  const start = clipStartSeconds(input.currentTime, input.mediaDuration, clipSeconds);
  const clipUri = await extractClip(input.sourceUri, start, clipSeconds);

  try {
    const match = await recognizeWithAudd(clipUri);
    if (!match) {
      throw new Error('AudD did not recognize this clip. Try another point in the video, or search by name.');
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
  } finally {
    if (clipUri !== input.sourceUri && clipUri.includes('lyricvid-detect-')) {
      await deleteAsync(clipUri, { idempotent: true }).catch(() => undefined);
    }
  }
}

export async function loadDetectedTrack(item: LrclibTrack) {
  return getLyricsById(item.id);
}
