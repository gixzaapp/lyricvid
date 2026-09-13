import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BrandSplash } from '@/components/BrandSplash';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { initializeAds } from '@/lib/ads';
import { colors } from '@/theme';

SplashScreen.setOptions({ duration: 0, fade: false });

export default function RootLayout() {
  const [showBrand, setShowBrand] = useState(Platform.OS !== 'android');

  useEffect(() => {
    SplashScreen.hide();
    void initializeAds();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0b1326' }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      />
      {showBrand ? (
        <View style={StyleSheet.absoluteFillObject}>
          <BrandSplash onFinished={() => setShowBrand(false)} />
        </View>
      ) : (
        <UpdatePrompt />
      )}
    </GestureHandlerRootView>
  );
}
