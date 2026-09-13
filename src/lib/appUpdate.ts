import Constants from 'expo-constants';
import {
  cacheDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { Linking, Platform } from 'react-native';

export type AppUpdateManifest = {
  latest: string;
  min?: string;
  message?: string;
  androidUrl?: string;
  iosUrl?: string;
};

export type AppUpdateStatus = {
  installed: string;
  latest: string;
  storeUrl: string;
  message: string;
  required: boolean;
};

type ExtraUpdateConfig = {
  manifestUrl?: string;
  androidStoreUrl?: string;
  iosStoreUrl?: string;
};

const DEFAULT_MESSAGE = 'A newer version of AI LyricVid is available.';
const DEFAULT_ANDROID_STORE = 'https://play.google.com/store/apps/details?id=com.gixza.lyricvid';
const DEFAULT_MANIFEST_URL =
  'https://raw.githubusercontent.com/gixzaapp/lyricvid/main/app-version.json';

function extraConfig(): ExtraUpdateConfig {
  const extra = Constants.expoConfig?.extra as { appUpdate?: ExtraUpdateConfig } | undefined;
  return extra?.appUpdate ?? {};
}

export function getInstalledVersion() {
  return Constants.expoConfig?.version ?? '1.0.0';
}

export function compareVersions(a: string, b: string) {
  const left = a.split('.').map((part) => Number(part) || 0);
  const right = b.split('.').map((part) => Number(part) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}

function storeUrl(manifest: AppUpdateManifest) {
  const extra = extraConfig();
  if (Platform.OS === 'ios') {
    return manifest.iosUrl || extra.iosStoreUrl || extra.androidStoreUrl || DEFAULT_ANDROID_STORE;
  }
  return manifest.androidUrl || extra.androidStoreUrl || DEFAULT_ANDROID_STORE;
}

function dismissPath() {
  if (!cacheDirectory) return null;
  return `${cacheDirectory}update-dismissed-version`;
}

async function readDismissedVersion() {
  const path = dismissPath();
  if (!path) return null;
  const info = await getInfoAsync(path);
  if (!info.exists) return null;
  const value = (await readAsStringAsync(path)).trim();
  return value || null;
}

export async function dismissOptionalUpdate(latest: string) {
  const path = dismissPath();
  if (!path) return;
  await writeAsStringAsync(path, latest);
}

function parseManifest(raw: unknown): AppUpdateManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const latest = 'latest' in raw && typeof raw.latest === 'string' ? raw.latest.trim() : '';
  if (!latest) return null;
  const min = 'min' in raw && typeof raw.min === 'string' ? raw.min.trim() : undefined;
  const message = 'message' in raw && typeof raw.message === 'string' ? raw.message : undefined;
  const androidUrl =
    'androidUrl' in raw && typeof raw.androidUrl === 'string' ? raw.androidUrl : undefined;
  const iosUrl = 'iosUrl' in raw && typeof raw.iosUrl === 'string' ? raw.iosUrl : undefined;
  return { latest, min, message, androidUrl, iosUrl };
}

export async function fetchUpdateManifest() {
  const url = extraConfig().manifestUrl || DEFAULT_MANIFEST_URL;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Update check failed (${response.status}).`);
  }
  const manifest = parseManifest(await response.json());
  if (!manifest) {
    throw new Error('Update manifest is missing a latest version.');
  }
  return manifest;
}

export async function checkAppUpdate(options?: {
  ignoreDismissed?: boolean;
}): Promise<AppUpdateStatus | null> {
  const manifest = await fetchUpdateManifest();
  const installed = getInstalledVersion();
  const outdated = compareVersions(installed, manifest.latest) < 0;
  if (!outdated) return null;

  const required = Boolean(manifest.min && compareVersions(installed, manifest.min) < 0);
  if (!required && !options?.ignoreDismissed) {
    const dismissed = await readDismissedVersion();
    if (dismissed && compareVersions(dismissed, manifest.latest) >= 0) {
      return null;
    }
  }

  return {
    installed,
    latest: manifest.latest,
    storeUrl: storeUrl(manifest),
    message: manifest.message?.trim() || DEFAULT_MESSAGE,
    required,
  };
}

export async function openStoreListing(url: string) {
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    throw new Error('Could not open the store listing.');
  }
  await Linking.openURL(url);
}
