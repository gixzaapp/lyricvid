import { useMemo, useRef, useState } from 'react';
import {
  Platform,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { clamp } from '@/lib/time';
import { colors, fontFamilyFor } from '@/theme';
import type { LyricWord, SubtitleStyle } from '@/types';

type Props = {
  words: LyricWord[];
  placeholder?: string;
  styleConfig: SubtitleStyle;
  onPositionChange: (x: number, y: number) => void;
};

export function LyricOverlay({ words, placeholder, styleConfig, onPositionChange }: Props) {
  const box = useRef({ w: 0, h: 0 });
  const start = useRef({ x: styleConfig.x, y: styleConfig.y });
  const styleRef = useRef(styleConfig);
  styleRef.current = styleConfig;
  const [size, setSize] = useState({ w: 0, h: 0 });

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

  const onStageLayout = (event: LayoutChangeEvent) => {
    box.current = {
      w: event.nativeEvent.layout.width,
      h: event.nativeEvent.layout.height,
    };
  };

  const resolvedFont = fontFamilyFor(styleConfig.fontFamily);
  const wordStyle = {
    color: styleConfig.color,
    fontSize: styleConfig.fontSize,
    ...(Platform.OS === 'ios'
      ? resolvedFont.ios
        ? { fontFamily: resolvedFont.ios }
        : {}
      : { fontFamily: resolvedFont.android }),
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
      <View
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
            backgroundColor: styleConfig.backgroundColor ?? 'transparent',
            alignItems,
          },
        ]}>
        {words.length ? (
          <View
            style={[
              styles.row,
              { justifyContent: alignItems === 'flex-start' ? 'flex-start' : alignItems === 'flex-end' ? 'flex-end' : 'center' },
            ]}>
            {words.map((word, index) => {
              const current = index === words.length - 1;
              return (
                <Text
                  key={`${word.timestamp}-${word.text}-${index}`}
                  style={[
                    wordStyle,
                    styles.word,
                    current && styles.currentWord,
                  ]}>
                  {word.text}
                  {index < words.length - 1 ? ' ' : ''}
                </Text>
              );
            })}
          </View>
        ) : placeholder ? (
          <Text style={[wordStyle, { textAlign: styleConfig.align, opacity: 0.7 }]}>{placeholder}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lyricBox: {
    position: 'absolute',
    maxWidth: '88%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  word: {
    opacity: 0.72,
  },
  currentWord: {
    opacity: 1,
    color: colors.accent,
  },
});
