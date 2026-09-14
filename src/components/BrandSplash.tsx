import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SURFACE = '#0b1326';
const ON_SURFACE = '#dae2fd';
const ON_VARIANT = '#cbc3d7';
const OUTLINE = '#958ea0';
const SECONDARY = '#4cd7f6';
const PRIMARY = '#d0bcff';

const STATUSES = [
  'Calibrating beat grid...',
  'Synthesizing vocal stems...',
  'Mapping typographic tempos...',
  'Ready to compose',
];

type Props = {
  onFinished: () => void;
};

export function BrandSplash({ onFinished }: Props) {
  const progress = useRef(new Animated.Value(0.12)).current;
  const [step, setStep] = useState(0);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  useEffect(() => {
    const tick = setInterval(() => {
      setStep((current) => Math.min(current + 1, STATUSES.length - 1));
    }, 700);

    Animated.timing(progress, {
      toValue: 1,
      duration: 2400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onFinished();
    });

    return () => clearInterval(tick);
  }, [onFinished, progress]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['12%', '100%'],
  });
  const percent = Math.min(100, 28 + step * 24);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.glowWrap} pointerEvents="none">
        <LinearGradient
          colors={['rgba(160,120,255,0.22)', 'rgba(76,215,246,0.14)', 'rgba(227,100,167,0.08)']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.glow}
        />
      </View>

      <View style={styles.center}>
        <View style={styles.emblemWrap}>
          <View style={styles.emblem}>
            <Image source={require('../../assets/images/splash-icon.png')} style={styles.mark} />
          </View>
          <View style={styles.pro}>
            <Text style={styles.proText}>PRO</Text>
          </View>
        </View>

        <Text style={styles.title}>
          <Text style={styles.titleAi}>AI </Text>
          LyricVid
        </Text>
        <Text style={styles.tagline}>Sync lyrics to video with intelligent rhythm</Text>

        <View style={styles.chip}>
          <Text style={styles.chipText}>NEURAL AUDIO SYNC 2.0</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.track}>
          <Animated.View style={[styles.bar, { width }]}>
            <LinearGradient
              colors={['#a078ff', '#4cd7f6', '#d0bcff']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.status}>{STATUSES[step]}</Text>
          <Text style={styles.percent}>{percent}%</Text>
        </View>
        <Text style={styles.credit}>v{version} • Powered by Gixza AI</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: SURFACE,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  glowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    width: 280,
    height: 280,
    borderRadius: 140,
    transform: [{ scale: 1.35 }],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemWrap: {
    marginBottom: 36,
  },
  emblem: {
    width: 148,
    height: 148,
    borderRadius: 32,
    backgroundColor: 'rgba(19, 27, 46, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 12,
  },
  mark: {
    width: 108,
    height: 108,
  },
  pro: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proText: {
    color: '#3c0091',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    color: ON_SURFACE,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  titleAi: {
    color: SECONDARY,
  },
  tagline: {
    marginTop: 12,
    color: ON_VARIANT,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 260,
  },
  chip: {
    marginTop: 28,
    backgroundColor: 'rgba(34, 42, 61, 0.72)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    color: ON_VARIANT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  footer: {
    paddingBottom: 18,
  },
  track: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#2d3449',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  status: {
    color: OUTLINE,
    fontSize: 11,
    fontWeight: '600',
  },
  percent: {
    color: SECONDARY,
    fontSize: 11,
    fontWeight: '700',
  },
  credit: {
    marginTop: 18,
    color: '#494454',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
});
