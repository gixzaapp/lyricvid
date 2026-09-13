import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { highlightRangeInText } from '@/lib/lyrics';
import { clamp } from '@/lib/time';
import { colors, lyricFontStyle } from '@/theme';
import type { LyricWord, SubtitleStyle } from '@/types';

type Props = {
  text?: string;
  words: LyricWord[];
  currentIndex?: number;
  lineKey: string;
  placeholder?: string;
  styleConfig: SubtitleStyle;
  onPositionChange: (x: number, y: number) => void;
};

export function LyricOverlay({
  text = '',
  words,
  currentIndex = -1,
  lineKey,
  placeholder,
  styleConfig,
  onPositionChange,
}: Props) {
  const box = useRef({ w: 0, h: 0 });
  const start = useRef({ x: styleConfig.x, y: styleConfig.y });
  const styleRef = useRef(styleConfig);
  styleRef.current = styleConfig;
  const wordsRef = useRef(words);
  const textRef = useRef(text);
  const placeholderRef = useRef(placeholder);
  const shownKey = useRef<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [paintedWords, setPaintedWords] = useState(words);
  const [paintedText, setPaintedText] = useState(text);
  const [paintedPlaceholder, setPaintedPlaceholder] = useState(placeholder);
  wordsRef.current = words;
  textRef.current = text;
  placeholderRef.current = placeholder;

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
    if (shownKey.current === lineKey) {
      setPaintedWords(words);
      setPaintedText(text);
    }
  }, [lineKey, text, words]);

  useEffect(() => {
    shownKey.current = lineKey;
    setPaintedWords(wordsRef.current);
    setPaintedText(textRef.current);
    setPaintedPlaceholder(placeholderRef.current);
    opacity.stopAnimation();
    translateY.stopAnimation();
    const show = lineKey !== 'hidden';
    opacity.setValue(show ? 1 : 0);
    translateY.setValue(0);
  }, [lineKey, opacity, translateY]);

  const onStageLayout = (event: LayoutChangeEvent) => {
    const next = {
      w: event.nativeEvent.layout.width,
      h: event.nativeEvent.layout.height,
    };
    box.current = next;
    setStageSize(next);
  };

  const displayText = paintedText || paintedPlaceholder || '';
  const highlight = highlightRangeInText(paintedText, paintedWords, currentIndex);
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
            transform: [{ translateY }],
          },
        ]}>
        {paintedText ? (
          <Text style={[wordStyle, styles.line, { textAlign: styleConfig.align }]}>
            {highlight.end > highlight.start ? (
              <>
                <Text style={styles.word}>{paintedText.slice(0, highlight.start)}</Text>
                <Text style={[styles.word, styles.currentWord]}>
                  {paintedText.slice(highlight.start, highlight.end)}
                </Text>
                <Text style={styles.word}>{paintedText.slice(highlight.end)}</Text>
              </>
            ) : (
              <Text style={styles.word}>{paintedText}</Text>
            )}
          </Text>
        ) : paintedPlaceholder ? (
          <Text style={[wordStyle, styles.line, { textAlign: styleConfig.align, opacity: 0.7 }]}>
            {paintedPlaceholder}
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
