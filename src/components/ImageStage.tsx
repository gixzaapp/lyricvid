import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LyricOverlay } from '@/components/LyricOverlay';
import { StickerOverlay } from '@/components/StickerOverlay';
import { WheelLyricOverlay } from '@/components/WheelLyricOverlay';
import { PlaybackBar } from '@/components/PlaybackBar';
import type { VideoStageHandle } from '@/components/VideoStage';
import { getActiveLineIndex, getVisibleLineWords, lineEndTime } from '@/lib/lyrics';
import { useT } from '@/store/locale';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';

type Props = {
  currentTime: number;
  onCurrentTime: (time: number) => void;
  compact?: boolean;
};

export const ImageStage = forwardRef<VideoStageHandle, Props>(function ImageStage(
  { currentTime, onCurrentTime, compact = false },
  ref,
) {
  const t = useT();
  const imageUri = useProjectStore((s) => s.videoUri);
  const audioUri = useProjectStore((s) => s.audioUri);
  const lyrics = useProjectStore((s) => s.lyrics);
  const offset = useProjectStore((s) => s.offset);
  const style = useProjectStore((s) => s.style);
  const track = useProjectStore((s) => s.track);
  const duration = useProjectStore((s) => s.videoDuration);
  const setAudioDuration = useProjectStore((s) => s.setAudioDuration);
  const setPosition = useProjectStore((s) => s.setPosition);
  const setStageWidth = useProjectStore((s) => s.setStageWidth);
  const audioPlayer = useAudioPlayer(audioUri ? { uri: audioUri } : null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const [ticking, setTicking] = useState(false);
  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  useEffect(() => {
    if (audioUri && audioStatus.duration > 0) {
      setAudioDuration(audioStatus.duration);
    }
  }, [audioStatus.duration, audioUri, setAudioDuration]);

  useEffect(() => {
    if (!audioUri || !audioStatus.playing) {
      return;
    }
    if (duration > 0 && audioStatus.currentTime >= duration - 0.05) {
      audioPlayer.pause();
      onCurrentTime(duration);
      return;
    }
    onCurrentTime(audioStatus.currentTime);
  }, [audioPlayer, audioStatus.currentTime, audioStatus.playing, audioUri, duration, onCurrentTime]);

  useEffect(() => {
    if (audioUri || !ticking) {
      return;
    }
    const timer = setInterval(() => {
      const next = timeRef.current + 0.1;
      if (duration > 0 && next >= duration - 0.05) {
        setTicking(false);
        onCurrentTime(duration);
        return;
      }
      onCurrentTime(next);
    }, 100);
    return () => clearInterval(timer);
  }, [audioUri, duration, onCurrentTime, ticking]);

  const end = duration > 0 ? duration : 0;
  const visibleLine = getVisibleLineWords(lyrics, currentTime, offset, end);
  const activeIndex = getActiveLineIndex(lyrics, currentTime, offset);
  const lineKey = lyrics.length === 0 ? 'placeholder' : activeIndex >= 0 ? lyrics[activeIndex].id : 'hidden';
  const lineStart = activeIndex >= 0 ? Math.max(0, lyrics[activeIndex].timestamp + offset) : 0;
  const lineEnd = activeIndex >= 0 ? lineEndTime(lyrics, activeIndex, end, offset) : 0;
  const nextStart = activeIndex >= 0 && lyrics[activeIndex + 1] ? lyrics[activeIndex + 1].timestamp + offset : null;
  const fadeOut =
    lineKey !== 'hidden' &&
    lineKey !== 'placeholder' &&
    (nextStart == null || nextStart > lineEnd + 0.04);
  const playing = Boolean(audioUri) ? audioStatus.playing : ticking;

  const seekTo = (time: number) => {
    const next = Math.max(0, end > 0 ? Math.min(time, end) : time);
    onCurrentTime(next);
    if (audioUri) {
      void audioPlayer.seekTo(next);
    }
  };

  const toggle = () => {
    if (playing) {
      setTicking(false);
      if (audioUri) audioPlayer.pause();
      return;
    }
    if (end > 0 && timeRef.current >= end - 0.2) {
      onCurrentTime(0);
      if (audioUri) void audioPlayer.seekTo(0);
    }
    if (audioUri) {
      audioPlayer.play();
      return;
    }
    setTicking(true);
  };

  useImperativeHandle(ref, () => ({ seek: seekTo }), [audioPlayer, audioUri, end]);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} pointerEvents={compact ? 'none' : 'auto'}>
      <View
        style={styles.stage}
        onLayout={(event) => setStageWidth(event.nativeEvent.layout.width)}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.video} contentFit="contain" /> : null}
        {style.animation === 'wheel' ? (
          <WheelLyricOverlay
            lyrics={lyrics}
            currentTime={currentTime}
            offset={offset}
            duration={end}
            placeholder={t('stage.placeholder')}
            styleConfig={style}
            onPositionChange={setPosition}
          />
        ) : (
          <LyricOverlay
            text={visibleLine.text}
            words={visibleLine.words}
            currentIndex={visibleLine.currentIndex}
            lineKey={lineKey}
            currentTime={currentTime}
            lineStart={lineStart}
            lineEnd={lineEnd}
            fadeOut={fadeOut}
            placeholder={lyrics.length ? undefined : t('stage.placeholder')}
            styleConfig={style}
            onPositionChange={setPosition}
          />
        )}
        <StickerOverlay
          title={track?.trackName?.trim() || t('stickers.fallbackTitle')}
          artist={track?.artistName?.trim() || t('stickers.fallbackArtist')}
          currentTime={currentTime}
          duration={end}
        />
      </View>
      <PlaybackBar
        currentTime={currentTime}
        duration={end}
        playing={playing}
        onToggle={toggle}
        onSeek={seekTo}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bgElevated,
  },
  wrapCompact: {
    flex: 0,
    height: 0,
    overflow: 'hidden',
  },
  stage: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  video: {
    flex: 1,
  },
});
