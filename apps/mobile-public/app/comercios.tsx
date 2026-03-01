import {
  calcularDistanciaHaversineKm,
  calcularTiempoEnVehiculo,
  formatearTelefonoDisplay,
  formatearTelefonoHref,
  normalizarTextoListado,
  ordenarYFiltrarListadoComercios,
  resolverPlanComercio,
} from '@findixi/shared';
import { FontAwesome, FontAwesome5, FontAwesome6, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PublicAppChrome } from '../src/components/layout/PublicAppChrome';
import { ScreenState } from '../src/components/ScreenState';
import { HomeCarousel } from '../src/components/home/HomeCarousel';
import {
  fetchComercioIdsBySearch,
  fetchCercanosParaCoordenadas,
  fetchComerciosFiltrados,
  fetchComerciosRefuerzoByIds,
  fetchMunicipioCoords,
  fetchMunicipios,
  fetchSubcategoriasByCategoria,
  type SubcategoriaOption,
} from '../src/features/comercios/api';
import { fetchGlobalBanners } from '../src/features/home/api';
import type { ComercioListItem } from '../src/features/comercios/types';
import type { HomeBannerItem } from '../src/features/home/types';
import { useI18n } from '../src/i18n/provider';
import type { I18nKey } from '../src/i18n/translations';
import { detectMunicipioUsuario, requestUserLocation, type UserLocation } from '../src/lib/location';
import { getDrivingDistance } from '../src/lib/osrm';
import { supabase } from '../src/lib/supabase';
import { borderRadius, fonts, shadows, spacing } from '../src/theme/tokens';

type OrderMode = 'ubicacion' | 'az' | 'recientes';
type SelectOption = { value: string; label: string };
type CategoryMeta = { label: string; slug: string; iconRaw: string | null };

const STORAGE_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/';
const DEFAULT_PORTADA = `${STORAGE_BASE}NoActivoPortada.jpg`;
const DEFAULT_LOGO = `${STORAGE_BASE}NoActivoLogo.png`;
const WEB_LOADER_IMAGE_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/loader.png';
const CARDS_PER_ROW = 2;
const BANNER_EVERY_ROWS = 4;
const VISIBLE_BATCH_SIZE = 25;
const CATEGORY_LABEL_BY_ID: Record<number, string> = {
  1: 'Restaurantes',
  2: 'Coffee Shops',
  3: 'Jangueo',
  4: 'Antojitos Dulces',
  5: 'Food Trucks',
  6: 'Dispensarios',
  7: 'Panaderias',
  8: 'Bares',
  9: 'Playgrounds',
};
const CATEGORY_ICON_BY_ID: Record<number, keyof typeof Ionicons.glyphMap> = {
  1: 'restaurant',
  2: 'cafe',
  3: 'beer',
  4: 'ice-cream',
  5: 'fast-food',
  6: 'leaf',
  7: 'storefront',
  8: 'wine',
  9: 'game-controller',
};
const CATEGORY_NAME_COLUMN_BY_LANG: Record<string, string> = {
  es: 'nombre_es',
  en: 'nombre_en',
  zh: 'nombre_zh',
  fr: 'nombre_fr',
  pt: 'nombre_pt',
  de: 'nombre_de',
  it: 'nombre_it',
  ko: 'nombre_ko',
  ja: 'nombre_ja',
};

type ListRow =
  | { type: 'cards'; key: string; left: ComercioListItem; right?: ComercioListItem }
  | { type: 'banner'; key: string };

function resolveBranchInfo(item: ComercioListItem): { showBranch: boolean; branchName: string } {
  const record = item as ComercioListItem & {
    nombreSucursal?: unknown;
    nombre_sucursal?: unknown;
    sucursalNombre?: unknown;
    sucursal_nombre?: unknown;
    sucursal?: unknown;
    esSucursal?: unknown;
    es_sucursal?: unknown;
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

function toStorageUrl(pathOrUrl: string | null | undefined, fallback: string): string {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${STORAGE_BASE}${raw.replace(/^public\//i, '').replace(/^\/+/, '')}`;
}

type TranslateFn = (key: I18nKey, params?: Record<string, string | number>) => string;

function formatTravelText(minutesRaw: number | null, t: TranslateFn): string {
  if (!Number.isFinite(minutesRaw)) return t('card.noDisponible');
  const minutes = Math.max(0, Math.round(Number(minutesRaw)));
  if (minutes < 60) return t('card.minAway', { min: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return t('card.horasMinAway', { h: hours, m: rest });
}

function computeDistance(item: ComercioListItem, location: UserLocation | null, t: TranslateFn): { km: number | null; label: string } {
  const withDistance = item as ComercioListItem & {
    distanciaKm?: number | null;
    tiempoVehiculo?: string | number | null;
    tiempoTexto?: string | null;
    minutosEstimados?: number | null;
  };

  const kmStored = Number(withDistance.distanciaKm);
  if (Number.isFinite(kmStored)) {
    const labelFromString =
      typeof withDistance.tiempoVehiculo === 'string' && withDistance.tiempoVehiculo.trim() !== ''
        ? withDistance.tiempoVehiculo.trim()
        : typeof withDistance.tiempoTexto === 'string' && withDistance.tiempoTexto.trim() !== ''
          ? withDistance.tiempoTexto.trim()
          : '';
    if (labelFromString) {
      return { km: kmStored, label: labelFromString };
    }

    if (Number.isFinite(withDistance.minutosEstimados)) {
      return { km: kmStored, label: formatTravelText(Number(withDistance.minutosEstimados), t) };
    }
  }

  if (!location || item.latitud == null || item.longitud == null) return { km: null, label: t('card.noDisponible') };

  const km = calcularDistanciaHaversineKm(
    location.latitude,
    location.longitude,
    Number(item.latitud),
    Number(item.longitud)
  );
  const travel = calcularTiempoEnVehiculo(km);
  return { km, label: formatTravelText(Number.isFinite(travel.minutos) ? travel.minutos : null, t) };
}

type ParsedCategoryIcon = {
  name: string;
  iconStyle: 'solid' | 'regular' | 'brands';
  preferFamily: 'fa6' | 'fa5';
};

function parseCategoryIcon(value: string | null | undefined): ParsedCategoryIcon | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const classMatch = raw.match(/class\s*=\s*["']([^"']+)["']/i);
  const source = (classMatch?.[1] || raw).trim();
  const tokens = source.split(/\s+/).filter(Boolean);
  const usesFa6StyleClass = /\bfa-solid\b|\bfa-regular\b|\bfa-brands\b/i.test(source);

  const iconStyle: ParsedCategoryIcon['iconStyle'] = tokens.includes('fa-brands') || tokens.includes('fab')
    ? 'brands'
    : tokens.includes('fa-regular') || tokens.includes('far')
      ? 'regular'
      : 'solid';

  const iconToken = tokens.find(
    (token) =>
      token.startsWith('fa-') &&
      token !== 'fa' &&
      token !== 'fas' &&
      token !== 'far' &&
      token !== 'fab' &&
      token !== 'fa-solid' &&
      token !== 'fa-regular' &&
      token !== 'fa-light' &&
      token !== 'fa-thin' &&
      token !== 'fa-brands'
  );

  const normalizeForFa5: Record<string, string> = {
    'martini-glass-citrus': 'cocktail',
    'martini-glass': 'glass-martini',
    'circle-check': 'check-circle',
    'location-dot': 'map-marker-alt',
  };
  const normalizeForFa6: Record<string, string> = {
    cocktail: 'martini-glass-citrus',
    'glass-martini': 'martini-glass',
    'check-circle': 'circle-check',
    'map-marker-alt': 'location-dot',
  };

  const normalizeName = (name: string, preferFamily: 'fa6' | 'fa5') => {
    if (preferFamily === 'fa5') return normalizeForFa5[name] || name;
    return normalizeForFa6[name] || name;
  };

  const preferFamily: 'fa6' | 'fa5' = usesFa6StyleClass ? 'fa6' : 'fa5';

  if (iconToken) return { name: normalizeName(iconToken.replace(/^fa-/, ''), preferFamily), iconStyle, preferFamily };
  if (raw.startsWith('fa-')) return { name: normalizeName(raw.replace(/^fa-/, ''), preferFamily), iconStyle, preferFamily };
  if (/^[a-z0-9-]+$/i.test(raw)) return { name: normalizeName(raw, preferFamily), iconStyle, preferFamily };
  return null;
}

function CategoryFilterIcon({
  rawValue,
  fallback,
}: {
  rawValue: string | null;
  fallback: keyof typeof Ionicons.glyphMap;
}) {
  const parsed = parseCategoryIcon(rawValue);
  if (parsed) {
    if (parsed.preferFamily === 'fa5') {
      return (
        <FontAwesome5
          name={parsed.name as never}
          size={18}
          color="#3ea6c4"
          brand={parsed.iconStyle === 'brands'}
          solid={parsed.iconStyle !== 'regular'}
        />
      );
    }

    return (
      <FontAwesome6
        name={parsed.name as never}
        iconStyle={parsed.iconStyle as never}
        size={18}
        color="#3ea6c4"
      />
    );
  }

  return <Ionicons name={fallback} size={18} color="#3ea6c4" />;
}

type FilterSelectProps = {
  label: string;
  value: string;
  placeholder: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  boxWidth?: number;
};

function FilterSelect({ label, value, placeholder, options, onChange, boxWidth }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={[styles.selectBlock, boxWidth ? { width: boxWidth } : null]}>
      <View style={styles.selectLabelWrap}>
        <Text style={styles.selectLabel}>{label}</Text>
      </View>
      <Pressable style={styles.selectTrigger} onPress={() => setOpen(true)}>
        <View style={styles.selectChevronSlot} />
        <Text numberOfLines={1} style={[styles.selectValue, !selected ? styles.selectValuePlaceholder : null]}>
          {selected?.label || placeholder}
        </Text>
        <View style={styles.selectChevronSlot}>
          <Ionicons name="chevron-down" size={16} color="#6b7280" />
        </View>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.selectBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.selectSheet} onPress={(event) => event.stopPropagation()}>
            <ScrollView>
              <Pressable
                style={styles.selectOption}
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <Text style={styles.selectOptionText}>{placeholder}</Text>
                {!value ? (
                  <View style={styles.selectOptionCheck}>
                    <Ionicons name="checkmark" size={16} color="#3ea6c4" />
                  </View>
                ) : null}
              </Pressable>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  style={styles.selectOption}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.selectOptionText}>{option.label}</Text>
                  {value === option.value ? (
                    <View style={styles.selectOptionCheck}>
                      <Ionicons name="checkmark" size={16} color="#3ea6c4" />
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
    <View style={styles.toggleWrap}>
      <View style={styles.toggleLabelWrap}>
        <Text style={styles.toggleLabel}>{label}</Text>
      </View>
      <Pressable
        onPress={() => onToggle(!value)}
        style={[styles.toggleTrack, value ? { backgroundColor: color } : null]}
      >
        <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : null]} />
      </Pressable>
    </View>
  );
}

type WebLoaderProps = {
  message: string;
  compact?: boolean;
};

function WebLoader({ message, compact = false }: WebLoaderProps) {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotate]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={compact ? styles.loaderWrapCompact : styles.loaderWrap}>
      <Animated.Image source={{ uri: WEB_LOADER_IMAGE_URL }} style={[styles.loaderImage, { transform: [{ rotate: spin }] }]} />
      <Text style={styles.loaderText}>{message}</Text>
    </View>
  );
}

type ComercioCardProps = {
  item: ComercioListItem;
  location: UserLocation | null;
  isFavorite: boolean;
  onPress: () => void;
};

function ComercioCard({ item, location, isFavorite, onPress }: ComercioCardProps) {
  const { t } = useI18n();
  const plan = resolverPlanComercio(item);
  const canOpenProfile = plan.permite_perfil !== false;
  const distance = computeDistance(item, location, t);
  const phone = formatearTelefonoDisplay(item.telefono ?? '');
  const phoneHref = formatearTelefonoHref(item.telefono ?? '');
  const portada = toStorageUrl(item.portada, DEFAULT_PORTADA);
  const logo = toStorageUrl(item.logo, DEFAULT_LOGO);
  const isOpen = item.abierto_ahora === true || item.abiertoAhora === true;
  const nameSizeStyle = (item.nombre || '').length > 25 ? styles.cardTitleActiveSmall : styles.cardTitleActive;
  const { showBranch, branchName } = resolveBranchInfo(item);
  const [showPlanHint, setShowPlanHint] = useState(false);

  useEffect(() => {
    if (!showPlanHint) return;
    const timeoutId = setTimeout(() => setShowPlanHint(false), 9000);
    return () => clearTimeout(timeoutId);
  }, [showPlanHint]);

  const handlePress = () => {
    if (canOpenProfile) {
      onPress();
      return;
    }
    setShowPlanHint(true);
  };

  return (
    <Pressable
      style={[styles.card, shadows.card, !canOpenProfile ? styles.cardDisabled : null]}
      onPress={handlePress}
    >
      {showPlanHint ? (
        <View style={[styles.planHintBubble, shadows.elevated]}>
          <Pressable style={styles.planHintClose} onPress={() => setShowPlanHint(false)} hitSlop={8}>
            <Text style={styles.planHintCloseText}>×</Text>
          </Pressable>
          <View style={styles.planHintIconWrap}>
            <Ionicons name="information-circle" size={14} color="#0ea5e9" />
          </View>
          <Text style={styles.planHintTitle}>{t('card.perfilNoDisponibleTitulo')}</Text>
          <Text style={styles.planHintBody}>
            {t('card.perfilNoDisponibleBody')}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardTopImageWrap}>
        <Image source={{ uri: portada }} style={styles.cardTopImage} resizeMode="cover" />
      </View>

      {isFavorite ? (
        <View style={styles.favoriteBadge}>
          <View style={styles.favoriteBadgeInner}>
            <Ionicons name="heart" size={10} color="#dc2626" />
          </View>
        </View>
      ) : null}

      <View style={styles.cardContentWrap}>
        <View style={[styles.cardLogoWrap, styles.cardLogoWrapActive, styles.cardLogoShadow]}>
          <Image source={{ uri: logo }} style={styles.cardLogo} resizeMode="contain" />
        </View>

        <View style={styles.cardNameBlockActive}>
          <View style={[styles.cardNameInner, showBranch ? styles.cardNameInnerWithBranch : null]}>
            <Text
              numberOfLines={2}
              style={[nameSizeStyle, showBranch ? styles.cardTitleWithBranch : styles.cardTitleWithoutBranch]}
            >
              {item.nombre || 'Comercio'}
            </Text>
          </View>
          {showBranch ? (
            <Text numberOfLines={1} style={styles.cardBranchText}>
              {branchName}
            </Text>
          ) : null}
        </View>

        {phoneHref ? (
          <Pressable
            style={({ pressed }) => [styles.cardPhonePill, pressed ? styles.cardPhonePillPressed : null]}
            onPress={(event) => {
              event.stopPropagation();
              void Linking.openURL(phoneHref);
            }}
          >
            <FontAwesome name="phone" size={16} color="#fff" />
            <Text style={styles.cardPhoneText}>{phone || t('card.llamar')}</Text>
          </Pressable>
        ) : (
          <View style={styles.cardPhonePlaceholder} />
        )}

        <View style={styles.cardStatusRow}>
          <FontAwesome name="clock-o" size={16} color={isOpen ? '#16a34a' : '#dc2626'} />
          <Text style={[styles.cardStatusText, isOpen ? styles.cardStatusOpen : styles.cardStatusClosed]}>
            {isOpen ? t('card.abiertoAhora') : t('card.cerradoAhora')}
          </Text>
        </View>

        <View style={styles.cardMetaRow}>
          <FontAwesome name="map-pin" size={14} color="#3ea6c4" style={styles.cardPinIcon} />
          <Text numberOfLines={1} style={styles.cardMetaText}>
            {item.pueblo || item.municipio || t('listado.municipioDesconocido')}
          </Text>
        </View>

        <View style={styles.cardMetaRow}>
          <FontAwesome name="car" size={14} color="#9ca3af" />
          <Text numberOfLines={1} style={styles.cardMetaSoftText}>
            {distance.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

type ComercioCardNoActivoProps = {
  item: ComercioListItem;
  location: UserLocation | null;
};

function ComercioCardNoActivo({ item, location }: ComercioCardNoActivoProps) {
  const { t } = useI18n();
  const distance = computeDistance(item, location, t);
  const phone = formatearTelefonoDisplay(item.telefono ?? '');
  const phoneHref = formatearTelefonoHref(item.telefono ?? '');
  const portada = `${STORAGE_BASE}NoActivoPortada.jpg`;
  const logo = `${STORAGE_BASE}NoActivoLogo.png`;
  const nameSizeStyle =
    (item.nombre || '').length > 25 ? styles.cardTitleNoActivoSmall : styles.cardTitleNoActivo;

  return (
    <View style={[styles.card, styles.cardNoActivo, shadows.card]}>
      <View style={styles.cardTopImageWrap}>
        <Image source={{ uri: portada }} style={styles.cardTopImage} resizeMode="cover" />
      </View>

      <View style={styles.cardContentWrapNoActivo}>
        <View style={[styles.cardLogoWrap, styles.cardLogoShadow, styles.cardLogoWrapNoActivo, styles.cardNoActivoLogoWrap]}>
          <Image source={{ uri: logo }} style={styles.cardLogo} resizeMode="contain" />
        </View>

        <View style={styles.cardNameBlock}>
          <Text numberOfLines={2} style={nameSizeStyle}>
            {item.nombre || 'Comercio'}
          </Text>
        </View>

        {phoneHref ? (
          <Pressable
            style={({ pressed }) => [styles.cardNoActivoPhoneRow, pressed ? styles.cardNoActivoPhonePressed : null]}
            onPress={() => void Linking.openURL(phoneHref)}
          >
            <FontAwesome name="phone" size={16} color="#6b7280" />
            <Text style={styles.cardNoActivoPhoneText}>{phone || t('card.telefono')}</Text>
          </Pressable>
        ) : (
          <View style={styles.cardNoActivoPhonePlaceholder} />
        )}

        <View style={styles.cardMetaRow}>
          <FontAwesome name="map-pin" size={14} color="#9ca3af" style={styles.cardPinIcon} />
          <Text numberOfLines={1} style={styles.cardNoActivoMetaText}>
            {item.pueblo || item.municipio || t('listado.municipioDesconocido')}
          </Text>
        </View>

        <View style={styles.cardMetaRow}>
          <FontAwesome name="car" size={14} color="#9ca3af" />
          <Text numberOfLines={1} style={styles.cardNoActivoMetaText}>
            {distance.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ComerciosScreen() {
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ idCategoria?: string; categoria?: string }>();
  const router = useRouter();
  const [items, setItems] = useState<ComercioListItem[]>([]);
  const [banners, setBanners] = useState<HomeBannerItem[]>([]);
  const [municipalityList, setMunicipalityList] = useState<string[]>([]);
  const [subcategoryOptions, setSubcategoryOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [suggestedItems, setSuggestedItems] = useState<ComercioListItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsTitle, setSuggestionsTitle] = useState('');
  const [suggestionsSubtitle, setSuggestionsSubtitle] = useState('');

  const [searchText, setSearchText] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [municipioDetectado, setMunicipioDetectado] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [order, setOrder] = useState<OrderMode>('az');
  const [openNow, setOpenNow] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [featuredFirst, setFeaturedFirst] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [categoryMeta, setCategoryMeta] = useState<CategoryMeta | null>(null);
  const orderSelectedManuallyRef = useRef(false);
  const locationBootstrapDoneRef = useRef(false);
  const municipioDetectadoRef = useRef(false);
  const requestSeqRef = useRef(0);
  const pageOffsetRef = useRef(0);
  const osrmCacheRef = useRef<Map<number, { distanciaKm: number; minutos: number; tiempoTexto: string }>>(new Map());
  const osrmRefiningRef = useRef(false);
  const osrmLastKeyRef = useRef('');

  const enrichSucursales = useCallback(async (list: ComercioListItem[]): Promise<ComercioListItem[]> => {
    const ids = Array.from(
      new Set(
        (Array.isArray(list) ? list : [])
          .map((entry) => Number(entry?.id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );
    if (ids.length === 0) return list;

    let rows: Array<Record<string, unknown>> = [];
    try {
      const { data, error } = await supabase
        .from('Comercios')
        .select('id,nombreSucursal,sucursal,esSucursal,es_sucursal')
        .in('id', ids);
      if (error) throw error;
      rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
    } catch {
      const { data, error } = await supabase
        .from('Comercios')
        .select('id,nombreSucursal')
        .in('id', ids);
      if (error) return list;
      rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
    }

    if (rows.length === 0) return list;
    const byId = new Map<number, Record<string, unknown>>();
    rows.forEach((row) => {
      const id = Number(row.id);
      if (Number.isFinite(id) && id > 0) byId.set(id, row);
    });

    return list.map((item) => {
      const extra = byId.get(Number(item.id));
      if (!extra) return item;

      const merged: ComercioListItem = { ...item };
      const nombreSucursal = String(extra.nombreSucursal ?? '').trim();
      if (nombreSucursal) {
        merged.nombreSucursal = nombreSucursal;
      }
      if (extra.sucursal !== undefined) merged.sucursal = Boolean(extra.sucursal);
      if (extra.esSucursal !== undefined) merged.esSucursal = Boolean(extra.esSucursal);
      if (extra.es_sucursal !== undefined) merged.es_sucursal = Boolean(extra.es_sucursal);

      const hasBranchFlag =
        merged.sucursal !== undefined ||
        merged.esSucursal !== undefined ||
        merged.es_sucursal !== undefined;
      if (!hasBranchFlag && nombreSucursal) {
        merged.sucursal = true;
      }

      return merged;
    });
  }, []);

  const selectedCategoryId = useMemo(() => {
    const raw = Array.isArray(params.idCategoria) ? params.idCategoria[0] : params.idCategoria;
    const parsed = Number(raw ?? '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [params.idCategoria]);

  useEffect(() => {
    let active = true;

    async function loadCategoryMeta() {
      if (!selectedCategoryId) {
        setCategoryMeta(null);
        return;
      }

      const column = CATEGORY_NAME_COLUMN_BY_LANG[lang] || 'nombre_es';
      const { data, error } = await supabase
        .from('Categorias')
        .select(
          `id,slug,icono,nombre,nombre_es,nombre_en,nombre_zh,nombre_fr,nombre_pt,nombre_de,nombre_it,nombre_ko,nombre_ja,${column}`
        )
        .eq('id', selectedCategoryId)
        .maybeSingle();

      if (!active) return;
      if (error || !data) {
        setCategoryMeta(null);
        return;
      }

      const record = data as unknown as Record<string, unknown>;
      const localized = String(record[column] ?? '').trim();
      const fallbackEs = String(record.nombre_es ?? '').trim();
      const fallbackNombre = String(record.nombre ?? '').trim();
      const label = localized || fallbackEs || fallbackNombre;
      const slug = String(record.slug ?? '').trim().toLowerCase();
      const iconRaw = String(record.icono ?? '').trim();

      setCategoryMeta({
        label,
        slug,
        iconRaw: iconRaw || null,
      });
    }

    void loadCategoryMeta();
    return () => {
      active = false;
    };
  }, [lang, selectedCategoryId]);

  const selectedCategoryLabel = useMemo(() => {
    if (categoryMeta?.label) return categoryMeta.label;
    const raw = Array.isArray(params.categoria) ? params.categoria[0] : params.categoria;
    const clean = String(raw ?? '').trim();
    if (clean) return clean;
    if (selectedCategoryId && CATEGORY_LABEL_BY_ID[selectedCategoryId]) {
      return CATEGORY_LABEL_BY_ID[selectedCategoryId];
    }
    return t('listado.titulo');
  }, [categoryMeta?.label, params.categoria, selectedCategoryId, t]);

  const selectedCategorySlug = useMemo(() => {
    if (categoryMeta?.slug) return categoryMeta.slug;
    if (selectedCategoryId === 1) return 'restaurantes';
    if (selectedCategoryId === 5) return 'food_trucks';
    return '';
  }, [categoryMeta?.slug, selectedCategoryId]);

  const selectedCategoryIcon = useMemo<keyof typeof Ionicons.glyphMap>(() => {
    if (selectedCategoryId && CATEGORY_ICON_BY_ID[selectedCategoryId]) {
      return CATEGORY_ICON_BY_ID[selectedCategoryId];
    }
    return 'restaurant';
  }, [selectedCategoryId]);

  const subcategoriaFilterLabel = useMemo(() => {
    if (selectedCategorySlug === 'restaurantes' || selectedCategorySlug === 'food_trucks') {
      return t('listado.tipoDeComida');
    }

    if (selectedCategoryLabel) {
      return t('listado.tipoDe', { categoria: selectedCategoryLabel });
    }

    return t('listado.tipoDeComida');
  }, [selectedCategoryLabel, selectedCategorySlug, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchText);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  const rpcQuery = useMemo(
    () => ({
      textoBusqueda: searchDebounced.trim() || null,
      municipio: municipio.trim() || null,
      categoriaId: selectedCategoryId,
      subcategoriaId: subcategoria ? Number(subcategoria) : null,
      abiertoAhora: openNow ? true : null,
      latitud: location?.latitude ?? null,
      longitud: location?.longitude ?? null,
    }),
    [location?.latitude, location?.longitude, municipio, openNow, searchDebounced, selectedCategoryId, subcategoria]
  );

  const loadComercios = useCallback(
    async ({
      append = false,
      query = rpcQuery,
    }: {
      append?: boolean;
      query?: typeof rpcQuery;
    } = {}) => {
      const currentRequest = ++requestSeqRef.current;
      const offset = append ? pageOffsetRef.current : 0;

      if (!append) setLoading(true);
      if (append) setLoadingMore(true);
      if (!append) {
        setSuggestedItems([]);
        setSuggestionsTitle('');
        setSuggestionsSubtitle('');
      }
      setError('');

      try {
        const searchTerm = String(query.textoBusqueda ?? '').trim();
        const shouldBoostBySearch = !append && searchTerm.length >= 3;

        const [rpcResult, bannerData, matchingIds] = await Promise.all([
          fetchComerciosFiltrados({
            ...query,
            limit: VISIBLE_BATCH_SIZE,
            offset,
          }),
          !append && banners.length === 0 ? fetchGlobalBanners().catch(() => []) : Promise.resolve(null),
          shouldBoostBySearch ? fetchComercioIdsBySearch(searchTerm) : Promise.resolve<number[]>([]),
        ]);

        if (currentRequest !== requestSeqRef.current) return;

        let incomingItems = rpcResult.items;

        if (shouldBoostBySearch && matchingIds.length > 0) {
          try {
            const refuerzo = await fetchComerciosRefuerzoByIds({
              categoriaId: query.categoriaId ?? null,
              subcategoriaId: query.subcategoriaId ?? null,
              abiertoAhora: query.abiertoAhora ?? null,
              comercioIds: matchingIds,
            });

            const byId = new Map<number, ComercioListItem>();
            [...incomingItems, ...refuerzo].forEach((entry) => {
              const key = Number(entry.id);
              if (!Number.isFinite(key) || byId.has(key)) return;
              byId.set(key, entry);
            });
            incomingItems = Array.from(byId.values());
          } catch {
            // Si refuerzo falla, mantenemos el listado principal sin bloquear la vista.
          }
        }

        if (shouldBoostBySearch) {
          const textoNormalizado = normalizarTextoListado(searchTerm);
          const idsPorNombre = incomingItems
            .filter((item) => normalizarTextoListado(item.nombre || '').includes(textoNormalizado))
            .map((item) => Number(item.id))
            .filter((id) => Number.isFinite(id) && id > 0);
          const idsCombinados = new Set<number>([
            ...idsPorNombre,
            ...matchingIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
          ]);
          incomingItems = incomingItems.filter((item) => idsCombinados.has(Number(item.id)));
        }

        incomingItems = await enrichSucursales(incomingItems);

        const nextOffset = offset + incomingItems.length;
        setItems((prev) => (append ? [...prev, ...incomingItems] : incomingItems));
        setHasMore(shouldBoostBySearch ? false : rpcResult.hasMore);
        pageOffsetRef.current = nextOffset;
        if (Array.isArray(bannerData)) {
          setBanners(bannerData);
        }
      } catch (err) {
        if (currentRequest !== requestSeqRef.current) return;
        setError(err instanceof Error ? err.message : t('listado.errorCarga'));
      } finally {
        if (currentRequest === requestSeqRef.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [banners.length, rpcQuery, t]
  );

  const loadFavorites = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setFavoriteIds(new Set());
        return;
      }

      const { data, error } = await supabase
        .from('favoritosusuarios')
        .select('idcomercio')
        .eq('idusuario', user.id);

      if (error) throw error;

      const ids = (Array.isArray(data) ? data : [])
        .map((row) => Number((row as { idcomercio?: number | string | null }).idcomercio))
        .filter((value) => Number.isFinite(value) && value > 0);
      setFavoriteIds(new Set(ids));
    } catch {
      setFavoriteIds(new Set());
    }
  }, []);

  const requestLocation = useCallback(async () => {
    try {
      const coords = await requestUserLocation();
      if (coords) {
        setLocation(coords);
        return coords;
      }
      setLocation(null);
      return null;
    } catch {
      setLocation(null);
      return null;
    }
  }, []);

  const handleOrderChange = useCallback(
    async (value: string) => {
      const next = (value as OrderMode) || 'az';
      orderSelectedManuallyRef.current = true;

      if (next !== 'ubicacion') {
        setOrder(next);
        return;
      }

      setResolvingLocation(true);
      const coords = await requestLocation();
      setResolvingLocation(false);
      if (coords) {
        if (!municipioDetectadoRef.current && !municipio) {
          municipioDetectadoRef.current = true;
          const municipioDetectado = await detectMunicipioUsuario(coords);
          if (municipioDetectado) {
            setMunicipioDetectado(municipioDetectado);
            setMunicipio(municipioDetectado);
          }
        }
        setOrder('ubicacion');
        return;
      }

      // Igual que web: sin permiso/coords, vuelve a orden alfabético.
      setOrder('az');
    },
    [municipio, requestLocation]
  );

  const bootstrapLocationOrder = useCallback(async () => {
    if (locationBootstrapDoneRef.current) return;
    locationBootstrapDoneRef.current = true;

    if (orderSelectedManuallyRef.current) return;

    setResolvingLocation(true);
    const coords = await requestLocation();
    setResolvingLocation(false);
    if (coords) {
      if (!municipioDetectadoRef.current && !municipio) {
        municipioDetectadoRef.current = true;
        const municipioDetectado = await detectMunicipioUsuario(coords);
        if (municipioDetectado) {
          setMunicipioDetectado(municipioDetectado);
          setMunicipio(municipioDetectado);
        }
      }
      setOrder('ubicacion');
      return;
    }

    // Igual que web: fallback automático a A-Z.
    setOrder('az');
  }, [municipio, requestLocation]);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites();
    }, [loadFavorites])
  );

  useEffect(() => {
    void bootstrapLocationOrder();
  }, [bootstrapLocationOrder]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const municipios = await fetchMunicipios();
        if (cancelled) return;
        setMunicipalityList(municipios);
      } catch {
        if (cancelled) return;
        setMunicipalityList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedCategoryId) {
        setSubcategoryOptions([]);
        setSubcategoria('');
        return;
      }

      try {
        const subcategorias = await fetchSubcategoriasByCategoria(selectedCategoryId);
        if (cancelled) return;
        const nextOptions = subcategorias.map((entry: SubcategoriaOption) => ({ value: String(entry.id), label: entry.label }));
        setSubcategoryOptions(nextOptions);
        if (subcategoria && !nextOptions.some((entry) => entry.value === subcategoria)) {
          setSubcategoria('');
        }
      } catch {
        if (cancelled) return;
        setSubcategoryOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId]);

  useEffect(() => {
    pageOffsetRef.current = 0;
    setHasMore(false);
    void loadComercios({ append: false, query: rpcQuery });
  }, [loadComercios, rpcQuery]);

  const municipalityOptions = useMemo<SelectOption[]>(() => {
    return municipalityList.map((name) => ({ value: name, label: name }));
  }, [municipalityList]);

  const orderOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'ubicacion', label: t('listado.cercania') },
      { value: 'az', label: t('listado.ordenAlfabetico') },
      { value: 'recientes', label: t('listado.masRecientes') },
    ],
    [t]
  );

  const estimateSelectWidth = useCallback((texts: string[]) => {
    const maxLen = texts.reduce((acc, text) => Math.max(acc, String(text || '').trim().length), 0);
    const estimated = 38 + maxLen * 5.25;
    return Math.max(92, Math.min(116, Math.round(estimated)));
  }, []);

  const municipioSelectWidth = useMemo(
    () =>
      estimateSelectWidth([
        t('listado.municipios'),
        ...municipalityOptions.map((item) => item.label),
        municipio,
      ]),
    [estimateSelectWidth, municipalityOptions, municipio, t]
  );

  const subcategoriaSelectWidth = useMemo(
    () =>
      estimateSelectWidth([
        subcategoriaFilterLabel,
        t('listado.todas'),
        ...subcategoryOptions.map((item) => item.label),
        subcategoria,
      ]),
    [estimateSelectWidth, subcategoriaFilterLabel, subcategoryOptions, subcategoria, t]
  );

  const ordenSelectWidth = useMemo(
    () =>
      estimateSelectWidth([
        t('listado.ordenarPor'),
        ...orderOptions.map((item) => item.label),
        order,
      ]),
    [estimateSelectWidth, orderOptions, order, t]
  );

  const filteredItems = useMemo(() => {
    const referencia =
      location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
        ? { lat: location.latitude, lon: location.longitude }
        : null;

    return ordenarYFiltrarListadoComercios(items, {
      orden: order,
      favoritos: favoritesOnly,
      destacadosPrimero: featuredFirst,
      abiertoAhora: openNow,
      favoritosSet: favoriteIds,
      referencia,
    }) as ComercioListItem[];
  }, [favoriteIds, favoritesOnly, featuredFirst, items, location, openNow, order]);

  const esBusquedaManual = useMemo(() => {
    if (!municipio) return false;
    if (!municipioDetectado) return true;
    return normalizarTextoListado(municipio) !== normalizarTextoListado(municipioDetectado);
  }, [municipio, municipioDetectado]);

  const hayComerciosEnMunicipio = useMemo(() => {
    if (!municipio) return items.length > 0;
    const target = normalizarTextoListado(municipio);
    return items.some((entry) => {
      const nombre = String(entry.pueblo ?? entry.municipio ?? '');
      return normalizarTextoListado(nombre) === target;
    });
  }, [items, municipio]);

  useEffect(() => {
    let cancelled = false;

    const loadSuggestions = async () => {
      if (loading || Boolean(error) || filteredItems.length > 0) {
        setSuggestedItems([]);
        setSuggestionsTitle('');
        setSuggestionsSubtitle('');
        setLoadingSuggestions(false);
        return;
      }

      setLoadingSuggestions(true);

      try {
        const usingSearch = searchDebounced.trim().length > 0;
        const debeUsarMunicipio = Boolean(municipio) && !hayComerciosEnMunicipio && esBusquedaManual && !usingSearch;
        let referencia: { lat: number; lon: number } | null = null;

        if (debeUsarMunicipio) {
          const municipioCoords = await fetchMunicipioCoords(municipio);
          if (municipioCoords) {
            referencia = municipioCoords;
          }
        }

        if (!referencia && location) {
          referencia = { lat: location.latitude, lon: location.longitude };
        }

        if (!referencia) {
          if (!cancelled) {
            setSuggestedItems([]);
            setSuggestionsTitle('');
            setSuggestionsSubtitle('');
          }
          return;
        }

        let cercanos = await fetchCercanosParaCoordenadas({
          latitud: referencia.lat,
          longitud: referencia.lon,
          radioKm: 15,
          categoriaId: selectedCategoryId,
          abiertoAhora: openNow ? true : null,
          incluirInactivos: false,
          limit: 10,
        });
        cercanos = await enrichSucursales(cercanos);

        if (cancelled) return;

        setSuggestedItems(cercanos.slice(0, 10));
        if (debeUsarMunicipio) {
          setSuggestionsTitle(
            t('listado.sugerenciaCercaDeMunicipio', {
              categoria: selectedCategoryLabel,
              municipio: municipio || t('listado.ubicacionDesconocida'),
            })
          );
          setSuggestionsSubtitle(t('listado.sugerenciaMostrando'));
        } else {
          setSuggestionsTitle(
            t('listado.sugerenciaCercaDeTi', {
              categoria: selectedCategoryLabel.toLowerCase(),
            })
          );
          setSuggestionsSubtitle('');
        }
      } catch {
        if (!cancelled) {
          setSuggestedItems([]);
          setSuggestionsTitle('');
          setSuggestionsSubtitle('');
        }
      } finally {
        if (!cancelled) {
          setLoadingSuggestions(false);
        }
      }
    };

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [
    enrichSucursales,
    error,
    filteredItems.length,
    loading,
    location,
    municipio,
    openNow,
    searchDebounced,
    selectedCategoryId,
    selectedCategoryLabel,
    esBusquedaManual,
    hayComerciosEnMunicipio,
    t,
  ]);

  useEffect(() => {
    if (order !== 'ubicacion') return;
    if (!location) return;
    if (filteredItems.length === 0) return;
    if (osrmRefiningRef.current) return;

    const candidatos = filteredItems
      .slice(0, 10)
      .filter((item) => Number.isFinite(Number(item.latitud)) && Number.isFinite(Number(item.longitud)));
    if (!candidatos.length) return;

    const key = `${location.latitude.toFixed(4)}:${location.longitude.toFixed(4)}:${candidatos
      .map((item) => Number(item.id))
      .join(',')}`;
    if (osrmLastKeyRef.current === key) return;
    osrmLastKeyRef.current = key;

    osrmRefiningRef.current = true;
    let cancelled = false;

    const refine = async () => {
      const updates = new Map<
        number,
        { distanciaKm: number; minutosEstimados: number; minutosCrudos: number; tiempoVehiculo: string; tiempoTexto: string }
      >();
      let requiresUpdate = false;

      for (const comercio of candidatos) {
        const id = Number(comercio.id);
        if (!Number.isFinite(id) || id <= 0) continue;

        let refined = osrmCacheRef.current.get(id);
        if (!refined) {
          const osrm = await getDrivingDistance(
            { lat: location.latitude, lng: location.longitude },
            { lat: Number(comercio.latitud), lng: Number(comercio.longitud) }
          );
          if (!osrm) continue;

          const distanciaKm = osrm.distancia / 1000;
          const minutos = Math.max(0, Math.round(osrm.duracion / 60));
          refined = {
            distanciaKm,
            minutos,
            tiempoTexto: formatTravelText(minutos, t),
          };
          osrmCacheRef.current.set(id, refined);
        }

        const distanciaOriginal = Number(comercio.distanciaKm);
        const delta =
          Number.isFinite(distanciaOriginal) && distanciaOriginal > 0
            ? Math.abs(refined.distanciaKm - distanciaOriginal) / distanciaOriginal
            : 1;

        if (delta > 0.15) {
          requiresUpdate = true;
          updates.set(id, {
            distanciaKm: refined.distanciaKm,
            minutosEstimados: refined.minutos,
            minutosCrudos: refined.minutos,
            tiempoVehiculo: refined.tiempoTexto,
            tiempoTexto: refined.tiempoTexto,
          });
        }
      }

      if (cancelled || !requiresUpdate || updates.size === 0) return;

      setItems((prev) =>
        prev.map((item) => {
          const update = updates.get(Number(item.id));
          if (!update) return item;
          return { ...item, ...update };
        })
      );
    };

    void refine().finally(() => {
      osrmRefiningRef.current = false;
    });

    return () => {
      cancelled = true;
    };
  }, [filteredItems, location, order, t]);

  const renderItems = filteredItems.length > 0 ? filteredItems : suggestedItems;

  const resultsText = useMemo(() => {
    const count = filteredItems.length;
    return t('listado.resultadosSinMunicipio', {
      n: count,
      categoria: selectedCategoryLabel,
    });
  }, [filteredItems.length, selectedCategoryLabel, t]);

  const emptyMessage = useMemo(() => {
    const categoria = selectedCategoryLabel.toLowerCase();
    const search = searchDebounced.trim();
    if (search.length > 0) {
      return t('listado.emptyBusqueda', { categoria, search });
    }
    if (esBusquedaManual) {
      return t('listado.emptyMunicipio', { categoria });
    }
    return t('listado.emptyUbicacion', { categoria });
  }, [esBusquedaManual, searchDebounced, selectedCategoryLabel, t]);

  const listRows = useMemo<ListRow[]>(() => {
    const rows: ListRow[] = [];
    let renderedRows = 0;

    for (let index = 0; index < renderItems.length; index += CARDS_PER_ROW) {
      const left = renderItems[index];
      const right = renderItems[index + 1];
      renderedRows += 1;

      rows.push({
        type: 'cards',
        key: `cards-${left.id}-${right?.id ?? 'empty'}`,
        left,
        right,
      });

      if (
        filteredItems.length > 0 &&
        banners.length > 0 &&
        renderedRows % BANNER_EVERY_ROWS === 0 &&
        index + CARDS_PER_ROW < renderItems.length
      ) {
        rows.push({
          type: 'banner',
          key: `banner-row-${renderedRows}-${index}`,
        });
      }
    }

    return rows;
  }, [banners.length, filteredItems.length, renderItems]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    pageOffsetRef.current = 0;
    setHasMore(false);
    await loadComercios({ append: false });
    await loadFavorites();
  }, [loadComercios, loadFavorites]);

  if (loading && items.length === 0) {
    return (
      <PublicAppChrome>
        {({ contentPaddingStyle }) => (
          <View style={[styles.stateWrap, contentPaddingStyle]}>
            <WebLoader message={t('listado.loadingComercios')} />
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
            <Pressable style={styles.retryButton} onPress={() => void loadComercios({ append: false })}>
              <Text style={styles.retryButtonText}>{t('listado.reintentar')}</Text>
            </Pressable>
          </View>
        )}
      </PublicAppChrome>
    );
  }

  return (
    <PublicAppChrome>
      {({ onScroll, scrollEventThrottle, contentPaddingStyle }) => (
        <View style={styles.screen}>
          <FlatList
            data={listRows}
            keyExtractor={(item) => item.key}
            onScroll={onScroll}
            scrollEventThrottle={scrollEventThrottle}
            contentContainerStyle={[styles.listContent, contentPaddingStyle]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
            ListHeaderComponent={
              <View>
                {banners.length > 0 ? <HomeCarousel items={banners} /> : null}

                <View style={styles.filtersSection}>
                  <Text style={styles.pageTitle}>{selectedCategoryLabel}</Text>

                  <View style={styles.filtersBox}>
                    <View style={styles.searchRow}>
                      <View style={styles.categoryIcon}>
                        <CategoryFilterIcon rawValue={categoryMeta?.iconRaw ?? null} fallback={selectedCategoryIcon} />
                      </View>
                      <TextInput
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholder={t('listado.buscarEn', { categoria: selectedCategoryLabel })}
                        placeholderTextColor="#9ca3af"
                        style={styles.searchInput}
                      />
                      <Ionicons name="search" size={18} color="#9ca3af" />
                    </View>

                    <View style={styles.selectsRow}>
                      <FilterSelect
                        label={t('listado.municipios')}
                        value={municipio}
                        placeholder={t('listado.municipios')}
                        options={municipalityOptions}
                        onChange={setMunicipio}
                        boxWidth={municipioSelectWidth}
                      />

                      <FilterSelect
                        label={subcategoriaFilterLabel}
                        value={subcategoria}
                        placeholder={t('listado.todas')}
                        options={subcategoryOptions}
                        onChange={setSubcategoria}
                        boxWidth={subcategoriaSelectWidth}
                      />

                      <FilterSelect
                        label={t('listado.ordenarPor')}
                        value={order}
                        placeholder={t('listado.ordenarPor')}
                        options={orderOptions}
                        onChange={(value) => {
                          void handleOrderChange(value);
                        }}
                        boxWidth={ordenSelectWidth}
                      />
                    </View>

                    <View style={styles.togglesRow}>
                      <FilterToggle label={t('listado.abierto')} value={openNow} color="#22c55e" onToggle={setOpenNow} />
                      <FilterToggle
                        label={t('listado.favoritos')}
                        value={favoritesOnly}
                        color="#ec4899"
                        onToggle={setFavoritesOnly}
                      />
                      <FilterToggle
                        label={t('listado.destacados')}
                        value={featuredFirst}
                        color="#facc15"
                        onToggle={setFeaturedFirst}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.resultsWrap}>
                  <Text style={styles.resultsText}>{resultsText}</Text>
                  {municipio && searchDebounced.trim().length === 0 ? (
                    <Pressable style={styles.municipioChip} onPress={() => setMunicipio('')}>
                      <Text style={styles.municipioChipClose}>×</Text>
                      <Text style={styles.municipioChipText}>{municipio}</Text>
                    </Pressable>
                  ) : null}
                </View>

                {loading || resolvingLocation ? <WebLoader compact message={t('listado.loadingComercios')} /> : null}
                {!loading && !error && filteredItems.length === 0 ? (
                  <View style={styles.suggestionsWrap}>
                    <Text style={styles.emptyMessageText}>{emptyMessage}</Text>
                    {loadingSuggestions ? <WebLoader compact message={t('listado.loadingCercanos')} /> : null}
                    {!loadingSuggestions && suggestionsTitle ? (
                      <Text style={styles.suggestionsTitle}>{suggestionsTitle}</Text>
                    ) : null}
                    {!loadingSuggestions && suggestionsSubtitle ? (
                      <Text style={styles.suggestionsSubtitle}>{suggestionsSubtitle}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            }
            renderItem={({ item }) =>
              item.type === 'banner' ? (
                <View style={styles.inlineBannerRow}>
                  <HomeCarousel items={banners} />
                </View>
              ) : (
                <View style={styles.gridRow}>
                  <View style={styles.cardCell}>
                    {item.left.activo === true ? (
                      <ComercioCard
                        item={item.left}
                        location={location}
                        isFavorite={favoriteIds.has(Number(item.left.id))}
                        onPress={() => {
                          router.push({ pathname: '/comercio/[id]', params: { id: String(item.left.id) } });
                        }}
                      />
                    ) : (
                      <ComercioCardNoActivo item={item.left} location={location} />
                    )}
                  </View>

                  <View style={styles.cardCell}>
                    {item.right ? (
                      item.right.activo === true ? (
                        <ComercioCard
                          item={item.right}
                          location={location}
                          isFavorite={favoriteIds.has(Number(item.right.id))}
                          onPress={() => {
                            router.push({ pathname: '/comercio/[id]', params: { id: String(item.right?.id) } });
                          }}
                        />
                      ) : (
                        <ComercioCardNoActivo item={item.right} location={location} />
                      )
                    ) : null}
                  </View>
                </View>
              )
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                {!loadingSuggestions && !suggestedItems.length ? (
                  <ScreenState message={t('listado.sinCercanos')} />
                ) : null}
              </View>
            }
            ListFooterComponent={
              hasMore ? (
                <View style={styles.showMoreWrap}>
                  <Pressable
                    style={styles.showMoreButton}
                    disabled={loadingMore}
                    onPress={() => {
                      if (loadingMore) return;
                      void loadComercios({ append: true });
                    }}
                  >
                    <Text style={styles.showMoreButtonText}>
                      {loadingMore ? t('listado.cargando') : t('listado.verSiguientes')}
                    </Text>
                  </Pressable>
                </View>
              ) : null
            }
          />
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
  stateWrap: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loaderWrap: {
    width: '100%',
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  loaderWrapCompact: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  loaderImage: {
    width: 64,
    height: 64,
  },
  loaderText: {
    color: '#6b7280',
    fontSize: 17,
    fontFamily: fonts.medium,
  },
  filtersSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  pageTitle: {
    textAlign: 'center',
    color: '#202022',
    fontSize: 28,
    fontFamily: fonts.medium,
    marginBottom: spacing.md,
  },
  filtersBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    padding: spacing.md,
    gap: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryIcon: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#111827',
    fontSize: 15,
    fontFamily: fonts.regular,
  },
  selectsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  selectBlock: {
    flexGrow: 0,
    flexShrink: 1,
  },
  selectLabel: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 16,
    fontFamily: fonts.medium,
  },
  selectLabelWrap: {
    minHeight: 34,
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  selectTrigger: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  selectChevronSlot: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectValue: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  selectValuePlaceholder: {
    color: '#9ca3af',
  },
  selectBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  selectSheet: {
    maxHeight: '60%',
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  selectOption: {
    minHeight: 46,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  selectOptionText: {
    color: '#111827',
    fontSize: 15,
    fontFamily: fonts.medium,
    textAlign: 'center',
    paddingHorizontal: 22,
  },
  selectOptionCheck: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  togglesRow: {
    marginTop: 0,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toggleWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  toggleLabelWrap: {
    minHeight: 38,
    justifyContent: 'flex-end',
  },
  toggleLabel: {
    textAlign: 'center',
    color: '#374151',
    fontSize: 14,
    lineHeight: 15,
    fontFamily: fonts.medium,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: borderRadius.pill,
    backgroundColor: '#d1d5db',
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.pill,
    backgroundColor: '#fff',
    transform: [{ translateX: 0 }],
  },
  toggleKnobOn: {
    transform: [{ translateX: 20 }],
  },
  resultsWrap: {
    marginTop: 2,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  resultsText: {
    color: '#1f2937',
    textAlign: 'center',
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  municipioChip: {
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#dbeafe',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  municipioChipClose: {
    color: '#3b82f6',
    fontSize: 16,
    lineHeight: 16,
    fontFamily: fonts.regular,
  },
  municipioChipText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  suggestionsWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  emptyMessageText: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: fonts.medium,
  },
  suggestionsTitle: {
    color: '#1f2937',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    marginTop: 2,
  },
  suggestionsSubtitle: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: fonts.regular,
    marginBottom: 2,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  gridRow: {
    paddingHorizontal: spacing.md,
    justifyContent: 'space-between',
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  inlineBannerRow: {
    marginBottom: spacing.sm,
  },
  cardCell: {
    width: '48.5%',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    minHeight: 336,
    height: 336,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  cardNoActivo: {
    backgroundColor: '#f3f4f6',
  },
  cardDisabled: {
    opacity: 0.9,
  },
  planHintBubble: {
    position: 'absolute',
    top: 8,
    left: 6,
    right: 6,
    zIndex: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  planHintClose: {
    position: 'absolute',
    right: 4,
    top: 2,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planHintCloseText: {
    color: '#6b7280',
    fontSize: 18,
    lineHeight: 18,
    fontFamily: fonts.light,
  },
  planHintIconWrap: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
    marginBottom: 4,
  },
  planHintTitle: {
    color: '#111827',
    fontSize: 13,
    lineHeight: 14,
    textAlign: 'center',
    fontFamily: fonts.semibold,
  },
  planHintBody: {
    color: '#4b5563',
    fontSize: 11,
    lineHeight: 13,
    textAlign: 'center',
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  cardTopImageWrap: {
    width: '100%',
    height: 80,
    backgroundColor: '#e5e7eb',
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
    overflow: 'hidden',
  },
  cardTopImage: {
    width: '100%',
    height: '100%',
  },
  favoriteBadge: {
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
  favoriteBadgeInner: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.pill,
    borderWidth: 2,
    borderColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLogoWrap: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.pill,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: '#fff',
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLogoWrapActive: {
    top: -40,
    zIndex: 20,
  },
  cardLogoWrapNoActivo: {
    top: -40,
    zIndex: 20,
  },
  cardLogo: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.pill,
  },
  cardLogoShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -17 },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 0,
  },
  cardNoActivoLogoWrap: {
    borderWidth: 0,
    backgroundColor: '#f3f4f6',
  },
  cardContentWrap: {
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
  cardBodyNoActivo: {
    paddingTop: 84,
    paddingHorizontal: 8,
    paddingBottom: 14,
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  cardContentWrapNoActivo: {
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
  cardNameBlockActive: {
    height: 52,
    width: '100%',
    position: 'relative',
    zIndex: 30,
    marginTop: 0,
  },
  cardNameInner: {
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
  cardNameInnerWithBranch: {
    bottom: 14,
  },
  cardNameBlock: {
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    position: 'relative',
  },
  cardTitleActive: {
    color: '#424242',
    fontSize: 19,
    lineHeight: 21,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontWeight: '400',
    zIndex: 30,
    position: 'relative',
  },
  cardTitleActiveSmall: {
    color: '#424242',
    fontSize: 17,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontWeight: '400',
    zIndex: 30,
    position: 'relative',
  },
  cardTitleWithoutBranch: {
    marginTop: 3,
  },
  cardTitleWithBranch: {
    marginTop: -4,
  },
  cardBranchText: {
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
  cardTitleNoActivo: {
    color: '#424242',
    fontSize: 19,
    lineHeight: 21,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontWeight: '400',
    zIndex: 30,
    marginTop: 3,
  },
  cardTitleNoActivoSmall: {
    color: '#424242',
    fontSize: 17,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontWeight: '400',
    zIndex: 30,
    marginTop: 3,
  },
  cardDisabledTag: {
    marginTop: 2,
    color: '#6b7280',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontFamily: fonts.semibold,
  },
  cardPhonePill: {
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
  cardPhonePillPressed: {
    opacity: 0.88,
  },
  cardPhoneText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 15,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  cardPhonePlaceholder: {
    minHeight: 30,
    marginTop: 0,
  },
  cardNoActivoPhoneRow: {
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
  cardNoActivoPhonePressed: {
    opacity: 0.7,
  },
  cardNoActivoPhoneText: {
    color: '#6b7280',
    fontSize: 15,
    lineHeight: 16,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  cardNoActivoPhonePlaceholder: {
    minHeight: 24,
    marginTop: 0,
  },
  cardNoActivoMetaText: {
    color: '#9c9c9c',
    fontSize: 14,
    maxWidth: 128,
    fontFamily: fonts.medium,
  },
  cardStatusRow: {
    marginTop: 6,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cardStatusText: {
    fontSize: 16,
    lineHeight: 18,
    fontFamily: fonts.regular,
    fontWeight: '400',
  },
  cardStatusOpen: {
    color: '#16a34a',
  },
  cardStatusClosed: {
    color: '#dc2626',
  },
  cardMetaRow: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 18,
    marginTop: 0,
  },
  cardPinIcon: {
    marginTop: 1,
  },
  cardMetaText: {
    color: '#3ea6c4',
    fontSize: 14,
    maxWidth: 128,
    fontFamily: fonts.medium,
  },
  cardMetaSoftText: {
    color: '#9c9c9c',
    fontSize: 14,
    maxWidth: 128,
    fontFamily: fonts.medium,
  },
  emptyWrap: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  showMoreWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  showMoreButton: {
    borderRadius: borderRadius.pill,
    backgroundColor: '#023047',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showMoreButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  retryButton: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontFamily: fonts.semibold,
  },
});
