import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated from 'react-native-reanimated';

import { useStageDrag } from '@/lib/stageDrag';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';
import type { VideoSticker } from '@/types';

type Props = {
  title: string;
  artist: string;
  currentTime: number;
  duration: number;
};

const BASE = 112;

function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function StickerOverlay({ title, artist, currentTime, duration }: Props) {
  const stickers = useProjectStore((s) => s.stickers);
  const selectedStickerId = useProjectStore((s) => s.selectedStickerId);
  const setStickerPosition = useProjectStore((s) => s.setStickerPosition);
  const selectSticker = useProjectStore((s) => s.selectSticker);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  const onStageLayout = (event: LayoutChangeEvent) => {
    setStage({
      w: event.nativeEvent.layout.width,
      h: event.nativeEvent.layout.height,
    });
  };

  if (stickers.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={onStageLayout}>
      {stickers.map((sticker) => (
        <DraggableSticker
          key={sticker.id}
          sticker={sticker}
          title={title}
          artist={artist}
          currentTime={currentTime}
          duration={duration}
          selected={sticker.id === selectedStickerId}
          stage={stage}
          onSelect={() => selectSticker(sticker.id)}
          onMove={(x, y) => setStickerPosition(sticker.id, x, y)}
        />
      ))}
    </View>
  );
}

function DraggableSticker({
  sticker,
  title,
  artist,
  currentTime,
  duration,
  selected,
  stage,
  onSelect,
  onMove,
}: {
  sticker: VideoSticker;
  title: string;
  artist: string;
  currentTime: number;
  duration: number;
  selected: boolean;
  stage: { w: number; h: number };
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}) {
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { gesture, dragStyle } = useStageDrag({
    x: sticker.x,
    y: sticker.y,
    getStage: () => stageRef.current,
    scale: sticker.scale,
    onSelect,
    onCommit: onMove,
  });

  return (
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
          styles.item,
          selected && styles.itemOn,
          {
            left: `${sticker.x}%`,
            top: `${sticker.y}%`,
            marginLeft: -size.w / 2,
            marginTop: -size.h / 2,
          },
          dragStyle,
        ]}
        collapsable={false}>
        {sticker.kind === 'vinyl' ? <VinylArt title={title} /> : null}
        {sticker.kind === 'cassette' ? <CassetteArt title={title} /> : null}
        {sticker.kind === 'music' ? <MusicArt title={title} /> : null}
        {sticker.kind === 'beats' ? <BeatsArt title={title} /> : null}
        {sticker.kind === 'player' ? (
          <PlayerArt title={title} artist={artist} currentTime={currentTime} duration={duration} />
        ) : null}
      </Reanimated.View>
    </GestureDetector>
  );
}

function VinylArt({ title }: { title: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      spin.setValue(0);
    };
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.stack}>
      <Animated.View style={[styles.vinyl, { transform: [{ rotate }] }]}>
        <View style={styles.groove} />
        <View style={[styles.groove, styles.grooveMid]} />
        <View style={styles.vinylLabel}>
          <Text numberOfLines={2} style={styles.vinylLabelText}>
            {title}
          </Text>
          <View style={styles.spindle} />
        </View>
      </Animated.View>
    </View>
  );
}

function CassetteArt({ title }: { title: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      spin.setValue(0);
    };
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.cassette}>
      <Text numberOfLines={1} style={styles.cassetteTitle}>
        {title}
      </Text>
      <View style={styles.window}>
        <Animated.View style={[styles.reel, { transform: [{ rotate }] }]}>
          <View style={styles.reelSpoke} />
          <View style={[styles.reelSpoke, styles.reelSpokeCross]} />
        </Animated.View>
        <View style={styles.tape} />
        <Animated.View style={[styles.reel, { transform: [{ rotate }] }]}>
          <View style={styles.reelSpoke} />
          <View style={[styles.reelSpoke, styles.reelSpokeCross]} />
        </Animated.View>
      </View>
    </View>
  );
}

const BEAT_COLORS = [
  '#FF2A00',
  '#FF5A00',
  '#FF8A00',
  '#FFB000',
  '#FFD400',
  '#E8FF00',
  '#8CFF00',
  '#2EFF00',
  '#00FF66',
  '#00FFC4',
  '#00E0FF',
  '#0090FF',
  '#0058FF',
  '#4A2AFF',
  '#8A2AFF',
  '#C42AFF',
];
const BEAT_BARS = 32;

function BeatsArt({ title }: { title: string }) {
  const pulses = useRef(Array.from({ length: BEAT_BARS }, () => new Animated.Value(0.35))).current;

  useEffect(() => {
    const loops = pulses.map((value, index) => {
      const up = 180 + (index % 7) * 40;
      const down = 140 + ((index * 3) % 5) * 30;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 0.28 + ((index * 17) % 40) / 100,
            duration: down,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(value, {
            toValue: 0.55 + ((index * 13) % 45) / 100,
            duration: up,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return loop;
    });
    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [pulses]);

  return (
    <View style={styles.beats}>
      <View style={styles.beatsWindow}>
        {Array.from({ length: BEAT_BARS }, (_, index) => {
          const color = BEAT_COLORS[Math.floor((index / BEAT_BARS) * BEAT_COLORS.length)] ?? '#FF2A00';
          const pulse = pulses[index % pulses.length];
          return (
            <View key={index} style={styles.beatSlot}>
              <Animated.View
                style={[
                  styles.beatBar,
                  {
                    backgroundColor: color,
                    height: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [6, 52],
                    }),
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <Text numberOfLines={1} style={styles.beatsTitle}>
        {title}
      </Text>
    </View>
  );
}

function PlayerArt({
  title,
  artist,
  currentTime,
  duration,
}: {
  title: string;
  artist: string;
  currentTime: number;
  duration: number;
}) {
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  return (
    <View style={styles.player}>
      <LinearGradient
        colors={['rgba(255,255,255,0.90)', 'rgba(255,255,255,0.58)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.15, y: 1 }}
        style={styles.playerGlass}>
        <View style={styles.playerArt}>
          <Ionicons name="musical-notes" size={16} color="#3A2A1C" />
        </View>
        <View style={styles.playerMeta}>
          <Text numberOfLines={1} style={styles.playerTitle}>
            {title}
          </Text>
          <Text numberOfLines={1} style={styles.playerArtist}>
            {artist}
          </Text>
          <View style={styles.playerTrack}>
            <View style={[styles.playerFill, { width: `${Math.max(2, progress * 100)}%` }]} />
          </View>
          <View style={styles.playerTimes}>
            <Text style={styles.playerTime}>{formatClock(currentTime)}</Text>
            <Text style={styles.playerTime}>-{formatClock(Math.max(0, duration - currentTime))}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const MUSIC_SPIKES = 72;
const MUSIC_PULSES = 18;
const MUSIC_SIZE = 120;
const MUSIC_INNER = 28;

function MusicArt({ title }: { title: string }) {
  const pulses = useRef(Array.from({ length: MUSIC_PULSES }, () => new Animated.Value(0.4))).current;

  useEffect(() => {
    const loops = pulses.map((value, index) => {
      const up = 160 + (index % 6) * 35;
      const down = 130 + ((index * 2) % 5) * 28;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 0.18 + ((index * 11) % 28) / 100,
            duration: down,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(value, {
            toValue: 0.55 + ((index * 7) % 45) / 100,
            duration: up,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return loop;
    });
    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [pulses]);

  return (
    <View style={styles.music}>
      <View style={styles.musicRing}>
        {Array.from({ length: MUSIC_SPIKES }, (_, index) => {
          const pulse = pulses[(index * 3) % pulses.length];
          const minH = 3 + (index % 4);
          const maxH = 16 + (index % 13);
          return (
            <View
              key={index}
              style={[styles.musicSpoke, { transform: [{ rotate: `${(index / MUSIC_SPIKES) * 360}deg` }] }]}>
              <Animated.View
                style={[
                  styles.musicSpike,
                  {
                    height: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [minH, maxH],
                    }),
                    marginTop: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [MUSIC_SIZE / 2 - MUSIC_INNER - minH, MUSIC_SIZE / 2 - MUSIC_INNER - maxH],
                    }),
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <Text numberOfLines={2} style={styles.musicTitle}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    position: 'absolute',
    alignItems: 'center',
  },
  itemOn: {
    shadowColor: colors.accent,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 8,
  },
  stack: {
    alignItems: 'center',
  },
  vinyl: {
    width: BASE,
    height: BASE,
    borderRadius: BASE / 2,
    backgroundColor: '#121212',
    borderWidth: 5,
    borderColor: '#2C2C2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groove: {
    ...StyleSheet.absoluteFillObject,
    margin: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  grooveMid: {
    margin: 22,
  },
  vinylLabel: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#C44B4B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  vinylLabelText: {
    color: '#FFF4E8',
    fontSize: 7,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 8,
  },
  spindle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0B0B12',
  },
  cassette: {
    width: 128,
    backgroundColor: '#1C2438',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6F7A99',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  cassetteTitle: {
    color: '#F4E8C8',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  window: {
    height: 34,
    borderRadius: 6,
    backgroundColor: '#0A1020',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  reel: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3A2A18',
    borderWidth: 2,
    borderColor: '#C9A46A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelSpoke: {
    position: 'absolute',
    width: 12,
    height: 2,
    backgroundColor: '#E8D2A0',
  },
  reelSpokeCross: {
    transform: [{ rotate: '90deg' }],
  },
  tape: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#6B4423',
  },
  beats: {
    width: 168,
    alignItems: 'center',
    gap: 6,
  },
  beatsWindow: {
    width: '100%',
    height: 64,
    borderRadius: 16,
    backgroundColor: '#050505',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 6,
  },
  beatSlot: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  beatBar: {
    width: 3,
    borderRadius: 99,
  },
  beatsTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  player: {
    width: 228,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  playerGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  playerArt: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#C8B49A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerMeta: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  playerTitle: {
    color: '#1A1A1A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  playerArtist: {
    color: '#6B6B6B',
    fontSize: 10,
    fontWeight: '600',
  },
  playerTrack: {
    height: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(80,80,80,0.22)',
    overflow: 'hidden',
    marginTop: 4,
  },
  playerFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#2B2B2B',
  },
  playerTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  playerTime: {
    color: '#7A7A7A',
    fontSize: 9,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  music: {
    alignItems: 'center',
    width: 128,
    gap: 6,
  },
  musicRing: {
    width: MUSIC_SIZE,
    height: MUSIC_SIZE,
  },
  musicSpoke: {
    position: 'absolute',
    left: MUSIC_SIZE / 2 - 0.75,
    top: 0,
    width: 1.5,
    height: MUSIC_SIZE,
    alignItems: 'center',
  },
  musicSpike: {
    width: 1.5,
    borderRadius: 1,
    backgroundColor: '#F4F4F4',
  },
  musicTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
