import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SURFACE = '#0b1326';
const ON_SURFACE = '#dae2fd';
const ON_VARIANT = '#cbc3d7';
const PRIMARY = '#d0bcff';
const PRIMARY_CONTAINER = '#a078ff';
const SECONDARY = '#4cd7f6';
const SECONDARY_FIXED = '#acedff';
const TERTIARY = '#ffafd3';
const TERTIARY_CONTAINER = '#e364a7';
const CONTAINER = '#171f33';
const CONTAINER_LOW = '#131b2e';
const CONTAINER_HIGH = '#222a3d';
const CONTAINER_HIGHEST = '#2d3449';
const OUTLINE = '#958ea0';
const OUTLINE_VARIANT = '#494454';
const ON_PRIMARY = '#3c0091';

const STATUS = [
  'Calibrating beat grid...',
  'Synthesizing vocal stems...',
  'Mapping typographic tempos...',
  'Ready to compose',
];

type Props = {
  onFinished: () => void;
};

export function BrandSplash({ onFinished }: Props) {
  const [step, setStep] = useState(0);
  const pulse = useRef(new Animated.Value(0.7)).current;
  const ping = useRef(new Animated.Value(1)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const version = Constants.expoConfig?.version ?? '1.0.2';

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.7, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(ping, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(ping, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
    Animated.timing(bar, {
      toValue: 1,
      duration: 2400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [bar, ping, pulse]);

  useEffect(() => {
    const tick = setInterval(() => {
      setStep((current) => Math.min(current + 1, STATUS.length - 1));
    }, 650);
    const done = setTimeout(onFinished, 2600);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [onFinished]);

  const percent = Math.min(100, 28 + step * 24);
  const barWidth = bar.interpolate({ inputRange: [0, 1], outputRange: ['12%', '100%'] });

  return (
    <View style={styles.root}>
      <LinearGradient colors={[SURFACE, '#101a33', SURFACE]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.orbOuter, { opacity: pulse, transform: [{ scale: pulse }] }]}>
        <LinearGradient
          colors={['rgba(160,120,255,0.28)', 'rgba(76,215,246,0.16)', 'rgba(227,100,167,0.1)']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.orbFill}
        />
      </Animated.View>
      <View style={styles.orbInner} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.topRow}>
          <View style={styles.readyChip}>
            <Animated.View style={[styles.readyDot, { opacity: ping }]} />
            <Text style={styles.readyLabel}>ENGINE READY</Text>
          </View>
        </View>

        <View style={styles.center}>
          <View style={styles.emblemWrap}>
            <LinearGradient
              colors={[PRIMARY, SECONDARY, TERTIARY_CONTAINER]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emblemGlow}
            />
            <View style={styles.emblem}>
              <Image source={require('../../assets/images/icon.png')} style={styles.emblemImage} />
            </View>
            <View style={styles.proBadge}>
              <Text style={styles.proText}>PRO</Text>
            </View>
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.titleAi}>AI</Text>
            <Text style={styles.titleRest}> LyricVid</Text>
          </View>
          <Text style={styles.tagline}>Sync lyrics to video with intelligent rhythm</Text>

          <View style={styles.neuralChip}>
            <Ionicons name="sparkles" size={12} color={SECONDARY} />
            <Text style={styles.neuralLabel}>NEURAL AUDIO SYNC 2.0</Text>
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: barWidth }]}>
              <LinearGradient
                colors={[PRIMARY_CONTAINER, SECONDARY, PRIMARY]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.status}>{STATUS[step]}</Text>
            <Text style={styles.percent}>{`${percent}%`}</Text>
          </View>
          <Text style={styles.footer}>{`v${version}  •  Powered by Generative AI`}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SURFACE,
  },
  orbOuter: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    alignSelf: 'center',
    top: '28%',
    overflow: 'hidden',
  },
  orbFill: {
    flex: 1,
  },
  orbInner: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    alignSelf: 'center',
    top: '34%',
    backgroundColor: 'rgba(208,188,255,0.18)',
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  topRow: {
    alignItems: 'flex-end',
  },
  readyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(23,31,51,0.72)',
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SECONDARY,
  },
  readyLabel: {
    color: SECONDARY_FIXED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  center: {
    alignItems: 'center',
  },
  emblemWrap: {
    width: 148,
    height: 148,
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemGlow: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 36,
    opacity: 0.35,
  },
  emblem: {
    width: 144,
    height: 144,
    borderRadius: 28,
    backgroundColor: CONTAINER_LOW,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emblemImage: {
    width: 132,
    height: 132,
  },
  proBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  proText: {
    color: ON_PRIMARY,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  titleAi: {
    color: SECONDARY,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  titleRest: {
    color: ON_SURFACE,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  tagline: {
    marginTop: 10,
    color: ON_VARIANT,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 260,
  },
  neuralChip: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(34,42,61,0.72)',
  },
  neuralLabel: {
    color: ON_VARIANT,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  bottom: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    gap: 10,
  },
  track: {
    height: 4,
    borderRadius: 999,
    backgroundColor: CONTAINER_HIGHEST,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  status: {
    color: OUTLINE,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  percent: {
    color: SECONDARY,
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    marginTop: 6,
    color: OUTLINE_VARIANT,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
});
