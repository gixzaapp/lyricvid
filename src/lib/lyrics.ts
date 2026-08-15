import type { LyricLine, LyricWord, LrclibTrack, RankedTrack } from '@/types';

const AUTO_MATCH_TOLERANCE = 3;
const TIMESTAMP_RE = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
const WORD_TAG_RE = /<(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?>([^<]*)/g;

let lineCounter = 0;

export function createLineId() {
  lineCounter += 1;
  return `ln_${Date.now()}_${lineCounter}`;
}

function stampToSeconds(minute: string, second: string, fraction?: string) {
  const frac = fraction ? Number(fraction.padEnd(3, '0').slice(0, 3)) / 1000 : 0;
  return Number(minute) * 60 + Number(second) + frac;
}

function unquoteYaml(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function splitLyricTokens(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const spaced = trimmed.split(/\s+/).filter(Boolean);
  if (spaced.length > 1) {
    return spaced;
  }

  const chars = [...trimmed];
  const denseScript = /[\u0900-\u0D7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;
  if (chars.length > 6 && !/\s/.test(trimmed) && denseScript.test(trimmed)) {
    return chars;
  }
  return spaced;
}

export function interpolateWords(text: string, start: number, end: number): LyricWord[] {
  const tokens = splitLyricTokens(text);
  if (tokens.length === 0) {
    return [];
  }
  if (tokens.length === 1) {
    return [{ text: tokens[0], timestamp: start }];
  }
  const span = Math.max(end - start, 0.35);
  const usable = span * 0.88;
  return tokens.map((token, index) => ({
    text: token,
    timestamp: start + (index / tokens.length) * usable,
  }));
}

function parseEnhancedWords(body: string): LyricWord[] {
  const words: LyricWord[] = [];
  for (const match of body.matchAll(WORD_TAG_RE)) {
    const text = match[4].trim();
    if (!text) continue;
    words.push({
      text,
      timestamp: stampToSeconds(match[1], match[2], match[3]),
    });
  }
  return words;
}

export function parseSyncedLyrics(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const raw of lrc.split(/\r?\n/)) {
    const row = raw.trim();
    if (!row) continue;

    const stamps = [...row.matchAll(TIMESTAMP_RE)];
    if (stamps.length === 0) continue;

    const body = row.replace(TIMESTAMP_RE, '').trim();
    const enhanced = parseEnhancedWords(body);
    const text = (enhanced.length ? enhanced.map((word) => word.text).join(' ') : body.replace(WORD_TAG_RE, '').trim());
    if (!text) continue;

    for (const stamp of stamps) {
      lines.push({
        id: createLineId(),
        timestamp: stampToSeconds(stamp[1], stamp[2], stamp[3]),
        text,
        words: enhanced.length ? enhanced : undefined,
      });
    }
  }

  return lines.sort((a, b) => a.timestamp - b.timestamp);
}

export function parsePlainLyrics(plain: string, duration: number): LyricLine[] {
  const rows = plain
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  const step = duration > 0 ? duration / rows.length : 3;
  return rows.map((text, index) => ({
    id: createLineId(),
    timestamp: index * step,
    text,
  }));
}

export function parseLyricsfile(yaml: string): LyricLine[] | null {
  if (!yaml || !yaml.includes('start_ms')) {
    return null;
  }

  const section = yaml.split(/^lines:\s*$/m)[1];
  if (!section) {
    return null;
  }
  const body = section.split(/^plain:\s*$/m)[0];
  const chunks = body
    .split(/^  - /m)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith('text:'));

  if (chunks.length === 0) {
    return null;
  }

  const lines: LyricLine[] = [];
  for (const chunk of chunks) {
    const textMatch = chunk.match(/^text:\s*(.+)$/m);
    if (!textMatch) continue;
    const text = unquoteYaml(textMatch[1]);
    const startMatch = chunk.match(/^start_ms:\s*(\d+(?:\.\d+)?)/m);
    const start = startMatch ? Number(startMatch[1]) / 1000 : 0;

    const wordChunks = chunk.split(/^    - /m).slice(1);
    const words: LyricWord[] = [];
    for (const wordChunk of wordChunks) {
      const wordText = wordChunk.match(/^text:\s*(.+)$/m);
      const wordStart = wordChunk.match(/^start_ms:\s*(\d+(?:\.\d+)?)/m);
      if (!wordText || !wordStart) continue;
      const token = unquoteYaml(wordText[1]).trim();
      if (!token) continue;
      words.push({
        text: token,
        timestamp: Number(wordStart[1]) / 1000,
      });
    }

    lines.push({
      id: createLineId(),
      timestamp: start,
      text,
      words: words.length ? words : undefined,
    });
  }

  return lines.length ? lines : null;
}

export function lyricsFromTrack(track: LrclibTrack, duration: number) {
  if (track.instrumental) {
    return { lyrics: [] as LyricLine[], synced: false, warning: 'This track is marked instrumental.' };
  }

  const fromFile = track.lyricsfile ? parseLyricsfile(track.lyricsfile) : null;
  if (fromFile?.some((line) => line.words?.length)) {
    return { lyrics: fromFile, synced: true, warning: null };
  }

  if (track.syncedLyrics) {
    return { lyrics: parseSyncedLyrics(track.syncedLyrics), synced: true, warning: null };
  }

  if (fromFile?.length) {
    return { lyrics: fromFile, synced: true, warning: null };
  }

  if (track.plainLyrics) {
    return {
      lyrics: parsePlainLyrics(track.plainLyrics, duration),
      synced: false,
      warning: 'Only unsynced lyrics were found. Timestamps were spread evenly — adjust them in the list.',
    };
  }
  return { lyrics: [] as LyricLine[], synced: false, warning: 'No lyrics were attached to this result.' };
}

export function rankTracksByDuration(tracks: LrclibTrack[], duration: number): RankedTrack[] {
  return tracks
    .map((track) => ({
      ...track,
      delta: Math.abs(track.duration - duration),
    }))
    .sort((a, b) => a.delta - b.delta);
}

export function autoSelectTrack(ranked: RankedTrack[]) {
  const close = ranked.filter((track) => track.delta <= AUTO_MATCH_TOLERANCE);
  if (close.length === 1) {
    return close[0];
  }
  return null;
}

export function getActiveLineIndex(lyrics: LyricLine[], time: number, offset: number) {
  const cursor = time - offset;
  let active = -1;
  for (let index = 0; index < lyrics.length; index += 1) {
    if (lyrics[index].timestamp <= cursor) {
      active = index;
    } else {
      break;
    }
  }
  return active;
}

export function getActiveLine(lyrics: LyricLine[], time: number, offset: number) {
  const index = getActiveLineIndex(lyrics, time, offset);
  return index >= 0 ? lyrics[index] : null;
}

export function lineEndTime(lyrics: LyricLine[], index: number, duration: number, offset = 0) {
  const line = lyrics[index];
  const next = lyrics[index + 1];
  const start = line.timestamp + offset;
  const end = next ? next.timestamp + offset : Math.min(start + 4, duration || start + 4);
  return Math.max(end, start + 0.4);
}

export function wordsForLine(lyrics: LyricLine[], index: number, duration: number): LyricWord[] {
  const line = lyrics[index];
  if (line.words?.length) {
    return line.words;
  }
  const end = (lyrics[index + 1]?.timestamp ?? line.timestamp + 4);
  return interpolateWords(line.text, line.timestamp, end > line.timestamp ? end : line.timestamp + 4);
}

export function getRevealedWords(lyrics: LyricLine[], time: number, offset: number, duration: number) {
  const index = getActiveLineIndex(lyrics, time, offset);
  if (index < 0) {
    return [] as LyricWord[];
  }
  const cursor = time - offset;
  return wordsForLine(lyrics, index, duration).filter((word) => word.timestamp <= cursor);
}

export function flattenWords(lyrics: LyricLine[], duration: number): LyricWord[] {
  return lyrics.flatMap((_, index) => wordsForLine(lyrics, index, duration));
}
