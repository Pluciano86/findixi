import * as Location from 'expo-location';

export type UserLocation = {
  latitude: number;
  longitude: number;
};

export async function requestUserLocation(): Promise<UserLocation | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}
