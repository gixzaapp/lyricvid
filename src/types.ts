export type LyricWord = {
  text: string;
  timestamp: number;
};

export type LyricLine = {
  id: string;
  timestamp: number;
  text: string;
  words?: LyricWord[];
};

export type SubtitleAlign = 'left' | 'center' | 'right';

export type LyricAnimationId = 'none' | 'fade' | 'rise' | 'drop' | 'pop' | 'slide' | 'zoom';

export type SubtitleStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string | null;
  bold: boolean;
  italic: boolean;
  outline: boolean;
  align: SubtitleAlign;
  animation: LyricAnimationId;
  animationSpeed: number;
  x: number;
  y: number;
};

export type LrclibTrack = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
  lyricsfile: string | null;
};

export type RankedTrack = LrclibTrack & {
  delta: number;
};
