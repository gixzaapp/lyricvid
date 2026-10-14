import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated from 'react-native-reanimated';

import { depthSlotStyle, depthVisibleRange, type DepthStyleId } from '@/lib/lyricDepth';
import { wheelPosition } from '@/lib/lyrics';
import { useStageDrag } from '@/lib/stageDrag';
import { lyricFontStyle } from '@/theme';
import type { LyricLine, SubtitleStyle } from '@/types';

type Props = {
  mode: DepthStyleId;
  lyrics: LyricLine[];
  currentTime: number;
  offset: number;
  duration: number;
  placeholder?: string;
  styleConfig: SubtitleStyle;
  onPositionChange: (x: number, y: number) => void;
};

export function DepthLyricOverlay({
  mode,
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
  const visible = depthVisibleRange(mode);
  const rowHeight = Math.max(28, styleConfig.fontSize * 1.35);
  const frameHeight = rowHeight * (visible * 2 + 1) + 16;
  const frameWidth =
    stageSize.w > 0
      ? Math.min(stageSize.w * (mode === 'coverflow' ? 0.96 : 0.88), mode === 'coverflow' ? 520 : 420)
      : mode === 'coverflow'
        ? '96%'
        : '88%';
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
      : Array.from({ length: visible * 2 + 1 }, (_, i) => {
          const step = i - visible;
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
            styles.frame,
            {
              left: `${styleConfig.x}%`,
              top: `${styleConfig.y}%`,
              marginLeft: -size.w / 2,
              marginTop: -size.h / 2,
              width: frameWidth,
              height: frameHeight,
              overflow: 'visible',
              backgroundColor: styleConfig.backgroundColor ?? 'rgba(10,10,16,0.42)',
            },
            dragStyle,
          ]}
          collapsable={false}>
          <View style={styles.rows}>
            {rows.map((row) => {
              const look = depthSlotStyle(mode, row.slot, rowHeight, size.w || 280);
              if (look.hide || !row.text) {
                return null;
              }
              return (
                <View
                  key={row.key}
                  style={[
                    styles.row,
                    {
                      top: (frameHeight - rowHeight) / 2,
                      height: rowHeight,
                      opacity: look.opacity,
                      backfaceVisibility: 'hidden',
                      transform: [
                        { perspective: 800 },
                        { translateX: look.tx },
                        { translateY: look.ty },
                        { rotateX: `${look.rx}deg` },
                        { rotateY: `${look.ry}deg` },
                        { scale: look.scale },
                      ],
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
  frame: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
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
