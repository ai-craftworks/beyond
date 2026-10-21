/**
 * src/utils/media.ts
 * ===================
 * Local media handling for skills and workouts (exercises).
 * Pick an image/GIF/video, copy it into the app's document directory (files
 * returned by the picker live in a cache that the OS may purge), and delete
 * files when an item is updated or removed.
 *
 * GIFs are picked as `image` assets — React Native's Image renders them
 * animated inline and in the fullscreen viewer.
 */

import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { MediaType } from '../database/Database';

export type PickedMediaKind = Exclude<MediaType, 'none'>;

export interface PickedMedia {
  type: PickedMediaKind;
  uri: string;
}

const MEDIA_DIR_NAME = 'media';

const mediaDir = (): Directory => new Directory(Paths.document, MEDIA_DIR_NAME);

const ensureDir = (): Directory => {
  const dir = mediaDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

const extensionFor = (uri: string, type: PickedMediaKind, preferredName?: string): string => {
  const candidate = (preferredName ?? uri).split('?')[0];
  const match = candidate.match(/\.([a-zA-Z0-9]+)$/);
  if (match) return match[1].toLowerCase();
  return type === 'video' ? 'mp4' : 'jpg';
};

/** Copies a picked file into permanent app storage and returns its stored URI. */
export const persistMedia = async (
  sourceUri: string,
  type: PickedMediaKind,
  preferredName?: string
): Promise<string> => {
  const dir = ensureDir();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(sourceUri, type, preferredName)}`;
  const source = new File(sourceUri);
  const destination = new File(dir, name);
  await source.copy(destination);
  return destination.uri;
};

/** Opens the system library picker and persists the chosen image/GIF/video. */
export const pickMedia = async (): Promise<PickedMedia | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Permission needed',
      'Allow access to your photos and files to attach media.',
    );
    return null;
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images', 'videos'],
    allowsEditing: false,
    quality: 1,
  };

  // On Android the default picker is the system Photo Picker, which is backed
  // by Google Photos and shows the cloud library instead of the device's own
  // gallery. The legacy picker opens the system file/gallery browser
  // (ACTION_GET_CONTENT) filtered to image/* and video/*, so local photos and
  // videos are both reachable. Ignored on iOS.
  if (Platform.OS === 'android') options.legacy = true;

  const result = await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const type: PickedMediaKind = asset.type === 'video' ? 'video' : 'image';
  const uri = await persistMedia(asset.uri, type, asset.fileName ?? undefined);
  return { type, uri };
};

/** Removes a stored media file. Safe to call with empty/invalid URIs. */
export const deleteMedia = (uri: string | null | undefined): void => {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best-effort cleanup — a missing file must never break the screen.
  }
};
