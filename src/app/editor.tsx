import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
import { getLyricsById } from '@/lib/lrclib';
import { detectSongFromMedia } from '@/lib/songDetect';
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
  const applyTrack = useProjectStore((s) => s.applyTrack);
  const pendingSongDetect = useProjectStore((s) => s.pendingSongDetect);
  const setPendingSongDetect = useProjectStore((s) => s.setPendingSongDetect);
  const stageRef = useRef<VideoStageHandle>(null);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabId>('lyrics');
  const [currentTime, setCurrentTime] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [detecting, setDetecting] = useState(false);
  const panelScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!pendingSongDetect || !videoUri) {
      return;
    }
    setPendingSongDetect(false);
    Alert.alert(
      'Detect song?',
      'Identify this video’s audio and load lyrics automatically?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            void (async () => {
              setDetecting(true);
              try {
                const project = useProjectStore.getState();
                const sourceUri = project.videoUri ?? videoUri;
                if (!sourceUri) {
                  throw new Error('Pick a video first.');
                }
                const { match, tracks } = await detectSongFromMedia({
                  sourceUri,
                  currentTime: 0,
                  mediaDuration: project.videoDuration,
                });
                if (!tracks[0]) {
                  Alert.alert(
                    'Song found, no lyrics',
                    `${match.artist} — ${match.title} was recognized, but LRCLIB has no lyrics. Use Search lyrics to try another match.`,
                  );
                  return;
                }
                const full = await getLyricsById(tracks[0].id);
                applyTrack(full);
                Alert.alert('Lyrics loaded', `${match.artist} — ${match.title}`);
              } catch (error) {
                Alert.alert(
                  'Could not detect song',
                  error instanceof Error ? error.message : 'Try Detect from audio in Search lyrics.',
                );
              } finally {
                setDetecting(false);
              }
            })();
          },
        },
      ],
    );
  }, [applyTrack, pendingSongDetect, setPendingSongDetect, videoUri]);

  const keyboardOpen = keyboardHeight > 0;
  const dockLift = Platform.OS === 'android' ? Math.max(0, keyboardHeight - insets.bottom) : 0;

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

      <VideoStage
        ref={stageRef}
        currentTime={currentTime}
        onCurrentTime={setCurrentTime}
        compact={keyboardOpen}
      />

      <View
        style={[
          styles.dock,
          keyboardOpen ? styles.dockKeyboard : null,
          dockLift > 0 ? { paddingBottom: dockLift } : null,
        ]}>
        {keyboardOpen ? null : (
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
        )}
        <ScrollView
          ref={panelScrollRef}
          style={styles.panel}
          contentContainerStyle={[
            styles.panelContent,
            { paddingBottom: (keyboardOpen ? 24 : 80) + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator>
          {tab === 'audio' ? <AudioPanel /> : null}
          {tab === 'lyrics' ? (
            <LyricsPanel
              currentTime={currentTime}
              onSeek={(time) => stageRef.current?.seek(time)}
              onInputFocus={(y) => {
                panelScrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
              }}
            />
          ) : null}
          {tab === 'style' ? <StylePanel /> : null}
          {tab === 'sync' ? <SyncPanel /> : null}
          {tab === 'export' ? <ExportPanel /> : null}
        </ScrollView>
      </View>
      {detecting ? (
        <View style={styles.detectOverlay}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.detectText}>Detecting song…</Text>
        </View>
      ) : null}
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
  dockKeyboard: {
    flex: 1,
    height: undefined,
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
  detectOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 7, 11, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  detectText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
