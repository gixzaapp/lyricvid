import * as DocumentPicker from 'expo-document-picker';
import { cacheDirectory, copyAsync, deleteAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { normalizePickerDuration } from '@/lib/time';

export type PickedMedia = {
  uri: string;
  name: string;
  duration: number;
};

export async function pickVideoFromLibrary(): Promise<PickedMedia | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('media.photoPermission');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const name = asset.fileName ?? 'video.mp4';
  return {
    uri: await cachePickedMedia(asset.uri, name),
    name,
    duration: normalizePickerDuration(asset.duration),
  };
}

async function cachePickedMedia(uri: string, name: string) {
  if (!cacheDirectory) {
    return uri;
  }
  if (uri.startsWith('file:') && uri.includes('/cache/')) {
    return uri;
  }
  const dest = `${cacheDirectory}${Date.now()}-${name.replace(/[\\/]/g, '_')}`;
  try {
    await deleteAsync(dest, { idempotent: true });
    await copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

export async function pickFile(kind: 'video' | 'audio'): Promise<PickedMedia | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: kind === 'video' ? ['video/*'] : ['audio/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name ?? (kind === 'video' ? 'video.mp4' : 'audio.mp3'),
    duration: 0,
  };
}
