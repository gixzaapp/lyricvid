import { LegacyEventEmitter, requireOptionalNativeModule } from 'expo-modules-core';
import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Dimensions, Share } from 'react-native';

import { wordsForLine } from '@/lib/lyrics';
import { assTimestamp, srtTimestamp } from '@/lib/time';
import { colors } from '@/theme';
import type { LyricLine, SubtitleStyle } from '@/types';

type NativeExport = {
  exportVideo: (options: Record<string, unknown>) => Promise<string>;
  addListener?: (event: string, listener: (payload: { progress?: number }) => void) => { remove: () => void };
};

function subscribeExportProgress(onProgress: (progress: number) => void) {
  if (!nativeExport) {
    return { remove() {} };
  }
  const handler = (payload: { progress?: number }) => {
    if (typeof payload?.progress === 'number') {
      onProgress(Math.max(0, Math.min(1, payload.progress)));
    }
  };
  if (typeof nativeExport.addListener === 'function') {
    return nativeExport.addListener('onExportProgress', handler);
  }
  return new LegacyEventEmitter(nativeExport).addListener('onExportProgress', handler);
}

export const HIRES_AUDIO_MESSAGE =
  'This audio is Hi-Res. Choose a lo-res file (44.1 or 48 kHz), then export again.';

export function isHiResAudioError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
  return code.includes('HIRES_AUDIO') || message.includes('HIRES_AUDIO');
}

const nativeExport = requireOptionalNativeModule<NativeExport>('VideoLyricExport');

function wordCues(lyrics: LyricLine[], offset: number, duration: number) {
  return lyrics.flatMap((_, lineIndex) => {
    const words = wordsForLine(lyrics, lineIndex, duration);
    return words.map((word, wordIndex) => {
      const start = Math.max(0, word.timestamp + offset);
      const next = words[wordIndex + 1];
      const end = next
        ? Math.max(next.timestamp + offset, start + 0.12)
        : Math.min(start + 0.8, duration || start + 0.8);
      return {
        start,
        end: Math.max(end, start + 0.12),
        text: words
          .slice(0, wordIndex + 1)
          .map((item) => item.text)
          .join(' '),
      };
    });
  });
}

function cssToAssColor(hex: string, alphaHex = '00') {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const r = full.slice(0, 2);
  const g = full.slice(2, 4);
  const b = full.slice(4, 6);
  return `&H${alphaHex}${b}${g}${r}`.toUpperCase();
}

function backgroundToAss(backgroundColor: string | null) {
  if (!backgroundColor) {
    return { borderStyle: 1, back: '&H00000000', outline: '&H00000000' };
  }
  if (backgroundColor.includes('255,255,255')) {
    return { borderStyle: 3, back: '&H00FFFFFF', outline: '&H00FFFFFF' };
  }
  return { borderStyle: 3, back: '&H80000000', outline: '&H80000000' };
}

export function toSrt(lyrics: LyricLine[], offset: number, duration: number) {
  return wordCues(lyrics, offset, duration)
    .map((cue, index) => `${index + 1}\n${srtTimestamp(cue.start)} --> ${srtTimestamp(cue.end)}\n${cue.text}\n`)
    .join('\n');
}

export function toAss(
  lyrics: LyricLine[],
  offset: number,
  duration: number,
  style: SubtitleStyle,
) {
  const playResX = 1080;
  const playResY = 1920;
  const x = Math.round((style.x / 100) * playResX);
  const y = Math.round((style.y / 100) * playResY);
  const bg = backgroundToAss(style.backgroundColor);
  const bold = style.bold ? -1 : 0;
  const italic = style.italic ? -1 : 0;
  const outline = style.outline ? 3 : 0;
  const align = style.align === 'left' ? 1 : style.align === 'right' ? 3 : 2;
  const primary = cssToAssColor(style.color);

  const header = `[Script Info]
Title: AI LyricVid
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${Math.round(style.fontSize * 1.6)},${primary},&H000000FF,${bg.outline},${bg.back},${bold},${italic},0,0,100,100,0,0,${bg.borderStyle},${outline},0,${align},40,40,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = wordCues(lyrics, offset, duration)
    .map((cue) => {
      const escaped = cue.text.replace(/\n/g, '\\N').replace(/[{}]/g, '');
      return `Dialogue: 0,${assTimestamp(cue.start)},${assTimestamp(cue.end)},Default,,0,0,0,,{\\pos(${x},${y})}${escaped}`;
    })
    .join('\n');

  return `${header}\n${events}\n`;
}

export function isVideoExportAvailable() {
  return nativeExport != null;
}

export function exportCues(lyrics: LyricLine[], offset: number, duration: number) {
  return wordCues(lyrics, offset, duration).map((cue) => {
    const parts = cue.text.split(' ');
    const current = parts[parts.length - 1] ?? '';
    const highlightStart = Math.max(0, cue.text.length - current.length);
    return {
      start: cue.start,
      end: cue.end,
      text: cue.text,
      highlightStart,
      highlightEnd: cue.text.length,
    };
  });
}

function isLocalFileUri(uri: string) {
  return uri.startsWith('file:');
}

function sandboxExportsDir() {
  if (!cacheDirectory) {
    throw new Error('App storage is not available on this device.');
  }
  return `${cacheDirectory}exports/`;
}

async function ensureExportsDir() {
  const dir = sandboxExportsDir();
  const info = await getInfoAsync(dir);
  if (!info.exists) {
    await makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

function joinUri(dir: string, filename: string) {
  return `${dir}${filename.replace(/[\\/]/g, '_')}`;
}

async function ensureLocalMedia(uri: string, filename: string) {
  if (uri.startsWith('file:')) {
    const info = await getInfoAsync(uri);
    if (info.exists) {
      return uri;
    }
  }
  const dest = joinUri(await ensureExportsDir(), filename);
  await deleteAsync(dest, { idempotent: true });
  await copyAsync({ from: uri, to: dest });
  const copied = await getInfoAsync(dest);
  if (!copied.exists) {
    throw new Error('Could not copy the video into app storage for export.');
  }
  return dest;
}

async function writeSandboxFile(filename: string, contents: string) {
  const uri = joinUri(await ensureExportsDir(), filename);
  await deleteAsync(uri, { idempotent: true });
  await writeAsStringAsync(uri, contents);
  return uri;
}

async function presentFile(uri: string, filename: string, mimeType: string) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle: filename,
    });
    return;
  }
  throw new Error('Sharing is not available on this device.');
}

async function presentText(filename: string, contents: string, mimeType: string) {
  try {
    const uri = await writeSandboxFile(filename, contents);
    await presentFile(uri, filename, mimeType);
    return uri;
  } catch {
    await Share.share({ title: filename, message: contents });
    return null;
  }
}

export async function writeAndShareFile(filename: string, contents: string, mimeType: string) {
  return presentText(filename, contents, mimeType);
}

export async function shareVideo(uri: string, filename: string) {
  if (!isLocalFileUri(uri)) {
    throw new Error('This video is already on your device. Save the subtitle files and name them to match the video.');
  }
  await presentFile(uri, filename, 'video/mp4');
  return uri;
}

export async function saveTextFileLocally(filename: string, contents: string) {
  const mime = filename.endsWith('.srt') ? 'application/x-subrip' : 'text/plain';
  const uri = await presentText(filename, contents, mime);
  return { uri, canceled: false };
}

export async function saveVideoLocally(sourceUri: string, filename: string) {
  const uri = await shareVideo(sourceUri, filename);
  return { uri, canceled: false };
}

export async function saveAllLocally(input: { stem: string; srt?: string; ass?: string }) {
  const saved: string[] = [];

  if (input.srt) {
    const filename = `${input.stem}.srt`;
    await presentText(filename, input.srt, 'application/x-subrip');
    saved.push(filename);
  }
  if (input.ass) {
    const filename = `${input.stem}.ass`;
    await presentText(filename, input.ass, 'text/plain');
    saved.push(filename);
  }

  return { canceled: saved.length === 0, saved };
}

async function saveToGallery(uri: string) {
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    return false;
  }
  try {
    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch {
    await MediaLibrary.createAssetAsync(uri);
    return true;
  }
}

export async function exportFinalVideo(input: {
  videoUri: string;
  audioUri?: string | null;
  replaceAudio: boolean;
  stem: string;
  lyrics: LyricLine[];
  offset: number;
  duration: number;
  style: SubtitleStyle;
  onProgress?: (progress: number) => void;
}) {
  if (!nativeExport) {
    throw new Error(
      'Finished video export needs the AI LyricVid app build. Expo Go cannot burn lyrics into an MP4. Open the AI LyricVid app installed from the Android/iOS build, then export again.',
    );
  }

  const filename = `${input.stem}-lyricvid.mp4`;
  const report = (value: number) => input.onProgress?.(Math.max(0, Math.min(1, value)));
  report(0.02);
  const outputPath = joinUri(await ensureExportsDir(), filename);
  await deleteAsync(outputPath, { idempotent: true });
  const videoUri = await ensureLocalMedia(input.videoUri, `${input.stem}-source.mp4`);
  report(0.08);
  const audioUri =
    input.replaceAudio && input.audioUri
      ? await ensureLocalMedia(input.audioUri, `${input.stem}-source-audio`)
      : null;
  report(0.1);

  let receivedNativeProgress = false;
  const subscription = subscribeExportProgress((nativeProgress) => {
    receivedNativeProgress = true;
    report(0.1 + nativeProgress * 0.8);
  });
  const startedAt = Date.now();
  const estimatedMs = Math.max(input.duration * 1500, 10_000);
  const fallback = setInterval(() => {
    if (receivedNativeProgress) {
      return;
    }
    const ratio = Math.min(0.85, (Date.now() - startedAt) / estimatedMs);
    report(0.1 + ratio * 0.8);
  }, 250);

  let uri: string;
  try {
    uri = await nativeExport.exportVideo({
      videoUri,
      audioUri,
      replaceAudio: Boolean(audioUri),
      outputPath,
      duration: input.duration,
      fontSize: input.style.fontSize,
      fontFamily: input.style.fontFamily,
      previewWidth: Dimensions.get('window').width,
      color: input.style.color,
      accentColor: colors.accent,
      backgroundColor: input.style.backgroundColor,
      bold: input.style.bold,
      italic: input.style.italic,
      outline: input.style.outline,
      align: input.style.align,
      x: input.style.x,
      y: input.style.y,
      cues: exportCues(input.lyrics, input.offset, input.duration),
    });
    report(0.92);
  } catch (error) {
    if (isHiResAudioError(error)) {
      throw Object.assign(new Error(HIRES_AUDIO_MESSAGE), { code: 'HIRES_AUDIO' });
    }
    throw error;
  } finally {
    clearInterval(fallback);
    subscription.remove();
  }

  if (!uri) {
    throw new Error('The exported video was empty.');
  }

  report(0.95);
  const savedToGallery = await saveToGallery(uri);
  report(1);
  await presentFile(uri, filename, 'video/mp4');
  return { uri, filename, savedToGallery };
}
