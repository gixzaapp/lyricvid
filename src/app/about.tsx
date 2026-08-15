import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>AI LyricVid</Text>
        <Text style={styles.version}>{`Version ${APP_VERSION}`}</Text>
        <Text style={styles.copy}>
          AI LyricVid overlays timed lyrics on a video. Pick a clip, search a song, style the words,
          then export a finished MP4 to your gallery.
        </Text>
        <Text style={styles.copy}>
          Everything stays on this device. No account is required.
        </Text>
        <View style={styles.credit}>
          <Text style={styles.creditLabel}>Lyrics courtesy of</Text>
          <Pressable onPress={() => Linking.openURL('https://lrclib.net')}>
            <Text style={styles.creditLink}>LRCLIB</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 14,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
  },
  version: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  copy: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  credit: {
    marginTop: 12,
    gap: 4,
  },
  creditLabel: {
    color: colors.muted,
    fontSize: 14,
  },
  creditLink: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
});
