import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type SongMatch = {
  title: string;
  artist: string;
  album: string;
};

type NativeExport = {
  songRecognitionAvailable?: boolean;
  isSongRecognitionAvailable?: () => boolean;
  recognizeSong?: (
    sourceUri: string,
    startSeconds: number,
    durationSeconds: number,
    developerToken?: string,
  ) => Promise<SongMatch | null>;
};

const nativeExport = requireOptionalNativeModule<NativeExport>('VideoLyricExport');
const DEFAULT_CLIP_SECONDS = 12;

export function getShazamDeveloperToken() {
  return process.env.EXPO_PUBLIC_SHAZAM_DEVELOPER_TOKEN?.trim() ?? '';
}

export function getShazamClipSeconds() {
  const parsed = Number(process.env.EXPO_PUBLIC_SHAZAM_CLIP_SECONDS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CLIP_SECONDS;
  }
  return Math.min(12, Math.max(6, parsed));
}

export function isShazamEnabled() {
  const flag = process.env.EXPO_PUBLIC_SHAZAM_ENABLED;
  if (flag === '0' || flag === 'false') {
    return false;
  }
  if (!nativeExport?.recognizeSong) {
    return false;
  }
  const nativeOn =
    nativeExport.isSongRecognitionAvailable?.() ?? nativeExport.songRecognitionAvailable === true;
  if (Platform.OS === 'ios') {
    return nativeExport.songRecognitionAvailable !== false;
  }
  return Boolean(getShazamDeveloperToken() || nativeOn);
}

export async function recognizeWithShazam(input: {
  sourceUri: string;
  startSeconds: number;
  durationSeconds: number;
}): Promise<SongMatch | null> {
  if (!nativeExport?.recognizeSong) {
    throw new Error('detect.needsBuild');
  }
  if (Platform.OS === 'android' && !isShazamEnabled()) {
    throw new Error('detect.noToken');
  }

  const match = await nativeExport.recognizeSong(
    input.sourceUri,
    input.startSeconds,
    input.durationSeconds,
    getShazamDeveloperToken() || undefined,
  );
  const title = match?.title?.trim();
  const artist = match?.artist?.trim();
  if (!title || !artist) {
    return null;
  }
  return {
    title,
    artist,
    album: match?.album?.trim() ?? '',
  };
}
