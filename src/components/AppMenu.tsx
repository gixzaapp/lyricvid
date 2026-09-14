import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { translate, type TranslationKey } from '@/i18n';
import { useLocaleStore, useT } from '@/store/locale';
import { colors } from '@/theme';

function bilingualLabel(code: string | null, key: TranslationKey) {
  const localized = translate(code, key);
  const english = translate('en', key);
  if (!code || code === 'en' || localized === english) return localized;
  return `${localized} (${english})`;
}

export function AppMenu() {
  const router = useRouter();
  const t = useT();
  const code = useLocaleStore((s) => s.code);
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('menu.open')}
        onPress={() => setOpen(true)}
        style={styles.iconBtn}>
        <Ionicons name="menu" size={26} color={colors.text} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={close} />
          <SafeAreaView style={styles.drawer} edges={['top', 'left', 'bottom']}>
            <Text style={styles.brand}>AI LyricVid</Text>
            <Pressable
              style={styles.item}
              onPress={() => {
                close();
                router.push('/language');
              }}>
              <Ionicons name="globe-outline" size={20} color={colors.text} />
              <Text style={styles.itemLabel}>{bilingualLabel(code, 'menu.language')}</Text>
            </Pressable>
            <Pressable
              style={styles.item}
              onPress={() => {
                close();
                router.push('/about');
              }}>
              <Ionicons name="information-circle-outline" size={20} color={colors.text} />
              <Text style={styles.itemLabel}>{t('menu.about')}</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.overlay,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    width: 280,
    maxWidth: '80%',
    backgroundColor: colors.bgElevated,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 8,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  brand: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  itemLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
