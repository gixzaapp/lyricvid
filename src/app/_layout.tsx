import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BrandSplash } from '@/components/BrandSplash';
import { LanguageSelect } from '@/components/LanguageSelect';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { initializeAds } from '@/lib/ads';
import { useLocaleStore } from '@/store/locale';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [showBrand, setShowBrand] = useState(false);
  const [brandDone, setBrandDone] = useState(false);
  const hydrated = useLocaleStore((s) => s.hydrated);
  const locale = useLocaleStore((s) => s.code);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const needsLanguage = brandDone && hydrated && !locale;

  useEffect(() => {
    void initializeAds();
    void useLocaleStore.getState().hydrate();
    const timer = setTimeout(() => {
      SplashScreen.hide();
      setShowBrand(true);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      />
      {!hydrated && brandDone ? <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0b1326' }]} /> : null}
      {needsLanguage ? (
        <View style={StyleSheet.absoluteFillObject}>
          <LanguageSelect selected={null} onSelect={(code) => void setLocale(code)} />
        </View>
      ) : null}
      {brandDone && hydrated && locale ? <UpdatePrompt /> : null}
      {showBrand && !brandDone ? (
        <View style={styles.brandLayer}>
          <BrandSplash onFinished={() => setBrandDone(true)} />
        </View>
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  brandLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: '#0b1326',
  },
});
