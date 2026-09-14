import { useEvent, useEventListener } from 'expo';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { LyricOverlay } from '@/components/LyricOverlay';
import { PlaybackBar } from '@/components/PlaybackBar';
import { getActiveLineIndex, getVisibleLineWords, lineEndTime } from '@/lib/lyrics';
import { useT } from '@/store/locale';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';

export type VideoStageHandle = {
  seek: (time: number) => void;
};

type Props = {
  currentTime: number;
  onCurrentTime: (time: number) => void;
  compact?: boolean;
};

export const VideoStage = forwardRef<VideoStageHandle, Props>(function VideoStage(
  { currentTime, onCurrentTime, compact = false },
  ref,
) {
  const t = useT();
  const videoUri = useProjectStore((s) => s.videoUri);
  const audioUri = useProjectStore((s) => s.audioUri);
  const keepOriginalAudio = useProjectStore((s) => s.keepOriginalAudio);
  const lyrics = useProjectStore((s) => s.lyrics);
  const offset = useProjectStore((s) => s.offset);
  const style = useProjectStore((s) => s.style);
  const videoDuration = useProjectStore((s) => s.videoDuration);
  const setVideoDuration = useProjectStore((s) => s.setVideoDuration);
  const setAudioDuration = useProjectStore((s) => s.setAudioDuration);
  const setPosition = useProjectStore((s) => s.setPosition);
  const setStageWidth = useProjectStore((s) => s.setStageWidth);

  const replaceAudio = !keepOriginalAudio && Boolean(audioUri);
  const videoSource = useMemo(() => (videoUri ? { uri: videoUri } : null), [videoUri]);
  const videoPlayer = useVideoPlayer(videoSource, (player) => {
    player.timeUpdateEventInterval = 0.08;
    player.loop = false;
  });
  const audioPlayer = useAudioPlayer(replaceAudio && audioUri ? { uri: audioUri } : null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const nativeDuration = videoPlayer.duration > 0 ? videoPlayer.duration : 0;
  const videoEnd = nativeDuration > 0 ? nativeDuration : videoDuration;
  const pendingPlay = useRef(false);

  const { isPlaying } = useEvent(videoPlayer, 'playingChange', {
    isPlaying: videoPlayer.playing,
  });

  const startPlayback = () => {
    pendingPlay.current = true;
    const end = nativeDuration > 0 ? nativeDuration : videoEnd;
    try {
      if (end > 0 && videoPlayer.currentTime >= end - 0.2) {
        videoPlayer.currentTime = 0;
        onCurrentTime(0);
      }
    } catch {
      try {
        videoPlayer.seekBy(-videoPlayer.currentTime);
        onCurrentTime(0);
      } catch {
        // Player is still attaching the first frame.
      }
    }
    if (replaceAudio) {
      void audioPlayer.seekTo(Math.max(0, videoPlayer.currentTime || 0));
      audioPlayer.play();
    }
    videoPlayer.play();
  };

  const stopAtVideoEnd = (time: number) => {
    pendingPlay.current = false;
    videoPlayer.pause();
    videoPlayer.loop = false;
    if (replaceAudio) audioPlayer.pause();
    onCurrentTime(time);
  };

  useEventListener(videoPlayer, 'timeUpdate', ({ currentTime: time }) => {
    const end = nativeDuration > 0 ? nativeDuration : 0;
    if (end > 0 && time >= end - 0.05) {
      stopAtVideoEnd(end);
      return;
    }
    onCurrentTime(time);
    if (replaceAudio && Math.abs(audioPlayer.currentTime - time) > 0.3) {
      void audioPlayer.seekTo(time);
    }
  });

  useEventListener(videoPlayer, 'playToEnd', () => {
    stopAtVideoEnd(videoEnd > 0 ? videoEnd : videoPlayer.currentTime);
  });

  useEventListener(videoPlayer, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') {
      if (videoPlayer.duration > 0) {
        setVideoDuration(videoPlayer.duration);
      }
      videoPlayer.loop = false;
      if (pendingPlay.current && !videoPlayer.playing) {
        videoPlayer.play();
      }
    }
  });

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  useEffect(() => {
    videoPlayer.muted = replaceAudio;
  }, [videoPlayer, replaceAudio]);

  useEffect(() => {
    if (replaceAudio && audioStatus.duration > 0) {
      setAudioDuration(audioStatus.duration);
    }
  }, [audioStatus.duration, replaceAudio, setAudioDuration]);

  useEffect(() => {
    if (!replaceAudio || videoEnd <= 0) {
      return;
    }
    if (audioStatus.currentTime >= videoEnd - 0.05 && audioStatus.playing) {
      audioPlayer.pause();
      videoPlayer.pause();
      onCurrentTime(videoEnd);
    }
  }, [audioStatus.currentTime, audioStatus.playing, replaceAudio, videoEnd, audioPlayer, videoPlayer, onCurrentTime]);

  const duration = videoEnd;
  const visibleLine = getVisibleLineWords(lyrics, currentTime, offset, duration);
  const activeIndex = getActiveLineIndex(lyrics, currentTime, offset);
  const lineKey = lyrics.length === 0 ? 'placeholder' : activeIndex >= 0 ? lyrics[activeIndex].id : 'hidden';
  const lineStart = activeIndex >= 0 ? Math.max(0, lyrics[activeIndex].timestamp + offset) : 0;
  const lineEnd = activeIndex >= 0 ? lineEndTime(lyrics, activeIndex, duration, offset) : 0;
  const nextStart = activeIndex >= 0 && lyrics[activeIndex + 1] ? lyrics[activeIndex + 1].timestamp + offset : null;
  const fadeOut =
    lineKey !== 'hidden' &&
    lineKey !== 'placeholder' &&
    (nextStart == null || nextStart > lineEnd + 0.04);

  const seekTo = (time: number) => {
    const end = nativeDuration > 0 ? nativeDuration : videoEnd;
    const next = Math.max(0, end > 0 ? Math.min(time, Math.max(end - 0.05, 0)) : time);
    try {
      videoPlayer.currentTime = next;
    } catch {
      videoPlayer.seekBy(next - videoPlayer.currentTime);
    }
    onCurrentTime(next);
    if (replaceAudio) {
      void audioPlayer.seekTo(next);
    }
  };

  const toggle = () => {
    if (videoPlayer.playing || isPlaying) {
      pendingPlay.current = false;
      videoPlayer.pause();
      if (replaceAudio) audioPlayer.pause();
      return;
    }
    startPlayback();
    const uri = videoUri;
    setTimeout(() => {
      if (!pendingPlay.current || videoPlayer.playing || !uri) {
        return;
      }
      void videoPlayer.replaceAsync({ uri }).then(() => {
        if (!pendingPlay.current) return;
        videoPlayer.timeUpdateEventInterval = 0.08;
        videoPlayer.loop = false;
        videoPlayer.play();
      });
    }, 280);
  };

  useImperativeHandle(ref, () => ({ seek: seekTo }), [replaceAudio, audioPlayer, videoPlayer, videoDuration]);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} pointerEvents={compact ? 'none' : 'auto'}>
      <View
        style={styles.stage}
        onLayout={(event) => setStageWidth(event.nativeEvent.layout.width)}>
        <VideoView
          player={videoPlayer}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
        />
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
      </View>
      <PlaybackBar
        currentTime={currentTime}
        duration={duration}
        playing={isPlaying}
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
