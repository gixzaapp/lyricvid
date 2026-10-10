import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Helper, SectionLabel } from '@/components/ui';
import { useT } from '@/store/locale';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';
import type { StickerKind } from '@/types';

const PRESETS: {
  kind: StickerKind;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: 'stickers.vinyl' | 'stickers.cassette' | 'stickers.music' | 'stickers.beats' | 'stickers.player';
}[] = [
  { kind: 'vinyl', icon: 'disc-outline', labelKey: 'stickers.vinyl' },
  { kind: 'cassette', icon: 'recording-outline', labelKey: 'stickers.cassette' },
  { kind: 'music', icon: 'musical-notes-outline', labelKey: 'stickers.music' },
  { kind: 'beats', icon: 'bar-chart-outline', labelKey: 'stickers.beats' },
  { kind: 'player', icon: 'play-circle-outline', labelKey: 'stickers.player' },
];

export function StickersPanel() {
  const t = useT();
  const stickers = useProjectStore((s) => s.stickers);
  const selectedStickerId = useProjectStore((s) => s.selectedStickerId);
  const toggleSticker = useProjectStore((s) => s.toggleSticker);
  const removeSticker = useProjectStore((s) => s.removeSticker);
  const selectSticker = useProjectStore((s) => s.selectSticker);
  const setStickerScale = useProjectStore((s) => s.setStickerScale);
  const selected = stickers.find((item) => item.id === selectedStickerId) ?? stickers[stickers.length - 1];

  return (
    <View style={styles.col}>
      <Helper>{t('stickers.help')}</Helper>
      <SectionLabel>{t('editor.stickers')}</SectionLabel>
      <View style={styles.row}>
        {PRESETS.map((preset) => {
          const on = stickers.some((item) => item.kind === preset.kind);
          return (
            <Pressable
              key={preset.kind}
              onPress={() => toggleSticker(preset.kind)}
              style={[styles.card, on && styles.cardOn]}>
              <Ionicons name={preset.icon} size={16} color={on ? colors.accent : colors.muted} />
              <Text style={[styles.cardLabel, on && styles.cardLabelOn]}>{t(preset.labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>
      {selected ? (
        <>
          <SectionLabel>{t('stickers.size', { size: selected.scale.toFixed(1) })}</SectionLabel>
          <Slider
            minimumValue={0.6}
            maximumValue={1.6}
            step={0.1}
            value={selected.scale}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.accent}
            onSlidingStart={() => selectSticker(selected.id)}
            onValueChange={(value) => setStickerScale(selected.id, value)}
          />
          <Pressable onPress={() => removeSticker(selected.id)} style={styles.remove}>
            <Text style={styles.removeLabel}>{t('stickers.remove')}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  col: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '47%',
    flexGrow: 0,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardOn: {
    borderColor: colors.accent,
    backgroundColor: colors.surface2,
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  cardLabelOn: {
    color: colors.text,
  },
  remove: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  removeLabel: {
    color: colors.danger,
    fontWeight: '700',
  },
});
