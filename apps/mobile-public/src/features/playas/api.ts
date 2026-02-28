import { supabase } from '../../lib/supabase';

import type { PlayaListItem, PlayaWeather } from './types';

const OPEN_WEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || '2c1d54239e886b97ed52ac446c3ae948';
const WEATHER_ICON_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/';

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function resolveWeatherLang(lang: string): string {
  const base = String(lang || 'es')
    .toLowerCase()
    .split('-')[0];

  const map: Record<string, string> = {
    es: 'es',
    en: 'en',
    fr: 'fr',
    de: 'de',
    pt: 'pt',
    it: 'it',
    zh: 'zh_cn',
    ko: 'kr',
    ja: 'ja',
  };

  return map[base] || 'es';
}

export function resolveWeatherIconUrl(iconCode: string | null | undefined): string | null {
  const icon = String(iconCode ?? '').trim();
  if (!icon) return null;

  const map: Record<string, string> = {
    '01d': '1.svg',
    '01n': '1n.svg',
    '02d': '2.svg',
    '02n': '2n.svg',
    '03d': '2.svg',
    '03n': '3.svg',
    '04d': '45.svg',
    '04n': '45.svg',
    '09d': '61.svg',
    '09n': '61.svg',
    '10d': '53.svg',
    '10n': '53.svg',
    '11d': '95.svg',
    '11n': '95.svg',
    '13d': '55.svg',
    '13n': '55.svg',
    '50d': '51.svg',
    '50n': '51n.svg',
  };

  return `${WEATHER_ICON_BASE}${map[icon] || '1.svg'}`;
}

export async function fetchBeachWeather(lat: number, lon: number, lang: string): Promise<PlayaWeather | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !OPEN_WEATHER_API_KEY) {
    return null;
  }

  try {
    const url =
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}` +
      `&units=imperial&lang=${resolveWeatherLang(lang)}&appid=${OPEN_WEATHER_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      weather?: Array<{ description?: string; icon?: string }>;
      wind?: { speed?: number };
    };

    const estado = normalizeText(payload.weather?.[0]?.description);
    const iconCode = normalizeText(payload.weather?.[0]?.icon);
    const windMph = Number(payload.wind?.speed);

    return {
      estado,
      viento: Number.isFinite(windMph) ? `${Math.round(windMph)} mph` : '-- mph',
      iconoUrl: resolveWeatherIconUrl(iconCode),
    };
  } catch {
    return null;
  }
}

export async function fetchListadoPlayasData(): Promise<PlayaListItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let favoritos = new Set<number>();

  if (user) {
    const { data: favoritosData, error: favoritosError } = await supabase
      .from('favoritosPlayas')
      .select('idplaya')
      .eq('idusuario', user.id);

    if (favoritosError) {
      console.warn('[mobile-public] No se pudieron cargar favoritos de playas:', favoritosError);
    } else {
      favoritos = new Set(
        (Array.isArray(favoritosData) ? favoritosData : [])
          .map((row) => Number((row as { idplaya?: number | string | null }).idplaya))
          .filter((value) => Number.isFinite(value) && value > 0)
      );
    }
  }

  const { data, error } = await supabase.from('playas').select('*');
  if (error) throw error;

  const { data: imagenesPortada, error: imagenError } = await supabase
    .from('imagenesPlayas')
    .select('idPlaya,imagen,portada')
    .eq('portada', true);

  if (imagenError) {
    console.warn('[mobile-public] No se pudieron cargar portadas de playas:', imagenError);
  }

  const portadaById = new Map<number, string>();
  (Array.isArray(imagenesPortada) ? imagenesPortada : []).forEach((row) => {
    const idPlaya = Number((row as { idPlaya?: number | string | null }).idPlaya);
    const imagen = normalizeText((row as { imagen?: unknown }).imagen);
    if (!Number.isFinite(idPlaya) || idPlaya <= 0 || !imagen) return;
    if (!portadaById.has(idPlaya)) {
      portadaById.set(idPlaya, imagen);
    }
  });

  return (Array.isArray(data) ? data : [])
    .map((row) => row as Record<string, unknown>)
    .map((record) => {
      const id = Number(record.id);
      const snorkeling = normalizeBool(record.snorkeling);
      const snorkel = normalizeBool(record.snorkel) || snorkeling;
      const imagenRaw = normalizeText(record.imagen);
      const portada = portadaById.get(id) || null;

      return {
        id,
        nombre: normalizeText(record.nombre) || 'Playa',
        municipio: normalizeText(record.municipio),
        costa: normalizeText(record.costa),
        latitud: toFiniteNumber(record.latitud),
        longitud: toFiniteNumber(record.longitud),
        imagen: imagenRaw || null,
        portada,
        favorito: favoritos.has(id),
        bote: normalizeBool(record.bote),
        nadar: normalizeBool(record.nadar),
        surfear: normalizeBool(record.surfear),
        snorkel,
        snorkeling,
      } satisfies PlayaListItem;
    })
    .filter((item) => Number.isFinite(item.id) && item.id > 0);
}
