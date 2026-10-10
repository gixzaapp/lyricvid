import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { clamp } from '@/lib/time';

type StageSize = { w: number; h: number };

export function useStageDrag({
  x,
  y,
  getStage,
  min = 0,
  max = 100,
  scale = 1,
  onSelect,
  onCommit,
}: {
  x: number;
  y: number;
  getStage: () => StageSize;
  min?: number;
  max?: number;
  scale?: number;
  onSelect?: () => void;
  onCommit: (x: number, y: number) => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const baseX = useSharedValue(x);
  const baseY = useSharedValue(y);
  const scaleValue = useSharedValue(scale);
  baseX.value = x;
  baseY.value = y;
  scaleValue.value = scale;

  const commit = (dx: number, dy: number) => {
    const stage = getStage();
    if (stage.w > 1 && stage.h > 1) {
      onCommit(
        clamp(baseX.value + (dx / stage.w) * 100, min, max),
        clamp(baseY.value + (dy / stage.h) * 100, min, max),
      );
    }
    tx.value = 0;
    ty.value = 0;
  };

  const gesture = Gesture.Pan()
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onStart(() => {
      tx.value = 0;
      ty.value = 0;
      if (onSelect) {
        runOnJS(onSelect)();
      }
    })
    .onUpdate((event) => {
      tx.value = event.translationX;
      ty.value = event.translationY;
    })
    .onEnd((event) => {
      runOnJS(commit)(event.translationX, event.translationY);
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scaleValue.value }],
  }));

  return { gesture, dragStyle };
}
