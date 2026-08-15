import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioPanel } from '@/components/panels/AudioPanel';
import { ExportPanel } from '@/components/panels/ExportPanel';
import { LyricsPanel } from '@/components/panels/LyricsPanel';
import { StylePanel } from '@/components/panels/StylePanel';
import { SyncPanel } from '@/components/panels/SyncPanel';
import { VideoStage, type VideoStageHandle } from '@/components/VideoStage';
import { useProjectStore } from '@/store/project';
import { colors } from '@/theme';

type TabId = 'audio' | 'lyrics' | 'style' | 'sync' | 'export';

const TABS: { id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'audio', label: 'Audio', icon: 'musical-notes-outline' },
  { id: 'lyrics', label: 'Lyrics', icon: 'text-outline' },
  { id: 'style', label: 'Style', icon: 'color-palette-outline' },
  { id: 'sync', label: 'Sync', icon: 'time-outline' },
  { id: 'export', label: 'Export', icon: 'share-outline' },
];

export default function EditorScreen() {
  const router = useRouter();
  const videoUri = useProjectStore((s) => s.videoUri);
  const track = useProjectStore((s) => s.track);
  const stageRef = useRef<VideoStageHandle>(null);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabId>('lyrics');
  const [currentTime, setCurrentTime] = useState(0);

  const title = useMemo(
    () => (track ? track.trackName : 'Lyric editor'),
    [track],
  );

  if (!videoUri) {
    return (
      <SafeAreaView style={styles.missing}>
        <Text style={styles.missingText}>Pick a video first.</Text>
        <Pressable onPress={() => router.replace('/')}>
          <Text style={styles.link}>Back home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <Pressable onPress={() => setTab('export')} style={styles.iconBtn}>
          <Ionicons name="share-outline" size={20} color={colors.accent} />
        </Pressable>
      </View>

      <VideoStage ref={stageRef} currentTime={currentTime} onCurrentTime={setCurrentTime} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.dock}>
        <View style={styles.tabs}>
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <Pressable key={item.id} onPress={() => setTab(item.id)} style={styles.tab}>
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={active ? colors.accent : colors.muted}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <ScrollView
          style={styles.panel}
          contentContainerStyle={[
            styles.panelContent,
            { paddingBottom: 80 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator>
          {tab === 'audio' ? <AudioPanel /> : null}
          {tab === 'lyrics' ? (
            <LyricsPanel
              currentTime={currentTime}
              onSeek={(time) => stageRef.current?.seek(time)}
            />
          ) : null}
          {tab === 'style' ? <StylePanel /> : null}
          {tab === 'sync' ? <SyncPanel /> : null}
          {tab === 'export' ? <ExportPanel /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  dock: {
    height: 320,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelOn: {
    color: colors.text,
  },
  panel: {
    flex: 1,
  },
  panelContent: {
    padding: 16,
  },
  missing: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  missingText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  link: {
    color: colors.accent,
    fontWeight: '700',
  },
});
