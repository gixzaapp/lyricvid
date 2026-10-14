export const DEPTH_STYLES = ['flip', 'coverflow', 'prism'] as const;

export type DepthStyleId = (typeof DEPTH_STYLES)[number];

export type DepthSlot = {
  opacity: number;
  scale: number;
  tx: number;
  ty: number;
  rx: number;
  ry: number;
  hide: boolean;
};

export function isDepthStyle(id?: string | null): id is DepthStyleId {
  return Boolean(id && (DEPTH_STYLES as readonly string[]).includes(id));
}

export function depthVisibleRange(mode: DepthStyleId): number {
  return mode === 'flip' || mode === 'prism' ? 1 : 2;
}

export function depthSlotStyle(mode: DepthStyleId, slot: number, rowH: number, rowW: number): DepthSlot {
  const distance = Math.abs(slot);
  switch (mode) {
    case 'flip': {
      const ry = slot * 90;
      const hide = Math.abs(Math.cos((ry * Math.PI) / 180)) < 0.12;
      return {
        opacity: clamp(1 - distance * 0.55, 0, 1),
        scale: 1,
        tx: 0,
        ty: 0,
        rx: 0,
        ry,
        hide,
      };
    }
    case 'coverflow':
      return {
        opacity: clamp(1 - distance * 0.32, 0.18, 1),
        scale: clamp(1 - distance * 0.16, 0.64, 1),
        tx: slot * rowW * 0.38,
        ty: Math.abs(slot) * rowH * 0.08,
        rx: 0,
        ry: -slot * 50,
        hide: distance > 2.15,
      };
    case 'prism': {
      const ry = slot * 120;
      const facing = Math.cos((ry * Math.PI) / 180);
      const hide = facing < 0.18 || distance > 0.95;
      return {
        opacity: hide ? 0 : clamp(1 - distance * 0.22, 0.28, 1),
        scale: 1,
        tx: Math.sin((ry * Math.PI) / 180) * rowW * 0.18,
        ty: 0,
        rx: 8,
        ry,
        hide,
      };
    }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
