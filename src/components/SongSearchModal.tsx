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
import { getLyricsById, searchLyrics } from '@/lib/lrclib';
import { autoSelectTrack, rankTracksByDuration } from '@/lib/lyrics';
import { formatDurationLabel } from '@/lib/time';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';
import type { RankedTrack } from '@/types';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function SongSearchModal({ visible, onClose }: Props) {
  const applyTrack = useProjectStore((s) => s.applyTrack);
  const timingDuration = useProjectStore((s) => s.timingDuration);
  const [trackName, setTrackName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<RankedTrack[]>([]);

  const duration = timingDuration();

  const search = async () => {
    setBusy(true);
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
      const ranked = duration > 0 ? rankTracksByDuration(found, duration) : found.map((t) => ({ ...t, delta: 0 }));
      const auto = duration > 0 ? autoSelectTrack(ranked) : null;
      if (auto) {
        const full = await getLyricsById(auto.id);
        applyTrack(full);
        onClose();
        return;
      }
      setResults(ranked);
      setNotice(
        duration > 0
          ? `No single match within ±3s of ${formatDurationLabel(duration)}. Pick the correct track.`
          : 'Pick the correct track.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (item: RankedTrack) => {
    setBusy(true);
    setError(null);
    try {
      const full = await getLyricsById(item.id);
      applyTrack(full);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lyrics.');
    } finally {
      setBusy(false);
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
        <Button label={busy ? 'Searching…' : 'Search LRCLIB'} onPress={search} disabled={busy || !trackName.trim()} />
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
                {duration > 0 ? ` · Δ ${item.delta.toFixed(1)}s` : ''}
                {item.syncedLyrics ? ' · synced' : item.plainLyrics ? ' · unsynced' : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Helper>Lyrics via LRCLIB · any language, shown as published</Helper>
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
