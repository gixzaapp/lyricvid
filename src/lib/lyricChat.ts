import { getActiveLineIndex } from '@/lib/lyrics';
import { clampAnimationSpeed } from '@/lib/lyricMotion';
import type { LyricLine } from '@/types';

export const CHAT_VISIBLE = 4;

export function isChatStyle(id?: string | null) {
  return id === 'chat';
}

export function chatEnterProgress(elapsed: number, speed?: number | null) {
  const window = 0.22 / clampAnimationSpeed(speed);
  if (window <= 0) return 1;
  return Math.min(1, Math.max(0, elapsed / window));
}

export function visibleChatLines(lyrics: LyricLine[], time: number, offset: number) {
  const index = getActiveLineIndex(lyrics, time, offset);
  if (index < 0) {
    return [] as { line: LyricLine; index: number; current: boolean }[];
  }
  const start = Math.max(0, index - (CHAT_VISIBLE - 1));
  const rows: { line: LyricLine; index: number; current: boolean }[] = [];
  for (let i = start; i <= index; i += 1) {
    rows.push({ line: lyrics[i], index: i, current: i === index });
  }
  return rows;
}

export function isOutgoingChat(index: number) {
  return index % 2 === 1;
}
