import {
  calcularDistanciaHaversineKm,
  calcularTiempoEnVehiculo,
  DEFAULT_APP_BASE_URLS,
  formatearTelefonoDisplay,
  formatearTelefonoHref,
  pickRandomItems,
  resolverPlanComercio,
} from '@findixi/shared';
import { FontAwesome, FontAwesome6 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgCssUri } from 'react-native-svg/css';

import { PublicAppChrome } from '../../src/components/layout/PublicAppChrome';
import {
  fetchBeachWeather,
  fetchBeachWeatherDetail,
  fetchIsFavoritePlaya,
  fetchPlayaById,
  fetchPlayaTranslation,
  toggleFavoritePlaya,
} from '../../src/features/playas/api';
import { tPerfilPlaya } from '../../src/features/playas/profileI18n';
import { tPlayas, traducirCosta } from '../../src/features/playas/i18n';
import type { PlayaDetail, PlayaWeather, PlayaWeatherDetail } from '../../src/features/playas/types';
import { useI18n } from '../../src/i18n/provider';
import { requestUserLocation, type UserLocation } from '../../src/lib/location';
import { getDrivingDistance } from '../../src/lib/osrm';
import { supabase } from '../../src/lib/supabase';
import { borderRadius, fonts, shadows, spacing } from '../../src/theme/tokens';

const PLAYA_PLACEHOLDER =
  'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/imgPlayaNoDisponible.jpg';
const STORAGE_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/';

const COMIDA_CATEGORIAS_VALIDAS = new Set([1, 2, 5, 7]);
const CATEGORIA_LABEL_BY_ID: Record<number, string> = {
  1: 'Restaurantes',
  2: 'Coffee Shops',
  5: 'Food Trucks',
  7: 'Panaderias',
};
const NEARBY_COMERCIO_NAME_LONG_THRESHOLD = 24;

type NearbyComercioCard = {
  id: number;
  nombre: string;
  municipio: string;
  telefono: string;
  portadaUrl: string;
  logoUrl: string;
  categoriaLabel: string;
  minutos: number;
};

type NearbyLugarCard = {
  id: number;
  nombre: string;
  municipio: string;
  imagenUrl: string;
  minutos: number;
};

type NearbyPlayaCard = {
  id: number;
  nombre: string;
  municipio: string;
  imagenUrl: string;
  latitud: number;
  longitud: number;
  minutos: number;
  clima: PlayaWeather | null;
};

function parseId(value: string | string[] | undefined): number {
  if (Array.isArray(value)) return Number(value[0] ?? 0);
  return Number(value ?? 0);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeLang(lang: string): string {
  return String(lang || 'es').toLowerCase().split('-')[0];
}

function formatMunicipioCosta(item: PlayaDetail, lang: string): string {
  const municipio = String(item.municipio || '').trim();
  const costaRaw = String(item.costa || '').trim();
  const costaLabel = costaRaw ? traducirCosta(lang, costaRaw) : '';

  let costaText = '';
  const code = normalizeLang(lang);
  if (costaLabel) {
    costaText = code === 'en' ? `${costaLabel} Coast` : `Costa ${costaLabel}`;
  }

  if (municipio && costaText) return `${municipio} - ${costaText}`;
  return municipio || costaText;
}

function toStorageUrl(pathOrUrl: string | null | undefined, fallback: string): string {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${STORAGE_BASE}${raw.replace(/^public\//i, '').replace(/^\/+/, '')}`;
}

function renderTravelText(minutes: number | null): string {
  if (!Number.isFinite(minutes)) return 'No disponible';
  const min = Math.max(0, Math.round(Number(minutes)));
  if (min < 60) return `a ${min} minuto${min === 1 ? '' : 's'}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `a ${h} h ${m} min`;
}

async function resolverMinutos(origen: UserLocation, destinoLat: number, destinoLon: number): Promise<number | null> {
  if (!Number.isFinite(destinoLat) || !Number.isFinite(destinoLon)) return null;

  const fallbackKm = calcularDistanciaHaversineKm(origen.latitude, origen.longitude, destinoLat, destinoLon);
  const fallback = calcularTiempoEnVehiculo(fallbackKm);
  let minutos = Number.isFinite(fallback.minutos) ? Math.max(0, Math.round(fallback.minutos)) : null;

  try {
    const osrm = await getDrivingDistance(
      { lat: origen.latitude, lng: origen.longitude },
      { lat: destinoLat, lng: destinoLon }
    );
    if (osrm && Number.isFinite(osrm.duracion)) {
      minutos = Math.max(0, Math.round(osrm.duracion / 60));
    }
  } catch {
    // fallback
  }

  return minutos;
}

export default function PlayaDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseId(params.id);
  const { lang } = useI18n();

  const [item, setItem] = useState<PlayaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [clima, setClima] = useState<PlayaWeatherDetail | null>(null);
  const [travelText, setTravelText] = useState(tPerfilPlaya('perfilPlaya.distancia', lang));
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [descripcionText, setDescripcionText] = useState('');
  const [accesoText, setAccesoText] = useState('');
  const [heroUri, setHeroUri] = useState(PLAYA_PLACEHOLDER);
  const [heroFailed, setHeroFailed] = useState(false);

  const [loadingCercanos, setLoadingCercanos] = useState(false);
  const [cercanosComida, setCercanosComida] = useState<NearbyComercioCard[]>([]);
  const [cercanosLugares, setCercanosLugares] = useState<NearbyLugarCard[]>([]);
  const [cercanosPlayas, setCercanosPlayas] = useState<NearbyPlayaCard[]>([]);

  const showNoImageOverlay = useMemo(() => !item?.imagen || heroFailed, [heroFailed, item?.imagen]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [playaData, userLocation] = await Promise.all([fetchPlayaById(id), requestUserLocation().catch(() => null)]);

      if (!playaData) {
        setError('Playa no encontrada.');
        setItem(null);
        return;
      }

      setItem(playaData);
      setLocation(userLocation);
      setHeroUri(playaData.imagen || PLAYA_PLACEHOLDER);
      setHeroFailed(false);
      setDescripcionText(playaData.descripcion || tPerfilPlaya('playa.descripcionNoDisponible', lang));
      setAccesoText(playaData.acceso || tPerfilPlaya('playa.accesoNoDisponible', lang));

      const [weatherData, authData] = await Promise.all([
        playaData.latitud != null && playaData.longitud != null
          ? fetchBeachWeatherDetail(Number(playaData.latitud), Number(playaData.longitud), lang)
          : Promise.resolve(null),
        supabase.auth.getUser(),
      ]);

      setClima(weatherData);

      const user = authData.data.user;
      if (user?.id) {
        const favoriteState = await fetchIsFavoritePlaya(playaData.id, user.id);
        setIsFavorite(favoriteState);
      } else {
        setIsFavorite(false);
      }

      if (userLocation && playaData.latitud != null && playaData.longitud != null) {
        const minutos = await resolverMinutos(userLocation, Number(playaData.latitud), Number(playaData.longitud));
        setTravelText(renderTravelText(minutos));
      } else {
        setTravelText('No disponible');
      }
    } catch (loadError) {
      console.error('[mobile-public] Error cargando perfil de playa:', loadError);
      setError('No se pudo cargar el perfil de playa.');
    } finally {
      setLoading(false);
    }
  }, [id, lang]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!item) return;

    let active = true;

    const run = async () => {
      const translated = await fetchPlayaTranslation(item.id, lang);
      if (!active) return;

      if (translated) {
        setDescripcionText(translated.descripcion || item.descripcion || tPerfilPlaya('playa.descripcionNoDisponible', lang));
        setAccesoText(translated.acceso || item.acceso || tPerfilPlaya('playa.accesoNoDisponible', lang));
      } else {
        setDescripcionText(item.descripcion || tPerfilPlaya('playa.descripcionNoDisponible', lang));
        setAccesoText(item.acceso || tPerfilPlaya('playa.accesoNoDisponible', lang));
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [item, lang]);

  useEffect(() => {
    if (!item || item.latitud == null || item.longitud == null || !location) {
      setCercanosComida([]);
      setCercanosLugares([]);
      setCercanosPlayas([]);
      return;
    }

    let active = true;
    const origen = {
      id: item.id,
      nombre: item.nombre,
      municipio: item.municipio,
      latitude: Number(item.latitud),
      longitude: Number(item.longitud),
    };

    const run = async () => {
      setLoadingCercanos(true);
      try {
        const { data: comerciosRaw } = await supabase
          .from('Comercios')
          .select(
            'id,nombre,municipio,telefono,latitud,longitud,logo,portada,activo,plan_id,plan_nivel,plan_nombre,permite_perfil,aparece_en_cercanos,permite_menu,permite_especiales,permite_ordenes,estado_propiedad,estado_verificacion,propietario_verificado,ComercioCategorias(idCategoria)'
          )
          .eq('activo', true);

        const comerciosBase = (Array.isArray(comerciosRaw) ? comerciosRaw : [])
          .map((row) => row as Record<string, unknown>)
          .filter((record) => {
            const lat = toFiniteNumber(record.latitud);
            const lon = toFiniteNumber(record.longitud);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
            if (!resolverPlanComercio(record).aparece_en_cercanos) return false;
            const categorias = Array.isArray(record.ComercioCategorias) ? record.ComercioCategorias : [];
            return categorias.some((entry) => COMIDA_CATEGORIAS_VALIDAS.has(Number((entry as { idCategoria?: number }).idCategoria)));
          });

        const candidatosComida = pickRandomItems(comerciosBase, Math.min(comerciosBase.length, 40));
        const comidaConTiempo = await Promise.all(
          candidatosComida.map(async (record) => {
            const lat = Number(record.latitud);
            const lon = Number(record.longitud);
            const minutos = await resolverMinutos(location, lat, lon);
            if (!Number.isFinite(minutos)) return null;

            const categorias = Array.isArray(record.ComercioCategorias)
              ? (record.ComercioCategorias as Array<{ idCategoria?: number | null }>)
              : [];
            const firstCategoria = categorias
              .map((entry) => Number(entry.idCategoria))
              .find((catId) => COMIDA_CATEGORIAS_VALIDAS.has(catId));

            return {
              id: Number(record.id),
              nombre: String(record.nombre ?? 'Comercio'),
              municipio: String(record.municipio ?? 'Puerto Rico'),
              telefono: String(record.telefono ?? '').trim(),
              portadaUrl: toStorageUrl(String(record.portada ?? ''), 'https://placehold.co/200x120?text=Portada'),
              logoUrl: toStorageUrl(String(record.logo ?? ''), 'https://placehold.co/80x80?text=Logo'),
              categoriaLabel: CATEGORIA_LABEL_BY_ID[firstCategoria ?? 1] ?? 'Comercio',
              minutos: Number(minutos),
            } satisfies NearbyComercioCard;
          })
        );

        const comidaFiltrada = comidaConTiempo
          .filter((value): value is NearbyComercioCard => Boolean(value))
          .filter((value) => value.minutos <= 10)
          .sort((a, b) => a.minutos - b.minutos);

        const { data: lugaresRaw } = await supabase
          .from('LugaresTuristicos')
          .select('id,nombre,municipio,latitud,longitud,activo')
          .eq('activo', true);
        const { data: imagenesLugaresRaw } = await supabase
          .from('imagenesLugares')
          .select('idLugar,imagen,portada')
          .eq('portada', true);

        const portadaLugarById = new Map<number, string>();
        (Array.isArray(imagenesLugaresRaw) ? imagenesLugaresRaw : []).forEach((row) => {
          const idLugar = Number((row as { idLugar?: number | string | null }).idLugar);
          if (!Number.isFinite(idLugar) || idLugar <= 0) return;
          const imageRaw = String((row as { imagen?: string | null }).imagen ?? '').trim();
          portadaLugarById.set(idLugar, toStorageUrl(imageRaw, 'https://placehold.co/600x380?text=Lugar'));
        });

        const lugaresBase = (Array.isArray(lugaresRaw) ? lugaresRaw : [])
          .map((row) => row as Record<string, unknown>)
          .filter((record) => Number.isFinite(toFiniteNumber(record.latitud)) && Number.isFinite(toFiniteNumber(record.longitud)));

        const lugaresConTiempo = await Promise.all(
          lugaresBase.slice(0, 60).map(async (record) => {
            const idLugar = Number(record.id);
            const minutos = await resolverMinutos(location, Number(record.latitud), Number(record.longitud));
            if (!Number.isFinite(minutos)) return null;

            return {
              id: idLugar,
              nombre: String(record.nombre ?? 'Lugar'),
              municipio: String(record.municipio ?? ''),
              imagenUrl: portadaLugarById.get(idLugar) || 'https://placehold.co/600x380?text=Lugar',
              minutos: Number(minutos),
            } satisfies NearbyLugarCard;
          })
        );

        const lugaresFiltrados = lugaresConTiempo
          .filter((value): value is NearbyLugarCard => Boolean(value))
          .filter((value) => value.minutos <= 20)
          .sort((a, b) => a.minutos - b.minutos);

        let playasFiltradas: NearbyPlayaCard[] = [];
        if (String(item.municipio ?? '').trim()) {
          const { data: municipioData } = await supabase
            .from('Municipios')
            .select('costa')
            .eq('nombre', String(item.municipio).trim())
            .maybeSingle();

          if (municipioData && Boolean((municipioData as { costa?: boolean | null }).costa)) {
            const { data: playasRaw } = await supabase
              .from('playas')
              .select('id,nombre,municipio,imagen,latitud,longitud')
              .not('latitud', 'is', null)
              .not('longitud', 'is', null)
              .neq('id', item.id);

            const playasConTiempo = await Promise.all(
              (Array.isArray(playasRaw) ? playasRaw : [])
                .map((row) => row as Record<string, unknown>)
                .slice(0, 60)
                .map(async (record) => {
                  const lat = Number(record.latitud);
                  const lon = Number(record.longitud);
                  const minutos = await resolverMinutos(location, lat, lon);
                  if (!Number.isFinite(minutos)) return null;

                  const climaPlaya = await fetchBeachWeather(lat, lon, lang);

                  return {
                    id: Number(record.id),
                    nombre: String(record.nombre ?? 'Playa'),
                    municipio: String(record.municipio ?? ''),
                    latitud: lat,
                    longitud: lon,
                    imagenUrl: String(record.imagen ?? '').trim() || PLAYA_PLACEHOLDER,
                    minutos: Number(minutos),
                    clima: climaPlaya,
                  } satisfies NearbyPlayaCard;
                })
            );

            playasFiltradas = playasConTiempo
              .filter((value): value is NearbyPlayaCard => Boolean(value))
              .filter((value) => value.minutos <= 45)
              .sort((a, b) => a.minutos - b.minutos);
          }
        }

        if (!active) return;

        setCercanosComida(comidaFiltrada);
        setCercanosLugares(lugaresFiltrados);
        setCercanosPlayas(playasFiltradas);
      } catch (nearError) {
        if (!active) return;
        console.warn('[mobile-public] No se pudieron cargar cercanos en perfil playa:', nearError);
        setCercanosComida([]);
        setCercanosLugares([]);
        setCercanosPlayas([]);
      } finally {
        if (active) setLoadingCercanos(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [item, lang, location]);

  const mapsUrl = useMemo(() => {
    if (!item || item.latitud == null || item.longitud == null) return null;
    return `https://www.google.com/maps?q=${item.latitud},${item.longitud}`;
  }, [item]);

  const wazeUrl = useMemo(() => {
    if (!item || item.latitud == null || item.longitud == null) return null;
    return `https://waze.com/ul?ll=${item.latitud},${item.longitud}&navigate=yes`;
  }, [item]);

  const handleToggleFavorite = useCallback(async () => {
    if (!item || favoriteBusy) return;

    setFavoriteBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        await Linking.openURL(`${DEFAULT_APP_BASE_URLS.public}/logearse.html`);
        return;
      }

      const next = await toggleFavoritePlaya(item.id, user.id, isFavorite);
      setIsFavorite(next);
    } catch (toggleError) {
      console.warn('[mobile-public] Error al cambiar favorito de playa:', toggleError);
    } finally {
      setFavoriteBusy(false);
    }
  }, [favoriteBusy, isFavorite, item]);

  if (loading) {
    return (
      <PublicAppChrome>
        {({ contentPaddingStyle }) => (
          <View style={[styles.stateWrap, contentPaddingStyle]}>
            <ActivityIndicator size="small" color="#3ea6c4" />
            <Text style={styles.stateText}>{tPerfilPlaya('perfilPlaya.cargandoInfo', lang)}</Text>
          </View>
        )}
      </PublicAppChrome>
    );
  }

  if (error || !item) {
    return (
      <PublicAppChrome>
        {({ contentPaddingStyle }) => (
          <View style={[styles.stateWrap, contentPaddingStyle]}>
            <Text style={styles.stateErrorText}>{error || 'Playa no encontrada.'}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadProfile()}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </Pressable>
          </View>
        )}
      </PublicAppChrome>
    );
  }

  return (
    <PublicAppChrome>
      {({ onScroll, scrollEventThrottle, contentPaddingStyle }) => (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.container, contentPaddingStyle]}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
        >
          <View style={styles.heroWrap}>
            <Image
              source={{ uri: heroUri || PLAYA_PLACEHOLDER }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => {
                setHeroFailed(true);
                setHeroUri(PLAYA_PLACEHOLDER);
              }}
            />
            {showNoImageOverlay ? (
              <View style={styles.noImageOverlay}>
                <Text style={styles.noImageText}>{tPlayas('playa.noImageTitle', lang)}</Text>
                <Text style={styles.noImageText}>{tPlayas('playa.noImageSubtitle', lang)}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.weatherSection}>
            <View style={styles.weatherColTemp}>
              <View style={styles.weatherTempRow}>
                <FontAwesome name="thermometer-half" size={32} color="#ffffff" />
                <Text style={styles.weatherTempValue}>{clima?.temperatura || '--°F'}</Text>
              </View>
              <Text style={styles.weatherRangeText}>
                {tPerfilPlaya('perfilPlaya.minLabel', lang)}: {clima?.min || '--°F'}{`\n`}
                {tPerfilPlaya('perfilPlaya.maxLabel', lang)}: {clima?.max || '--°F'}
              </Text>
            </View>

            <View style={styles.weatherColStatus}>
              {clima?.iconoUrl ? (
                clima.iconoUrl.toLowerCase().includes('.svg') ? (
                  <SvgCssUri uri={clima.iconoUrl} width={56} height={56} />
                ) : (
                  <Image source={{ uri: clima.iconoUrl }} style={styles.weatherStatusIcon} />
                )
              ) : null}
              <Text style={styles.weatherStatusText}>{clima?.estado || tPerfilPlaya('perfilPlaya.climaActualizando', lang)}</Text>
            </View>

            <View style={styles.weatherColMeta}>
              <View style={styles.weatherMetaRow}>
                <FontAwesome6 name="wind" size={20} color="#ffffff" />
                <Text style={styles.weatherMetaText}>{clima?.viento || '-- mph'}</Text>
              </View>
              <View style={styles.weatherMetaRow}>
                <FontAwesome name="tint" size={20} color="#ffffff" />
                <Text style={styles.weatherMetaText}>{clima?.humedad || '--%'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.mainInfoWrap}>
            <Text style={styles.nameText}>{item.nombre || tPerfilPlaya('perfilPlaya.cargandoInfo', lang)}</Text>
            <Text style={styles.municipioText}>{formatMunicipioCosta(item, lang)}</Text>

            <Text style={styles.aptaTitle}>{tPerfilPlaya('perfilPlaya.aptaPara', lang)}</Text>
            <View style={styles.aptitudesRow}>
              {item.nadar ? (
                <View style={styles.aptitudCol}>
                  <Text style={styles.aptitudEmoji}>🏊</Text>
                  <Text style={styles.aptitudLabel}>{tPlayas('playas.nadar', lang)}</Text>
                </View>
              ) : null}
              {item.surfear ? (
                <View style={styles.aptitudCol}>
                  <Text style={styles.aptitudEmoji}>🏄</Text>
                  <Text style={styles.aptitudLabel}>{tPlayas('playas.surfear', lang)}</Text>
                </View>
              ) : null}
              {item.snorkeling || item.snorkel ? (
                <View style={styles.aptitudCol}>
                  <Text style={styles.aptitudEmoji}>🤿</Text>
                  <Text style={styles.aptitudLabel}>{tPlayas('playas.snorkel', lang)}</Text>
                </View>
              ) : null}
              {!item.nadar && !item.surfear && !item.snorkeling && !item.snorkel ? (
                <Text style={styles.noAptitudesText}>{tPerfilPlaya('perfilPlaya.sinAptitudes', lang)}</Text>
              ) : null}
            </View>

            <View style={styles.metaLine}>
              <FontAwesome name="map-pin" size={16} color="#3ea6c4" />
              <Text style={styles.metaBlueText}>{item.direccion || tPerfilPlaya('perfilPlaya.direccionNoDisponible', lang)}</Text>
            </View>

            <View style={styles.metaLine}>
              <FontAwesome name="car" size={16} color="#9c9c9c" />
              <Text style={styles.metaGrayText}>{travelText}</Text>
            </View>

            <View style={styles.mapsRow}>
              <Pressable
                style={[styles.mapButton, !mapsUrl ? styles.mapButtonDisabled : null]}
                disabled={!mapsUrl}
                onPress={() => {
                  if (!mapsUrl) return;
                  void Linking.openURL(mapsUrl);
                }}
              >
                <Image source={{ uri: `${STORAGE_BASE}/google map.jpg` }} style={styles.mapImage} resizeMode="contain" />
              </Pressable>
              <Pressable
                style={[styles.mapButton, !wazeUrl ? styles.mapButtonDisabled : null]}
                disabled={!wazeUrl}
                onPress={() => {
                  if (!wazeUrl) return;
                  void Linking.openURL(wazeUrl);
                }}
              >
                <Image source={{ uri: `${STORAGE_BASE}/waze.jpg` }} style={styles.mapImage} resizeMode="contain" />
              </Pressable>
            </View>

            <Pressable style={styles.favoriteBtn} onPress={() => void handleToggleFavorite()}>
              <FontAwesome name={isFavorite ? 'heart' : 'heart-o'} size={22} color={isFavorite ? '#ef4444' : '#555'} />
              <Text style={[styles.favoriteBtnText, isFavorite ? styles.favoriteBtnTextActive : null]}>
                {isFavorite ? tPerfilPlaya('perfilPlaya.enFavoritos', lang) : tPerfilPlaya('perfilPlaya.btnFavorito', lang)}
              </Text>
            </Pressable>

            <View style={[styles.cardSection, shadows.card]}>
              <Text style={styles.cardSectionTitle}>{tPerfilPlaya('perfilPlaya.descripcion', lang)}</Text>
              <Text style={styles.cardBodyText}>{descripcionText || tPerfilPlaya('playa.descripcionNoDisponible', lang)}</Text>
            </View>

            <View style={[styles.cardSection, shadows.card]}>
              <Text style={styles.cardSectionTitle}>{tPerfilPlaya('perfilPlaya.acceso', lang)}</Text>
              <Text style={styles.cardBodyText}>{accesoText || tPerfilPlaya('playa.accesoNoDisponible', lang)}</Text>
            </View>
          </View>

          <View style={styles.nearbySection}>
            <Text style={styles.nearbyTitle}>{tPerfilPlaya('perfilPlaya.cercanosComida', lang, { nombre: item.nombre })}</Text>
            {loadingCercanos ? (
              <View style={styles.nearbyLoadingWrap}>
                <ActivityIndicator size="small" color="#3ea6c4" />
              </View>
            ) : cercanosComida.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyHorizontalList}>
                {cercanosComida.map((card) => (
                  <View key={`near-food-${card.id}`} style={styles.nearbyFoodCardShadow}>
                    <Pressable
                      style={styles.nearbyFoodCard}
                      onPress={() => router.push({ pathname: '/comercio/[id]', params: { id: String(card.id) } })}
                    >
                      <View style={styles.nearbyFoodHeader}>
                        <Image source={{ uri: card.portadaUrl }} style={styles.nearbyFoodCover} resizeMode="cover" />
                        <View style={styles.nearbyFoodLogoWrap}>
                          <Image source={{ uri: card.logoUrl }} style={styles.nearbyFoodLogo} resizeMode="cover" />
                        </View>
                      </View>
                      <View style={styles.nearbyFoodInfo}>
                        <Text
                          style={[
                            styles.nearbyFoodName,
                            card.nombre.length > NEARBY_COMERCIO_NAME_LONG_THRESHOLD ? styles.nearbyFoodNameSmall : null,
                          ]}
                          numberOfLines={2}
                        >
                          {card.nombre}
                        </Text>
                        <Text style={styles.nearbyFoodCategory} numberOfLines={1}>
                          {card.categoriaLabel}
                        </Text>
                        {card.telefono ? (
                          <Pressable
                            style={({ pressed }) => [styles.nearbyFoodPhonePill, pressed ? styles.nearbyFoodPhonePillPressed : null]}
                            onPress={(event) => {
                              event.stopPropagation();
                              const href = formatearTelefonoHref(card.telefono);
                              if (!href) return;
                              void Linking.openURL(href);
                            }}
                          >
                            <FontAwesome name="phone" size={10} color="#ffffff" />
                            <Text style={styles.nearbyFoodPhoneText} numberOfLines={1}>
                              {formatearTelefonoDisplay(card.telefono)}
                            </Text>
                          </Pressable>
                        ) : null}
                        <View style={styles.nearbyMetaLine}>
                          <FontAwesome name="map-pin" size={11} color="#3ea6c4" />
                          <Text style={[styles.nearbyMetaText, styles.nearbyFoodMunicipioText]}>{card.municipio}</Text>
                        </View>
                        <View style={styles.nearbyMetaLine}>
                          <FontAwesome name="car" size={11} color="#ef4444" />
                          <Text style={[styles.nearbyMetaText, styles.nearbyFoodTimeText]}>{renderTravelText(card.minutos)}</Text>
                        </View>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <View style={styles.nearbySection}>
            <Text style={styles.nearbyTitle}>{tPerfilPlaya('perfilPlaya.cercanosLugares', lang, { nombre: item.nombre })}</Text>
            {loadingCercanos ? (
              <View style={styles.nearbyLoadingWrap}>
                <ActivityIndicator size="small" color="#3ea6c4" />
              </View>
            ) : cercanosLugares.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyHorizontalListLarge}>
                {cercanosLugares.map((card) => (
                  <View key={`near-place-${card.id}`} style={styles.nearbyPlaceCardShadow}>
                    <Pressable
                      style={styles.nearbyPlaceCard}
                      onPress={() => {
                        void Linking.openURL(`${DEFAULT_APP_BASE_URLS.public}/perfilLugar.html?id=${card.id}`);
                      }}
                    >
                      <Image source={{ uri: card.imagenUrl }} style={styles.nearbyPlaceImage} resizeMode="cover" />
                      <View style={styles.nearbyPlaceInfo}>
                        <Text style={styles.nearbyPlaceName} numberOfLines={1}>
                          {card.nombre}
                        </Text>
                        <View style={styles.nearbyPlaceMetaRow}>
                          <View style={styles.nearbyMetaLine}>
                            <FontAwesome name="map-pin" size={13} color="#3ea6c4" />
                            <Text style={[styles.nearbyPlaceMetaText, styles.nearbyPlaceMunicipioText]}>{card.municipio}</Text>
                          </View>
                          <View style={styles.nearbyMetaLine}>
                            <FontAwesome name="car" size={13} color="#9ca3af" />
                            <Text style={[styles.nearbyPlaceMetaText, styles.nearbyPlaceTimeText]}>{renderTravelText(card.minutos)}</Text>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <View style={styles.nearbySection}>
            <Text style={styles.nearbyTitle}>{tPerfilPlaya('perfilPlaya.playas45', lang, { nombre: item.nombre })}</Text>
            {loadingCercanos ? (
              <View style={styles.nearbyLoadingWrap}>
                <ActivityIndicator size="small" color="#3ea6c4" />
              </View>
            ) : cercanosPlayas.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyHorizontalList}>
                {cercanosPlayas.map((card) => (
                  <View key={`near-beach-${card.id}`} style={styles.nearbyBeachCardShadow}>
                    <Pressable
                      style={styles.nearbyBeachCard}
                      onPress={() => router.push({ pathname: '/playa/[id]', params: { id: String(card.id) } })}
                    >
                      <Image source={{ uri: card.imagenUrl }} style={styles.nearbyBeachImage} resizeMode="cover" />
                      <View style={styles.nearbyBeachInfo}>
                        <Text style={styles.nearbyBeachName} numberOfLines={2}>
                          {card.nombre}
                        </Text>
                        {card.clima?.estado ? (
                          <View style={styles.nearbyBeachWeatherLine}>
                            {card.clima.iconoUrl ?
                              card.clima.iconoUrl.toLowerCase().includes('.svg') ? (
                                <SvgCssUri uri={card.clima.iconoUrl} width={16} height={16} />
                              ) : (
                                <Image source={{ uri: card.clima.iconoUrl }} style={styles.nearbyBeachWeatherIcon} />
                              ) : null}
                            <Text style={styles.nearbyBeachWeatherText} numberOfLines={1}>
                              {card.clima.estado}
                            </Text>
                          </View>
                        ) : null}
                        <View style={[styles.nearbyMetaLine, styles.nearbyBeachMunicipioRow]}>
                          <FontAwesome name="map-pin" size={11} color="#3ea6c4" />
                          <Text style={[styles.nearbyMetaText, styles.nearbyBeachMunicipioText]}>{card.municipio}</Text>
                        </View>
                        <View style={[styles.nearbyMetaLine, styles.nearbyBeachTimeRow]}>
                          <FontAwesome name="car" size={11} color="#ef4444" style={styles.nearbyBeachTimeIcon} />
                          <Text style={[styles.nearbyMetaText, styles.nearbyBeachTimeText]}>{renderTravelText(card.minutos)}</Text>
                        </View>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </ScrollView>
      )}
    </PublicAppChrome>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    paddingBottom: spacing.xxl,
    backgroundColor: '#ffffff',
  },
  stateWrap: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  stateText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
  },
  stateErrorText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    marginHorizontal: spacing.lg,
  },
  retryButton: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: '#023047',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    color: '#fff',
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  heroWrap: {
    width: '100%',
    height: 288,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  noImageOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  noImageText: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 30,
    fontFamily: fonts.semibold,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  weatherSection: {
    backgroundColor: '#424242',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weatherColTemp: {
    width: '35%',
    alignItems: 'center',
  },
  weatherTempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherTempValue: {
    color: '#fff',
    fontFamily: fonts.light,
    fontSize: 44,
    lineHeight: 46,
  },
  weatherRangeText: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 16,
  },
  weatherColStatus: {
    width: '30%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherStatusIcon: {
    width: 56,
    height: 56,
  },
  weatherStatusText: {
    marginTop: 4,
    color: '#fff',
    fontFamily: fonts.semibold,
    fontSize: 13,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  weatherColMeta: {
    width: '30%',
    alignItems: 'center',
    gap: 8,
  },
  weatherMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weatherMetaText: {
    color: '#fff',
    fontFamily: fonts.medium,
    fontSize: 18,
    lineHeight: 21,
  },
  mainInfoWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  nameText: {
    fontFamily: fonts.bold,
    fontSize: 33,
    lineHeight: 38,
    color: '#111827',
    textAlign: 'center',
  },
  municipioText: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  aptaTitle: {
    marginTop: spacing.md,
    fontFamily: fonts.semibold,
    fontSize: 20,
    color: '#424242',
    textAlign: 'center',
  },
  aptitudesRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.lg,
    minHeight: 70,
  },
  aptitudCol: {
    alignItems: 'center',
  },
  aptitudEmoji: {
    fontSize: 44,
    lineHeight: 46,
  },
  aptitudLabel: {
    marginTop: 4,
    color: '#9c9c9c',
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  noAptitudesText: {
    color: '#9c9c9c',
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  metaLine: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaBlueText: {
    color: '#3ea6c4',
    fontFamily: fonts.medium,
    fontSize: 20,
    textAlign: 'center',
  },
  metaGrayText: {
    color: '#9c9c9c',
    fontFamily: fonts.medium,
    fontSize: 20,
    textAlign: 'center',
  },
  mapsRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  mapButton: {
    width: 132,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 9,
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mapButtonDisabled: {
    opacity: 0.4,
  },
  mapImage: {
    width: '101%',
    height: '103%',
    borderRadius: 999,
  },
  favoriteBtn: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  favoriteBtnText: {
    fontFamily: fonts.medium,
    fontSize: 20,
    color: '#555',
  },
  favoriteBtnTextActive: {
    color: '#ef4444',
  },
  cardSection: {
    marginTop: spacing.lg,
    width: '100%',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: spacing.lg,
  },
  cardSectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 19,
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  cardBodyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: '#374151',
    textAlign: 'left',
  },
  nearbySection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  nearbyTitle: {
    fontFamily: fonts.medium,
    fontSize: 19,
    color: '#374151',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  nearbyLoadingWrap: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyHorizontalList: {
    paddingVertical: 6,
    paddingRight: spacing.md,
    paddingLeft: 2,
    gap: spacing.sm,
  },
  nearbyHorizontalListLarge: {
    paddingVertical: 6,
    paddingRight: spacing.md,
    paddingLeft: 2,
    gap: spacing.md,
  },
  nearbyFoodCard: {
    width: 160,
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  nearbyFoodCardShadow: {
    width: 160,
    borderRadius: 12,
    backgroundColor: 'transparent',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 5,
    elevation: 3,
    marginVertical: 1,
  },
  nearbyFoodHeader: {
    width: '100%',
    height: 96,
    position: 'relative',
    backgroundColor: '#e5e7eb',
  },
  nearbyFoodCover: {
    width: '100%',
    height: '100%',
  },
  nearbyFoodLogoWrap: {
    position: 'absolute',
    left: '50%',
    bottom: -24,
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -17 },
    shadowOpacity: 0.5,
    shadowRadius: 11,
    elevation: 6,
  },
  nearbyFoodLogo: {
    width: '100%',
    height: '100%',
  },
  nearbyFoodInfo: {
    paddingTop: 32,
    paddingHorizontal: 8,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 0,
  },
  nearbyFoodName: {
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#111827',
    lineHeight: 13,
  },
  nearbyFoodNameSmall: {
    fontSize: 11,
    lineHeight: 12,
  },
  nearbyFoodCategory: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#6b7280',
    marginTop: -2,
  },
  nearbyFoodPhonePill: {
    marginTop: 4,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  nearbyFoodPhonePillPressed: {
    opacity: 0.88,
  },
  nearbyMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 2,
  },
  nearbyMetaText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#4b5563',
  },
  nearbyFoodMunicipioText: {
    color: '#0284c7',
  },
  nearbyFoodPhoneText: {
    color: '#ffffff',
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  nearbyFoodTimeText: {
    color: '#4b5563',
  },
  nearbyPlaceCard: {
    width: 320,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  nearbyPlaceCardShadow: {
    width: 320,
    borderRadius: 12,
    backgroundColor: 'transparent',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 5,
    elevation: 3,
    marginVertical: 1,
  },
  nearbyPlaceImage: {
    width: '100%',
    height: 168,
    backgroundColor: '#e5e7eb',
  },
  nearbyPlaceInfo: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  nearbyPlaceName: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: '#1f2937',
    textAlign: 'center',
  },
  nearbyPlaceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  nearbyPlaceMetaText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#6b7280',
  },
  nearbyPlaceMunicipioText: {
    color: '#3ea6c4',
  },
  nearbyPlaceTimeText: {
    color: '#9ca3af',
  },
  nearbyBeachCard: {
    width: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  nearbyBeachCardShadow: {
    width: 160,
    borderRadius: 12,
    backgroundColor: 'transparent',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 5,
    elevation: 3,
    marginVertical: 1,
  },
  nearbyBeachImage: {
    width: '100%',
    height: 96,
    backgroundColor: '#e5e7eb',
  },
  nearbyBeachInfo: {
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 2,
  },
  nearbyBeachName: {
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: '#111827',
    minHeight: 36,
    lineHeight: 16,
  },
  nearbyBeachWeatherLine: {
    marginTop: 2,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  nearbyBeachWeatherIcon: {
    width: 16,
    height: 16,
  },
  nearbyBeachWeatherText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#4b5563',
  },
  nearbyBeachMunicipioRow: {
    marginTop: 4,
  },
  nearbyBeachMunicipioText: {
    color: '#4b5563',
  },
  nearbyBeachTimeRow: {
    alignItems: 'flex-start',
  },
  nearbyBeachTimeIcon: {
    marginTop: 2,
  },
  nearbyBeachTimeText: {
    color: '#4b5563',
  },
});
