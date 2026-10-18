import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated from 'react-native-reanimated';

import {
  chatEnterProgress,
  isOutgoingChat,
  visibleChatLines,
} from '@/lib/lyricChat';
import { useStageDrag } from '@/lib/stageDrag';
import { lyricFontStyle } from '@/theme';
import type { LyricLine, SubtitleStyle } from '@/types';

type Props = {
  lyrics: LyricLine[];
  currentTime: number;
  offset: number;
  placeholder?: string;
  styleConfig: SubtitleStyle;
  onPositionChange: (x: number, y: number) => void;
};

const INCOMING_BG = '#E8E8ED';
const INCOMING_TEXT = '#1C1C1E';
const OUTGOING_BG = '#0A84FF';

export function ChatLyricOverlay({
  lyrics,
  currentTime,
  offset,
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

  const rows = visibleChatLines(lyrics, currentTime, offset);
  const sample = rows[0]?.line.text || placeholder || '';
  const family = lyricFontStyle(
    styleConfig.fontFamily,
    sample,
    Platform.OS === 'ios' ? 'ios' : 'android',
    { bold: styleConfig.bold, italic: styleConfig.italic },
  );
  const outgoingFill = styleConfig.backgroundColor ?? OUTGOING_BG;
  const currentStart = rows.find((row) => row.current)?.line.timestamp ?? 0;
  const enter = chatEnterProgress(Math.max(0, currentTime - (currentStart + offset)), styleConfig.animationSpeed);

  const bubbles =
    rows.length === 0
      ? [{ key: 'placeholder', text: placeholder ?? '', outgoing: false, current: false }]
      : rows.map((row) => ({
          key: row.line.id,
          text: row.line.text,
          outgoing: isOutgoingChat(row.index),
          current: row.current,
        }));

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
            styles.thread,
            {
              left: `${styleConfig.x}%`,
              top: `${styleConfig.y}%`,
              marginLeft: -size.w / 2,
              marginTop: -size.h / 2,
              width: stageSize.w > 0 ? Math.min(stageSize.w * 0.88, 420) : '88%',
            },
            dragStyle,
          ]}
          collapsable={false}>
          {bubbles.map((bubble) => {
            const outgoing = bubble.outgoing;
            const pop = bubble.current ? 0.86 + enter * 0.14 : 1;
            return (
              <View
                key={bubble.key}
                style={[styles.row, outgoing ? styles.rowOut : styles.rowIn, { opacity: bubble.current ? enter : 1 }]}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: outgoing ? outgoingFill : INCOMING_BG,
                      transform: [{ scale: pop }],
                    },
                    outgoing ? styles.bubbleOut : styles.bubbleIn,
                  ]}>
                  <Text
                    style={[
                      styles.text,
                      family,
                      {
                        color: outgoing ? styleConfig.color : INCOMING_TEXT,
                        fontSize: styleConfig.fontSize,
                        lineHeight: Math.round(styleConfig.fontSize * 1.35),
                      },
                    ]}>
                    {bubble.text}
                  </Text>
                </View>
              </View>
            );
          })}
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  thread: {
    position: 'absolute',
    gap: 8,
    paddingVertical: 4,
  },
  row: {
    width: '100%',
    maxWidth: '100%',
  },
  rowIn: {
    alignItems: 'flex-start',
  },
  rowOut: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleIn: {
    borderBottomLeftRadius: 6,
  },
  bubbleOut: {
    borderBottomRightRadius: 6,
  },
  text: {
    fontWeight: '600',
  },
});
