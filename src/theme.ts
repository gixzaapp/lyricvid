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

export type FontPresetId = 'sans' | 'serif' | 'rounded' | 'narrow' | 'mono' | 'script' | 'poster' | 'light';

export const FONT_PRESETS: {
  id: FontPresetId;
  label: string;
  ios: string | undefined;
  android: string;
}[] = [
  { id: 'sans', label: 'Sans', ios: undefined, android: 'sans-serif' },
  { id: 'serif', label: 'Serif', ios: 'Georgia', android: 'serif' },
  { id: 'rounded', label: 'Rounded', ios: 'Avenir Next', android: 'sans-serif-medium' },
  { id: 'narrow', label: 'Narrow', ios: 'AvenirNextCondensed-DemiBold', android: 'sans-serif-condensed' },
  { id: 'mono', label: 'Mono', ios: 'Menlo', android: 'monospace' },
  { id: 'script', label: 'Script', ios: 'Noteworthy-Bold', android: 'cursive' },
  { id: 'poster', label: 'Poster', ios: 'HelveticaNeue-CondensedBold', android: 'sans-serif-black' },
  { id: 'light', label: 'Light', ios: 'HelveticaNeue-Light', android: 'sans-serif-light' },
];

export function fontFamilyFor(id?: string) {
  const preset = FONT_PRESETS.find((item) => item.id === id) ?? FONT_PRESETS[0];
  return { ios: preset.ios, android: preset.android, id: preset.id };
}

export const PRESET_BACKGROUNDS = [
  { label: 'None', value: null },
  { label: 'Dim', value: 'rgba(0,0,0,0.55)' },
  { label: 'Solid', value: 'rgba(0,0,0,0.82)' },
  { label: 'Light', value: 'rgba(255,255,255,0.88)' },
] as const;
