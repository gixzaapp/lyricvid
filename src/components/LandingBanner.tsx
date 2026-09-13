import { StyleSheet, View } from 'react-native';

import { getAds, getBannerAdUnitId } from '@/lib/ads';

export function LandingBanner() {
  const ads = getAds();
  if (!ads) {
    return null;
  }

  const { BannerAd, BannerAdSize } = ads;
  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={getBannerAdUnitId()}
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
