import { StyleSheet, View } from 'react-native';

import { getAds } from '@/lib/ads';

export function LandingBanner() {
  const ads = getAds();
  if (!ads) {
    return null;
  }

  const { BannerAd, BannerAdSize, TestIds } = ads;
  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={TestIds.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: '100%',
  },
});
