import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetectBanner } from '@/components/DetectBanner';
import { Button, Helper } from '@/components/ui';
import { isTranslationKey } from '@/i18n';
import { isShazamEnabled } from '@/lib/shazam';
import { getLyricsById, searchLyrics } from '@/lib/lrclib';
import { detectSongFromMedia } from '@/lib/songDetect';
import { formatDurationLabel } from '@/lib/time';
import { errorText, useT } from '@/store/locale';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';
import type { LrclibTrack } from '@/types';

const DETECT_AD_MS = 3000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Props = {
  visible: boolean;
  currentTime: number;
  onClose: () => void;
};

export function SongSearchModal({ visible, currentTime, onClose }: Props) {
  const t = useT();
  const applyTrack = useProjectStore((s) => s.applyTrack);
  const videoUri = useProjectStore((s) => s.videoUri);
  const audioUri = useProjectStore((s) => s.audioUri);
  const keepOriginalAudio = useProjectStore((s) => s.keepOriginalAudio);
  const videoDuration = useProjectStore((s) => s.videoDuration);
  const audioDuration = useProjectStore((s) => s.audioDuration);
  const [trackName, setTrackName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [busy, setBusy] = useState<'search' | 'detect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<LrclibTrack[]>([]);
  const canDetect = isShazamEnabled();
  const sourceUri = !keepOriginalAudio && audioUri ? audioUri : videoUri;
  const sourceDuration = !keepOriginalAudio && audioUri ? audioDuration : videoDuration;

  const search = async () => {
    setBusy('search');
    setError(null);
    setNotice(null);
    setResults([]);
    try {
      const found = await searchLyrics({
        trackName,
        artistName,
      });
      if (found.length === 0) {
        setError('search.noMatches');
        return;
      }
      const ranked = [...found].sort((a, b) => {
        const sync = Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics));
        if (sync !== 0) return sync;
        return (b.duration || 0) - (a.duration || 0);
      });
      setResults(ranked);
      setNotice('search.pickSong');
    } catch (err) {
      setError(errorText(err, 'search.failed'));
    } finally {
      setBusy(null);
    }
  };

  const detect = async () => {
    if (!sourceUri) {
      setError('search.detectNeedVideo');
      return;
    }
    setBusy('detect');
    setError(null);
    setNotice(null);
    setResults([]);
    let showResult = () => {};
    try {
      const { tracks } = await detectSongFromMedia({
        sourceUri,
        currentTime,
        mediaDuration: sourceDuration,
      });
      showResult = () => {
        if (tracks.length === 0) {
          setError('search.detectNoLyrics');
          return;
        }
        setResults(tracks);
        setNotice('search.detected');
      };
    } catch (err) {
      const message = errorText(err, 'search.detectFailed');
      showResult = () => setError(message);
    } finally {
      await wait(DETECT_AD_MS);
      setBusy(null);
    }
    showResult();
  };

  const pick = async (item: LrclibTrack) => {
    setBusy('search');
    setError(null);
    try {
      const full = await getLyricsById(item.id);
      applyTrack(full);
      onClose();
    } catch (err) {
      setError(errorText(err, 'search.loadFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('search.title')}</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>{t('common.close')}</Text>
          </Pressable>
        </View>
        <TextInput
          placeholder={t('search.songName')}
          placeholderTextColor={colors.muted}
          value={trackName}
          onChangeText={setTrackName}
          style={styles.input}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <TextInput
          placeholder={t('search.artist')}
          placeholderTextColor={colors.muted}
          value={artistName}
          onChangeText={setArtistName}
          style={styles.input}
          autoCapitalize="none"
        />
        <Button
          label={busy === 'search' ? t('search.searching') : t('search.search')}
          onPress={search}
          disabled={busy != null || !trackName.trim()}
        />
        {canDetect ? (
          <Button
            variant="secondary"
            label={t('search.detect')}
            onPress={detect}
            disabled={busy != null || !sourceUri}
          />
        ) : null}
        {busy === 'detect' ? (
          <View style={styles.detectBlock}>
            <Text style={styles.detectText}>{t('search.detecting')}</Text>
            <DetectBanner />
          </View>
        ) : null}
        {canDetect && !sourceUri ? (
          <Helper>{t('search.needVideo')}</Helper>
        ) : null}
        {error ? (
          <Helper tone="warning">{isTranslationKey(error) ? t(error) : error}</Helper>
        ) : null}
        {notice ? (
          <Helper>{isTranslationKey(notice) ? t(notice) : notice}</Helper>
        ) : null}
        {busy === 'search' ? <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} /> : null}
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {results.map((item) => (
            <Pressable key={item.id} onPress={() => pick(item)} style={styles.result}>
              <Text style={styles.track}>{isTranslationKey(item.trackName) ? t(item.trackName) : item.trackName}</Text>
              <Text style={styles.meta}>
                {isTranslationKey(item.artistName) ? t(item.artistName) : item.artistName}
                {item.albumName ? ` · ${item.albumName}` : ''}
              </Text>
              <Text style={styles.meta}>
                {formatDurationLabel(item.duration)}
                {item.syncedLyrics ? ` · ${t('search.synced')}` : item.plainLyrics ? ` · ${t('search.unsynced')}` : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Helper>
          {canDetect ? t('search.footerDetect') : t('search.footerLrc')}
        </Helper>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  close: {
    color: colors.accent,
    fontWeight: '700',
  },
  detectBlock: {
    alignItems: 'center',
    gap: 8,
  },
  detectText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  result: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 4,
  },
  track: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
});
