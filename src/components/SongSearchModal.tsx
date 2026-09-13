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

import { Button, Helper } from '@/components/ui';
import { isAuddEnabled } from '@/lib/audd';
import { getLyricsById, searchLyrics } from '@/lib/lrclib';
import { detectSongFromMedia } from '@/lib/songDetect';
import { formatDurationLabel } from '@/lib/time';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';
import type { LrclibTrack } from '@/types';

type Props = {
  visible: boolean;
  currentTime: number;
  onClose: () => void;
};

export function SongSearchModal({ visible, currentTime, onClose }: Props) {
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
  const canDetect = isAuddEnabled();
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
        setError('No matches on LRCLIB. Try a different title or add the artist.');
        return;
      }
      const ranked = [...found].sort((a, b) => {
        const sync = Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics));
        if (sync !== 0) return sync;
        return (b.duration || 0) - (a.duration || 0);
      });
      setResults(ranked);
      setNotice('Pick the song. The editor will list its full lyrics, even if the video is shorter.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setBusy(null);
    }
  };

  const detect = async () => {
    if (!sourceUri) {
      setError('Pick a video first, then detect the song from its audio.');
      return;
    }
    setBusy('detect');
    setError(null);
    setNotice(null);
    setResults([]);
    try {
      const { match, tracks } = await detectSongFromMedia({
        sourceUri,
        currentTime,
        mediaDuration: sourceDuration,
      });
      setTrackName(match.title);
      setArtistName(match.artist);
      if (tracks.length === 0) {
        setError(`AudD found ${match.artist} — ${match.title}, but LRCLIB has no lyrics. Search with a different spelling, or paste lyrics.`);
        return;
      }
      setResults(tracks);
      setNotice(`Detected ${match.artist} — ${match.title}. Pick the lyrics below.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Song detection failed.');
    } finally {
      setBusy(null);
    }
  };

  const pick = async (item: LrclibTrack) => {
    setBusy('search');
    setError(null);
    try {
      const full = await getLyricsById(item.id);
      applyTrack(full);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lyrics.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Find lyrics</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <TextInput
          placeholder="Song name"
          placeholderTextColor={colors.muted}
          value={trackName}
          onChangeText={setTrackName}
          style={styles.input}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <TextInput
          placeholder="Artist (optional)"
          placeholderTextColor={colors.muted}
          value={artistName}
          onChangeText={setArtistName}
          style={styles.input}
          autoCapitalize="none"
        />
        <Button
          label={busy === 'search' ? 'Searching…' : 'Search LRCLIB'}
          onPress={search}
          disabled={busy != null || !trackName.trim()}
        />
        {canDetect ? (
          <Button
            variant="secondary"
            label={busy === 'detect' ? 'Detecting…' : 'Detect from audio'}
            onPress={detect}
            disabled={busy != null || !sourceUri}
          />
        ) : null}
        {canDetect && !sourceUri ? (
          <Helper>Pick a video first to detect the song from its soundtrack.</Helper>
        ) : null}
        {error ? <Helper tone="warning">{error}</Helper> : null}
        {notice ? <Helper>{notice}</Helper> : null}
        {busy ? <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} /> : null}
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {results.map((item) => (
            <Pressable key={item.id} onPress={() => pick(item)} style={styles.result}>
              <Text style={styles.track}>{item.trackName}</Text>
              <Text style={styles.meta}>
                {item.artistName}
                {item.albumName ? ` · ${item.albumName}` : ''}
              </Text>
              <Text style={styles.meta}>
                {formatDurationLabel(item.duration)}
                {item.syncedLyrics ? ' · synced' : item.plainLyrics ? ' · unsynced' : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Helper>
          {canDetect
            ? 'Detect sends a short audio clip to AudD, then loads lyrics from LRCLIB.'
            : 'Lyrics via LRCLIB · any language, shown as published'}
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
