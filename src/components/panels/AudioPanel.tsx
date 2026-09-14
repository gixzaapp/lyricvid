import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Helper, SectionLabel } from '@/components/ui';
import { pickFile } from '@/lib/media';
import { formatDurationLabel } from '@/lib/time';
import { errorText, useT } from '@/store/locale';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';

export function AudioPanel() {
  const t = useT();
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
      Alert.alert(t('audio.pickFailed'), errorText(error, 'common.unknownError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.col}>
      <SectionLabel>{t('audio.soundtrack')}</SectionLabel>
      <View style={styles.row}>
        <Button
          compact
          label={t('audio.keep')}
          variant={keepOriginalAudio ? 'primary' : 'secondary'}
          onPress={() => setKeepOriginalAudio(true)}
          style={styles.flex}
        />
        <Button
          compact
          label={t('audio.replace')}
          variant={!keepOriginalAudio ? 'primary' : 'secondary'}
          onPress={() => setKeepOriginalAudio(false)}
          style={styles.flex}
        />
      </View>

      {keepOriginalAudio ? (
        <Helper>{t('audio.keepHelp', { duration: formatDurationLabel(videoDuration) })}</Helper>
      ) : (
        <Card>
          <Text style={styles.name}>{audioName ?? t('audio.noTrack')}</Text>
          {audioDuration > 0 ? (
            <Helper>{t('audio.replaceDuration', { duration: formatDurationLabel(audioDuration) })}</Helper>
          ) : (
            <Helper>{t('audio.replaceHelp', { duration: formatDurationLabel(videoDuration) })}</Helper>
          )}
          <Button compact label={busy ? t('audio.opening') : t('audio.choose')} onPress={pickAudio} disabled={busy} />
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
