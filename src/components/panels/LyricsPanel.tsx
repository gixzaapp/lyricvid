import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SongSearchModal } from '@/components/SongSearchModal';
import { SplitLineModal } from '@/components/SplitLineModal';
import { Button, Helper, SectionLabel } from '@/components/ui';
import { createLineId, parsePlainLyrics, parseSyncedLyrics, tokensForLine } from '@/lib/lyrics';
import { formatTimestampInput, parseTimestampInput } from '@/lib/time';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';

type Props = {
  currentTime: number;
  onSeek: (time: number) => void;
  onInputFocus?: (offsetY: number) => void;
};

export function LyricsPanel({ currentTime, onSeek, onInputFocus }: Props) {
  const track = useProjectStore((s) => s.track);
  const lyrics = useProjectStore((s) => s.lyrics);
  const warning = useProjectStore((s) => s.lyricsWarning);
  const lyricsSynced = useProjectStore((s) => s.lyricsSynced);
  const updateLine = useProjectStore((s) => s.updateLine);
  const addLine = useProjectStore((s) => s.addLine);
  const removeLine = useProjectStore((s) => s.removeLine);
  const startFromLine = useProjectStore((s) => s.startFromLine);
  const splitLine = useProjectStore((s) => s.splitLine);
  const setLyrics = useProjectStore((s) => s.setLyrics);
  const trackDuration = useProjectStore((s) => s.track?.duration ?? 0);
  const videoDuration = useProjectStore((s) => s.videoDuration);
  const [searchOpen, setSearchOpen] = useState(false);
  const [splitId, setSplitId] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const splitTarget = lyrics.find((item) => item.id === splitId) ?? null;
  const lineOffsets = useRef<Record<string, number>>({});

  const applyLineTime = (id: string, raw: string, requireClock: boolean) => {
    if (requireClock && !/^\d{1,2}:\d{2}(?:\.\d{1,3})?$/.test(raw.trim())) {
      return;
    }
    const next = parseTimestampInput(raw);
    if (next == null) return;
    const current = lyrics.find((item) => item.id === id)?.timestamp;
    if (current !== next) {
      updateLine(id, { timestamp: next });
    }
    onSeek(next);
  };

  const applyPaste = () => {
    const raw = paste.trim();
    if (!raw) return;
    const synced = parseSyncedLyrics(raw);
    if (synced.length) {
      setLyrics(synced, true, null);
      setPaste('');
      return;
    }
    setLyrics(
      parsePlainLyrics(raw, trackDuration),
      false,
      'Pasted as unsynced lyrics. Timestamps follow the song, not the video length.',
    );
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
      {lyricsSynced ? <Helper tone="success">Full synced lyrics loaded. Tap a line to jump there.</Helper> : null}
      {videoDuration > 0 && lyrics.some((line) => line.timestamp > videoDuration)
        ? (
          <Helper>
            Showing the whole song. Preview and export stop at the video end; later lines stay in the list for editing.
          </Helper>
        )
        : null}

      {lyrics.map((line, index) => (
        <View
          key={line.id}
          style={styles.line}
          onLayout={(event) => {
            lineOffsets.current[line.id] = event.nativeEvent.layout.y;
          }}>
          <Pressable onPress={() => onSeek(line.timestamp)} style={styles.timeWrap}>
            <TextInput
              key={line.id}
              defaultValue={formatTimestampInput(line.timestamp)}
              onFocus={() => onInputFocus?.(lineOffsets.current[line.id] ?? index * 56)}
              onChangeText={(text) => applyLineTime(line.id, text, true)}
              onEndEditing={(event) => applyLineTime(line.id, event.nativeEvent.text, false)}
              onSubmitEditing={(event) => applyLineTime(line.id, event.nativeEvent.text, false)}
              style={styles.time}
              placeholder="00:00.00"
              placeholderTextColor={colors.muted}
              keyboardType="numbers-and-punctuation"
            />
          </Pressable>
          <TextInput
            value={line.text}
            onChangeText={(text) => updateLine(line.id, { text })}
            onFocus={() => onInputFocus?.(lineOffsets.current[line.id] ?? index * 56)}
            style={styles.text}
            placeholder="Lyric line"
            placeholderTextColor={colors.muted}
            multiline
          />
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="Split this line"
              onPress={() => {
                if (tokensForLine(line).length < 2) {
                  Alert.alert('Cannot split', 'This line needs at least two words.');
                  return;
                }
                setSplitId(line.id);
              }}>
              <Ionicons name="create-outline" size={18} color={colors.accent} />
            </Pressable>
            <Pressable
              accessibilityLabel="Start from this line"
              onPress={() =>
                Alert.alert(
                  'Start from this',
                  'Delete every line above this one and shift times so it starts at 00:00.00.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Continue', onPress: () => startFromLine(line.id) },
                  ],
                )
              }>
              <Ionicons name="cut-outline" size={18} color={colors.accent} />
            </Pressable>
            <Pressable
              accessibilityLabel="Remove line"
              onPress={() =>
                Alert.alert('Remove line?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => removeLine(line.id) },
                ])
              }>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
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
      <SongSearchModal
        visible={searchOpen}
        currentTime={currentTime}
        onClose={() => setSearchOpen(false)}
      />
      <SplitLineModal
        line={splitTarget}
        onClose={() => setSplitId(null)}
        onSplit={(afterCount) => {
          if (splitId) splitLine(splitId, afterCount);
          setSplitId(null);
        }}
      />
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  remove: {
    color: colors.muted,
    paddingHorizontal: 4,
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
