import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppMenu } from '@/components/AppMenu';
import { LandingBanner } from '@/components/LandingBanner';
import { isAuddEnabled } from '@/lib/audd';
import { pickFile, pickVideoFromLibrary } from '@/lib/media';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const setVideo = useProjectStore((s) => s.setVideo);
  const setPendingSongDetect = useProjectStore((s) => s.setPendingSongDetect);
  const videoUri = useProjectStore((s) => s.videoUri);
  const videoName = useProjectStore((s) => s.videoName);
  const reset = useProjectStore((s) => s.reset);
  const [busy, setBusy] = useState(false);

  const openVideo = async (from: 'library' | 'files') => {
    try {
      setBusy(true);
      const picked = from === 'library' ? await pickVideoFromLibrary() : await pickFile('video');
      if (!picked) return;
      reset();
      setVideo(picked);
      setPendingSongDetect(isAuddEnabled());
      router.push('/editor');
    } catch (error) {
      Alert.alert('Could not open video', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <LinearGradient colors={[colors.bg, '#120E24', colors.bg]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(139, 124, 255, 0.28)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 1 }}
        style={styles.glowA}
      />
      <LinearGradient
        colors={['rgba(255, 92, 138, 0.12)', 'transparent']}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0.2 }}
        style={styles.glowB}
      />

      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <View style={styles.menuChip}>
            <AppMenu />
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.mark}>
            <Ionicons name="musical-notes" size={22} color={colors.accent} />
          </View>
          <Text style={styles.title}>AI LyricVid</Text>
          <Text style={styles.subtitle}>
            Pick a video, choose the song, and AI adds timed lyrics. Style the words, then export a finished video.
          </Text>

          <View style={styles.preview}>
            <LinearGradient colors={['#2A2150', '#12101C', '#0B0B12']} style={styles.previewFill}>
              <View style={styles.previewTop}>
                <View style={styles.dot} />
                <View style={[styles.dot, styles.dotMid]} />
                <View style={styles.dot} />
              </View>
              <View style={styles.lyricBox}>
                <Text style={styles.lyricDim}>when the night</Text>
                <Text style={styles.lyricOn}> falls</Text>
              </View>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.actions}>
          {videoUri ? (
            <Pressable onPress={() => router.push('/editor')} style={styles.continue}>
              <Ionicons name="play-circle" size={22} color={colors.accent} />
              <View style={styles.continueCopy}>
                <Text style={styles.continueKicker}>Continue project</Text>
                <Text numberOfLines={1} style={styles.continueName}>
                  {videoName ?? 'Current video'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ) : null}

          <Pressable
            disabled={busy}
            onPress={() => openVideo('library')}
            style={({ pressed }) => [styles.primary, busy && styles.disabled, pressed && !busy && styles.pressed]}>
            <Ionicons name="film-outline" size={20} color="#0B0B10" />
            <Text style={styles.primaryLabel}>{busy ? 'Opening…' : 'Choose from library'}</Text>
          </Pressable>

          <Pressable
            disabled={busy}
            onPress={() => openVideo('files')}
            style={({ pressed }) => [styles.secondary, busy && styles.disabled, pressed && !busy && styles.pressed]}>
            <Ionicons name="folder-open-outline" size={20} color={colors.text} />
            <Text style={styles.secondaryLabel}>Pick a video file</Text>
          </Pressable>
        </View>
        <View style={styles.banner}>
          <LandingBanner />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  glowA: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 280,
    height: 280,
  },
  glowB: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    width: 240,
    height: 240,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 22,
  },
  topBar: {
    paddingTop: 4,
  },
  menuChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
  },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  preview: {
    width: '100%',
    maxWidth: 340,
    aspectRatio: 16 / 10,
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  previewFill: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 18,
  },
  previewTop: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotMid: {
    backgroundColor: colors.accent,
  },
  lyricBox: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  lyricDim: {
    color: 'rgba(245,245,247,0.7)',
    fontSize: 20,
    fontWeight: '800',
  },
  lyricOn: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '800',
  },
  actions: {
    gap: 10,
    paddingBottom: 12,
  },
  banner: {
    marginHorizontal: -22,
  },
  continue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  continueCopy: {
    flex: 1,
    gap: 2,
  },
  continueKicker: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  continueName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
  },
  primaryLabel: {
    color: '#0B0B10',
    fontWeight: '800',
    fontSize: 16,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryLabel: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
  },
});
