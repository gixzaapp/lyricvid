import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatClock } from '@/lib/time';
import { colors } from '@/theme';

type Props = {
  currentTime: number;
  duration: number;
  playing: boolean;
  onToggle: () => void;
  onSeek: (time: number) => void;
};

export function PlaybackBar({ currentTime, duration, playing, onToggle, onSeek }: Props) {
  const dragging = useRef(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const shownTime = scrubTime ?? currentTime;
  const max = Math.max(duration, 0.1);

  return (
    <View style={styles.row}>
      <Pressable onPress={onToggle} style={styles.play} accessibilityRole="button">
        <Ionicons name={playing ? 'pause' : 'play'} size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.time}>{formatClock(shownTime)}</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={max}
        value={Math.min(Math.max(shownTime, 0), max)}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.text}
        onSlidingStart={() => {
          dragging.current = true;
          setScrubTime(currentTime);
        }}
        onValueChange={(value) => {
          if (dragging.current) {
            setScrubTime(value);
          }
        }}
        onSlidingComplete={(value) => {
          dragging.current = false;
          setScrubTime(null);
          onSeek(value);
        }}
      />
      <Text style={styles.time}>{formatClock(duration)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slider: {
    flex: 1,
    height: 32,
  },
  time: {
    color: colors.muted,
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    width: 42,
    textAlign: 'center',
  },
});
