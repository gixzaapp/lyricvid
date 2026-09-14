import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Helper, SectionLabel } from '@/components/ui';
import { useT } from '@/store/locale';
import { colors } from '@/theme';
import { useProjectStore } from '@/store/project';

export function SyncPanel() {
  const t = useT();
  const offset = useProjectStore((s) => s.offset);
  const setOffset = useProjectStore((s) => s.setOffset);
  const lyricsSynced = useProjectStore((s) => s.lyricsSynced);

  return (
    <View style={styles.col}>
      <SectionLabel>{t('sync.title')}</SectionLabel>
      <Text style={styles.value}>
        {offset >= 0 ? '+' : ''}
        {offset.toFixed(2)}s
      </Text>
      <Slider
        minimumValue={-10}
        maximumValue={10}
        step={0.05}
        value={offset}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.text}
        onValueChange={setOffset}
      />
      <View style={styles.row}>
        <Button compact variant="secondary" label="-0.5s" onPress={() => setOffset(Math.max(-10, offset - 0.5))} />
        <Button compact variant="secondary" label={t('sync.reset')} onPress={() => setOffset(0)} />
        <Button compact variant="secondary" label="+0.5s" onPress={() => setOffset(Math.min(10, offset + 0.5))} />
      </View>
      <Helper>{t('sync.help')}</Helper>
      {!lyricsSynced ? (
        <Helper tone="warning">{t('sync.unsynced')}</Helper>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  col: {
    gap: 10,
  },
  value: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
