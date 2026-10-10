import * as DocumentPicker from 'expo-document-picker';
import { cacheDirectory, copyAsync, deleteAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { normalizePickerDuration } from '@/lib/time';

export type PickedMedia = {
  uri: string;
  name: string;
  duration: number;
  kind: 'video' | 'image' | 'audio';
};

const IMAGE_NAME = /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i;

export function mediaKind(name: string, mime?: string | null): 'video' | 'image' {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('video/')) return 'video';
  if (IMAGE_NAME.test(name)) return 'image';
  return 'video';
}

export async function pickVideoFromLibrary(): Promise<PickedMedia | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos', 'images'],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const kind = asset.type === 'image' ? 'image' : mediaKind(asset.fileName ?? '', asset.mimeType);
  const name = asset.fileName ?? (kind === 'image' ? 'photo.jpg' : 'video.mp4');
  return {
    uri: await cachePickedMedia(asset.uri, name),
    name,
    duration: kind === 'image' ? 0 : normalizePickerDuration(asset.duration),
    kind,
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

export async function pickFile(kind: 'video' | 'audio' | 'media'): Promise<PickedMedia | null> {
  const type =
    kind === 'audio' ? ['audio/*'] : kind === 'media' ? ['video/*', 'image/*'] : ['video/*'];
  const result = await DocumentPicker.getDocumentAsync({
    type,
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const name = asset.name ?? (kind === 'audio' ? 'audio.mp3' : 'video.mp4');
  const pickedKind =
    kind === 'audio' ? 'audio' : mediaKind(name, asset.mimeType);
  return {
    uri: asset.uri,
    name,
    duration: 0,
    kind: pickedKind,
  };
}
