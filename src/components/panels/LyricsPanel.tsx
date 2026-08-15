import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SongSearchModal } from '@/components/SongSearchModal';
import { Button, Helper, SectionLabel } from '@/components/ui';
import { createLineId, parsePlainLyrics, parseSyncedLyrics } from '@/lib/lyrics';
import { formatTimestampInput, parseTimestampInput } from '@/lib/time';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';

type Props = {
  currentTime: number;
  onSeek: (time: number) => void;
};

export function LyricsPanel({ currentTime, onSeek }: Props) {
  const track = useProjectStore((s) => s.track);
  const lyrics = useProjectStore((s) => s.lyrics);
  const warning = useProjectStore((s) => s.lyricsWarning);
  const lyricsSynced = useProjectStore((s) => s.lyricsSynced);
  const updateLine = useProjectStore((s) => s.updateLine);
  const addLine = useProjectStore((s) => s.addLine);
  const removeLine = useProjectStore((s) => s.removeLine);
  const setLyrics = useProjectStore((s) => s.setLyrics);
  const timingDuration = useProjectStore((s) => s.timingDuration);
  const [searchOpen, setSearchOpen] = useState(false);
  const [paste, setPaste] = useState('');

  const applyPaste = () => {
    const raw = paste.trim();
    if (!raw) return;
    const synced = parseSyncedLyrics(raw);
    if (synced.length) {
      setLyrics(synced, true, null);
      setPaste('');
      return;
    }
    setLyrics(parsePlainLyrics(raw, timingDuration()), false, 'Pasted as unsynced lyrics. Edit timestamps as needed.');
    setPaste('');
  };

  return (
    <View style={styles.col}>
      <SectionLabel>Song</SectionLabel>
      <Text style={styles.song}>
        {track ? `${track.artistName} — ${track.trackName}` : 'No song selected'}
      </Text>
      <View style={styles.row}>
        <Button compact label="Search lyrics" onPress={() => setSearchOpen(true)} style={styles.flex} />
        <Button compact variant="secondary" label="Add line" onPress={() => addLine(currentTime)} />
      </View>
      {warning ? <Helper tone="warning">{warning}</Helper> : null}
      {lyricsSynced ? <Helper tone="success">Synced lyrics loaded. Tap a line to jump there.</Helper> : null}

      {lyrics.map((line) => (
        <View key={line.id} style={styles.line}>
          <Pressable onPress={() => onSeek(line.timestamp)} style={styles.timeWrap}>
            <TextInput
              key={`${line.id}-${line.timestamp}`}
              defaultValue={formatTimestampInput(line.timestamp)}
              onEndEditing={(event) => {
                const next = parseTimestampInput(event.nativeEvent.text);
                if (next != null) updateLine(line.id, { timestamp: next });
              }}
              style={styles.time}
              placeholder="00:00.00"
              placeholderTextColor={colors.muted}
            />
          </Pressable>
          <TextInput
            value={line.text}
            onChangeText={(text) => updateLine(line.id, { text })}
            style={styles.text}
            placeholder="Lyric line"
            placeholderTextColor={colors.muted}
            multiline
          />
          <Pressable
            onPress={() =>
              Alert.alert('Remove line?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeLine(line.id) },
              ])
            }>
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </View>
      ))}

      <SectionLabel>Paste lyrics</SectionLabel>
      <TextInput
        value={paste}
        onChangeText={setPaste}
        placeholder="Paste LRC or plain lyrics in any language"
        placeholderTextColor={colors.muted}
        style={styles.paste}
        multiline
      />
      <Button
        compact
        variant="secondary"
        label="Use pasted lyrics"
        onPress={applyPaste}
        disabled={!paste.trim()}
      />
      <Button
        compact
        variant="ghost"
        label="Start from a blank line"
        onPress={() =>
          setLyrics([{ id: createLineId(), timestamp: currentTime, text: '' }], false, null)
        }
      />
      <SongSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  col: {
    gap: 10,
  },
  song: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeWrap: {
    width: 78,
  },
  time: {
    color: colors.accent,
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    fontWeight: '700',
  },
  text: {
    flex: 1,
    color: colors.text,
    minHeight: 36,
    padding: 0,
  },
  remove: {
    color: colors.muted,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  paste: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    padding: 10,
    textAlignVertical: 'top',
  },
});
