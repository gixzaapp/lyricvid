import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Helper, SectionLabel } from '@/components/ui';
import { tokensForLine } from '@/lib/lyrics';
import { useT } from '@/store/locale';
import { colors } from '@/theme';
import type { LyricLine } from '@/types';

type Props = {
  line: LyricLine | null;
  onClose: () => void;
  onSplit: (afterCount: number) => void;
};

export function SplitLineModal({ line, onClose, onSplit }: Props) {
  const t = useT();
  const tokens = useMemo(() => (line ? tokensForLine(line) : []), [line]);
  const [afterCount, setAfterCount] = useState(1);

  useEffect(() => {
    const count = tokens.length;
    setAfterCount(count >= 2 ? Math.floor(count / 2) : 1);
  }, [line?.id, tokens.length]);

  const canSplit = tokens.length >= 2;
  const first = tokens.slice(0, afterCount).join(' ');
  const second = tokens.slice(afterCount).join(' ');

  return (
    <Modal visible={Boolean(line)} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('split.title')}</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>{t('common.close')}</Text>
          </Pressable>
        </View>
        {canSplit ? (
          <Helper>{t('split.help')}</Helper>
        ) : (
          <Helper tone="warning">{t('split.needWords')}</Helper>
        )}
        <ScrollView contentContainerStyle={styles.words} keyboardShouldPersistTaps="handled">
          {tokens.map((word, index) => {
            const selected = index === afterCount - 1;
            const disabled = index === tokens.length - 1;
            return (
              <Pressable
                key={`${word}-${index}`}
                disabled={disabled}
                onPress={() => setAfterCount(index + 1)}
                style={[
                  styles.word,
                  selected && styles.wordOn,
                  disabled && styles.wordOff,
                ]}>
                <Text style={[styles.wordText, selected && styles.wordTextOn]}>{word}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {canSplit ? (
          <View style={styles.preview}>
            <SectionLabel>{t('split.thisLine')}</SectionLabel>
            <Text style={styles.previewText}>{first}</Text>
            <SectionLabel>{t('split.nextLine')}</SectionLabel>
            <Text style={styles.previewText}>{second}</Text>
          </View>
        ) : null}
        <Button
          label={t('split.action')}
          disabled={!canSplit || afterCount < 1 || afterCount >= tokens.length}
          onPress={() => onSplit(afterCount)}
        />
        <Button compact variant="secondary" label={t('common.cancel')} onPress={onClose} />
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
  words: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  word: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  wordOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  wordOff: {
    opacity: 0.4,
  },
  wordText: {
    color: colors.text,
    fontWeight: '600',
  },
  wordTextOn: {
    color: colors.accent,
  },
  preview: {
    gap: 6,
  },
  previewText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
});
