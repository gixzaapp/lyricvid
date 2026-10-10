import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated from 'react-native-reanimated';

import { wheelPosition } from '@/lib/lyrics';
import { useStageDrag } from '@/lib/stageDrag';
import { clamp } from '@/lib/time';
import { lyricFontStyle } from '@/theme';
import type { LyricLine, SubtitleStyle } from '@/types';

type Props = {
  lyrics: LyricLine[];
  currentTime: number;
  offset: number;
  duration: number;
  placeholder?: string;
  styleConfig: SubtitleStyle;
  onPositionChange: (x: number, y: number) => void;
};

const VISIBLE = 2;

export function WheelLyricOverlay({
  lyrics,
  currentTime,
  offset,
  duration,
  placeholder,
  styleConfig,
  onPositionChange,
}: Props) {
  const box = useRef({ w: 0, h: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const { gesture, dragStyle } = useStageDrag({
    x: styleConfig.x,
    y: styleConfig.y,
    getStage: () => box.current,
    onCommit: onPositionChange,
  });

  const onStageLayout = (event: LayoutChangeEvent) => {
    const next = {
      w: event.nativeEvent.layout.width,
      h: event.nativeEvent.layout.height,
    };
    box.current = next;
    setStageSize(next);
  };

  const { position } = wheelPosition(lyrics, currentTime, offset, duration);
  const rowHeight = Math.max(28, styleConfig.fontSize * 1.35);
  const wheelHeight = rowHeight * (VISIBLE * 2 + 1) + 16;
  const family = lyricFontStyle(
    styleConfig.fontFamily,
    lyrics[0]?.text ?? placeholder ?? '',
    Platform.OS === 'ios' ? 'ios' : 'android',
    { bold: styleConfig.bold, italic: styleConfig.italic },
  );
  const base = Math.floor(position);
  const frac = position < 0 ? 0 : position - base;
  const rows =
    lyrics.length === 0 || position < 0
      ? [{ key: 'placeholder', text: placeholder ?? '', slot: 0 }]
      : Array.from({ length: VISIBLE * 2 + 1 }, (_, i) => {
          const step = i - VISIBLE;
          const lineIndex = base + step;
          const line = lineIndex >= 0 && lineIndex < lyrics.length ? lyrics[lineIndex] : undefined;
          return {
            key: `${step}-${line?.id ?? 'empty'}`,
            text: line?.text ?? '',
            slot: step - frac,
          };
        });

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={onStageLayout}>
      <GestureDetector gesture={gesture}>
      <Reanimated.View
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
          styles.wheel,
          {
            left: `${styleConfig.x}%`,
            top: `${styleConfig.y}%`,
            marginLeft: -size.w / 2,
            marginTop: -size.h / 2,
            width: stageSize.w > 0 ? Math.min(stageSize.w * 0.88, 420) : '88%',
            height: wheelHeight,
            backgroundColor: styleConfig.backgroundColor ?? 'rgba(10,10,16,0.42)',
          },
          dragStyle,
        ]}
        collapsable={false}>
        <View style={[styles.selection, { height: rowHeight, top: (wheelHeight - rowHeight) / 2 }]} />
        <View style={styles.fadeTop} pointerEvents="none" />
        <View style={styles.fadeBottom} pointerEvents="none" />
        <View style={styles.rows}>
          {rows.map((row) => {
            const distance = Math.abs(row.slot);
            const opacity = clamp(1 - distance * 0.38, 0.18, 1);
            const scale = clamp(1 - distance * 0.12, 0.72, 1);
            return (
              <View
                key={row.key}
                style={[
                  styles.row,
                  {
                    top: (wheelHeight - rowHeight) / 2,
                    height: rowHeight,
                    transform: [{ translateY: row.slot * rowHeight }, { scale }],
                    opacity,
                  },
                ]}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.line,
                    family,
                    {
                      color: styleConfig.color,
                      fontSize: styleConfig.fontSize,
                      textAlign: styleConfig.align,
                      textShadowColor: styleConfig.outline ? 'rgba(0,0,0,0.75)' : 'transparent',
                      textShadowOffset: styleConfig.outline ? { width: 0, height: 1 } : { width: 0, height: 0 },
                      textShadowRadius: styleConfig.outline ? 3 : 0,
                    },
                  ]}>
                  {row.text}
                </Text>
              </View>
            );
          })}
        </View>
      </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  selection: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '28%',
    backgroundColor: 'rgba(8,8,12,0.28)',
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '28%',
    backgroundColor: 'rgba(8,8,12,0.28)',
  },
  rows: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  row: {
    position: 'absolute',
    left: 10,
    right: 10,
    justifyContent: 'center',
  },
  line: {
    fontWeight: '700',
  },
});
