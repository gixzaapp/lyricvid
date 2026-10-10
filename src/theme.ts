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
  | 'dancing'
  | 'elegant'
  | 'pacifico'
  | 'parisienne'
  | 'signature'
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
  { id: 'dancing', label: 'Dancing', ios: 'DancingScript', android: 'DancingScript' },
  { id: 'elegant', label: 'Vibes', ios: 'GreatVibes-Regular', android: 'GreatVibes-Regular' },
  { id: 'pacifico', label: 'Pacifico', ios: 'Pacifico-Regular', android: 'Pacifico-Regular' },
  { id: 'parisienne', label: 'Parisienne', ios: 'Parisienne-Regular', android: 'Parisienne-Regular' },
  { id: 'signature', label: 'Signature', ios: 'Allura-Regular', android: 'Allura-Regular' },
  { id: 'marker', label: 'Marker', ios: 'MarkerFelt-Wide', android: 'casual' },
  { id: 'smallcaps', label: 'Caps', ios: 'Copperplate-Bold', android: 'sans-serif-smallcaps' },
];

export const CUSTOM_FONTS = {
  DancingScript: require('../assets/fonts/DancingScript.ttf'),
  'GreatVibes-Regular': require('../assets/fonts/GreatVibes-Regular.ttf'),
  'Pacifico-Regular': require('../assets/fonts/Pacifico-Regular.ttf'),
  'Parisienne-Regular': require('../assets/fonts/Parisienne-Regular.ttf'),
  'Allura-Regular': require('../assets/fonts/Allura-Regular.ttf'),
};

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

export const CUSTOM_FONT_IDS: FontPresetId[] = [
  'dancing',
  'elegant',
  'pacifico',
  'parisienne',
  'signature',
];

export function isCustomLyricFont(id?: string) {
  return CUSTOM_FONT_IDS.includes(fontFamilyFor(id).id);
}

export function lyricFontStyle(
  fontId: string | undefined,
  text: string,
  platform: 'ios' | 'android',
  options?: { bold?: boolean; italic?: boolean },
) {
  if (usesSystemLyricFont(text)) {
    return {};
  }
  const resolved = fontFamilyFor(fontId);
  const family = platform === 'ios' ? resolved.ios : resolved.android;
  if (!family) {
    return {};
  }
  if (isCustomLyricFont(resolved.id)) {
    return { fontFamily: family };
  }
  return {
    fontFamily: family,
    fontWeight: options?.bold ? ('800' as const) : ('500' as const),
    fontStyle: options?.italic ? ('italic' as const) : ('normal' as const),
  };
}

export const PRESET_BACKGROUNDS = [
  { label: 'None', value: null },
  { label: 'Dim', value: 'rgba(0,0,0,0.55)' },
  { label: 'Solid', value: 'rgba(0,0,0,0.82)' },
  { label: 'Light', value: 'rgba(255,255,255,0.88)' },
] as const;
