import {
  calcularDistanciaHaversineKm,
  calcularTiempoEnVehiculo,
  DEFAULT_APP_BASE_URLS,
  formatearHorario,
  formatearMonedaUSD,
  formatearTelefonoDisplay,
  formatearTelefonoHref,
  obtenerMensajeHorario,
  pickRandomItems,
  resolverPlanComercio,
} from '@findixi/shared';
import { FontAwesome, FontAwesome5, FontAwesome6, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SvgCssUri } from 'react-native-svg/css';

import { PublicAppChrome } from '../../src/components/layout/PublicAppChrome';
import { ScreenState } from '../../src/components/ScreenState';
import {
  fetchComercioAmenidades,
  fetchComercioById,
  fetchComercioDescripcionTraducida,
  fetchComercioEspecialesDia,
  fetchComercioGaleriaUrls,
  fetchComercioHorarios,
  fetchComercioLogoUrl,
  fetchComercioMenuTargetId,
  fetchComercioSucursales,
  type ComercioAmenidad,
  type ComercioEspecialesDia,
  type ComercioHorario,
  type ComercioSucursal,
} from '../../src/features/comercios/api';
import type { ComercioRow } from '../../src/features/comercios/types';
import { useI18n } from '../../src/i18n/provider';
import { requestUserLocation, type UserLocation } from '../../src/lib/location';
import { getDrivingDistance } from '../../src/lib/osrm';
import { supabase } from '../../src/lib/supabase';
import { borderRadius, fonts, shadows, spacing } from '../../src/theme/tokens';

const STORAGE_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/';
const DEFAULT_PORTADA = `${STORAGE_BASE}NoActivoPortada.jpg`;
const DEFAULT_LOGO = `${STORAGE_BASE}NoActivoLogo.png`;
const SOCIAL_ICON_BASE = `${STORAGE_BASE}`;
const OPEN_WEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || '2c1d54239e886b97ed52ac446c3ae948';
const WEATHER_ICON_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/';

const DAY_LABELS_ES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'] as const;

function parseId(value: string | string[] | undefined): number {
  if (Array.isArray(value)) return Number(value[0] ?? 0);
  return Number(value ?? 0);
}

function toStorageUrl(pathOrUrl: string | null | undefined, fallback: string): string {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${STORAGE_BASE}${raw.replace(/^public\//i, '').replace(/^\/+/, '')}`;
}

function normalizeUrl(url: string | null | undefined, prefix = ''): string | null {
  const raw = String(url ?? '').trim();
  if (!raw) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw)) return raw;
  if (!prefix) return `https://${raw}`;
  return `${prefix}${raw}`;
}

type AmenidadIconStyle = 'solid' | 'regular' | 'brands';
type AmenidadIconResolved = {
  preferFamily: 'fa6' | 'fa5';
  name: string;
  iconStyle?: AmenidadIconStyle;
};

function amenidadIconName(iconClass: string | null | undefined, amenidadNombre?: string | null): AmenidadIconResolved {
  const raw = String(iconClass ?? '');
  const nombre = String(amenidadNombre ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/\bbarra\b/.test(nombre)) {
    return {
      preferFamily: 'fa6',
      name: 'martini-glass-citrus',
      iconStyle: 'solid',
    };
  }

  const matches = [...raw.matchAll(/fa-([a-z0-9-]+)/gi)].map((entry) => String(entry[1] ?? '').toLowerCase());
  const ignore = new Set(['solid', 'regular', 'brands', 'light', 'thin', 'duotone']);
  const icon = matches.find((value) => value && !ignore.has(value)) || '';
  const iconStyle: AmenidadIconStyle = /\bfa-regular\b|\bfar\b/i.test(raw)
    ? 'regular'
    : /\bfa-brands\b|\bfab\b/i.test(raw)
      ? 'brands'
      : 'solid';

  const normalizeMap: Record<string, string> = {
    'circle-check': 'check-circle',
    'circle-xmark': 'times-circle',
    'square-parking': 'parking',
    'location-dot': 'map-marker-alt',
    'utensils': 'utensils',
    'martini-glass': 'glass-martini',
    'martini-glass-citrus': 'cocktail',
    'person-swimming': 'swimmer',
    'water-ladder': 'swimmer',
    'house': 'home',
    'house-chimney': 'home',
    'bell-concierge': 'concierge-bell',
    'handshake-angle': 'hands-helping',
    'person': 'user',
    'xmark': 'times',
    'location-pin': 'map-marker-alt',
  };

  if (!icon) return { preferFamily: 'fa5', name: 'check-circle' };

  const normalized = normalizeMap[icon] || icon;
  const usesFa6StyleClass = /\bfa-solid\b|\bfa-regular\b|\bfa-brands\b/i.test(raw);
  return {
    preferFamily: usesFa6StyleClass ? 'fa6' : 'fa5',
    name: normalized,
    iconStyle,
  };
}

function renderTravelText(minutes: number | null): string {
  if (!Number.isFinite(minutes)) return 'No disponible';
  const min = Math.max(0, Math.round(Number(minutes)));
  if (min < 60) return `a ${min} minuto${min === 1 ? '' : 's'}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `a ${h} h ${m} min`;
}

function formatPrice(value: number | null): string {
  return formatearMonedaUSD(value, { fallback: 'Gratis' });
}

type CuponCard = {
  id: number;
  titulo: string;
  descripcion: string;
  imagenUrl: string;
  descuento: number | null;
  cantidadDisponible: number;
  usados: number;
  fechaFinRaw: string | null;
  guardado: { redimido: boolean; codigoqr: string | null } | null;
};

type UsuarioPerfil = {
  membresiaUp: boolean;
  telefono: string | null;
};

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
  clima: {
    estado: string;
    iconoUrl: string | null;
  } | null;
};

type NearbyPlayaBase = Omit<NearbyPlayaCard, 'clima'>;

const COMIDA_CATEGORIAS_VALIDAS = new Set([1, 2, 5, 7]);
const CATEGORIA_LABEL_BY_ID: Record<number, string> = {
  1: 'Restaurantes',
  2: 'Coffee Shops',
  5: 'Food Trucks',
  7: 'Panaderias',
  11: 'Jangueo',
};
const NEARBY_COMERCIO_NAME_LONG_THRESHOLD = 24;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function crearCodigoQr(): string {
  const maybeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return maybeCrypto.randomUUID();
  }
  return `qr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatFechaLegible(fechaRaw: string | null): string {
  if (!fechaRaw) return '--';
  const date = new Date(fechaRaw);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('es-PR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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

function resolveWeatherIconUrl(iconCode: string | null | undefined): string | null {
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

async function fetchBeachWeather(lat: number, lon: number, lang: string) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !OPEN_WEATHER_API_KEY) return null;

  try {
    const url =
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}` +
      `&units=imperial&lang=${resolveWeatherLang(lang)}&appid=${OPEN_WEATHER_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      weather?: Array<{ description?: string; icon?: string }>;
    };
    const estado = String(payload.weather?.[0]?.description ?? '').trim();
    const iconCode = String(payload.weather?.[0]?.icon ?? '').trim();

    return {
      estado: estado || 'Clima no disponible',
      iconoUrl: resolveWeatherIconUrl(iconCode),
    };
  } catch {
    return null;
  }
}

export default function ComercioDetailScreen() {
  const { lang } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseId(params.id);

  const [item, setItem] = useState<ComercioRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_LOGO);
  const [horarios, setHorarios] = useState<ComercioHorario[]>([]);
  const [amenidades, setAmenidades] = useState<ComercioAmenidad[]>([]);
  const [especialesDia, setEspecialesDia] = useState<ComercioEspecialesDia>({ almuerzo: [], happyhour: [] });
  const [tabEspecial, setTabEspecial] = useState<'almuerzo' | 'happyhour'>('almuerzo');
  const [sucursales, setSucursales] = useState<ComercioSucursal[]>([]);
  const [menuTargetId, setMenuTargetId] = useState<number | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [travelText, setTravelText] = useState('Cargando distancia...');
  const [blockedByPlan, setBlockedByPlan] = useState(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [cupones, setCupones] = useState<CuponCard[]>([]);
  const [savingCuponId, setSavingCuponId] = useState<number | null>(null);
  const [usuarioPerfil, setUsuarioPerfil] = useState<UsuarioPerfil | null>(null);
  const [cercanosComida, setCercanosComida] = useState<NearbyComercioCard[]>([]);
  const [cercanosLugares, setCercanosLugares] = useState<NearbyLugarCard[]>([]);
  const [cercanosPlayas, setCercanosPlayas] = useState<NearbyPlayaCard[]>([]);
  const [loadingCercanos, setLoadingCercanos] = useState(false);
  const clockSpin = useRef(new Animated.Value(0)).current;
  const clockShouldSpinRef = useRef(false);
  const clockAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const plan = useMemo(() => resolverPlanComercio(item || {}), [item]);
  const esJangueo = useMemo(
    () => Boolean(item?.ComercioCategorias?.some((entry) => Number(entry.idCategoria) === 11)),
    [item]
  );

  const heroImage = galleryImages[galleryIndex] || toStorageUrl(item?.portada, DEFAULT_PORTADA);
  const statusHorario = useMemo(
    () =>
      obtenerMensajeHorario({
        horarios,
        now: new Date(nowTick),
        diasSemana: [...DAY_LABELS_ES],
        labels: {
          abiertoAhora: 'Abierto Ahora',
          cerradoAhora: 'Cerrado Ahora',
          horarioNoDisponible: 'Horario no disponible',
          abreHoy: 'Abre hoy a {hora}',
          abreDia: 'Abre {dia} a {hora}',
          manana: 'manana',
          cierraALas: 'Cierra a las {hora}',
        },
      }),
    [horarios, nowTick]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    void requestUserLocation()
      .then((coords) => {
        if (!mounted) return;
        setLocation(coords);
      })
      .catch(() => {
        if (!mounted) return;
        setLocation(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const loadFavorite = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setIsFavorite(false);
        return;
      }

      const { data, error: favError } = await supabase
        .from('favoritosusuarios')
        .select('id')
        .eq('idusuario', user.id)
        .eq('idcomercio', id)
        .maybeSingle();
      if (favError) throw favError;
      setIsFavorite(Boolean(data));
    } catch {
      setIsFavorite(false);
    }
  }, [id]);

  useEffect(() => {
    void loadFavorite();
  }, [loadFavorite]);

  const toggleFavorite = useCallback(async () => {
    if (favoriteBusy || !Number.isFinite(id) || id <= 0) return;
    setFavoriteBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        Alert.alert(
          'Inicia sesion',
          'Debes iniciar sesion para gestionar tus favoritos.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Ir a login',
              onPress: () => {
                void Linking.openURL(`${DEFAULT_APP_BASE_URLS.public}/logearse.html`);
              },
            },
          ]
        );
        setFavoriteBusy(false);
        return;
      }

      if (isFavorite) {
        const { error: deleteError } = await supabase
          .from('favoritosusuarios')
          .delete()
          .eq('idusuario', user.id)
          .eq('idcomercio', id);
        if (deleteError) throw deleteError;
        setIsFavorite(false);
      } else {
        const { error: insertError } = await supabase.from('favoritosusuarios').insert({
          idusuario: user.id,
          idcomercio: id,
        });
        if (insertError) throw insertError;
        setIsFavorite(true);
      }
    } catch (toggleError) {
      console.warn('[mobile-public] No se pudo actualizar favorito:', toggleError);
    } finally {
      setFavoriteBusy(false);
    }
  }, [favoriteBusy, id, isFavorite]);

  useEffect(() => {
    if (!galleryImages.length || modalVisible) return;
    const timer = setInterval(() => {
      setGalleryIndex((prev) => (prev + 1) % galleryImages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [galleryImages, modalVisible]);

  const stopClockSpin = useCallback(() => {
    clockShouldSpinRef.current = false;
    if (clockAnimRef.current) {
      clockAnimRef.current.stop();
      clockAnimRef.current = null;
    }
    clockSpin.stopAnimation();
    clockSpin.setValue(0);
  }, [clockSpin]);

  const startClockSpin = useCallback(() => {
    if (clockShouldSpinRef.current) return;
    clockShouldSpinRef.current = true;

    const spinOnce = () => {
      if (!clockShouldSpinRef.current) return;
      clockSpin.setValue(0);
      const anim = Animated.timing(clockSpin, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      });
      clockAnimRef.current = anim;
      anim.start(({ finished }) => {
        if (finished && clockShouldSpinRef.current) {
          spinOnce();
        }
      });
    };

    spinOnce();
  }, [clockSpin]);

  useEffect(() => {
    if (statusHorario.abierto) {
      startClockSpin();
    } else {
      stopClockSpin();
    }

    return () => {
      stopClockSpin();
    };
  }, [startClockSpin, statusHorario.abierto, stopClockSpin]);

  useEffect(() => {
    if (!item || !location || item.latitud == null || item.longitud == null) {
      setTravelText('No disponible');
      return;
    }

    const fallbackKm = calcularDistanciaHaversineKm(
      location.latitude,
      location.longitude,
      Number(item.latitud),
      Number(item.longitud)
    );
    const fallback = calcularTiempoEnVehiculo(fallbackKm);
    setTravelText(renderTravelText(Number.isFinite(fallback.minutos) ? fallback.minutos : null));

    let mounted = true;
    void getDrivingDistance(
      { lat: location.latitude, lng: location.longitude },
      { lat: Number(item.latitud), lng: Number(item.longitud) }
    )
      .then((osrm) => {
        if (!mounted || !osrm) return;
        setTravelText(renderTravelText(osrm.duracion / 60));
      })
      .catch(() => {
        // fallback already set
      });

    return () => {
      mounted = false;
    };
  }, [item, location]);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) {
      setError('ID de comercio invalido');
      setLoading(false);
      return;
    }

    let active = true;

    const run = async () => {
      setLoading(true);
      setError('');
      setBlockedByPlan(false);
      setDescExpanded(false);

      try {
        const comercio = await fetchComercioById(id);
        if (!active) return;
        if (!comercio) {
          setItem(null);
          setError('Comercio no encontrado');
          setLoading(false);
          return;
        }

        const planInfo = resolverPlanComercio(comercio);
        setItem(comercio);
        setDescripcion(String(comercio.descripcion ?? '').trim());

        if (!planInfo.permite_perfil) {
          setBlockedByPlan(true);
          setLoading(false);
          return;
        }

        const now = new Date();
        const diaSemana = now.getDay();

        const [
          galeriaRes,
          logoRes,
          horariosRes,
          amenidadesRes,
          especialesRes,
          sucursalesRes,
          menuTargetRes,
          descripcionTraducidaRes,
        ] = await Promise.allSettled([
          fetchComercioGaleriaUrls(id),
          fetchComercioLogoUrl(id),
          fetchComercioHorarios(id),
          fetchComercioAmenidades(id),
          fetchComercioEspecialesDia(id, diaSemana),
          fetchComercioSucursales(id),
          fetchComercioMenuTargetId(id),
          fetchComercioDescripcionTraducida(id, lang),
        ]);

        if (!active) return;

        if (galeriaRes.status === 'fulfilled') {
          const urls = galeriaRes.value.length ? galeriaRes.value : [toStorageUrl(comercio.portada, DEFAULT_PORTADA)];
          setGalleryImages(urls);
          setGalleryIndex(0);
        } else {
          setGalleryImages([toStorageUrl(comercio.portada, DEFAULT_PORTADA)]);
          setGalleryIndex(0);
        }

        if (logoRes.status === 'fulfilled') {
          setLogoUrl(logoRes.value || toStorageUrl(comercio.logo, DEFAULT_LOGO));
        } else {
          setLogoUrl(toStorageUrl(comercio.logo, DEFAULT_LOGO));
        }

        if (horariosRes.status === 'fulfilled') {
          setHorarios(horariosRes.value);
        } else {
          setHorarios([]);
        }

        if (amenidadesRes.status === 'fulfilled') {
          setAmenidades(amenidadesRes.value);
        } else {
          setAmenidades([]);
        }

        if (especialesRes.status === 'fulfilled') {
          setEspecialesDia(especialesRes.value);
          setTabEspecial(especialesRes.value.almuerzo.length > 0 ? 'almuerzo' : 'happyhour');
        } else {
          setEspecialesDia({ almuerzo: [], happyhour: [] });
        }

        if (sucursalesRes.status === 'fulfilled') {
          setSucursales(sucursalesRes.value);
        } else {
          setSucursales([]);
        }

        if (menuTargetRes.status === 'fulfilled') {
          setMenuTargetId(menuTargetRes.value);
        } else {
          setMenuTargetId(null);
        }

        if (descripcionTraducidaRes.status === 'fulfilled') {
          const traducida = descripcionTraducidaRes.value;
          setDescripcion(String(traducida ?? comercio.descripcion ?? '').trim());
        } else {
          setDescripcion(String(comercio.descripcion ?? '').trim());
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el comercio');
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [id, lang]);

  const mapsUrl = useMemo(() => {
    if (!item || item.latitud == null || item.longitud == null) return null;
    return `https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`;
  }, [item]);

  const wazeUrl = useMemo(() => {
    if (!item || item.latitud == null || item.longitud == null) return null;
    return `https://waze.com/ul?ll=${item.latitud},${item.longitud}&navigate=yes`;
  }, [item]);

  const phoneHref = useMemo(() => formatearTelefonoHref(item?.telefono ?? ''), [item?.telefono]);
  const phoneDisplay = useMemo(() => formatearTelefonoDisplay(item?.telefono ?? ''), [item?.telefono]);
  const specialsVisible = especialesDia.almuerzo.length > 0 || especialesDia.happyhour.length > 0;
  const activeSpecialList = tabEspecial === 'almuerzo' ? especialesDia.almuerzo : especialesDia.happyhour;
  const clockColor = statusHorario.abierto ? '#22c55e' : '#ef4444';

  const socialLinks = useMemo(() => {
    if (!item) return [];
    return [
      {
        key: 'facebook',
        href: normalizeUrl(item.facebook),
        icon: 'facebook',
        image: `${SOCIAL_ICON_BASE}/logoFacebook.png`,
      },
      {
        key: 'instagram',
        href: normalizeUrl(item.instagram),
        icon: 'instagram',
        image: `${SOCIAL_ICON_BASE}/logoInsta.png`,
      },
      {
        key: 'tiktok',
        href: normalizeUrl(item.tiktok),
        icon: 'music',
        image: `${SOCIAL_ICON_BASE}/logoTikTok.png`,
      },
      {
        key: 'whatsapp',
        href: normalizeUrl(item.whatsapp, 'https://wa.me/'),
        icon: 'whatsapp',
        image: `${SOCIAL_ICON_BASE}/logoWhatsApp.png`,
      },
      {
        key: 'email',
        href: normalizeUrl(item.email, 'mailto:'),
        icon: 'envelope',
        image: `${SOCIAL_ICON_BASE}/logoEmail.png`,
      },
      {
        key: 'webpage',
        href: normalizeUrl(item.webpage),
        icon: 'globe',
        image: `${SOCIAL_ICON_BASE}/logoWeb.png`,
      },
    ].filter((entry) => Boolean(entry.href));
  }, [item]);

  const loadCupones = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) {
      setCupones([]);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let perfil: UsuarioPerfil | null = null;
      if (user?.id) {
        const { data: perfilData } = await supabase
          .from('usuarios')
          .select('membresiaUp,telefono')
          .eq('id', user.id)
          .maybeSingle();
        if (perfilData) {
          perfil = {
            membresiaUp: Boolean((perfilData as { membresiaUp?: boolean | null }).membresiaUp),
            telefono: String((perfilData as { telefono?: string | null }).telefono ?? '').trim() || null,
          };
        }
      }
      setUsuarioPerfil(perfil);

      const { data: cuponesRaw, error } = await supabase
        .from('cupones')
        .select('*')
        .eq('idComercio', id)
        .order('fechainicio', { ascending: false });

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayMs = today.getTime();

      const cuponesActivos = (Array.isArray(cuponesRaw) ? cuponesRaw : []).filter((cupon) => {
        const row = cupon as Record<string, unknown>;
        const activo = row.activo !== false;
        const fechaFinRaw = String((row.fechaFin ?? row.fechafin ?? '') as string).trim();
        if (!fechaFinRaw) return activo;
        const fechaFin = new Date(fechaFinRaw).getTime();
        if (!Number.isFinite(fechaFin)) return activo;
        return activo && fechaFin >= todayMs;
      });

      if (!cuponesActivos.length) {
        setCupones([]);
        return;
      }

      const cuponIds = cuponesActivos
        .map((row) => Number((row as { id?: number | string | null }).id))
        .filter((value) => Number.isFinite(value) && value > 0);

      const conteoPorCupon = new Map<number, number>();
      if (cuponIds.length > 0) {
        const { data: totalesData } = await supabase
          .from('cuponesUsuarios')
          .select('idCupon')
          .in('idCupon', cuponIds);

        (Array.isArray(totalesData) ? totalesData : []).forEach((row) => {
          const idCupon = Number((row as { idCupon?: number | string | null }).idCupon);
          if (!Number.isFinite(idCupon) || idCupon <= 0) return;
          conteoPorCupon.set(idCupon, (conteoPorCupon.get(idCupon) || 0) + 1);
        });
      }

      const guardadosPorCupon = new Map<number, { redimido: boolean; codigoqr: string | null }>();
      if (user?.id && cuponIds.length > 0) {
        const { data: guardadosData } = await supabase
          .from('cuponesUsuarios')
          .select('idCupon, codigoqr, redimido')
          .eq('idUsuario', user.id)
          .in('idCupon', cuponIds);

        (Array.isArray(guardadosData) ? guardadosData : []).forEach((row) => {
          const idCupon = Number((row as { idCupon?: number | string | null }).idCupon);
          if (!Number.isFinite(idCupon) || idCupon <= 0) return;
          guardadosPorCupon.set(idCupon, {
            redimido: Boolean((row as { redimido?: boolean | null }).redimido),
            codigoqr: String((row as { codigoqr?: string | null }).codigoqr ?? '').trim() || null,
          });
        });
      }

      const mapped = cuponesActivos
        .map((row) => {
          const record = row as Record<string, unknown>;
          const idCupon = Number(record.id);
          if (!Number.isFinite(idCupon) || idCupon <= 0) return null;

          const fechaFinRaw = String((record.fechaFin ?? record.fechafin ?? '') as string).trim() || null;
          const imagen = String((record.imagen ?? '') as string).trim();
          const usados = conteoPorCupon.get(idCupon) || 0;
          const cantidadDisponible = Number(record.cantidadDisponible ?? 0);

          return {
            id: idCupon,
            titulo: String((record.titulo ?? 'Cupon') as string).trim() || 'Cupon',
            descripcion: String((record.descripcion ?? '') as string).trim(),
            imagenUrl: imagen || 'https://placehold.co/600x400?text=Cupon',
            descuento: toFiniteNumber(record.descuento),
            cantidadDisponible: Number.isFinite(cantidadDisponible) ? cantidadDisponible : 0,
            usados,
            fechaFinRaw,
            guardado: guardadosPorCupon.get(idCupon) ?? null,
          } satisfies CuponCard;
        })
        .filter((value): value is CuponCard => Boolean(value));

      setCupones(mapped);
    } catch (loadError) {
      console.warn('[mobile-public] No se pudieron cargar cupones:', loadError);
      setCupones([]);
    }
  }, [id]);

  useEffect(() => {
    void loadCupones();
  }, [loadCupones]);

  const handleGuardarCupon = useCallback(
    async (cupon: CuponCard) => {
      if (savingCuponId != null) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        Alert.alert(
          'Inicia sesion',
          'Debes iniciar sesion para guardar cupones.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Ir a login',
              onPress: () => {
                void Linking.openURL(`${DEFAULT_APP_BASE_URLS.public}/logearse.html`);
              },
            },
          ]
        );
        return;
      }

      if (!usuarioPerfil?.membresiaUp) {
        Alert.alert(
          'Membresia Up requerida',
          'Para guardar este cupon necesitas Membresia Up.',
          [
            { text: 'Cerrar', style: 'cancel' },
            {
              text: 'Hazte Up',
              onPress: () => {
                void Linking.openURL(`${DEFAULT_APP_BASE_URLS.public}/upgradeUp.html`);
              },
            },
          ]
        );
        return;
      }

      setSavingCuponId(cupon.id);
      try {
        const codigoqr = crearCodigoQr();
        const telefono = String(usuarioPerfil.telefono ?? '').trim();
        const telefonoUsuario = telefono ? (telefono.startsWith('+1') ? telefono : `+1${telefono}`) : null;

        const { error: insertError } = await supabase.from('cuponesUsuarios').insert({
          idCupon: cupon.id,
          idUsuario: user.id,
          codigoqr,
          redimido: false,
          fechaGuardado: new Date().toISOString(),
          telefonoUsuario,
        });

        if (insertError) {
          if (insertError.code === '23505') {
            Alert.alert('Cupon guardado', 'Ya guardaste este cupon.');
          } else {
            throw insertError;
          }
        }

        await loadCupones();
      } catch (saveError) {
        console.warn('[mobile-public] No se pudo guardar cupon:', saveError);
        Alert.alert('Error', 'No se pudo guardar el cupon. Intenta nuevamente.');
      } finally {
        setSavingCuponId(null);
      }
    },
    [loadCupones, savingCuponId, usuarioPerfil]
  );

  useEffect(() => {
    if (!item || item.latitud == null || item.longitud == null) {
      setCercanosComida([]);
      setCercanosLugares([]);
      setCercanosPlayas([]);
      return;
    }

    let active = true;
    const origenLat = Number(item.latitud);
    const origenLon = Number(item.longitud);
    const origenId = Number(item.id);

    async function resolverMinutos(destLat: number, destLon: number): Promise<number | null> {
      if (!Number.isFinite(destLat) || !Number.isFinite(destLon)) return null;
      const fallbackKm = calcularDistanciaHaversineKm(origenLat, origenLon, destLat, destLon);
      const fallback = calcularTiempoEnVehiculo(fallbackKm);
      let minutos = Number.isFinite(fallback.minutos) ? Math.max(0, Math.round(fallback.minutos as number)) : null;

      try {
        const osrm = await getDrivingDistance(
          { lat: origenLat, lng: origenLon },
          { lat: destLat, lng: destLon }
        );
        if (osrm && Number.isFinite(osrm.duracion)) {
          minutos = Math.max(0, Math.round(osrm.duracion / 60));
        }
      } catch {
        // usa fallback
      }

      return minutos;
    }

    const run = async () => {
      setLoadingCercanos(true);
      try {
        const { data: comerciosRaw } = await supabase
          .from('Comercios')
          .select(
            'id,nombre,municipio,telefono,latitud,longitud,logo,portada,activo,plan_id,plan_nivel,plan_nombre,permite_perfil,aparece_en_cercanos,permite_menu,permite_especiales,permite_ordenes,estado_propiedad,estado_verificacion,propietario_verificado,ComercioCategorias(idCategoria)'
          )
          .eq('activo', true)
          .neq('id', origenId);

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

        const candidatosComida = pickRandomItems(comerciosBase, Math.min(comerciosBase.length, 30));
        const comidaConTiempo = await Promise.all(
          candidatosComida.map(async (record) => {
            const lat = Number(record.latitud);
            const lon = Number(record.longitud);
            const minutos = await resolverMinutos(lat, lon);
            if (!Number.isFinite(minutos)) return null;

            const categorias = Array.isArray(record.ComercioCategorias)
              ? (record.ComercioCategorias as Array<{ idCategoria?: number | null }>)
              : [];
            const firstCategoria = categorias
              .map((entry: { idCategoria?: number | null }) => Number(entry.idCategoria))
              .find((catId: number) => COMIDA_CATEGORIAS_VALIDAS.has(catId));

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

        const lugaresOrdenados = [...lugaresBase].sort((a, b) => {
          const distA = calcularDistanciaHaversineKm(origenLat, origenLon, Number(a.latitud), Number(a.longitud));
          const distB = calcularDistanciaHaversineKm(origenLat, origenLon, Number(b.latitud), Number(b.longitud));
          return distA - distB;
        });

        const lugaresConTiempo = await Promise.all(
          lugaresOrdenados.slice(0, 40).map(async (record) => {
            const idLugar = Number(record.id);
            const minutos = await resolverMinutos(Number(record.latitud), Number(record.longitud));
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
              .not('longitud', 'is', null);

            const playasBase = (Array.isArray(playasRaw) ? playasRaw : [])
              .map((row) => row as Record<string, unknown>)
              .filter((record) => Number.isFinite(toFiniteNumber(record.latitud)) && Number.isFinite(toFiniteNumber(record.longitud)));

            const playasOrdenadas = [...playasBase].sort((a, b) => {
              const distA = calcularDistanciaHaversineKm(origenLat, origenLon, Number(a.latitud), Number(a.longitud));
              const distB = calcularDistanciaHaversineKm(origenLat, origenLon, Number(b.latitud), Number(b.longitud));
              return distA - distB;
            });

            const playasConTiempo = await Promise.all<NearbyPlayaBase | null>(
              playasOrdenadas.slice(0, 40).map(async (record) => {
                const minutos = await resolverMinutos(Number(record.latitud), Number(record.longitud));
                if (!Number.isFinite(minutos)) return null;

                return {
                  id: Number(record.id),
                  nombre: String(record.nombre ?? 'Playa'),
                  municipio: String(record.municipio ?? ''),
                  latitud: Number(record.latitud),
                  longitud: Number(record.longitud),
                  imagenUrl: toStorageUrl(
                    String((record.imagen ?? '') as string).trim(),
                    'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/imgPlayaNoDisponible.jpg'
                  ),
                  minutos: Number(minutos),
                } satisfies NearbyPlayaBase;
              })
            );

            const playasBaseFiltradas = playasConTiempo
              .filter((value): value is NearbyPlayaBase => Boolean(value))
              .filter((value) => value.minutos <= 45)
              .sort((a, b) => a.minutos - b.minutos);

            playasFiltradas = await Promise.all(
              playasBaseFiltradas.map(async (playa): Promise<NearbyPlayaCard> => {
                const clima = await fetchBeachWeather(playa.latitud, playa.longitud, lang);
                return {
                  ...playa,
                  clima,
                } satisfies NearbyPlayaCard;
              })
            );
          }
        }

        if (!active) return;
        setCercanosComida(comidaFiltrada);
        setCercanosLugares(lugaresFiltrados);
        setCercanosPlayas(playasFiltradas);
      } catch (nearError) {
        if (!active) return;
        console.warn('[mobile-public] No se pudieron cargar cercanos del perfil:', nearError);
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
  }, [item, lang]);

  if (loading) {
    return (
      <PublicAppChrome>
        {({ contentPaddingStyle }) => (
          <View style={[styles.stateWrap, contentPaddingStyle]}>
            <ScreenState loading message="Cargando perfil comercio..." />
          </View>
        )}
      </PublicAppChrome>
    );
  }

  if (error) {
    return (
      <PublicAppChrome>
        {({ contentPaddingStyle }) => (
          <View style={[styles.stateWrap, contentPaddingStyle]}>
            <ScreenState message={`Error: ${error}`} />
          </View>
        )}
      </PublicAppChrome>
    );
  }

  if (!item) {
    return (
      <PublicAppChrome>
        {({ contentPaddingStyle }) => (
          <View style={[styles.stateWrap, contentPaddingStyle]}>
            <ScreenState message="Comercio no encontrado." />
          </View>
        )}
      </PublicAppChrome>
    );
  }

  if (blockedByPlan) {
    return (
      <PublicAppChrome>
        {({ contentPaddingStyle }) => (
          <View style={[styles.stateWrap, contentPaddingStyle]}>
            <View style={[styles.blockedCard, shadows.card]}>
              <Text style={styles.blockedTitle}>Perfil en construccion</Text>
              <Text style={styles.blockedText}>
                Este comercio aun esta en plan Basic. Muy pronto podras ver su perfil completo.
              </Text>
              <Pressable style={styles.blockedButton} onPress={() => router.push('/comercios')}>
                <Text style={styles.blockedButtonText}>Volver al listado</Text>
              </Pressable>
            </View>
          </View>
        )}
      </PublicAppChrome>
    );
  }

  return (
    <PublicAppChrome>
      {({ onScroll, scrollEventThrottle, contentPaddingStyle }) => (
        <View style={styles.screen}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.container, contentPaddingStyle]}
            onScroll={onScroll}
            scrollEventThrottle={scrollEventThrottle}
          >
            <View style={styles.galleryWrap}>
              <Pressable
                style={styles.galleryImageWrap}
                onPress={() => {
                  setModalIndex(galleryIndex);
                  setModalVisible(true);
                }}
              >
                <Image source={{ uri: heroImage }} style={styles.galleryImage} resizeMode="cover" />
              </Pressable>
              {galleryImages.length > 1 ? (
                <View style={styles.galleryDots}>
                  {galleryImages.map((_, index) => (
                    <View key={`dot-${index}`} style={[styles.galleryDot, index === galleryIndex ? styles.galleryDotActive : null]} />
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.profileTopWrap}>
              <Pressable
                style={styles.favoriteButton}
                disabled={favoriteBusy}
                onPress={() => {
                  void toggleFavorite();
                }}
              >
                <FontAwesome name={isFavorite ? 'heart' : 'heart-o'} size={34} color={isFavorite ? '#dc2626' : '#6b7280'} />
                <Text style={[styles.favoriteText, isFavorite ? styles.favoriteTextActive : null]}>
                  {isFavorite ? 'Mi Favorito' : 'Añadir\nFavoritos'}
                </Text>
              </Pressable>

              <View style={styles.logoCircleShadow}>
                <View style={styles.logoCircleInner}>
                  <Image source={{ uri: logoUrl }} style={styles.logoCircleImage} resizeMode="contain" />
                </View>
              </View>

              <View style={styles.statusTopWrap}>
                <Animated.View
                  style={[
                    styles.clockIconWrap,
                    statusHorario.abierto
                      ? {
                          transform: [
                            {
                              rotate: clockSpin.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '360deg'],
                              }),
                            },
                          ],
                        }
                      : null,
                  ]}
                >
                  <View style={styles.clockIconStack}>
                    <FontAwesome5 name="clock" size={37} color={clockColor} style={styles.clockIconStroke} />
                    <FontAwesome5 name="clock" size={35} color={clockColor} style={styles.clockIconTop} />
                  </View>
                </Animated.View>
                <Text style={[styles.statusTopText, statusHorario.abierto ? styles.statusOpen : styles.statusClosed]}>
                  {statusHorario.titulo}
                </Text>
                {statusHorario.subtitulo ? <Text style={styles.statusTopSub}>{statusHorario.subtitulo}</Text> : null}
              </View>
            </View>

            <View style={styles.centerInfo}>
              <Text style={styles.nameText}>{item.nombre || 'Comercio'}</Text>
              {(item.nombreSucursal || item.nombre_sucursal) ? (
                <Text style={styles.branchText}>{item.nombreSucursal || item.nombre_sucursal}</Text>
              ) : null}

              {!esJangueo && phoneHref ? (
                <Pressable
                  style={({ pressed }) => [styles.phonePill, pressed ? styles.phonePillPressed : null]}
                  onPress={() => void Linking.openURL(phoneHref)}
                >
                  <FontAwesome name="phone" size={20} color="#fff" />
                  <Text style={styles.phonePillText}>{phoneDisplay}</Text>
                </Pressable>
              ) : null}

              <View style={[styles.metaLine, styles.addressMetaLine]}>
                <FontAwesome name="map-pin" size={16} color="#3ea6c4" />
                <Text style={styles.metaBlue}>{item.direccion || item.municipio || 'Puerto Rico'}</Text>
              </View>

              <View style={styles.metaLine}>
                <FontAwesome name="car" size={16} color="#9ca3af" />
                <Text style={styles.metaGray}>{travelText}</Text>
              </View>
            </View>

            <View style={styles.mapsRow}>
              <Pressable
                style={[styles.mapButton, styles.mapButtonGoogle, !mapsUrl ? styles.mapButtonDisabled : null]}
                disabled={!mapsUrl}
                onPress={() => {
                  if (!mapsUrl) return;
                  void Linking.openURL(mapsUrl);
                }}
              >
                <View style={styles.mapButtonInner}>
                  <Image source={{ uri: `${SOCIAL_ICON_BASE}/google map.jpg` }} style={styles.mapImage} resizeMode="contain" />
                </View>
              </Pressable>
              <Pressable
                style={[styles.mapButton, styles.mapButtonWaze, !wazeUrl ? styles.mapButtonDisabled : null]}
                disabled={!wazeUrl}
                onPress={() => {
                  if (!wazeUrl) return;
                  void Linking.openURL(wazeUrl);
                }}
              >
                <View style={styles.mapButtonInner}>
                  <Image source={{ uri: `${SOCIAL_ICON_BASE}/waze.jpg` }} style={[styles.mapImage, styles.mapImageWaze]} resizeMode="contain" />
                </View>
              </Pressable>
            </View>

            {socialLinks.length ? (
              <View style={styles.socialRow}>
                {socialLinks.map((entry) => (
                  <Pressable
                    key={entry.key}
                    style={styles.socialButton}
                    onPress={() => {
                      if (!entry.href) return;
                      void Linking.openURL(entry.href);
                    }}
                  >
                    <Image source={{ uri: entry.image }} style={styles.socialImage} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {cupones.length > 0 ? (
              <View style={[styles.cardSection, shadows.card]}>
                <Text style={styles.sectionTitle}>Ofertas y Descuentos</Text>
                <Text style={styles.cuponIndicatorText}>{cupones.length} cupones disponibles</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cuponList}>
                  {cupones.map((cupon) => {
                    const cantidadRestante =
                      cupon.cantidadDisponible > 0
                        ? Math.max(cupon.cantidadDisponible - cupon.usados, 0)
                        : null;
                    const agotado = cantidadRestante != null && cantidadRestante <= 0;
                    const guardado = cupon.guardado;

                    return (
                      <View key={`cupon-${cupon.id}`} style={[styles.cuponCard, shadows.card]}>
                        <Image source={{ uri: cupon.imagenUrl }} style={styles.cuponImage} resizeMode="cover" />
                        <Text style={styles.cuponTitle} numberOfLines={2}>
                          {cupon.titulo}
                        </Text>
                        {cupon.descripcion ? (
                          <Text style={styles.cuponDescription} numberOfLines={3}>
                            {cupon.descripcion}
                          </Text>
                        ) : null}
                        {Number.isFinite(cupon.descuento) ? (
                          <Text style={styles.cuponDiscount}>Descuento: {Number(cupon.descuento)}%</Text>
                        ) : null}
                        {cantidadRestante != null ? (
                          <Text style={styles.cuponCountText}>
                            Disponibles: {cantidadRestante} de {cupon.cantidadDisponible}
                          </Text>
                        ) : null}
                        <Text style={styles.cuponDateText}>Valido hasta el {formatFechaLegible(cupon.fechaFinRaw)}</Text>

                        {guardado ? (
                          <View style={[styles.cuponStatePill, guardado.redimido ? styles.cuponStateRedeemed : styles.cuponStateSaved]}>
                            <Text style={styles.cuponStateText}>{guardado.redimido ? 'Redimido' : 'Ya guardado'}</Text>
                          </View>
                        ) : agotado ? (
                          <View style={[styles.cuponStatePill, styles.cuponStateSoldOut]}>
                            <Text style={styles.cuponStateText}>Agotado</Text>
                          </View>
                        ) : (
                          <Pressable
                            style={[styles.cuponSaveButton, savingCuponId === cupon.id ? styles.cuponSaveButtonDisabled : null]}
                            disabled={savingCuponId === cupon.id}
                            onPress={() => {
                              void handleGuardarCupon(cupon);
                            }}
                          >
                            <Text style={styles.cuponSaveButtonText}>
                              {savingCuponId === cupon.id ? 'Guardando...' : 'Guardar cupon'}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {sucursales.length > 0 ? (
              <View style={[styles.cardSection, shadows.card]}>
                <Text style={styles.sectionTitle}>Otras Sucursales</Text>
                <View style={styles.sucursalesWrap}>
                  {sucursales.map((sucursal) => (
                    <Pressable
                      key={`sucursal-${sucursal.id}`}
                      style={styles.sucursalChip}
                      onPress={() => {
                        router.push({ pathname: '/comercio/[id]', params: { id: String(sucursal.id) } });
                      }}
                    >
                      <Text style={styles.sucursalChipText}>{sucursal.nombre}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {plan.permite_menu && menuTargetId ? (
              <Pressable
                style={styles.menuButton}
                onPress={() => {
                  const menuUrl = `${DEFAULT_APP_BASE_URLS.public}/menu/menuComercio.html?idComercio=${menuTargetId}&modo=pickup&source=app`;
                  void Linking.openURL(menuUrl);
                }}
              >
                <Text style={styles.menuButtonText}>Ver Nuestro Menu</Text>
              </Pressable>
            ) : null}

            {specialsVisible ? (
              <View style={[styles.cardSection, shadows.card]}>
                <Text style={styles.sectionTitle}>Especiales para hoy</Text>
                <View style={styles.specialToggleRow}>
                  {especialesDia.almuerzo.length > 0 ? (
                    <Pressable
                      style={[styles.specialToggleButton, styles.specialToggleLunch, tabEspecial === 'almuerzo' ? styles.specialToggleActive : null]}
                      onPress={() => setTabEspecial('almuerzo')}
                    >
                      <Text style={styles.specialToggleText}>Ver Almuerzo</Text>
                    </Pressable>
                  ) : null}
                  {especialesDia.happyhour.length > 0 ? (
                    <Pressable
                      style={[styles.specialToggleButton, styles.specialToggleHappy, tabEspecial === 'happyhour' ? styles.specialToggleActive : null]}
                      onPress={() => setTabEspecial('happyhour')}
                    >
                      <Text style={styles.specialToggleText}>Ver Happy Hour</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.specialListWrap}>
                  {activeSpecialList.map((especial) => (
                    <View key={`especial-${especial.id}`} style={[styles.specialCard, shadows.card]}>
                      <Image
                        source={{ uri: especial.imagenUrl || 'https://placehold.co/120x120?text=Especial' }}
                        style={styles.specialImage}
                        resizeMode="cover"
                      />
                      <View style={styles.specialInfo}>
                        <Text style={styles.specialName}>{especial.nombre}</Text>
                        {especial.descripcion ? <Text style={styles.specialDescription}>{especial.descripcion}</Text> : null}
                        <Text style={styles.specialPrice}>{formatPrice(especial.precio)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {descripcion ? (
              <View style={[styles.cardSection, shadows.card]}>
                <Text numberOfLines={descExpanded ? undefined : 5} style={styles.descriptionText}>
                  {descripcion}
                </Text>
                <Pressable style={styles.descToggle} onPress={() => setDescExpanded((prev) => !prev)}>
                  <Text style={styles.descToggleText}>{descExpanded ? 'Ocultar informacion' : 'Ver toda la informacion'}</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={[styles.cardSection, shadows.card]}>
              <Text style={styles.sectionTitle}>Horario de {item.nombre}</Text>
              <Text style={[styles.scheduleStatusTitle, statusHorario.abierto ? styles.statusOpen : styles.statusClosed]}>
                {statusHorario.titulo}
              </Text>
              {statusHorario.subtitulo ? <Text style={styles.scheduleStatusSub}>{statusHorario.subtitulo}</Text> : null}

              <View style={styles.scheduleRowsWrap}>
                {DAY_LABELS_ES.map((dayName, index) => {
                  const horario = horarios.find((entry) => entry.diaSemana === index);
                  const isToday = index === new Date(nowTick).getDay();
                  const isClosedToday = isToday && !statusHorario.abierto;
                  const rowStyle = isToday
                    ? statusHorario.abierto
                      ? styles.scheduleRowOpenToday
                      : styles.scheduleRowClosedToday
                    : null;
                  return (
                    <View key={`row-day-${index}`} style={[styles.scheduleRow, rowStyle]}>
                      <Text style={[styles.scheduleDay, isToday ? styles.scheduleDayToday : null]}>{dayName}:</Text>
                      <Text style={[styles.scheduleValue, isToday ? styles.scheduleValueToday : null]}>
                        {horario
                          ? formatearHorario(horario.apertura, horario.cierre, horario.cerrado)
                          : isClosedToday
                            ? 'Cerrado'
                            : 'No disponible'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={[styles.cardSection, shadows.card]}>
              <Text style={styles.sectionTitle}>
                {item.nombre} cuenta con:
              </Text>
              <View style={styles.amenidadesGrid}>
                {amenidades.length === 0 ? (
                  <Text style={styles.emptyAmenidadesText}>Sin amenidades registradas.</Text>
                ) : (
                  amenidades.map((amenidad) => (
                    <View key={`amenidad-${amenidad.id}`} style={styles.amenidadItem}>
                      {(() => {
                        const icono = amenidadIconName(amenidad.icono, amenidad.nombre);
                        if (icono.preferFamily === 'fa6') {
                          return (
                            <FontAwesome6
                              name={icono.name as never}
                              iconStyle={icono.iconStyle as never}
                              size={21}
                              color="#3ea6c4"
                            />
                          );
                        }
                        return (
                          <FontAwesome5
                            name={icono.name as never}
                            size={21}
                            color="#3ea6c4"
                            solid={icono.iconStyle !== 'regular'}
                          />
                        );
                      })()}
                      <Text style={styles.amenidadText}>{amenidad.nombre}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            <View style={styles.nearbySection}>
              <Text style={styles.nearbyTitle}>Lugares para Comer a menos de 10 minutos de {item.nombre}</Text>
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
              <Text style={styles.nearbyTitle}>Lugares de interes cerca de {item.nombre}</Text>
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
              <Text style={styles.nearbyTitle}>Playas a menos de 45 minutos de {item.nombre}</Text>
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
                        onPress={() => {
                          router.push({ pathname: '/playa/[id]', params: { id: String(card.id) } });
                        }}
                      >
                        <Image source={{ uri: card.imagenUrl }} style={styles.nearbyBeachImage} resizeMode="cover" />
                        <View style={styles.nearbyBeachInfo}>
                          <Text style={styles.nearbyBeachName} numberOfLines={2}>
                            {card.nombre}
                          </Text>
                          {card.clima?.estado ? (
                            <View style={styles.nearbyBeachWeatherLine}>
                              {card.clima.iconoUrl ? (
                                card.clima.iconoUrl.toLowerCase().includes('.svg') ? (
                                  <SvgCssUri
                                    uri={card.clima.iconoUrl}
                                    width={16}
                                    height={16}
                                  />
                                ) : (
                                  <Image source={{ uri: card.clima.iconoUrl }} style={styles.nearbyBeachWeatherIcon} />
                                )
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

          <Modal transparent visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}>
            <View style={styles.modalBackdrop}>
              <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setModalVisible(false)} />
              <View style={styles.modalCard}>
                <Pressable style={styles.modalClose} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCloseText}>×</Text>
                </Pressable>

                <Image source={{ uri: galleryImages[modalIndex] || heroImage }} style={styles.modalImage} resizeMode="contain" />

                {galleryImages.length > 1 ? (
                  <View style={styles.modalControls}>
                    <Pressable
                      style={styles.modalControlButton}
                      onPress={() => setModalIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)}
                    >
                      <Ionicons name="chevron-back" size={22} color="#fff" />
                    </Pressable>
                    <Text style={styles.modalCounter}>
                      {modalIndex + 1}/{galleryImages.length}
                    </Text>
                    <Pressable
                      style={styles.modalControlButton}
                      onPress={() => setModalIndex((prev) => (prev + 1) % galleryImages.length)}
                    >
                      <Ionicons name="chevron-forward" size={22} color="#fff" />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          </Modal>
        </View>
      )}
    </PublicAppChrome>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scroll: {
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
  },
  blockedCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  blockedTitle: {
    fontFamily: fonts.medium,
    fontSize: 21,
    color: '#1f2937',
    textAlign: 'center',
  },
  blockedText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
  },
  blockedButton: {
    marginTop: spacing.sm,
    alignSelf: 'center',
    backgroundColor: '#ec7f25',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  blockedButtonText: {
    fontFamily: fonts.medium,
    color: '#fff',
    fontSize: 15,
  },
  galleryWrap: {
    width: '100%',
    height: 260,
    backgroundColor: '#111827',
  },
  galleryImageWrap: {
    width: '100%',
    height: '100%',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  galleryDots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  galleryDot: {
    width: 7,
    height: 7,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  galleryDotActive: {
    backgroundColor: '#fff',
    width: 16,
  },
  profileTopWrap: {
    marginTop: -36,
    minHeight: 122,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    left: 14,
    top: 50,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 62,
  },
  favoriteText: {
    marginTop: 3,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 16,
    textAlign: 'center',
  },
  favoriteTextActive: {
    color: '#dc2626',
  },
  logoCircleShadow: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -48 },
    shadowOpacity: 0.3,
    shadowRadius: 23,
    elevation: 10,
  },
  logoCircleInner: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#fff',
    borderWidth: 0,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircleImage: {
    width: '100%',
    height: '100%',
  },
  statusTopWrap: {
    position: 'absolute',
    right: 14,
    top: 50,
    alignItems: 'center',
    width: 114,
  },
  statusTopText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    marginTop: 2,
  },
  clockIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockIconStack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockIconStroke: {
    position: 'absolute',
    opacity: 0.95,
  },
  clockIconTop: {
    position: 'absolute',
  },
  statusTopSub: {
    fontFamily: fonts.light,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 14,
  },
  statusOpen: {
    color: '#16a34a',
  },
  statusClosed: {
    color: '#dc2626',
  },
  centerInfo: {
    marginTop: 4,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  nameText: {
    fontFamily: fonts.medium,
    fontSize: 31,
    lineHeight: 34,
    color: '#424242',
    textAlign: 'center',
  },
  branchText: {
    marginTop: -2,
    fontFamily: fonts.medium,
    fontSize: 20,
    color: '#6b7280',
    textAlign: 'center',
  },
  phonePill: {
    marginTop: spacing.sm,
    backgroundColor: '#dc2626',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 28,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  phonePillPressed: {
    opacity: 0.88,
  },
  phonePillText: {
    color: '#fff',
    fontFamily: fonts.medium,
    fontSize: 29,
    lineHeight: 34,
  },
  metaLine: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addressMetaLine: {
    marginTop: spacing.sm,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#3ea6c4',
    borderStyle: 'dotted',
  },
  metaBlue: {
    fontFamily: fonts.medium,
    fontSize: 20,
    color: '#3ea6c4',
    textAlign: 'center',
  },
  metaGray: {
    fontFamily: fonts.medium,
    fontSize: 20,
    color: '#9c9c9c',
    textAlign: 'center',
  },
  mapsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  mapButton: {
    width: 132,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 9,
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  mapButtonGoogle: { width: 132 },
  mapButtonWaze: { width: 132 },
  mapButtonDisabled: {
    opacity: 0.4,
  },
  mapImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  mapImageWaze: {
    backgroundColor: '#58c2f0',
    width: '101%',
    height: '103%',
  },
  socialRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
  },
  socialButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  socialImage: {
    width: '100%',
    height: '100%',
  },
  cardSection: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 23,
    color: '#424242',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sucursalesWrap: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  sucursalChip: {
    backgroundColor: '#dc2626',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sucursalChipText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: '#fff',
  },
  menuButton: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  menuButtonText: {
    fontFamily: fonts.medium,
    color: '#fff',
    fontSize: 20,
  },
  specialToggleRow: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  specialToggleButton: {
    borderRadius: borderRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  specialToggleLunch: {
    backgroundColor: '#2563eb',
  },
  specialToggleHappy: {
    backgroundColor: '#db2777',
  },
  specialToggleActive: {
    opacity: 1,
  },
  specialToggleText: {
    fontFamily: fonts.medium,
    color: '#fff',
    fontSize: 14,
  },
  specialListWrap: {
    gap: spacing.sm,
  },
  specialCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  specialImage: {
    width: 92,
    height: 92,
    borderRadius: borderRadius.sm,
    backgroundColor: '#f3f4f6',
  },
  specialInfo: {
    flex: 1,
    gap: 4,
  },
  specialName: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: '#1f2937',
  },
  specialDescription: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#6b7280',
  },
  specialPrice: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: '#16a34a',
  },
  descriptionText: {
    fontFamily: fonts.light,
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    textAlign: 'justify',
  },
  descToggle: {
    marginTop: spacing.sm,
    alignSelf: 'center',
    paddingVertical: 2,
  },
  descToggleText: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
  scheduleStatusTitle: {
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 24,
  },
  scheduleStatusSub: {
    marginTop: 4,
    textAlign: 'center',
    color: '#6b7280',
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  scheduleRowsWrap: {
    marginTop: spacing.md,
    gap: 6,
  },
  scheduleRow: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduleRowOpenToday: {
    backgroundColor: '#16a34a',
  },
  scheduleRowClosedToday: {
    backgroundColor: '#ef4444',
  },
  scheduleDay: {
    width: '38%',
    fontFamily: fonts.regular,
    fontSize: 17,
    color: '#374151',
    textAlign: 'center',
  },
  scheduleDayToday: {
    color: '#fff',
    fontFamily: fonts.medium,
  },
  scheduleValue: {
    width: '62%',
    fontFamily: fonts.regular,
    fontSize: 17,
    color: '#374151',
    textAlign: 'center',
  },
  scheduleValueToday: {
    color: '#fff',
    fontFamily: fonts.medium,
  },
  amenidadesGrid: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  amenidadItem: {
    width: '32%',
    alignItems: 'center',
    gap: 4,
  },
  amenidadText: {
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#374151',
  },
  emptyAmenidadesText: {
    width: '100%',
    textAlign: 'center',
    color: '#6b7280',
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  cuponLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  cuponLoadingText: {
    fontFamily: fonts.regular,
    color: '#6b7280',
    fontSize: 13,
  },
  cuponEmptyText: {
    textAlign: 'center',
    color: '#6b7280',
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  cuponIndicatorText: {
    textAlign: 'center',
    color: '#6b7280',
    fontFamily: fonts.regular,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  cuponList: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  cuponCard: {
    width: 256,
    minHeight: 378,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: spacing.sm,
    gap: 6,
  },
  cuponImage: {
    width: '100%',
    height: 152,
    borderRadius: borderRadius.sm,
    backgroundColor: '#e5e7eb',
  },
  cuponTitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: '#374151',
    lineHeight: 20,
  },
  cuponDescription: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    minHeight: 44,
  },
  cuponDiscount: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#16a34a',
  },
  cuponCountText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#6b7280',
  },
  cuponDateText: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#6b7280',
  },
  cuponStatePill: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cuponStateSaved: {
    backgroundColor: '#e5e7eb',
  },
  cuponStateRedeemed: {
    backgroundColor: '#dcfce7',
  },
  cuponStateSoldOut: {
    backgroundColor: '#fee2e2',
  },
  cuponStateText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#374151',
  },
  cuponSaveButton: {
    marginTop: spacing.sm,
    backgroundColor: '#2563eb',
    borderRadius: borderRadius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuponSaveButtonDisabled: {
    opacity: 0.7,
  },
  cuponSaveButtonText: {
    fontFamily: fonts.medium,
    color: '#fff',
    fontSize: 13,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: -2,
    right: 2,
    zIndex: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modalCloseText: {
    color: '#fff',
    fontFamily: fonts.medium,
    fontSize: 38,
    lineHeight: 42,
  },
  modalImage: {
    width: '100%',
    height: 420,
    borderRadius: borderRadius.md,
    backgroundColor: '#000',
  },
  modalControls: {
    marginTop: spacing.sm,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  modalControlButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modalCounter: {
    color: '#fff',
    fontFamily: fonts.medium,
    fontSize: 15,
  },
});
