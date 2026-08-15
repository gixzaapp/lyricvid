import Slider from '@react-native-community/slider';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Chip, SectionLabel } from '@/components/ui';
import { FONT_PRESETS, PRESET_BACKGROUNDS, PRESET_TEXT_COLORS, colors, fontFamilyFor } from '@/theme';
import { useProjectStore } from '@/store/project';

export function StylePanel() {
  const style = useProjectStore((s) => s.style);
  const setStyle = useProjectStore((s) => s.setStyle);

  return (
    <View style={styles.col}>
      <SectionLabel>Fonts</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fonts}>
        {FONT_PRESETS.map((font) => {
          const resolved = fontFamilyFor(font.id);
          const family = Platform.OS === 'ios' ? resolved.ios : resolved.android;
          const selected = style.fontFamily === font.id;
          return (
            <Pressable
              key={font.id}
              onPress={() => setStyle({ fontFamily: font.id })}
              style={[styles.fontCard, selected && styles.fontCardOn]}>
              <Text style={[styles.fontSample, family ? { fontFamily: family } : null]}>Ag</Text>
              <Text style={[styles.fontName, selected && styles.fontNameOn]}>{font.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionLabel>Text</SectionLabel>
      <View style={styles.row}>
        {PRESET_TEXT_COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => setStyle({ color })}
            style={[
              styles.swatch,
              { backgroundColor: color },
              style.color === color && styles.swatchOn,
            ]}
          />
        ))}
      </View>

      <View style={styles.split}>
        <Text style={styles.meta}>Size {Math.round(style.fontSize)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={16}
          maximumValue={56}
          value={style.fontSize}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.text}
          onValueChange={(fontSize) => setStyle({ fontSize })}
        />
      </View>

      <SectionLabel>Background</SectionLabel>
      <View style={styles.wrap}>
        {PRESET_BACKGROUNDS.map((item) => (
          <Chip
            key={item.label}
            label={item.label}
            selected={style.backgroundColor === item.value}
            onPress={() => setStyle({ backgroundColor: item.value })}
          />
        ))}
      </View>

      <SectionLabel>Align</SectionLabel>
      <View style={styles.wrap}>
        {(['left', 'center', 'right'] as const).map((align) => (
          <Chip
            key={align}
            label={align}
            selected={style.align === align}
            onPress={() => setStyle({ align })}
          />
        ))}
      </View>

      <View style={styles.toggles}>
        <Toggle label="Bold" value={style.bold} onValueChange={(bold) => setStyle({ bold })} />
        <Toggle label="Italic" value={style.italic} onValueChange={(italic) => setStyle({ italic })} />
        <Toggle label="Outline" value={style.outline} onValueChange={(outline) => setStyle({ outline })} />
      </View>
      <Text style={styles.hint}>Drag the lyric box on the video to reposition it.</Text>
    </View>
  );
}

function Toggle({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  col: {
    gap: 12,
  },
  fonts: {
    gap: 8,
    paddingRight: 8,
  },
  fontCard: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  fontCardOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  fontSample: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  fontName: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  fontNameOn: {
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatchOn: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  split: {
    gap: 4,
  },
  slider: {
    width: '100%',
    height: 32,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  toggles: {
    gap: 4,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
  },
});
