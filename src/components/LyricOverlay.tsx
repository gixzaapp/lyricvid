import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { highlightRangeInText } from '@/lib/lyrics';
import { animatesWholeLine, fadeInDuration, fadeOutDuration, motionFor } from '@/lib/lyricMotion';
import { clamp } from '@/lib/time';
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
  const start = useRef({ x: styleConfig.x, y: styleConfig.y });
  const styleRef = useRef(styleConfig);
  styleRef.current = styleConfig;
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
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = { x: styleRef.current.x, y: styleRef.current.y };
        },
        onPanResponderMove: (_, gesture) => {
          if (!box.current.w || !box.current.h) return;
          const x = clamp(start.current.x + (gesture.dx / box.current.w) * 100, 8, 92);
          const y = clamp(start.current.y + (gesture.dy / box.current.h) * 100, 8, 92);
          onPositionChange(x, y);
        },
      }),
    [onPositionChange],
  );

  useEffect(() => {
    const { lineStart: startAt, lineEnd: endAt, fromX: dx, motion: preset } = timingRef.current;
    exitStarted.current = false;
    opacity.stopAnimation();
    translateX.stopAnimation();
    translateY.stopAnimation();
    scale.stopAnimation();

    const rest = () => {
      opacity.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
      scale.setValue(1);
    };

    const hideInstant = () => {
      opacity.setValue(0);
      translateX.setValue(dx);
      translateY.setValue(preset.fromY);
      scale.setValue(preset.scaleFrom);
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
    if (progress >= 1) {
      return;
    }

    const remaining = Math.max(80, (1 - progress) * fadeIn * 1000);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: remaining,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: remaining,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: remaining,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: remaining,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [lineKey, motion.fadeIn, motion.fadeOut, motion.id, opacity, scale, translateX, translateY]);

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
    motion.scaleFrom,
    opacity,
    scale,
    translateX,
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
    ...lyricFontStyle(styleConfig.fontFamily, displayText, Platform.OS === 'ios' ? 'ios' : 'android'),
    fontWeight: styleConfig.bold ? '800' : '500',
    fontStyle: styleConfig.italic ? 'italic' : 'normal',
    textShadowColor: styleConfig.outline ? 'rgba(0,0,0,0.85)' : 'transparent',
    textShadowOffset: styleConfig.outline ? { width: 0, height: 1 } : { width: 0, height: 0 },
    textShadowRadius: styleConfig.outline ? 4 : 0,
  } as const;

  const alignItems =
    styleConfig.align === 'left' ? 'flex-start' : styleConfig.align === 'right' ? 'flex-end' : 'center';

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={onStageLayout}>
      <Animated.View
        {...pan.panHandlers}
        onLayout={(event) => {
          setSize({
            w: event.nativeEvent.layout.width,
            h: event.nativeEvent.layout.height,
          });
        }}
        style={[
          styles.lyricBox,
          {
            left: `${styleConfig.x}%`,
            top: `${styleConfig.y}%`,
            marginLeft: -size.w / 2,
            marginTop: -size.h / 2,
            maxWidth: stageSize.w > 0 ? stageSize.w * 0.92 : '92%',
            backgroundColor: styleConfig.backgroundColor ?? 'transparent',
            alignItems,
            opacity,
            transform: [{ translateX }, { translateY }, { scale }],
          },
        ]}
        collapsable={false}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  lyricBox: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
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
