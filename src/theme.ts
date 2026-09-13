export const colors = {
  bg: '#07070B',
  bgElevated: '#101018',
  surface: '#16161F',
  surface2: '#1E1E2A',
  border: '#2C2C3A',
  text: '#F5F5F7',
  muted: '#8B8B9A',
  accent: '#8B7CFF',
  accentDim: 'rgba(139, 124, 255, 0.18)',
  pink: '#FF5C8A',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  overlay: 'rgba(0, 0, 0, 0.55)',
} as const;

export const PRESET_TEXT_COLORS = [
  '#FFFFFF',
  '#F8E71C',
  '#FF6B6B',
  '#4ECDC4',
  '#A78BFA',
  '#F472B6',
  '#111111',
] as const;

export type FontPresetId =
  | 'sans'
  | 'serif'
  | 'condensed'
  | 'typewriter'
  | 'mono'
  | 'script'
  | 'marker'
  | 'smallcaps';

export const FONT_PRESETS: {
  id: FontPresetId;
  label: string;
  ios: string | undefined;
  android: string;
}[] = [
  { id: 'sans', label: 'Sans', ios: undefined, android: 'sans-serif' },
  { id: 'serif', label: 'Serif', ios: 'Georgia', android: 'serif' },
  { id: 'condensed', label: 'Condensed', ios: 'AvenirNextCondensed-DemiBold', android: 'sans-serif-condensed' },
  { id: 'typewriter', label: 'Typewriter', ios: 'AmericanTypewriter-Semibold', android: 'serif-monospace' },
  { id: 'mono', label: 'Mono', ios: 'Menlo', android: 'monospace' },
  { id: 'script', label: 'Script', ios: 'Noteworthy-Bold', android: 'cursive' },
  { id: 'marker', label: 'Marker', ios: 'MarkerFelt-Wide', android: 'casual' },
  { id: 'smallcaps', label: 'Caps', ios: 'Copperplate-Bold', android: 'sans-serif-smallcaps' },
];

const LEGACY_FONT_IDS: Record<string, FontPresetId> = {
  rounded: 'sans',
  narrow: 'condensed',
  poster: 'condensed',
  light: 'sans',
};

export function fontFamilyFor(id?: string) {
  const resolved = (id && LEGACY_FONT_IDS[id]) || id;
  const preset = FONT_PRESETS.find((item) => item.id === resolved) ?? FONT_PRESETS[0];
  return { ios: preset.ios, android: preset.android, id: preset.id };
}

const COMPLEX_SCRIPT =
  /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0900-\u0DFF\u0E00-\u0E7F\u0F00-\u0FFF\u1000-\u109F\u1100-\u11FF\u1200-\u137F\u1780-\u17FF\u3040-\u30FF\u3100-\u312F\u3400-\u9FFF\uA960-\uA97F\uAC00-\uD7AF\uF900-\uFAFF]/;

export function usesSystemLyricFont(text: string) {
  return COMPLEX_SCRIPT.test(text);
}

export function lyricFontStyle(fontId: string | undefined, text: string, platform: 'ios' | 'android') {
  if (usesSystemLyricFont(text)) {
    return {};
  }
  const resolved = fontFamilyFor(fontId);
  if (platform === 'ios') {
    return resolved.ios ? { fontFamily: resolved.ios } : {};
  }
  return { fontFamily: resolved.android };
}

export const PRESET_BACKGROUNDS = [
  { label: 'None', value: null },
  { label: 'Dim', value: 'rgba(0,0,0,0.55)' },
  { label: 'Solid', value: 'rgba(0,0,0,0.82)' },
  { label: 'Light', value: 'rgba(255,255,255,0.88)' },
] as const;
