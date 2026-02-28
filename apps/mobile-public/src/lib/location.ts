import * as Location from 'expo-location';

export type UserLocation = {
  latitude: number;
  longitude: number;
};

export async function detectMunicipioUsuario(coords: UserLocation): Promise<string | null> {
  const lat = Number(coords?.latitude);
  const lon = Number(coords?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      address?: {
        town?: string;
        city?: string;
        village?: string;
        county?: string;
      };
    };
    const municipio =
      data?.address?.town ||
      data?.address?.city ||
      data?.address?.village ||
      data?.address?.county ||
      null;

    return typeof municipio === 'string' && municipio.trim() ? municipio.trim() : null;
  } catch {
    return null;
  }
}

export async function requestUserLocation(): Promise<UserLocation | null> {
  const currentPermission = await Location.getForegroundPermissionsAsync();
  let status = currentPermission.status;

  if (status !== 'granted') {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') return null;

  try {
    const position = (await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 8000);
      }),
    ])) as Location.LocationObject | null;

    if (!position) {
      const fallback = await Location.getLastKnownPositionAsync();
      if (!fallback) return null;
      return {
        latitude: fallback.coords.latitude,
        longitude: fallback.coords.longitude,
      };
    }

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    const fallback = await Location.getLastKnownPositionAsync();
    if (!fallback) return null;
    return {
      latitude: fallback.coords.latitude,
      longitude: fallback.coords.longitude,
    };
  }
}
