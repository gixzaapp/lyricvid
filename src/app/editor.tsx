import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
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

import { DetectBanner } from '@/components/DetectBanner';
import { ImageStage } from '@/components/ImageStage';
import { AudioPanel } from '@/components/panels/AudioPanel';
import { ExportPanel } from '@/components/panels/ExportPanel';
import { LyricsPanel } from '@/components/panels/LyricsPanel';
import { StickersPanel } from '@/components/panels/StickersPanel';
import { StylePanel } from '@/components/panels/StylePanel';
import { SyncPanel } from '@/components/panels/SyncPanel';
import { VideoStage, type VideoStageHandle } from '@/components/VideoStage';
import { getLyricsById } from '@/lib/lrclib';
import { detectSongFromMedia } from '@/lib/songDetect';
import { errorText, useT } from '@/store/locale';
import { IMAGE_LENGTHS, useProjectStore } from '@/store/project';
import { colors } from '@/theme';
import type { TranslationKey } from '@/i18n';

const DETECT_AD_MS = 3000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TabId = 'audio' | 'lyrics' | 'style' | 'stickers' | 'sync' | 'export';

const TABS: { id: TabId; labelKey: TranslationKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'audio', labelKey: 'editor.audio', icon: 'musical-notes-outline' },
  { id: 'lyrics', labelKey: 'editor.lyrics', icon: 'text-outline' },
  { id: 'style', labelKey: 'editor.style', icon: 'color-palette-outline' },
  { id: 'stickers', labelKey: 'editor.stickers', icon: 'pricetag-outline' },
  { id: 'sync', labelKey: 'editor.sync', icon: 'time-outline' },
  { id: 'export', labelKey: 'editor.export', icon: 'share-outline' },
];

export default function EditorScreen() {
  const router = useRouter();
  const t = useT();
  const videoUri = useProjectStore((s) => s.videoUri);
  const sourceKind = useProjectStore((s) => s.sourceKind);
  const videoDuration = useProjectStore((s) => s.videoDuration);
  const setVideoDuration = useProjectStore((s) => s.setVideoDuration);
  const track = useProjectStore((s) => s.track);
  const applyTrack = useProjectStore((s) => s.applyTrack);
  const pendingSongDetect = useProjectStore((s) => s.pendingSongDetect);
  const setPendingSongDetect = useProjectStore((s) => s.setPendingSongDetect);
  const stageRef = useRef<VideoStageHandle>(null);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabId>(sourceKind === 'image' ? 'audio' : 'lyrics');
  const [currentTime, setCurrentTime] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [detecting, setDetecting] = useState(false);
  const panelScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    panelScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [tab]);

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
    if (!pendingSongDetect || !videoUri || sourceKind === 'image') {
      return;
    }
    const timer = setTimeout(() => {
      setPendingSongDetect(false);
      Alert.alert(
        t('detect.title'),
        t('detect.body'),
        [
          { text: t('common.no'), style: 'cancel' },
          {
            text: t('common.yes'),
            onPress: () => {
              void (async () => {
                setDetecting(true);
                let showResult = () => {};
                try {
                  const project = useProjectStore.getState();
                  const sourceUri = project.videoUri ?? videoUri;
                  if (!sourceUri) {
                    throw new Error('editor.pickVideo');
                  }
                  const { match, tracks } = await detectSongFromMedia({
                    sourceUri,
                    currentTime: 0,
                    mediaDuration: project.videoDuration,
                  });
                  if (!tracks[0]) {
                    showResult = () => {
                      Alert.alert(
                        t('detect.noLyricsTitle'),
                        t('detect.noLyricsBody', { artist: match.artist, title: match.title }),
                      );
                    };
                  } else {
                    const full = await getLyricsById(tracks[0].id);
                    applyTrack(full);
                    showResult = () => {
                      Alert.alert(t('detect.loadedTitle'), `${match.artist} — ${match.title}`);
                    };
                  }
                } catch (error) {
                  const message = errorText(error, 'detect.failFallback');
                  showResult = () => {
                    Alert.alert(t('detect.failTitle'), message);
                  };
                } finally {
                  await wait(DETECT_AD_MS);
                  setDetecting(false);
                }
                showResult();
              })();
            },
          },
        ],
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [applyTrack, pendingSongDetect, setPendingSongDetect, sourceKind, t, videoUri]);

  const keyboardOpen = keyboardHeight > 0;
  const dockLift = Platform.OS === 'android' ? Math.max(0, keyboardHeight - insets.bottom) : 0;

  const title = useMemo(
    () => (track ? track.trackName : t('editor.title')),
    [t, track],
  );

  if (!videoUri) {
    return (
      <SafeAreaView style={styles.missing}>
        <Text style={styles.missingText}>{t('editor.pickVideo')}</Text>
        <Pressable onPress={() => router.replace('/')}>
          <Text style={styles.link}>{t('editor.backHome')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (sourceKind === 'image' && videoDuration <= 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text numberOfLines={1} style={styles.title}>
            {t('image.lengthTitle')}
          </Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.lengthBody}>
          <Text style={styles.lengthCopy}>{t('image.lengthBody')}</Text>
          {IMAGE_LENGTHS.map((seconds) => (
            <Pressable
              key={seconds}
              onPress={() => {
                setVideoDuration(seconds);
                setTab('audio');
              }}
              style={styles.lengthChoice}>
              <Text style={styles.lengthChoiceLabel}>{t(seconds === 30 ? 'image.length30' : 'image.length60')}</Text>
            </Pressable>
          ))}
        </View>
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

      {sourceKind === 'image' ? (
        <ImageStage
          ref={stageRef}
          currentTime={currentTime}
          onCurrentTime={setCurrentTime}
          compact={keyboardOpen}
        />
      ) : (
        <VideoStage
          ref={stageRef}
          currentTime={currentTime}
          onCurrentTime={setCurrentTime}
          compact={keyboardOpen}
        />
      )}

      <View
        style={[
          styles.dock,
          keyboardOpen ? styles.dockKeyboard : null,
          dockLift > 0 ? { paddingBottom: dockLift } : null,
        ]}>
        {keyboardOpen ? null : (
          <ScrollView
            horizontal
            style={styles.tabBar}
            contentContainerStyle={styles.tabs}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bounces={false}>
            {TABS.map((item) => {
              const active = item.id === tab;
              return (
                <Pressable key={item.id} onPress={() => setTab(item.id)} style={styles.tab}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={active ? colors.accent : colors.muted}
                  />
                  <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{t(item.labelKey)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        <ScrollView
          key={tab}
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
          {tab === 'stickers' ? <StickersPanel /> : null}
          {tab === 'sync' ? <SyncPanel /> : null}
          {tab === 'export' ? <ExportPanel /> : null}
        </ScrollView>
      </View>
      {detecting ? (
        <View style={styles.detectOverlay}>
          <DetectBanner />
          <Text style={styles.detectText}>{t('editor.detecting')}</Text>
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
  tabBar: {
    flexGrow: 0,
    flexShrink: 0,
    height: 52,
  },
  tabs: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  tab: {
    minWidth: 56,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
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
  lengthBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 12,
  },
  lengthCopy: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  lengthChoice: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  lengthChoiceLabel: {
    color: colors.text,
    fontSize: 18,
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
