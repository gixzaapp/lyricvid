import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LANGUAGES, type LocaleCode } from '@/i18n/languages';
import { useT } from '@/store/locale';
import { colors } from '@/theme';

type Props = {
  selected: LocaleCode | null;
  onSelect: (code: LocaleCode) => void;
};

export function LanguageSelect({ selected, onSelect }: Props) {
  const t = useT();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <Text style={styles.title}>{t('language.title')}</Text>
      <Text style={styles.subtitle}>{t('language.subtitle')}</Text>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {LANGUAGES.map((item) => {
          const active = selected === item.code;
          return (
            <Pressable
              key={item.code}
              onPress={() => onSelect(item.code)}
              style={({ pressed }) => [
                styles.card,
                active && styles.cardOn,
                pressed && styles.pressed,
              ]}>
              <View style={[styles.mark, active && styles.markOn]}>
                <Text style={[styles.markText, active && styles.markTextOn]}>{item.mark}</Text>
              </View>
              <Text style={styles.native}>{item.nativeName}</Text>
              <Text style={styles.english}>{item.englishName}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 22,
    paddingTop: 28,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 28,
  },
  card: {
    width: '47.5%',
    minHeight: 148,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    justifyContent: 'flex-end',
    gap: 4,
  },
  cardOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  markOn: {
    backgroundColor: colors.accent,
  },
  markText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  markTextOn: {
    color: '#0B0B10',
  },
  native: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  english: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.86,
  },
});
