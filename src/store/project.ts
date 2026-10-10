import { create } from 'zustand';

import { createLineId, lyricsFromTrack, splitLineAtWord } from '@/lib/lyrics';
import type { LyricLine, LrclibTrack, StickerKind, SubtitleStyle, VideoSticker } from '@/types';

const defaultStyle: SubtitleStyle = {
  fontFamily: 'sans',
  fontSize: 28,
  color: '#FFFFFF',
  backgroundColor: 'rgba(0,0,0,0.55)',
  bold: true,
  italic: false,
  outline: true,
  align: 'center',
  animation: 'rise',
  animationSpeed: 1,
  x: 50,
  y: 78,
};

export type SourceKind = 'video' | 'image';

export const IMAGE_LENGTHS = [30, 60] as const;

const STICKER_DEFAULTS: Record<StickerKind, { x: number; y: number }> = {
  vinyl: { x: 20, y: 18 },
  cassette: { x: 80, y: 18 },
  music: { x: 20, y: 40 },
  beats: { x: 80, y: 42 },
  player: { x: 50, y: 20 },
};

function createStickerId() {
  return `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

type ProjectState = {
  sourceKind: SourceKind;
  videoUri: string | null;
  videoName: string | null;
  videoDuration: number;
  audioUri: string | null;
  audioName: string | null;
  audioDuration: number;
  keepOriginalAudio: boolean;
  track: LrclibTrack | null;
  lyrics: LyricLine[];
  lyricsSynced: boolean;
  lyricsWarning: string | null;
  offset: number;
  style: SubtitleStyle;
  stickers: VideoSticker[];
  selectedStickerId: string | null;
  setVideo: (input: { uri: string; name: string; duration?: number }) => void;
  setImage: (input: { uri: string; name: string }) => void;
  setVideoDuration: (duration: number) => void;
  setAudio: (input: { uri: string; name: string; duration?: number } | null) => void;
  setAudioDuration: (duration: number) => void;
  setKeepOriginalAudio: (keep: boolean) => void;
  applyTrack: (track: LrclibTrack) => void;
  setLyrics: (lyrics: LyricLine[], synced: boolean, warning?: string | null) => void;
  updateLine: (id: string, patch: Partial<Pick<LyricLine, 'text' | 'timestamp'>>) => void;
  addLine: (timestamp: number) => void;
  removeLine: (id: string) => void;
  startFromLine: (id: string) => void;
  splitLine: (id: string, afterCount: number) => void;
  setOffset: (offset: number) => void;
  setStyle: (patch: Partial<SubtitleStyle>) => void;
  setPosition: (x: number, y: number) => void;
  toggleSticker: (kind: StickerKind) => void;
  removeSticker: (id: string) => void;
  selectSticker: (id: string | null) => void;
  setStickerPosition: (id: string, x: number, y: number) => void;
  setStickerScale: (id: string, scale: number) => void;
  timingDuration: () => number;
  pendingSongDetect: boolean;
  setPendingSongDetect: (value: boolean) => void;
  stageWidth: number;
  setStageWidth: (width: number) => void;
  reset: () => void;
};

const initial = {
  sourceKind: 'video' as SourceKind,
  videoUri: null as string | null,
  videoName: null as string | null,
  videoDuration: 0,
  audioUri: null as string | null,
  audioName: null as string | null,
  audioDuration: 0,
  keepOriginalAudio: true,
  track: null as LrclibTrack | null,
  lyrics: [] as LyricLine[],
  lyricsSynced: false,
  lyricsWarning: null as string | null,
  offset: 0,
  style: defaultStyle,
  stickers: [] as VideoSticker[],
  selectedStickerId: null as string | null,
  pendingSongDetect: false,
  stageWidth: 0,
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  ...initial,
  setVideo: ({ uri, name, duration = 0 }) =>
    set({
      sourceKind: 'video',
      videoUri: uri,
      videoName: name,
      videoDuration: duration,
      keepOriginalAudio: true,
    }),
  setImage: ({ uri, name }) =>
    set({
      sourceKind: 'image',
      videoUri: uri,
      videoName: name,
      videoDuration: 0,
      keepOriginalAudio: false,
      audioUri: null,
      audioName: null,
      audioDuration: 0,
    }),
  setVideoDuration: (duration) => {
    if (duration > 0) {
      set({ videoDuration: duration });
    }
  },
  setAudio: (input) => {
    if (!input) {
      set({ audioUri: null, audioName: null, audioDuration: 0, keepOriginalAudio: true });
      return;
    }
    set({
      audioUri: input.uri,
      audioName: input.name,
      audioDuration: input.duration ?? 0,
      keepOriginalAudio: false,
    });
  },
  setAudioDuration: (duration) => {
    if (duration > 0) {
      set({ audioDuration: duration });
    }
  },
  setKeepOriginalAudio: (keep) =>
    set({
      keepOriginalAudio: keep,
      ...(keep ? { audioUri: null, audioName: null, audioDuration: 0 } : {}),
    }),
  applyTrack: (track) => {
    const songDuration = track.duration > 0 ? track.duration : get().timingDuration();
    const parsed = lyricsFromTrack(track, songDuration);
    set({
      track,
      lyrics: parsed.lyrics,
      lyricsSynced: parsed.synced,
      lyricsWarning: parsed.warning,
    });
  },
  setLyrics: (lyrics, synced, warning = null) =>
    set({
      lyrics: [...lyrics].sort((a, b) => a.timestamp - b.timestamp),
      lyricsSynced: synced,
      lyricsWarning: warning,
    }),
  updateLine: (id, patch) =>
    set((state) => ({
      lyrics: state.lyrics
        .map((line) => {
          if (line.id !== id) return line;
          const next = { ...line, ...patch };
          if (patch.text != null && patch.text !== line.text) {
            delete next.words;
          }
          return next;
        })
        .sort((a, b) => a.timestamp - b.timestamp),
    })),
  addLine: (timestamp) =>
    set((state) => ({
      lyrics: [
        ...state.lyrics,
        { id: createLineId(), timestamp, text: '' },
      ].sort((a, b) => a.timestamp - b.timestamp),
    })),
  removeLine: (id) =>
    set((state) => ({
      lyrics: state.lyrics.filter((line) => line.id !== id),
    })),
  startFromLine: (id) =>
    set((state) => {
      const index = state.lyrics.findIndex((line) => line.id === id);
      if (index < 0) return {};
      const origin = state.lyrics[index].timestamp;
      return {
        lyrics: state.lyrics.slice(index).map((line) => ({
          ...line,
          timestamp: Math.max(0, line.timestamp - origin),
          words: line.words?.map((word) => ({
            ...word,
            timestamp: Math.max(0, word.timestamp - origin),
          })),
        })),
      };
    }),
  splitLine: (id, afterCount) =>
    set((state) => {
      const index = state.lyrics.findIndex((line) => line.id === id);
      if (index < 0) return {};
      const line = state.lyrics[index];
      const nextTimestamp = state.lyrics[index + 1]?.timestamp ?? line.timestamp + 4;
      const split = splitLineAtWord(line, afterCount, nextTimestamp);
      if (!split) return {};
      const lyrics = [...state.lyrics];
      lyrics.splice(index, 1, split.first, split.second);
      return { lyrics };
    }),
  setOffset: (offset) => set({ offset }),
  setStyle: (patch) => set((state) => ({ style: { ...state.style, ...patch } })),
  setPosition: (x, y) => set((state) => ({ style: { ...state.style, x, y } })),
  toggleSticker: (kind) =>
    set((state) => {
      const existing = state.stickers.find((item) => item.kind === kind);
      if (existing) {
        return {
          stickers: state.stickers.filter((item) => item.id !== existing.id),
          selectedStickerId: state.selectedStickerId === existing.id ? null : state.selectedStickerId,
        };
      }
      const sticker: VideoSticker = {
        id: createStickerId(),
        kind,
        scale: 1,
        ...STICKER_DEFAULTS[kind],
      };
      return { stickers: [...state.stickers, sticker], selectedStickerId: sticker.id };
    }),
  removeSticker: (id) =>
    set((state) => ({
      stickers: state.stickers.filter((item) => item.id !== id),
      selectedStickerId: state.selectedStickerId === id ? null : state.selectedStickerId,
    })),
  selectSticker: (id) => set({ selectedStickerId: id }),
  setStickerPosition: (id, x, y) =>
    set((state) => ({
      stickers: state.stickers.map((item) => (item.id === id ? { ...item, x, y } : item)),
    })),
  setStickerScale: (id, scale) =>
    set((state) => ({
      stickers: state.stickers.map((item) => (item.id === id ? { ...item, scale } : item)),
    })),
  timingDuration: () => {
    const state = get();
    return state.videoDuration > 0 ? state.videoDuration : 0;
  },
  setPendingSongDetect: (value) => set({ pendingSongDetect: value }),
  setStageWidth: (width) => {
    if (width > 0) {
      set({ stageWidth: width });
    }
  },
  reset: () => set({ ...initial, style: { ...defaultStyle }, stickers: [], selectedStickerId: null }),
}));
