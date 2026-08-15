import { NativeModules, Platform } from 'react-native';

type AdsModule = typeof import('react-native-google-mobile-ads');

let ads: AdsModule | null = null;
let interstitial: ReturnType<AdsModule['InterstitialAd']['createForAdRequest']> | null = null;
let interstitialLoaded = false;
let shownThisExport = false;

export function adsAvailable() {
  return Platform.OS !== 'web' && Boolean(NativeModules.RNGoogleMobileAdsModule);
}

export function getAds() {
  if (!adsAvailable()) {
    return null;
  }
  if (!ads) {
    ads = require('react-native-google-mobile-ads') as AdsModule;
  }
  return ads;
}

export async function initializeAds() {
  const module = getAds();
  if (!module) {
    return;
  }
  try {
    await module.default().initialize();
    preloadExportInterstitial();
  } catch {
    // Native ads are unavailable until the next app rebuild.
  }
}

export function preloadExportInterstitial() {
  const module = getAds();
  if (!module) {
    return;
  }
  try {
    interstitialLoaded = false;
    interstitial = module.InterstitialAd.createForAdRequest(module.TestIds.INTERSTITIAL);
    interstitial.addAdEventListener(module.AdEventType.LOADED, () => {
      interstitialLoaded = true;
    });
    interstitial.addAdEventListener(module.AdEventType.CLOSED, () => {
      interstitialLoaded = false;
      preloadExportInterstitial();
    });
    interstitial.load();
  } catch {
    interstitial = null;
    interstitialLoaded = false;
  }
}

export function resetExportAdGate() {
  shownThisExport = false;
}

export function showExportInterstitialAtProgress(progress: number) {
  if (shownThisExport || progress < 0.1 || !interstitialLoaded || !interstitial) {
    return;
  }
  shownThisExport = true;
  void interstitial.show().catch(() => {
    shownThisExport = false;
  });
}
