import type { MobileGeoTag } from '@railcommand/domain';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Share } from 'react-native';
import { mobileConfig } from './config';
import type { ExpoStoredPhoto } from './offline-store';
import {
  assertFieldPhotoSize,
  MAX_FIELD_PHOTO_BYTES,
  PHOTO_STORAGE_MESSAGE,
  PHOTO_TOO_LARGE_MESSAGE,
  safePhotoExtension,
  safePhotoFileName,
} from './photo-files';

export async function attachCurrentLocation(): Promise<MobileGeoTag> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Location permission was not granted. The draft remains saved.');
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: position.coords.latitude, lng: position.coords.longitude,
    accuracy: position.coords.accuracy ?? undefined, altitude: position.coords.altitude ?? undefined,
    timestamp: new Date(position.timestamp).toISOString() };
}

async function persistPickedPhoto(
  userId: string,
  projectId: string,
  parentClientId: string,
  asset: ImagePicker.ImagePickerAsset,
  geoTag: MobileGeoTag | null,
): Promise<ExpoStoredPhoto> {
  assertFieldPhotoSize(asset.fileSize);
  const photoId = Crypto.randomUUID();
  const directory = new Directory(Paths.document, 'railcommand', userId, projectId, 'photos');
  const extension = safePhotoExtension(asset.fileName, asset.mimeType);
  const destination = new File(directory, `${photoId}.${extension}`);
  let copiedSize: number;
  try {
    directory.create({ idempotent: true, intermediates: true });
    new File(asset.uri).copy(destination);
    copiedSize = destination.size;
  } catch {
    try { destination.delete(); } catch { /* A partial app-owned copy is never queued. */ }
    throw new Error(PHOTO_STORAGE_MESSAGE);
  }
  if (copiedSize <= 0) {
    try { destination.delete(); } catch { /* An unreadable app-owned copy is never queued. */ }
    throw new Error(PHOTO_STORAGE_MESSAGE);
  }
  if (copiedSize > MAX_FIELD_PHOTO_BYTES) {
    try { destination.delete(); } catch { /* The failed copy remains app-scoped and is never queued. */ }
    throw new Error(PHOTO_TOO_LARGE_MESSAGE);
  }
  return { photoId, projectId, parentClientId, uri: destination.uri,
    fileName: safePhotoFileName(asset.fileName, photoId, extension),
    fileType: asset.mimeType || 'image/jpeg', size: copiedSize,
    capturedAt: new Date().toISOString(), geoTag, status: 'pending', lastError: null };
}

export async function captureFieldPhoto(userId: string, projectId: string, parentClientId: string, geoTag: MobileGeoTag | null) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Camera permission was not granted. The draft remains saved.');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.82, allowsEditing: false });
  if (result.canceled || !result.assets[0]) return null;
  return persistPickedPhoto(userId, projectId, parentClientId, result.assets[0], geoTag);
}

export async function importFieldPhoto(userId: string, projectId: string, parentClientId: string, geoTag: MobileGeoTag | null) {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82,
    allowsEditing: false, allowsMultipleSelection: false });
  if (result.canceled || !result.assets[0]) return null;
  return persistPickedPhoto(userId, projectId, parentClientId, result.assets[0], geoTag);
}

export async function shareDailyLogSummary(summary: string) {
  await Share.share({ message: summary || 'RailCommand daily log' });
}

export async function confirmHaptic() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export async function registerForFieldNotifications() {
  if (!Device.isDevice) throw new Error('Push notifications require a physical device.');
  if (!mobileConfig.easProjectId) throw new Error('Push registration is not configured for this build yet.');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('field-updates', {
      name: 'Field updates', importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Notification permission was not granted. You can enable it later in Settings.');
  const token = await Notifications.getExpoPushTokenAsync({ projectId: mobileConfig.easProjectId });
  return { expoPushToken: token.data, platform: Platform.OS as 'ios' | 'android',
    appProfile: mobileConfig.profile, deviceName: Device.deviceName };
}
