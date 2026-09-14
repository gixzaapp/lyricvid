import type { LyricAnimationId } from '@/types';

export type { LyricAnimationId };

export type LyricMotionConfig = {
  id: LyricAnimationId;
  fadeIn: number;
  fadeOut: number;
  fromY: number;
  fromX: number;
  scaleFrom: number;
  risePercent: number;
  slidePercent: number;
};

export const ANIMATION_PRESETS: { id: LyricAnimationId; mark: string }[] = [
  { id: 'none', mark: '—' },
  { id: 'fade', mark: '▒' },
  { id: 'rise', mark: '↑' },
  { id: 'drop', mark: '↓' },
  { id: 'pop', mark: '●' },
  { id: 'slide', mark: '→' },
  { id: 'zoom', mark: '+' },
];

const MOTION: Record<LyricAnimationId, Omit<LyricMotionConfig, 'id'>> = {
  none: { fadeIn: 0, fadeOut: 0, fromY: 0, fromX: 0, scaleFrom: 1, risePercent: 0, slidePercent: 0 },
  fade: { fadeIn: 0.28, fadeOut: 0.2, fromY: 0, fromX: 0, scaleFrom: 1, risePercent: 0, slidePercent: 0 },
  rise: { fadeIn: 0.28, fadeOut: 0.2, fromY: 12, fromX: 0, scaleFrom: 0.94, risePercent: 1.4, slidePercent: 0 },
  drop: { fadeIn: 0.28, fadeOut: 0.2, fromY: -12, fromX: 0, scaleFrom: 0.94, risePercent: -1.4, slidePercent: 0 },
  pop: { fadeIn: 0.22, fadeOut: 0.16, fromY: 0, fromX: 0, scaleFrom: 0.72, risePercent: 0, slidePercent: 0 },
  slide: { fadeIn: 0.3, fadeOut: 0.2, fromY: 0, fromX: -36, scaleFrom: 1, risePercent: 0, slidePercent: -2.4 },
  zoom: { fadeIn: 0.32, fadeOut: 0.22, fromY: 0, fromX: 0, scaleFrom: 0.55, risePercent: 0, slidePercent: 0 },
};

export const ANIMATION_SPEED_MIN = 0.4;
export const ANIMATION_SPEED_MAX = 2.5;
export const ANIMATION_SPEED_DEFAULT = 1;

export function clampAnimationSpeed(speed?: number | null) {
  if (!Number.isFinite(speed) || !speed || speed <= 0) {
    return ANIMATION_SPEED_DEFAULT;
  }
  return Math.min(ANIMATION_SPEED_MAX, Math.max(ANIMATION_SPEED_MIN, speed));
}

export function animationFor(id?: string | null): LyricAnimationId {
  if (id && id in MOTION) {
    return id as LyricAnimationId;
  }
  return 'rise';
}

export function motionFor(id?: string | null, speed?: number | null): LyricMotionConfig {
  const resolved = animationFor(id);
  const rate = clampAnimationSpeed(speed);
  const base = MOTION[resolved];
  return {
    id: resolved,
    ...base,
    fadeIn: base.fadeIn <= 0 ? 0 : base.fadeIn / rate,
    fadeOut: base.fadeOut <= 0 ? 0 : base.fadeOut / rate,
  };
}

export function animatesWholeLine(id?: string | null) {
  return animationFor(id) !== 'none';
}

export function fadeInDuration(lineDuration: number, fadeIn = motionFor().fadeIn) {
  if (fadeIn <= 0) {
    return 0;
  }
  if (!Number.isFinite(lineDuration) || lineDuration <= 0) {
    return fadeIn;
  }
  return Math.min(fadeIn, Math.max(0.08, lineDuration * 0.4));
}

export function fadeOutDuration(lineDuration: number, fadeOut = motionFor().fadeOut) {
  if (fadeOut <= 0) {
    return 0;
  }
  if (!Number.isFinite(lineDuration) || lineDuration <= 0) {
    return fadeOut;
  }
  return Math.min(fadeOut, Math.max(0.08, lineDuration * 0.28));
}
