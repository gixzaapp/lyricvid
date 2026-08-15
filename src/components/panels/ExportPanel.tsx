import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, ToastAndroid, View } from 'react-native';

import { Button, Helper } from '@/components/ui';
import { preloadExportInterstitial, resetExportAdGate, showExportInterstitialAtProgress } from '@/lib/ads';
import {
  exportFinalVideo,
  HIRES_AUDIO_MESSAGE,
  isHiResAudioError,
  isVideoExportAvailable,
} from '@/lib/export';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';

function fileStem(name: string | null) {
  const base = (name ?? 'lyricvid').replace(/\.[^.]+$/, '');
  return base.replace(/[^\w.-]+/g, '_') || 'lyricvid';
}

export function ExportPanel() {
  const lyrics = useProjectStore((s) => s.lyrics);
  const offset = useProjectStore((s) => s.offset);
  const style = useProjectStore((s) => s.style);
  const videoUri = useProjectStore((s) => s.videoUri);
  const videoName = useProjectStore((s) => s.videoName);
  const audioUri = useProjectStore((s) => s.audioUri);
  const keepOriginalAudio = useProjectStore((s) => s.keepOriginalAudio);
  const track = useProjectStore((s) => s.track);
  const videoDuration = useProjectStore((s) => s.videoDuration);
  const timingDuration = useProjectStore((s) => s.timingDuration);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const stem = fileStem(track?.trackName ?? videoName);
  const duration = videoDuration > 0 ? videoDuration : timingDuration();
  const canExportVideo = isVideoExportAvailable();

  useEffect(() => {
    preloadExportInterstitial();
  }, []);

  const exportVideo = async () => {
    try {
      setBusy(true);
      setProgress(0.02);
      resetExportAdGate();
      const result = await exportFinalVideo({
        videoUri: videoUri!,
        audioUri,
        replaceAudio: !keepOriginalAudio && Boolean(audioUri),
        stem,
        lyrics,
        offset,
        duration,
        style,
        onProgress: (value) => {
          setProgress(value);
          showExportInterstitialAtProgress(value);
        },
      });
      Alert.alert(
        'Video ready',
        result.savedToGallery
          ? `${result.filename} was saved to your gallery.`
          : `${result.filename} is ready. Use the system sheet to save or share it.`,
      );
    } catch (error) {
      if (isHiResAudioError(error)) {
        if (Platform.OS === 'android') {
          ToastAndroid.show(HIRES_AUDIO_MESSAGE, ToastAndroid.LONG);
        } else {
          Alert.alert('Hi-Res audio', HIRES_AUDIO_MESSAGE);
        }
        return;
      }
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <View style={styles.col}>
      {!canExportVideo ? (
        <Helper>
          Open the AI LyricVid app from the Android/iOS build to export. Expo Go cannot create a finished MP4.
        </Helper>
      ) : null}
      <Button
        label={busy ? 'Exporting video…' : 'Export video'}
        disabled={!videoUri || !lyrics.length || busy}
        onPress={exportVideo}
      />
      {busy ? (
        <View style={styles.progressBlock}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(Math.max(progress, 0.03) * 100)}%` }]} />
          </View>
          <Text style={styles.percent}>{`${Math.round(progress * 100)}%`}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  col: {
    gap: 12,
  },
  progressBlock: {
    gap: 8,
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  percent: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
});
