import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Helper, SectionLabel } from '@/components/ui';
import { pickFile } from '@/lib/media';
import { formatDurationLabel } from '@/lib/time';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';

export function AudioPanel() {
  const keepOriginalAudio = useProjectStore((s) => s.keepOriginalAudio);
  const audioName = useProjectStore((s) => s.audioName);
  const audioDuration = useProjectStore((s) => s.audioDuration);
  const videoDuration = useProjectStore((s) => s.videoDuration);
  const setKeepOriginalAudio = useProjectStore((s) => s.setKeepOriginalAudio);
  const setAudio = useProjectStore((s) => s.setAudio);
  const [busy, setBusy] = useState(false);

  const pickAudio = async () => {
    try {
      setBusy(true);
      const file = await pickFile('audio');
      if (file) {
        setAudio(file);
      }
    } catch (error) {
      Alert.alert('Could not pick audio', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.col}>
      <SectionLabel>Soundtrack</SectionLabel>
      <View style={styles.row}>
        <Button
          compact
          label="Keep original"
          variant={keepOriginalAudio ? 'primary' : 'secondary'}
          onPress={() => setKeepOriginalAudio(true)}
          style={styles.flex}
        />
        <Button
          compact
          label="Replace audio"
          variant={!keepOriginalAudio ? 'primary' : 'secondary'}
          onPress={() => setKeepOriginalAudio(false)}
          style={styles.flex}
        />
      </View>

      {keepOriginalAudio ? (
        <Helper>Preview uses the audio already on the video ({formatDurationLabel(videoDuration)}).</Helper>
      ) : (
        <Card>
          <Text style={styles.name}>{audioName ?? 'No replacement track yet'}</Text>
          {audioDuration > 0 ? (
            <Helper>Replacement duration {formatDurationLabel(audioDuration)}</Helper>
          ) : (
            <Helper>Pick an mp3 or wav. Preview and export stop at the video length ({formatDurationLabel(videoDuration)}).</Helper>
          )}
          <Button compact label={busy ? 'Opening…' : 'Choose audio file'} onPress={pickAudio} disabled={busy} />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  col: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontWeight: '700',
  },
});
