const REMOTE_OSRM_BASE = 'https://osrm.enpe-erre.com';

export type OsrmPoint = {
  lat: number;
  lng: number;
};

export type OsrmRoute = {
  distancia: number;
  duracion: number;
};

export async function getDrivingDistance(from: OsrmPoint, to: OsrmPoint): Promise<OsrmRoute | null> {
  const latFrom = Number(from?.lat);
  const lngFrom = Number(from?.lng);
  const latTo = Number(to?.lat);
  const lngTo = Number(to?.lng);

  if (
    !Number.isFinite(latFrom) ||
    !Number.isFinite(lngFrom) ||
    !Number.isFinite(latTo) ||
    !Number.isFinite(lngTo)
  ) {
    return null;
  }

  try {
    const url = `${REMOTE_OSRM_BASE}/route/v1/driving/${lngFrom},${latFrom};${lngTo},${latTo}?overview=false`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      routes?: Array<{ distance?: number; duration?: number }>;
    };
    const route = data?.routes?.[0];
    const distancia = Number(route?.distance);
    const duracion = Number(route?.duration);

    if (!Number.isFinite(distancia) || !Number.isFinite(duracion)) return null;
    return { distancia, duracion };
  } catch {
    return null;
  }
}
