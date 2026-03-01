import { formatearTelefonoDisplay, formatearTelefonoHref, resolverPlanComercio } from '@findixi/shared';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Callout, CalloutSubview, Circle, Marker, type Region } from 'react-native-maps';

import { PublicAppChrome } from '../src/components/layout/PublicAppChrome';
import { fetchCercaCategorias, fetchFavoritosRemotosOrLocal } from '../src/features/cercademi/api';
import { tCerca } from '../src/features/cercademi/i18n';
import type { CercaCategoriaOption, CercaComercioItem } from '../src/features/cercademi/types';
import { fetchCercanosParaCoordenadas } from '../src/features/comercios/api';
import { useI18n } from '../src/i18n/provider';
import { requestUserLocation, type UserLocation } from '../src/lib/location';
import { supabase } from '../src/lib/supabase';
import { borderRadius, fonts, shadows, spacing } from '../src/theme/tokens';

type SelectOption = {
  value: string;
  label: string;
};

const DEFAULT_REGION: Region = {
  latitude: 18.2208,
  longitude: -66.5901,
  latitudeDelta: 0.25,
  longitudeDelta: 0.25,
};

const SUPABASE_PUBLIC_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co';
const PLACEHOLDER_LOGO =
  `${SUPABASE_PUBLIC_BASE}/storage/v1/object/public/imagenesapp/enpr/imgLogoNoDisponible.jpg`;
const FALLBACK_USER_IMG = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const HIGH_SPEED_TRACK_ZOOM = 12.4;
const MEDIUM_SPEED_TRACK_ZOOM = 14.0;
const LOW_SPEED_TRACK_ZOOM = 16.5;
const CATEGORY_COLORS: Record<number, string> = {
  1: '#2563eb',
  2: '#16a34a',
  3: '#f97316',
  4: '#ec4899',
  5: '#9333ea',
  6: '#facc15',
  7: '#0ea5e9',
};

type SliderProps = {
  style?: unknown;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
};

const SliderComponent = (() => {
  try {
    return require('@react-native-community/slider').default as ComponentType<SliderProps>;
  } catch {
    return null;
  }
})();

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function toStorageUrl(pathOrUrl: string | null | undefined, fallback: string): string {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${SUPABASE_PUBLIC_BASE}/storage/v1/object/public/galeriacomercios/${raw
    .replace(/^public\//i, '')
    .replace(/^\/+/, '')}`;
}

function toUserAvatarUrl(pathOrUrl: string | null | undefined): string {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw) return FALLBACK_USER_IMG;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/storage/v1/')) return `${SUPABASE_PUBLIC_BASE}${raw}`;
  return raw;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function calculateDistanceMeters(a: UserLocation, b: UserLocation): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function normalizeHeading(heading: number | null): number | null {
  if (!Number.isFinite(heading)) return null;
  const safeHeading = Number(heading);
  return ((safeHeading % 360) + 360) % 360;
}

function targetZoomBySpeedMph(mphRaw: number): number {
  const mph = Number.isFinite(mphRaw) ? Number(mphRaw) : 0;
  if (mph > 45) return HIGH_SPEED_TRACK_ZOOM;
  if (mph >= 20) return MEDIUM_SPEED_TRACK_ZOOM;
  return LOW_SPEED_TRACK_ZOOM;
}

function zoomFromLatitudeDelta(latitudeDelta: number): number | null {
  const safeDelta = Number(latitudeDelta);
  if (!Number.isFinite(safeDelta) || safeDelta <= 0) return null;
  return Math.log2(360 / safeDelta);
}

function headingDelta(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function toMarkerColor(raw: unknown): string | null {
  const color = String(raw ?? '').trim();
  return /^#([0-9a-f]{6})$/i.test(color) ? color : null;
}

function resolveComercioMarkerColor(item: CercaComercioItem): string {
  const colorHex = toMarkerColor((item as CercaComercioItem & { color_hex?: string | null }).color_hex);
  if (colorHex) return colorHex;

  const directCategoria = toFiniteNumber((item as CercaComercioItem & { idCategoria?: number | string | null }).idCategoria);
  if (Number.isFinite(directCategoria)) {
    const fromDirect = CATEGORY_COLORS[Number(directCategoria)];
    if (fromDirect) return fromDirect;
  }

  const categoriaId = Array.isArray(item.ComercioCategorias)
    ? item.ComercioCategorias.find((entry) => Number.isFinite(Number(entry?.idCategoria)))?.idCategoria
    : null;
  const safeCategoriaId = categoriaId == null ? Number.NaN : Number(categoriaId);
  if (Number.isFinite(safeCategoriaId)) {
    const fromCategorias = CATEGORY_COLORS[safeCategoriaId];
    if (fromCategorias) return fromCategorias;
  }

  return '#2563eb';
}

function comercioIsOpen(item: CercaComercioItem): boolean {
  return item.abiertoAhora === true || item.abierto_ahora === true;
}

function enrichComercios(list: CercaComercioItem[]): CercaComercioItem[] {
  return list.map((item) => ({
    ...item,
    logoUrl: toStorageUrl(item.logo, PLACEHOLDER_LOGO),
    portadaUrl: toStorageUrl(item.portada, PLACEHOLDER_LOGO),
    favorito: Boolean(item.favorito),
  }));
}

type FilterSelectProps = {
  value: string;
  placeholder: string;
  options: SelectOption[];
  onChange: (value: string) => void;
};

function FilterSelect({ value, placeholder, options, onChange }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Pressable style={styles.categorySelect} onPress={() => setOpen(true)}>
        <Text numberOfLines={1} style={[styles.categorySelectText, !selected ? styles.categorySelectPlaceholder : null]}>
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#6b7280" />
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
            <Pressable
              style={styles.modalOption}
              onPress={() => {
                onChange('');
                setOpen(false);
              }}
            >
              <Text style={styles.modalOptionText}>{placeholder}</Text>
              {!value ? <Ionicons name="checkmark" size={16} color="#3ea6c4" /> : null}
            </Pressable>
            {options.map((option) => (
              <Pressable
                key={option.value}
                style={styles.modalOption}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
                {value === option.value ? <Ionicons name="checkmark" size={16} color="#3ea6c4" /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

type ToggleProps = {
  label: string;
  value: boolean;
  color: string;
  onToggle: (next: boolean) => void;
};

function FilterToggle({ label, value, color, onToggle }: ToggleProps) {
  return (
    <View style={styles.toggleItem}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Pressable onPress={() => onToggle(!value)} style={[styles.toggleTrack, value ? { backgroundColor: color } : null]}>
        <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : null]} />
      </Pressable>
    </View>
  );
}

function resolveBranchInfo(item: CercaComercioItem): { showBranch: boolean; branchName: string } {
  const record = item as CercaComercioItem & {
    nombreSucursal?: unknown;
    nombre_sucursal?: unknown;
    sucursalNombre?: unknown;
    sucursal_nombre?: unknown;
  };

  const nombreSucursalRaw =
    record.nombreSucursal ??
    record.nombre_sucursal ??
    record.sucursalNombre ??
    record.sucursal_nombre;

  const branchName = String(nombreSucursalRaw ?? '').trim();
  const showBranch = Boolean(branchName);
  return { showBranch, branchName };
}

type NearMeComercioCardProps = {
  item: CercaComercioItem;
  lang: string;
  isFavorite: boolean;
  onPhonePress: () => void;
  onNavigatePress: () => void;
};

function NearMeComercioCard({ item, lang, isFavorite, onPhonePress, onNavigatePress }: NearMeComercioCardProps) {
  const plan = resolverPlanComercio(item);
  const canOpenProfile = plan.permite_perfil !== false && item.activo !== false;
  const isOpen = comercioIsOpen(item);
  const phone = formatearTelefonoDisplay(item.telefono ?? '');
  const phoneHref = formatearTelefonoHref(item.telefono ?? '');
  const portada = toStorageUrl(item.portada, PLACEHOLDER_LOGO);
  const logo = toStorageUrl(item.logo, PLACEHOLDER_LOGO);
  const inactivePortada = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/NoActivoPortada.jpg';
  const inactiveLogo = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/NoActivoLogo.png';
  const isInactiveCard = item.activo === false || !canOpenProfile;
  const { showBranch, branchName } = resolveBranchInfo(item);
  const nombre = String(item.nombre || 'Comercio');
  const tiempo = String(item.tiempoTexto || item.tiempoVehiculo || '').trim();
  const nameSizeStyle = nombre.length > 25 ? styles.mapCardTitleSmall : styles.mapCardTitle;

  if (isInactiveCard) {
    return (
      <View style={[styles.mapCard, styles.mapCardNoActivo, shadows.card]}>
        <View style={styles.mapCardTopImageWrap}>
          <Image source={{ uri: inactivePortada }} style={styles.mapCardTopImage} resizeMode="cover" />
        </View>

        <View style={styles.mapCardContentWrapNoActivo}>
          <View style={[styles.mapCardLogoWrap, styles.mapCardLogoShadow, styles.mapCardLogoWrapNoActivo]}>
            <Image source={{ uri: inactiveLogo }} style={styles.mapCardLogo} resizeMode="contain" />
          </View>

          <View style={styles.mapCardNameBlock}>
            <Text numberOfLines={2} style={nameSizeStyle}>
              {nombre}
            </Text>
          </View>

          {phoneHref ? (
            <CalloutSubview
              onPress={() => {
                if (!phoneHref) return;
                onPhonePress();
                void Linking.openURL(phoneHref);
              }}
            >
              <View style={styles.mapCardNoActivoPhoneRow}>
                <FontAwesome name="phone" size={16} color="#6b7280" />
                <Text style={styles.mapCardNoActivoPhoneText}>{phone || tCerca('cerca.llamar', lang)}</Text>
              </View>
            </CalloutSubview>
          ) : (
            <View style={styles.mapCardNoActivoPhonePlaceholder} />
          )}

          <View style={styles.mapCardMetaRow}>
            <FontAwesome name="map-pin" size={14} color="#9ca3af" />
            <Text numberOfLines={1} style={styles.mapCardNoActivoMetaText}>
              {item.pueblo || item.municipio || tCerca('cerca.municipio', lang)}
            </Text>
          </View>

          {tiempo ? (
            <>
              <View style={styles.mapCardMetaRow}>
                <FontAwesome name="car" size={14} color="#9ca3af" />
                <Text numberOfLines={1} style={styles.mapCardNoActivoMetaText}>
                  {tiempo}
                </Text>
              </View>
              <CalloutSubview onPress={onNavigatePress}>
                <View style={styles.mapCardGpsButton}>
                  <Ionicons name="navigate" size={13} color="#3ea6c4" />
                  <Text style={styles.mapCardGpsButtonText}>{tCerca('cerca.abrirGps', lang)}</Text>
                </View>
              </CalloutSubview>
            </>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.mapCard, shadows.card]}>
      <View style={styles.mapCardTopImageWrap}>
        <Image source={{ uri: portada }} style={styles.mapCardTopImage} resizeMode="cover" />
      </View>

      {isFavorite ? (
        <View style={styles.mapFavoriteBadge}>
          <View style={styles.mapFavoriteBadgeInner}>
            <Ionicons name="heart" size={10} color="#dc2626" />
          </View>
        </View>
      ) : null}

      <View style={styles.mapCardContentWrap}>
        <View style={[styles.mapCardLogoWrap, styles.mapCardLogoShadow]}>
          <Image source={{ uri: logo }} style={styles.mapCardLogo} resizeMode="contain" />
        </View>

        <View style={styles.mapCardNameBlockActive}>
          <View style={[styles.mapCardNameInner, showBranch ? styles.mapCardNameInnerWithBranch : null]}>
            <Text numberOfLines={2} style={[nameSizeStyle, showBranch ? styles.mapCardTitleWithBranch : styles.mapCardTitleWithoutBranch]}>
              {nombre}
            </Text>
          </View>
          {showBranch ? (
            <Text numberOfLines={1} style={styles.mapCardBranchText}>
              {branchName}
            </Text>
          ) : null}
        </View>

        {phoneHref ? (
          <CalloutSubview
            onPress={() => {
              if (!phoneHref) return;
              onPhonePress();
              void Linking.openURL(phoneHref);
            }}
          >
            <View style={styles.mapCardPhonePill}>
              <FontAwesome name="phone" size={16} color="#fff" />
              <Text style={styles.mapCardPhoneText}>{phone || tCerca('cerca.llamar', lang)}</Text>
            </View>
          </CalloutSubview>
        ) : (
          <View style={styles.mapCardPhonePlaceholder} />
        )}

        <View style={styles.mapCardStatusRow}>
          <FontAwesome name="clock-o" size={16} color={isOpen ? '#16a34a' : '#dc2626'} />
          <Text style={[styles.mapCardStatusText, isOpen ? styles.mapCardStatusOpen : styles.mapCardStatusClosed]}>
            {isOpen ? tCerca('cerca.abiertoAhora', lang) : tCerca('cerca.cerradoAhora', lang)}
          </Text>
        </View>

        <View style={styles.mapCardMetaRow}>
          <FontAwesome name="map-pin" size={14} color="#3ea6c4" />
          <Text numberOfLines={1} style={styles.mapCardMetaText}>
            {item.pueblo || item.municipio || tCerca('cerca.municipio', lang)}
          </Text>
        </View>

        {tiempo ? (
          <>
            <View style={styles.mapCardMetaRow}>
              <FontAwesome name="car" size={14} color="#9ca3af" />
              <Text numberOfLines={1} style={styles.mapCardMetaSoftText}>
                {tiempo}
              </Text>
            </View>
            <CalloutSubview onPress={onNavigatePress}>
              <View style={styles.mapCardGpsButton}>
                <Ionicons name="navigate" size={13} color="#3ea6c4" />
                <Text style={styles.mapCardGpsButtonText}>{tCerca('cerca.abrirGps', lang)}</Text>
              </View>
            </CalloutSubview>
          </>
        ) : null}
      </View>
    </View>
  );
}

export default function CercaDeMiScreen() {
  const { lang } = useI18n();
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const mapZoomRef = useRef(MEDIUM_SPEED_TRACK_ZOOM);
  const lastPhonePressAtRef = useRef(0);
  const requestSeqRef = useRef(0);
  const firstTrackedFixRef = useRef(false);
  const lastTrackedCoordsRef = useRef<UserLocation | null>(null);
  const userHeadingRef = useRef<number | null>(null);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [userMarkerImage, setUserMarkerImage] = useState(FALLBACK_USER_IMG);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [categories, setCategories] = useState<CercaCategoriaOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [radiusApplied, setRadiusApplied] = useState(5);
  const [rawComercios, setRawComercios] = useState<CercaComercioItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [followingUser, setFollowingUser] = useState(true);
  const liveCoordsRef = useRef<UserLocation | null>(null);
  const lastReloadRef = useRef<{ coords: UserLocation; at: number } | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => setRadiusApplied(radiusMiles), 180);
    return () => clearTimeout(timeoutId);
  }, [radiusMiles]);

  const refreshFavoritos = useCallback(async () => {
    const result = await fetchFavoritosRemotosOrLocal();
    setSessionUserId(result.userId);
    setFavoriteIds(result.ids);
  }, []);

  const loadCategorias = useCallback(async () => {
    try {
      const result = await fetchCercaCategorias(lang);
      setCategories(result);
    } catch (loadError) {
      console.warn('[mobile-public] No se pudieron cargar categorías en CercaDeMi:', loadError);
      setCategories([]);
    }
  }, [lang]);

  const loadCercanos = useCallback(
    async (forcedLocation?: UserLocation | null) => {
      const currentSeq = ++requestSeqRef.current;
      setLoading(true);
      setError('');

      try {
        let userCoords = forcedLocation ?? liveCoordsRef.current;
        if (!userCoords) {
          userCoords = await requestUserLocation();
        }

        if (!userCoords) {
          if (requestSeqRef.current !== currentSeq) return;
          setError(tCerca('cerca.sinUbicacion', lang));
          setRawComercios([]);
          return;
        }

        const safeCategoryId = Number(selectedCategory);
        const categoriaId = Number.isFinite(safeCategoryId) && safeCategoryId > 0 ? safeCategoryId : null;
        const radioKm = Math.max(1, radiusApplied) * 1.60934;

        const data = await fetchCercanosParaCoordenadas({
          latitud: userCoords.latitude,
          longitud: userCoords.longitude,
          radioKm,
          categoriaId,
          abiertoAhora: openNowOnly ? true : null,
          incluirInactivos: false,
          limit: 500,
        });

        if (requestSeqRef.current !== currentSeq) return;
        setLocation(userCoords);
        liveCoordsRef.current = userCoords;
        setRawComercios(enrichComercios((Array.isArray(data) ? data : []) as CercaComercioItem[]));
        lastReloadRef.current = { coords: userCoords, at: Date.now() };
      } catch (loadError) {
        if (requestSeqRef.current !== currentSeq) return;
        console.error('[mobile-public] Error cargando cercanos:', loadError);
        setError(tCerca('cerca.error', lang));
        setRawComercios([]);
      } finally {
        if (requestSeqRef.current === currentSeq) {
          setLoading(false);
        }
      }
    },
    [lang, openNowOnly, radiusApplied, selectedCategory]
  );

  useEffect(() => {
    void loadCategorias();
  }, [loadCategorias]);

  useEffect(() => {
    void refreshFavoritos();
  }, [refreshFavoritos]);

  useEffect(() => {
    let active = true;

    const loadUserAvatar = async () => {
      if (!sessionUserId) {
        setUserMarkerImage(FALLBACK_USER_IMG);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('imagen')
          .eq('id', sessionUserId)
          .maybeSingle();
        if (error) throw error;
        if (!active) return;
        const avatar = toUserAvatarUrl((data as { imagen?: string | null } | null)?.imagen);
        setUserMarkerImage(avatar || FALLBACK_USER_IMG);
      } catch (avatarError) {
        if (!active) return;
        console.warn('[mobile-public] No se pudo cargar avatar de usuario para CercaDeMi:', avatarError);
        setUserMarkerImage(FALLBACK_USER_IMG);
      }
    };

    void loadUserAvatar();

    return () => {
      active = false;
    };
  }, [sessionUserId]);

  useFocusEffect(
    useCallback(() => {
      void refreshFavoritos();
    }, [refreshFavoritos])
  );

  useEffect(() => {
    void loadCercanos();
  }, [loadCercanos]);

  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    const shouldReload = (nextCoords: UserLocation) => {
      const last = lastReloadRef.current;
      if (!last) return true;

      const elapsed = Date.now() - last.at;
      const distance = calculateDistanceMeters(last.coords, nextCoords);
      return distance >= 120 || elapsed >= 60_000;
    };

    const startWatch = async () => {
      const current = await Location.getForegroundPermissionsAsync();
      let status = current.status;

      if (status !== 'granted') {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }

      if (status !== 'granted') return;
      if (!active) return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (pos) => {
          if (!active) return;

          const nextCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          const previousTracked = lastTrackedCoordsRef.current;
          const movedMeters = previousTracked ? calculateDistanceMeters(previousTracked, nextCoords) : Infinity;
          lastTrackedCoordsRef.current = nextCoords;
          const headingNow = normalizeHeading(toFiniteNumber(pos.coords.heading));
          if (headingNow != null) {
            const previousHeading = userHeadingRef.current;
            if (previousHeading == null || headingDelta(previousHeading, headingNow) >= 4) {
              userHeadingRef.current = headingNow;
              setUserHeading(headingNow);
            }
          }
          const speedMps = toFiniteNumber(pos.coords.speed);
          const mph = Number.isFinite(speedMps) ? Number(speedMps) * 2.23694 : 0;
          const speedTargetZoom = targetZoomBySpeedMph(mph);

          liveCoordsRef.current = nextCoords;
          setLocation(nextCoords);

          if (followingUser) {
            const headingToApply = headingNow ?? userHeadingRef.current ?? 0;
            if (!firstTrackedFixRef.current) {
              firstTrackedFixRef.current = true;
              mapZoomRef.current = HIGH_SPEED_TRACK_ZOOM;
            }

            const zoomToApply =
              movedMeters >= 3
                ? Math.max(mapZoomRef.current, speedTargetZoom)
                : mapZoomRef.current;
            mapZoomRef.current = zoomToApply;

            mapRef.current?.animateCamera(
              {
                center: {
                  latitude: nextCoords.latitude,
                  longitude: nextCoords.longitude,
                },
                heading: headingToApply,
                pitch: 0,
                zoom: zoomToApply,
              },
              { duration: movedMeters >= 3 ? 240 : 220 }
            );
          }

          if (shouldReload(nextCoords)) {
            void loadCercanos(nextCoords);
          }
        }
      );
    };

    void startWatch();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [followingUser, loadCercanos]);

  const displayComercios = useMemo(() => {
    const search = normalizeText(searchText);
    return rawComercios.filter((item) => {
      const bySearch =
        !search ||
        normalizeText(item.nombre).includes(search) ||
        normalizeText(item.descripcion).includes(search) ||
        normalizeText(item.municipio).includes(search);

      const isFavorite = favoriteIds.has(Number(item.id));
      const byFavorites = !favoritesOnly || isFavorite;
      const byActive = !activeOnly || item.activo === true;

      return bySearch && byFavorites && byActive;
    });
  }, [activeOnly, favoriteIds, favoritesOnly, rawComercios, searchText]);

  const markerItems = useMemo(
    () =>
      displayComercios.filter((item) => Number.isFinite(toFiniteNumber(item.latitud)) && Number.isFinite(toFiniteNumber(item.longitud))),
    [displayComercios]
  );

  const handleToggleFavorites = useCallback(
    (next: boolean) => {
      if (!next) {
        setFavoritesOnly(false);
        return;
      }

      if (!sessionUserId) {
        Alert.alert(tCerca('cerca.favoritosLoginTitulo', lang), tCerca('cerca.favoritosLoginBody', lang), [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Ir',
            onPress: () => {
              router.push('/cuenta');
            },
          },
        ]);
        setFavoritesOnly(false);
        return;
      }

      if (favoriteIds.size === 0) {
        Alert.alert(tCerca('cerca.favoritos', lang), tCerca('cerca.favoritosVacios', lang));
        setFavoritesOnly(false);
        return;
      }

      setFavoritesOnly(true);
    },
    [favoriteIds.size, lang, router, sessionUserId]
  );

  const handleRecenter = useCallback(async () => {
    setFollowingUser(true);
    const userCoords = await requestUserLocation();
    if (!userCoords) {
      Alert.alert(tCerca('cerca.centrarme', lang), tCerca('cerca.sinUbicacion', lang));
      return;
    }

    setLocation(userCoords);
    liveCoordsRef.current = userCoords;
    firstTrackedFixRef.current = true;
    lastTrackedCoordsRef.current = userCoords;
    const recenterZoom = Math.max(15, mapZoomRef.current);
    mapZoomRef.current = recenterZoom;
    mapRef.current?.animateCamera(
      {
        center: {
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
        },
        heading: userHeadingRef.current ?? 0,
        pitch: 0,
        zoom: recenterZoom,
      },
      { duration: 280 }
    );
    await loadCercanos(userCoords);
  }, [lang, loadCercanos]);

  const openNavigationOptions = useCallback(
    (item: CercaComercioItem) => {
      const lat = toFiniteNumber(item.latitud);
      const lon = toFiniteNumber(item.longitud);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const destination = `${lat},${lon}`;
      const googleNative =
        Platform.OS === 'ios'
          ? `comgooglemaps://?daddr=${destination}&directionsmode=driving`
          : `google.navigation:q=${destination}&mode=d`;
      const googleFallback = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
      const wazeNative = `waze://?ll=${lat},${lon}&navigate=yes`;
      const wazeFallback = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;

      const openWithFallback = async (nativeUrl: string, fallbackUrl: string) => {
        try {
          const canOpenNative = await Linking.canOpenURL(nativeUrl);
          if (canOpenNative) {
            await Linking.openURL(nativeUrl);
            return;
          }
          await Linking.openURL(fallbackUrl);
        } catch (openError) {
          console.warn('[mobile-public] No se pudo abrir navegación:', openError);
          Alert.alert(tCerca('cerca.rutaErrorTitulo', lang), tCerca('cerca.rutaErrorBody', lang));
        }
      };

      Alert.alert(tCerca('cerca.rutaTitulo', lang), tCerca('cerca.rutaBody', lang), [
        { text: tCerca('cerca.cancelar', lang), style: 'cancel' },
        {
          text: tCerca('cerca.rutaGoogle', lang),
          onPress: () => {
            void openWithFallback(googleNative, googleFallback);
          },
        },
        {
          text: tCerca('cerca.rutaWaze', lang),
          onPress: () => {
            void openWithFallback(wazeNative, wazeFallback);
          },
        },
      ]);
    },
    [lang]
  );

  const distanceRadiusMeters = radiusApplied * 1609.34;
  const categoryOptions: SelectOption[] = categories.map((entry) => ({
    value: String(entry.id),
    label: entry.label,
  }));

  return (
    <PublicAppChrome>
      {({ contentPaddingStyle }) => (
        <View style={[styles.screen, contentPaddingStyle]}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={DEFAULT_REGION}
            onRegionChangeComplete={(nextRegion) => {
              const zoom = zoomFromLatitudeDelta(nextRegion.latitudeDelta);
              if (Number.isFinite(zoom)) {
                mapZoomRef.current = Number(zoom);
              }
            }}
            onPanDrag={() => {
              if (followingUser) setFollowingUser(false);
            }}
          >
            {location ? (
              <Circle
                center={{ latitude: location.latitude, longitude: location.longitude }}
                radius={distanceRadiusMeters}
                strokeWidth={1.5}
                strokeColor="rgba(37,99,235,0.35)"
                fillColor="rgba(37,99,235,0.12)"
              />
            ) : null}

            {location ? (
              <Marker
                coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                anchor={{ x: 0.5, y: 1 }}
                zIndex={2200}
              >
                <View style={styles.userMarkerShell}>
                  <View style={styles.userMarkerGlow} />
                  {userHeading != null ? (
                    <View
                      style={[
                        styles.userHeadingWrap,
                        {
                          transform: [{ rotate: `${userHeading}deg` }],
                        },
                      ]}
                    >
                      <View style={styles.userHeadingArrow} />
                    </View>
                  ) : null}
                  <View style={styles.userMarkerWrap}>
                    <Image source={{ uri: userMarkerImage }} style={styles.userMarkerImage} resizeMode="cover" />
                  </View>
                </View>
              </Marker>
            ) : null}

            {markerItems.map((item) => {
              const markerColor = resolveComercioMarkerColor(item);
              return (
                <Marker
                  key={String(item.id)}
                  coordinate={{ latitude: Number(item.latitud), longitude: Number(item.longitud) }}
                  anchor={{ x: 0.5, y: 1 }}
                  zIndex={200}
                >
                  <View style={styles.comercioMarkerShell}>
                    <View style={[styles.comercioMarkerWrap, { borderColor: markerColor }]}>
                      <Image source={{ uri: item.logoUrl || PLACEHOLDER_LOGO }} style={styles.comercioMarkerLogo} resizeMode="cover" />
                    </View>
                    <View style={[styles.comercioMarkerTail, { backgroundColor: markerColor }]} />
                  </View>
                  <Callout
                    tooltip
                    onPress={() => {
                      const calloutPressAt = Date.now();
                      // Delay profile navigation slightly so phone presses inside the callout can cancel it.
                      setTimeout(() => {
                        if (calloutPressAt - lastPhonePressAtRef.current < 450) return;
                        router.push({
                          pathname: '/comercio/[id]',
                          params: { id: String(item.id) },
                        });
                      }, 120);
                    }}
                  >
                    <NearMeComercioCard
                      item={item}
                      lang={lang}
                      isFavorite={favoriteIds.has(Number(item.id))}
                      onPhonePress={() => {
                        lastPhonePressAtRef.current = Date.now();
                      }}
                      onNavigatePress={() => {
                        lastPhonePressAtRef.current = Date.now();
                        openNavigationOptions(item);
                      }}
                    />
                  </Callout>
                </Marker>
              );
            })}
          </MapView>

          <View style={[styles.topPanel, shadows.card]}>
            <Text style={styles.title}>{tCerca('cerca.title', lang)}</Text>

            <View style={styles.searchRow}>
              <FontAwesome name="search" size={14} color="#9ca3af" />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder={tCerca('cerca.placeholder', lang)}
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
              />
            </View>

            <View style={styles.categoryRow}>
              <FilterSelect
                value={selectedCategory}
                placeholder={tCerca('cerca.categoriasTodas', lang)}
                options={categoryOptions}
                onChange={setSelectedCategory}
              />
              <Pressable style={styles.filterBtn} onPress={() => setShowFilters((curr) => !curr)}>
                <FontAwesome name="sliders" size={13} color="#111827" />
                <Text style={styles.filterBtnText}>{tCerca('cerca.filtros', lang)}</Text>
              </Pressable>
            </View>

            {showFilters ? (
              <View style={styles.filterPanel}>
                <View style={styles.toggleRow}>
                  <FilterToggle
                    label={tCerca('cerca.abierto', lang)}
                    value={openNowOnly}
                    color="#16a34a"
                    onToggle={setOpenNowOnly}
                  />
                  <FilterToggle
                    label={tCerca('cerca.activos', lang)}
                    value={activeOnly}
                    color="#2563eb"
                    onToggle={setActiveOnly}
                  />
                  <FilterToggle
                    label={tCerca('cerca.favoritos', lang)}
                    value={favoritesOnly}
                    color="#9333ea"
                    onToggle={handleToggleFavorites}
                  />
                </View>

                <Text style={styles.radiusHelp}>{tCerca('cerca.ajusteRadio', lang)}</Text>
                <View style={styles.radiusRow}>
                  <Text style={styles.radiusLabel}>{tCerca('cerca.radio', lang)}</Text>
                  {SliderComponent ? (
                    <SliderComponent
                      style={styles.slider}
                      minimumValue={1}
                      maximumValue={100}
                      step={1}
                      value={radiusMiles}
                      onValueChange={setRadiusMiles}
                      minimumTrackTintColor="#3ea6c4"
                      maximumTrackTintColor="#d1d5db"
                      thumbTintColor={Platform.OS === 'android' ? '#3ea6c4' : undefined}
                    />
                  ) : (
                    <View style={styles.sliderFallbackWrap}>
                      <Pressable
                        style={styles.sliderFallbackBtn}
                        onPress={() => setRadiusMiles((current) => Math.max(1, Math.round(current) - 1))}
                      >
                        <Text style={styles.sliderFallbackBtnText}>-</Text>
                      </Pressable>
                      <View style={styles.sliderFallbackRail} />
                      <Pressable
                        style={styles.sliderFallbackBtn}
                        onPress={() => setRadiusMiles((current) => Math.min(100, Math.round(current) + 1))}
                      >
                        <Text style={styles.sliderFallbackBtnText}>+</Text>
                      </Pressable>
                    </View>
                  )}
                  <Text style={styles.radiusValue}>{Math.round(radiusMiles)} mi</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.actionBtn, shadows.card, followingUser ? styles.actionBtnActive : null]}
              onPress={() => void handleRecenter()}
            >
              <Ionicons name="locate" size={18} color="#1f2937" />
            </Pressable>
            <Pressable style={[styles.actionBtn, shadows.card]} onPress={() => void loadCercanos()}>
              <Ionicons name="refresh" size={18} color="#1f2937" />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="small" color="#3ea6c4" />
              <Text style={styles.loaderText}>{tCerca('cerca.loading', lang)}</Text>
            </View>
          ) : null}

          {!loading && error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => void loadCercanos()}>
                <Text style={styles.retryText}>{tCerca('cerca.reintentar', lang)}</Text>
              </Pressable>
            </View>
          ) : null}

          {!loading && !error && displayComercios.length === 0 ? (
            <View style={styles.emptyBanner}>
              <Text style={styles.emptyText}>{tCerca('cerca.sinResultados', lang)}</Text>
            </View>
          ) : null}
        </View>
      )}
    </PublicAppChrome>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topPanel: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  title: {
    textAlign: 'center',
    color: '#111827',
    fontSize: 22,
    fontFamily: fonts.medium,
  },
  searchRow: {
    minHeight: 42,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    fontFamily: fonts.regular,
    paddingVertical: spacing.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categorySelect: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  categorySelectText: {
    flex: 1,
    color: '#111827',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  categorySelectPlaceholder: {
    color: '#94a3b8',
  },
  filterBtn: {
    minHeight: 40,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  filterBtnText: {
    color: '#111827',
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  filterPanel: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  toggleItem: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 92,
  },
  toggleLabel: {
    color: '#374151',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#d1d5db',
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  radiusHelp: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 11,
    fontFamily: fonts.regular,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  radiusLabel: {
    color: '#374151',
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  slider: {
    flex: 1,
    height: 28,
  },
  sliderFallbackWrap: {
    flex: 1,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sliderFallbackBtn: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderFallbackBtnText: {
    color: '#0f172a',
    fontSize: 16,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  sliderFallbackRail: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d1d5db',
  },
  radiusValue: {
    width: 44,
    textAlign: 'right',
    color: '#374151',
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  actionButtons: {
    position: 'absolute',
    right: spacing.md,
    bottom: 140,
    gap: spacing.sm,
  },
  actionBtn: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.pill,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    borderWidth: 1,
    borderColor: '#0ea5e9',
    backgroundColor: '#e0f2fe',
  },
  loaderOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 24,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  loaderText: {
    color: '#334155',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  errorBanner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 24,
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  errorText: {
    color: '#b91c1c',
    textAlign: 'center',
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  retryText: {
    color: '#0ea5e9',
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  emptyBanner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 24,
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptyText: {
    color: '#374151',
    textAlign: 'center',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  userMarkerShell: {
    width: 48,
    height: 58,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  userMarkerGlow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(37,99,235,0.34)',
    bottom: 2,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  userHeadingWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  userHeadingArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#2563eb',
  },
  userMarkerWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.pill,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  userMarkerImage: {
    width: '100%',
    height: '100%',
  },
  comercioMarkerShell: {
    width: 50,
    height: 60,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  comercioMarkerWrap: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.pill,
    borderWidth: 2,
    borderColor: '#2563eb',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  comercioMarkerTail: {
    width: 2,
    height: 10,
    borderRadius: 1,
    marginTop: 0,
  },
  comercioMarkerLogo: {
    width: '100%',
    height: '100%',
  },
  mapCard: {
    width: 188,
    minHeight: 336,
    height: 336,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    overflow: 'hidden',
    position: 'relative',
  },
  mapCardNoActivo: {
    backgroundColor: '#f3f4f6',
  },
  mapCardTopImageWrap: {
    width: '100%',
    height: 80,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  mapCardTopImage: {
    width: '100%',
    height: '100%',
  },
  mapFavoriteBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 3,
    width: 32,
    height: 32,
    borderRadius: borderRadius.pill,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  mapFavoriteBadgeInner: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.pill,
    borderWidth: 2,
    borderColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCardLogoWrap: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.pill,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: '#fff',
    position: 'absolute',
    alignSelf: 'center',
    top: -40,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCardLogoWrapNoActivo: {
    borderWidth: 0,
    backgroundColor: '#f3f4f6',
  },
  mapCardLogo: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.pill,
  },
  mapCardLogoShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -17 },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 0,
  },
  mapCardContentWrap: {
    flex: 1,
    marginTop: 24,
    paddingTop: 48,
    width: '100%',
    paddingHorizontal: 8,
    paddingBottom: 14,
    alignItems: 'center',
    gap: 1,
    position: 'relative',
  },
  mapCardContentWrapNoActivo: {
    flex: 1,
    marginTop: 24,
    paddingTop: 48,
    width: '100%',
    paddingHorizontal: 8,
    paddingBottom: 14,
    alignItems: 'center',
    gap: 1,
    position: 'relative',
  },
  mapCardNameBlockActive: {
    height: 52,
    width: '100%',
    position: 'relative',
    zIndex: 30,
  },
  mapCardNameInner: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  mapCardNameInnerWithBranch: {
    bottom: 14,
  },
  mapCardNameBlock: {
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    position: 'relative',
  },
  mapCardTitle: {
    color: '#424242',
    fontSize: 19,
    lineHeight: 21,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontWeight: '400',
    zIndex: 30,
    position: 'relative',
  },
  mapCardTitleSmall: {
    color: '#424242',
    fontSize: 17,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontWeight: '400',
    zIndex: 30,
    position: 'relative',
  },
  mapCardTitleWithoutBranch: {
    marginTop: 3,
  },
  mapCardTitleWithBranch: {
    marginTop: -4,
  },
  mapCardBranchText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    lineHeight: 16,
    fontFamily: fonts.regular,
  },
  mapCardPhonePill: {
    marginTop: 4,
    alignSelf: 'center',
    borderRadius: borderRadius.pill,
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 30,
  },
  mapCardPhonePillPressed: {
    opacity: 0.88,
  },
  mapCardPhoneText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 15,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  mapCardPhonePlaceholder: {
    minHeight: 30,
    marginTop: 0,
  },
  mapCardStatusRow: {
    marginTop: 6,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  mapCardStatusText: {
    fontSize: 16,
    lineHeight: 18,
    fontFamily: fonts.regular,
    fontWeight: '400',
  },
  mapCardStatusOpen: {
    color: '#16a34a',
  },
  mapCardStatusClosed: {
    color: '#dc2626',
  },
  mapCardMetaRow: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 18,
    marginTop: 0,
  },
  mapCardMetaText: {
    color: '#3ea6c4',
    fontSize: 14,
    maxWidth: 128,
    fontFamily: fonts.medium,
  },
  mapCardMetaSoftText: {
    color: '#9c9c9c',
    fontSize: 14,
    maxWidth: 128,
    fontFamily: fonts.medium,
  },
  mapCardGpsButton: {
    marginTop: 2,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#a8dcee',
    backgroundColor: '#edf9fd',
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  mapCardGpsButtonText: {
    color: '#3ea6c4',
    fontSize: 11,
    lineHeight: 12,
    fontFamily: fonts.medium,
  },
  mapCardNoActivoPhoneRow: {
    marginTop: 0,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 24,
    paddingHorizontal: 4,
  },
  mapCardNoActivoPhonePressed: {
    opacity: 0.7,
  },
  mapCardNoActivoPhoneText: {
    color: '#6b7280',
    fontSize: 15,
    lineHeight: 16,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  mapCardNoActivoPhonePlaceholder: {
    minHeight: 24,
    marginTop: 0,
  },
  mapCardNoActivoMetaText: {
    color: '#9c9c9c',
    fontSize: 14,
    maxWidth: 128,
    fontFamily: fonts.medium,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.25)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalSheet: {
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  modalOption: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionText: {
    color: '#0f172a',
    fontSize: 14,
    fontFamily: fonts.regular,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
});
