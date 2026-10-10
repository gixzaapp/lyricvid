import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated from 'react-native-reanimated';

import { useStageDrag } from '@/lib/stageDrag';

import { highlightRangeInText } from '@/lib/lyrics';
import {
  SPARKLE_SLOTS,
  animatesWholeLine,
  clampAnimationSpeed,
  fadeInDuration,
  fadeOutDuration,
  floatOffset,
  glowPulse,
  motionFor,
  sparkleTwinkle,
} from '@/lib/lyricMotion';
import { colors, lyricFontStyle } from '@/theme';
import type { LyricWord, SubtitleStyle } from '@/types';

type Props = {
  text?: string;
  words: LyricWord[];
  currentIndex?: number;
  lineKey: string;
  currentTime: number;
  lineStart: number;
  lineEnd: number;
  fadeOut: boolean;
  placeholder?: string;
  styleConfig: SubtitleStyle;
  onPositionChange: (x: number, y: number) => void;
};

const ROTATE_RANGE = 45;

export function LyricOverlay({
  text = '',
  words,
  currentIndex = -1,
  lineKey,
  currentTime,
  lineStart,
  lineEnd,
  fadeOut,
  placeholder,
  styleConfig,
  onPositionChange,
}: Props) {
  const box = useRef({ w: 0, h: 0 });
  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;
  const exitStarted = useRef(false);
  const motion = motionFor(styleConfig.animation, styleConfig.animationSpeed);
  const fromX = styleConfig.align === 'right' ? Math.abs(motion.fromX) : motion.fromX;
  const wholeLine = animatesWholeLine(motion.id);
  const timingRef = useRef({ lineStart, lineEnd, fromX, motion });
  timingRef.current = { lineStart, lineEnd, fromX, motion };
  const opacity = useRef(new Animated.Value(motion.fadeIn <= 0 ? 1 : 0)).current;
  const translateX = useRef(new Animated.Value(fromX)).current;
  const translateY = useRef(new Animated.Value(motion.fromY)).current;
  const scale = useRef(new Animated.Value(motion.scaleFrom)).current;
  const rotate = useRef(new Animated.Value(motion.rotateFrom)).current;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const speed = clampAnimationSpeed(styleConfig.animationSpeed);
  const { gesture, dragStyle } = useStageDrag({
    x: styleConfig.x,
    y: styleConfig.y,
    getStage: () => box.current,
    min: 0,
    max: 100,
    onCommit: onPositionChange,
  });

  useEffect(() => {
    const { lineStart: startAt, lineEnd: endAt, fromX: dx, motion: preset } = timingRef.current;
    exitStarted.current = false;
    opacity.stopAnimation();
    translateX.stopAnimation();
    translateY.stopAnimation();
    scale.stopAnimation();
    rotate.stopAnimation();

    const rest = () => {
      opacity.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
      scale.setValue(1);
      rotate.setValue(0);
    };

    const hideInstant = () => {
      opacity.setValue(0);
      translateX.setValue(dx);
      translateY.setValue(preset.fromY);
      scale.setValue(preset.scaleFrom);
      rotate.setValue(preset.rotateFrom);
    };

    const hide = (duration: number) => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: dx * 0.45,
          duration,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: preset.fromY * 0.4,
          duration,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: preset.scaleFrom,
          duration,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: preset.rotateFrom * 0.45,
          duration,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    };

    if (lineKey === 'hidden') {
      if (preset.fadeOut <= 0) {
        hideInstant();
      } else {
        hide(Math.max(80, preset.fadeOut * 1000 || 180));
      }
      return;
    }

    const fadeIn = fadeInDuration(endAt - startAt, preset.fadeIn);
    if (fadeIn <= 0) {
      rest();
      return;
    }

    const elapsed = Math.max(0, timeRef.current - startAt);
    const progress = Math.min(1, elapsed / fadeIn);
    opacity.setValue(progress);
    translateX.setValue((1 - progress) * dx);
    translateY.setValue((1 - progress) * preset.fromY);
    scale.setValue(preset.scaleFrom + (1 - preset.scaleFrom) * progress);
    rotate.setValue((1 - progress) * preset.rotateFrom);
    if (progress >= 1) {
      return;
    }

    const remaining = Math.max(80, (1 - progress) * fadeIn * 1000);
    const enterEase = preset.enterEase === 'back' ? Easing.out(Easing.back(1.55)) : Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: remaining,
        easing: enterEase,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: remaining,
        easing: enterEase,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: remaining,
        easing: enterEase,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: remaining,
        easing: enterEase,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: 0,
        duration: remaining,
        easing: enterEase,
        useNativeDriver: true,
      }),
    ]).start();
  }, [lineKey, motion.enterEase, motion.fadeIn, motion.fadeOut, motion.id, opacity, rotate, scale, translateX, translateY]);

  useEffect(() => {
    if (lineKey === 'hidden' || !fadeOut || exitStarted.current || motion.fadeOut <= 0) {
      return;
    }
    const window = fadeOutDuration(lineEnd - lineStart, motion.fadeOut);
    const remaining = lineEnd - currentTime;
    if (window <= 0 || remaining > window || remaining < 0) {
      return;
    }
    exitStarted.current = true;
    const duration = Math.max(80, remaining * 1000);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: fromX * 0.45,
        duration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: motion.fromY * 0.4,
        duration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: motion.scaleFrom,
        duration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: motion.rotateFrom * 0.45,
        duration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    currentTime,
    fadeOut,
    fromX,
    lineEnd,
    lineKey,
    lineStart,
    motion.fadeOut,
    motion.fromY,
    motion.rotateFrom,
    motion.scaleFrom,
    opacity,
    rotate,
    scale,
    translateX,
    translateY,
  ]);

  useEffect(() => {
    if (lineKey === 'hidden' || exitStarted.current || motion.loop === 'none' || motion.loop === 'sparkle') {
      return;
    }
    const enter = fadeInDuration(lineEnd - lineStart, motion.fadeIn);
    const elapsed = Math.max(0, currentTime - lineStart);
    if (enter > 0 && elapsed < enter) {
      return;
    }
    const hold = elapsed - enter;
    if (motion.loop === 'float') {
      translateY.setValue(floatOffset(hold, speed));
    }
    if (motion.loop === 'glow') {
      scale.setValue(1 + glowPulse(hold, speed) * 0.05);
    }
  }, [
    currentTime,
    lineEnd,
    lineKey,
    lineStart,
    motion.fadeIn,
    motion.loop,
    speed,
    scale,
    translateY,
  ]);

  const onStageLayout = (event: LayoutChangeEvent) => {
    const next = {
      w: event.nativeEvent.layout.width,
      h: event.nativeEvent.layout.height,
    };
    box.current = next;
    setStageSize(next);
  };

  const displayText = text || placeholder || '';
  const highlight = highlightRangeInText(text, words, currentIndex);
  const wordStyle = {
    color: styleConfig.color,
    fontSize: styleConfig.fontSize,
    ...lyricFontStyle(styleConfig.fontFamily, displayText, Platform.OS === 'ios' ? 'ios' : 'android', {
      bold: styleConfig.bold,
      italic: styleConfig.italic,
    }),
    textShadowColor: styleConfig.outline ? 'rgba(0,0,0,0.85)' : 'transparent',
    textShadowOffset: styleConfig.outline ? { width: 0, height: 1 } : { width: 0, height: 0 },
    textShadowRadius: styleConfig.outline ? 4 : 0,
  } as const;

  const alignItems =
    styleConfig.align === 'left' ? 'flex-start' : styleConfig.align === 'right' ? 'flex-end' : 'center';
  const holdTime = Math.max(0, currentTime - lineStart);
  const glow = motion.loop === 'glow' ? glowPulse(holdTime, speed) : 0;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={onStageLayout}>
      <GestureDetector gesture={gesture}>
      <Reanimated.View
        style={[
          styles.dragWrap,
          {
            left: `${styleConfig.x}%`,
            top: `${styleConfig.y}%`,
            marginLeft: -size.w / 2,
            marginTop: -size.h / 2,
            maxWidth: stageSize.w > 0 ? stageSize.w * 0.92 : '92%',
          },
          dragStyle,
        ]}>
      <Animated.View
        onLayout={(event) => {
          const next = {
            w: event.nativeEvent.layout.width,
            h: event.nativeEvent.layout.height,
          };
          if (Math.abs(next.w - size.w) > 1 || Math.abs(next.h - size.h) > 1) {
            setSize(next);
          }
        }}
        style={[
          styles.lyricBox,
          motion.sparkle ? styles.sparklePad : null,
          {
            backgroundColor: styleConfig.backgroundColor ?? 'transparent',
            alignItems,
            opacity,
            transform: [
              { translateX },
              { translateY },
              {
                rotate: rotate.interpolate({
                  inputRange: [-ROTATE_RANGE, ROTATE_RANGE],
                  outputRange: [`-${ROTATE_RANGE}deg`, `${ROTATE_RANGE}deg`],
                }),
              },
              { scale },
            ],
          },
        ]}
        collapsable={false}>
        {motion.sparkle && size.w > 0
          ? SPARKLE_SLOTS.map((slot, index) => {
              const twinkle = sparkleTwinkle(holdTime, index, speed);
              return (
                <Text
                  key={`sparkle-${index}`}
                  pointerEvents="none"
                  style={[
                    styles.sparkle,
                    {
                      left: slot.x * size.w - slot.size / 2,
                      top: slot.y * size.h - slot.size / 2,
                      fontSize: slot.size,
                      opacity: twinkle,
                      transform: [{ scale: 0.45 + twinkle * 0.8 }],
                      color: styleConfig.color,
                      textShadowColor: styleConfig.color,
                    },
                  ]}>
                  ✦
                </Text>
              );
            })
          : null}
        {text && motion.loop === 'glow' ? (
          <Text
            pointerEvents="none"
            style={[
              wordStyle,
              styles.line,
              styles.glow,
              {
                textAlign: styleConfig.align,
                opacity: 0.28 + glow * 0.45,
                textShadowColor: styleConfig.color,
                textShadowRadius: 10 + glow * 14,
              },
            ]}>
            {text}
          </Text>
        ) : null}
        {text ? (
          <Text style={[wordStyle, styles.line, { textAlign: styleConfig.align }]}>
            {wholeLine || highlight.end <= highlight.start ? (
              text
            ) : (
              <>
                <Text style={styles.word}>{text.slice(0, highlight.start)}</Text>
                <Text style={[styles.word, styles.currentWord]}>
                  {text.slice(highlight.start, highlight.end)}
                </Text>
                <Text style={styles.word}>{text.slice(highlight.end)}</Text>
              </>
            )}
          </Text>
        ) : placeholder ? (
          <Text style={[wordStyle, styles.line, { textAlign: styleConfig.align, opacity: 0.7 }]}>
            {placeholder}
          </Text>
        ) : null}
      </Animated.View>
      </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  dragWrap: {
    position: 'absolute',
  },
  lyricBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'visible',
  },
  sparklePad: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  glow: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 6,
  },
  sparkle: {
    position: 'absolute',
    fontWeight: '700',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  line: {
    flexShrink: 1,
  },
  word: {
    opacity: 0.72,
  },
  currentWord: {
    opacity: 1,
    color: colors.accent,
  },
});
