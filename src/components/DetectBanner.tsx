import { StyleSheet, View } from 'react-native';

import { getAds, getDetectBannerAdUnitId } from '@/lib/ads';

export function DetectBanner() {
  const ads = getAds();
  if (!ads) {
    return null;
  }

  const { BannerAd, BannerAdSize } = ads;
  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={getDetectBannerAdUnitId()}
        size={BannerAdSize.MEDIUM_RECTANGLE}
        onAdFailedToLoad={() => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: 300,
    height: 250,
  },
});
