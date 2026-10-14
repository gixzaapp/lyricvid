import type { LyricAnimationId } from '@/types';

export type { LyricAnimationId };

export type LyricEnterEase = 'cubic' | 'back';
export type LyricLoopId = 'none' | 'float' | 'glow' | 'sparkle';

export type LyricMotionConfig = {
  id: LyricAnimationId;
  fadeIn: number;
  fadeOut: number;
  fromY: number;
  fromX: number;
  scaleFrom: number;
  risePercent: number;
  slidePercent: number;
  rotateFrom: number;
  enterEase: LyricEnterEase;
  loop: LyricLoopId;
  sparkle: boolean;
};

export const ANIMATION_PRESETS: { id: LyricAnimationId; mark: string }[] = [
  { id: 'none', mark: '—' },
  { id: 'fade', mark: '▒' },
  { id: 'rise', mark: '↑' },
  { id: 'drop', mark: '↓' },
  { id: 'pop', mark: '●' },
  { id: 'slide', mark: '→' },
  { id: 'zoom', mark: '+' },
  { id: 'sparkle', mark: '✦' },
  { id: 'fly', mark: '✈' },
  { id: 'glow', mark: '◉' },
  { id: 'bounce', mark: '↕' },
  { id: 'float', mark: '˜' },
  { id: 'wheel', mark: '☰' },
  { id: 'flip', mark: '⟳' },
  { id: 'coverflow', mark: '⇆' },
  { id: 'prism', mark: '△' },
];

const MOTION: Record<LyricAnimationId, Omit<LyricMotionConfig, 'id'>> = {
  none: {
    fadeIn: 0,
    fadeOut: 0,
    fromY: 0,
    fromX: 0,
    scaleFrom: 1,
    risePercent: 0,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'none',
    sparkle: false,
  },
  fade: {
    fadeIn: 0.28,
    fadeOut: 0.2,
    fromY: 0,
    fromX: 0,
    scaleFrom: 1,
    risePercent: 0,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'none',
    sparkle: false,
  },
  rise: {
    fadeIn: 0.28,
    fadeOut: 0.2,
    fromY: 12,
    fromX: 0,
    scaleFrom: 0.94,
    risePercent: 1.4,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'none',
    sparkle: false,
  },
  drop: {
    fadeIn: 0.28,
    fadeOut: 0.2,
    fromY: -12,
    fromX: 0,
    scaleFrom: 0.94,
    risePercent: -1.4,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'none',
    sparkle: false,
  },
  pop: {
    fadeIn: 0.22,
    fadeOut: 0.16,
    fromY: 0,
    fromX: 0,
    scaleFrom: 0.72,
    risePercent: 0,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'none',
    sparkle: false,
  },
  slide: {
    fadeIn: 0.3,
    fadeOut: 0.2,
    fromY: 0,
    fromX: -36,
    scaleFrom: 1,
    risePercent: 0,
    slidePercent: -2.4,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'none',
    sparkle: false,
  },
  zoom: {
    fadeIn: 0.32,
    fadeOut: 0.22,
    fromY: 0,
    fromX: 0,
    scaleFrom: 0.55,
    risePercent: 0,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'none',
    sparkle: false,
  },
  sparkle: {
    fadeIn: 0.28,
    fadeOut: 0.2,
    fromY: 0,
    fromX: 0,
    scaleFrom: 1,
    risePercent: 0,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'sparkle',
    sparkle: true,
  },
  fly: {
    fadeIn: 0.42,
    fadeOut: 0.26,
    fromY: 28,
    fromX: -72,
    scaleFrom: 0.86,
    risePercent: 3.4,
    slidePercent: -7.2,
    rotateFrom: -14,
    enterEase: 'cubic',
    loop: 'none',
    sparkle: false,
  },
  glow: {
    fadeIn: 0.3,
    fadeOut: 0.2,
    fromY: 0,
    fromX: 0,
    scaleFrom: 0.96,
    risePercent: 0,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'glow',
    sparkle: false,
  },
  bounce: {
    fadeIn: 0.4,
    fadeOut: 0.18,
    fromY: 26,
    fromX: 0,
    scaleFrom: 0.8,
    risePercent: 2.8,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'back',
    loop: 'none',
    sparkle: false,
  },
  float: {
    fadeIn: 0.3,
    fadeOut: 0.2,
    fromY: 10,
    fromX: 0,
    scaleFrom: 0.97,
    risePercent: 1.1,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'float',
    sparkle: false,
  },
  wheel: {
    fadeIn: 0.18,
    fadeOut: 0.16,
    fromY: 0,
    fromX: 0,
    scaleFrom: 1,
    risePercent: 0,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'none',
    sparkle: false,
  },
  flip: {
    fadeIn: 0,
    fadeOut: 0,
    fromY: 0,
    fromX: 0,
    scaleFrom: 1,
    risePercent: 0,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'none',
    sparkle: false,
  },
  coverflow: {
    fadeIn: 0,
    fadeOut: 0,
    fromY: 0,
    fromX: 0,
    scaleFrom: 1,
    risePercent: 0,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'none',
    sparkle: false,
  },
  prism: {
    fadeIn: 0,
    fadeOut: 0,
    fromY: 0,
    fromX: 0,
    scaleFrom: 1,
    risePercent: 0,
    slidePercent: 0,
    rotateFrom: 0,
    enterEase: 'cubic',
    loop: 'none',
    sparkle: false,
  },
};

export const ANIMATION_SPEED_MIN = 0.4;
export const ANIMATION_SPEED_MAX = 2.5;
export const ANIMATION_SPEED_DEFAULT = 1;

export const SPARKLE_SLOTS = [
  { x: 0.06, y: 0.16, size: 11 },
  { x: 0.28, y: 0.0, size: 8 },
  { x: 0.52, y: 0.1, size: 13 },
  { x: 0.74, y: -0.02, size: 9 },
  { x: 0.94, y: 0.2, size: 12 },
  { x: 0.1, y: 0.9, size: 9 },
  { x: 0.38, y: 1.02, size: 11 },
  { x: 0.66, y: 0.92, size: 8 },
  { x: 0.9, y: 0.84, size: 12 },
  { x: 0.0, y: 0.5, size: 7 },
  { x: 1.0, y: 0.46, size: 8 },
];

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

export function sparkleTwinkle(time: number, index: number, speed: number) {
  const rate = clampAnimationSpeed(speed);
  const phase = ((time * 2.6 * rate + index * 0.37) % 1 + 1) % 1;
  const wave = Math.sin(phase * Math.PI);
  return wave * wave;
}

export function glowPulse(time: number, speed: number) {
  return 0.5 + 0.5 * Math.sin(time * 3.6 * clampAnimationSpeed(speed));
}

export function floatOffset(time: number, speed: number, amplitude = 7) {
  return Math.sin(time * 2.4 * clampAnimationSpeed(speed)) * amplitude;
}
