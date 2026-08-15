import { useEvent, useEventListener } from 'expo';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';

import { LyricOverlay } from '@/components/LyricOverlay';
import { PlaybackBar } from '@/components/PlaybackBar';
import { getRevealedWords } from '@/lib/lyrics';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';

export type VideoStageHandle = {
  seek: (time: number) => void;
};

type Props = {
  currentTime: number;
  onCurrentTime: (time: number) => void;
};

export const VideoStage = forwardRef<VideoStageHandle, Props>(function VideoStage(
  { currentTime, onCurrentTime },
  ref,
) {
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

  const replaceAudio = !keepOriginalAudio && Boolean(audioUri);
  const videoPlayer = useVideoPlayer(videoUri ? { uri: videoUri } : null, (player) => {
    player.timeUpdateEventInterval = 0.08;
    player.loop = false;
  });
  const audioPlayer = useAudioPlayer(replaceAudio && audioUri ? { uri: audioUri } : null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const videoEnd = videoPlayer.duration > 0 ? videoPlayer.duration : videoDuration;

  const { isPlaying } = useEvent(videoPlayer, 'playingChange', {
    isPlaying: videoPlayer.playing,
  });

  const stopAtVideoEnd = (time: number) => {
    videoPlayer.pause();
    videoPlayer.loop = false;
    if (replaceAudio) audioPlayer.pause();
    onCurrentTime(time);
  };

  useEventListener(videoPlayer, 'timeUpdate', ({ currentTime: time }) => {
    if (videoEnd > 0 && time >= videoEnd - 0.05) {
      stopAtVideoEnd(videoEnd);
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
    if (status === 'readyToPlay' && videoPlayer.duration > 0) {
      setVideoDuration(videoPlayer.duration);
      videoPlayer.loop = false;
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
  const revealedWords = getRevealedWords(lyrics, currentTime, offset, duration);

  const seekTo = (time: number) => {
    const end = videoEnd;
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
    if (isPlaying) {
      videoPlayer.pause();
      if (replaceAudio) audioPlayer.pause();
      return;
    }
    const end = videoEnd;
    if (end > 0 && videoPlayer.currentTime >= end - 0.2) {
      seekTo(0);
    }
    if (replaceAudio) {
      void audioPlayer.seekTo(videoPlayer.currentTime);
      audioPlayer.play();
    }
    videoPlayer.play();
  };

  useImperativeHandle(ref, () => ({ seek: seekTo }), [replaceAudio, audioPlayer, videoPlayer, videoDuration]);

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <VideoView
          player={videoPlayer}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
        />
        <LyricOverlay
          words={revealedWords}
          placeholder={lyrics.length ? undefined : 'Search a song to overlay lyrics'}
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
  stage: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  video: {
    flex: 1,
  },
});
