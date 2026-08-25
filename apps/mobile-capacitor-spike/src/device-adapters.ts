import { Geolocation, type GeolocationPlugin } from '@capacitor/geolocation';
import { Haptics, ImpactStyle, NotificationType, type HapticsPlugin } from '@capacitor/haptics';
import { Network, type ConnectionStatus, type NetworkPlugin } from '@capacitor/network';
import { Share, type SharePlugin } from '@capacitor/share';
import type { PluginListenerHandle } from '@capacitor/core';
import type { MobileGeoTag } from '@railcommand/domain';

export type DeviceResult<T> =
  | { status: 'ok'; value: T; message: string }
  | { status: 'denied' | 'unavailable' | 'cancelled' | 'failed'; message: string };

const allowed = (value: string) => value === 'granted' || value === 'limited';

export async function captureCurrentLocation(
  geolocation: Pick<GeolocationPlugin, 'checkPermissions' | 'requestPermissions' | 'getCurrentPosition'> = Geolocation,
): Promise<DeviceResult<MobileGeoTag>> {
  try {
    let permissions = await geolocation.checkPermissions();
    if (!allowed(permissions.location) && !allowed(permissions.coarseLocation)) {
      permissions = await geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
    }
    if (!allowed(permissions.location) && !allowed(permissions.coarseLocation)) {
      return {
        status: 'denied',
        message: 'Location permission was denied. The draft remains usable without a location.',
      };
    }
    const position = await geolocation.getCurrentPosition({
      enableHighAccuracy: allowed(permissions.location),
      enableLocationFallback: true,
      maximumAge: 30_000,
      timeout: 12_000,
    });
    const value: MobileGeoTag = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude ?? undefined,
      timestamp: new Date(position.timestamp).toISOString(),
    };
    return { status: 'ok', value, message: 'Location attached to this device draft.' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      status: 'unavailable',
      message: `Location is unavailable (${detail}). The draft remains saved without it.`,
    };
  }
}

export async function shareProjectLink(
  projectId: string,
  projectName: string,
  share: Pick<SharePlugin, 'canShare' | 'share'> = Share,
): Promise<DeviceResult<null>> {
  try {
    const supported = await share.canShare();
    if (!supported.value) {
      return { status: 'unavailable', message: 'Sharing is unavailable on this device.' };
    }
    await share.share({
      title: `RailCommand · ${projectName}`,
      text: `Open ${projectName} in RailCommand`,
      url: `https://railcommand.io/projects/${encodeURIComponent(projectId)}`,
      dialogTitle: 'Share RailCommand project',
    });
    return { status: 'ok', value: null, message: 'Project link shared.' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { status: 'cancelled', message: `Share sheet closed (${detail}).` };
  }
}

export async function haptic(
  kind: 'selection' | 'success' | 'warning' = 'selection',
  adapter: Pick<HapticsPlugin, 'impact' | 'notification'> = Haptics,
): Promise<void> {
  try {
    if (kind === 'selection') await adapter.impact({ style: ImpactStyle.Light });
    else await adapter.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Warning });
  } catch {
    // Haptics are an enhancement only. Unsupported hardware must never block field work.
  }
}

export function getConnectivity(network: Pick<NetworkPlugin, 'getStatus'> = Network): Promise<ConnectionStatus> {
  return network.getStatus();
}

export function onConnectivityChange(
  listener: (status: ConnectionStatus) => void,
  network: Pick<NetworkPlugin, 'addListener'> = Network,
): Promise<PluginListenerHandle> {
  return network.addListener('networkStatusChange', listener);
}
