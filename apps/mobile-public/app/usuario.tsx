import { calcularDistanciaHaversineKm, DEFAULT_APP_BASE_URLS } from '@findixi/shared';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PublicAppChrome } from '../src/components/layout/PublicAppChrome';
import { ScreenState } from '../src/components/ScreenState';
import { useI18n } from '../src/i18n/provider';
import type { I18nKey } from '../src/i18n/translations';
import { openExternalUrl } from '../src/lib/external-link';
import { requestUserLocation, type UserLocation } from '../src/lib/location';
import { supabase } from '../src/lib/supabase';
import { borderRadius, fonts, shadows, spacing } from '../src/theme/tokens';

type SessionSnapshot = {
  userId: string;
  email: string;
  createdAt: string;
};

type UserProfileSnapshot = {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  imagen: string;
  municipio: string;
  membresiaUp: boolean;
  notificarText: boolean;
  creadoEn: string;
};

type MunicipioOption = {
  id: number;
  nombre: string;
};

type CouponRaw = {
  idCupon: number;
  redimido: boolean;
};

type CouponView = {
  id: number;
  titulo: string;
  descripcion: string;
  comercio: string;
  redimido: boolean;
};

type FavoriteOrder = 'alfabetico' | 'recientes' | 'cercania';

type FavoriteBase = {
  id: number;
  nombre: string;
  municipioNombre: string;
  categoriaIds: string[];
  categorias: string[];
  latitud: number | null;
  longitud: number | null;
  creadoEn: string;
};

type FavoriteComercio = FavoriteBase & {
  logo: string;
};

type FavoriteLugar = FavoriteBase & {
  imagen: string;
};

type FavoritePlaya = FavoriteBase & {
  imagen: string;
};

type SelectOption = {
  value: string;
  label: string;
};

const PLACEHOLDER_FOTO = 'https://placehold.co/100x100?text=User';
const PLACEHOLDER_LOGO = 'https://placehold.co/60x60?text=Logo';
const PLACEHOLDER_LUGAR = 'https://placehold.co/120x80?text=Lugar';
const PLACEHOLDER_PLAYA = 'https://placehold.co/120x80?text=Playa';
const UP_LOGO_CLARO =
  'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/UpFondoClaro.png';

type UsuarioCopy = {
  locale: string;
  userFallbackName: string;
  municipioUnavailable: string;
  activeSince: string;
  loadingAccount: string;
  redirectingLogin: string;
  membershipActiveTitle: string;
  membershipActiveUntil: string;
  membershipFreeUntil: string;
  seeLess: string;
  seeMore: string;
  upCostLine: string;
  upBenefitCoupons: string;
  upBenefitDiscounts: string;
  upBenefitNotifications: string;
  becomeUpToday: string;
  noEmail: string;
  editProfile: string;
  quickActions: string;
  favoriteComercios: string;
  favoriteLugares: string;
  favoritePlayas: string;
  myCoupons: string;
  myOrders: string;
  processing: string;
  signOut: string;
  messagesEyebrow: string;
  notifications: string;
  noMessages: string;
  upModalTitle: string;
  upModalBody: string;
  upModalFine: string;
  becomeUpNow: string;
  close: string;
  fieldName: string;
  fieldLastName: string;
  fieldPhone: string;
  fieldMunicipio: string;
  municipalityEmpty: string;
  cancel: string;
  save: string;
  nameRequiredTitle: string;
  nameRequiredBody: string;
  myCouponsTitle: string;
  loadingCoupons: string;
  noCouponsYet: string;
  couponRedeemed: string;
  couponSaved: string;
  couponFallbackTitle: string;
  couponFallbackComercio: string;
  searchComercio: string;
  searchLugar: string;
  searchPlaya: string;
  filterMunicipio: string;
  filterCategoria: string;
  filterOrden: string;
  orderAlphabetical: string;
  orderRecent: string;
  orderNearby: string;
  loadingFavorites: string;
  noFavorites: string;
  favComerciosTitle: string;
  favLugaresTitle: string;
  favPlayasTitle: string;
  comercioNoName: string;
  lugarNoName: string;
  playaNoName: string;
  categoryPrefix: string;
  categorySwim: string;
  categorySurf: string;
  categorySnorkel: string;
  coastPrefix: string;
  alertDeleteFavoriteTitle: string;
  alertDeleteCommerceBody: (name: string) => string;
  alertDeleteLugarBody: (name: string) => string;
  alertDeletePlayaBody: (name: string) => string;
  delete: string;
  deleteErrorTitle: string;
  deleteCommerceError: string;
  deleteLugarError: string;
  deletePlayaError: string;
  errorLoadAccount: string;
  errorSignOut: string;
  errorSaveProfile: string;
  errorLoadCoupons: string;
  errorLoadFavComercios: string;
  errorLoadFavLugares: string;
  errorLoadFavPlayas: string;
};

type Translator = (key: I18nKey, params?: Record<string, string | number>) => string;

function buildUsuarioCopy(t: Translator, lang: string): UsuarioCopy {
  return {
    locale: lang === 'es' ? 'es-PR' : 'en-US',
    userFallbackName: t('usuario.userFallbackName'),
    municipioUnavailable: t('usuario.municipioUnavailable'),
    activeSince: t('usuario.activeSince'),
    loadingAccount: t('usuario.loadingAccount'),
    redirectingLogin: t('usuario.redirectingLogin'),
    membershipActiveTitle: t('usuario.membershipActiveTitle'),
    membershipActiveUntil: t('usuario.membershipActiveUntil'),
    membershipFreeUntil: t('usuario.membershipFreeUntil'),
    seeLess: t('usuario.seeLess'),
    seeMore: t('usuario.seeMore'),
    upCostLine: t('usuario.upCostLine'),
    upBenefitCoupons: t('usuario.upBenefitCoupons'),
    upBenefitDiscounts: t('usuario.upBenefitDiscounts'),
    upBenefitNotifications: t('usuario.upBenefitNotifications'),
    becomeUpToday: t('usuario.becomeUpToday'),
    noEmail: t('usuario.noEmail'),
    editProfile: t('usuario.editProfile'),
    quickActions: t('usuario.quickActions'),
    favoriteComercios: t('usuario.favoriteComercios'),
    favoriteLugares: t('usuario.favoriteLugares'),
    favoritePlayas: t('usuario.favoritePlayas'),
    myCoupons: t('usuario.myCoupons'),
    myOrders: t('usuario.myOrders'),
    processing: t('usuario.processing'),
    signOut: t('usuario.signOut'),
    messagesEyebrow: t('usuario.messagesEyebrow'),
    notifications: t('usuario.notifications'),
    noMessages: t('usuario.noMessages'),
    upModalTitle: t('usuario.upModalTitle'),
    upModalBody: t('usuario.upModalBody'),
    upModalFine: t('usuario.upModalFine'),
    becomeUpNow: t('usuario.becomeUpNow'),
    close: t('usuario.close'),
    fieldName: t('usuario.fieldName'),
    fieldLastName: t('usuario.fieldLastName'),
    fieldPhone: t('usuario.fieldPhone'),
    fieldMunicipio: t('usuario.fieldMunicipio'),
    municipalityEmpty: t('usuario.municipalityEmpty'),
    cancel: t('usuario.cancel'),
    save: t('usuario.save'),
    nameRequiredTitle: t('usuario.nameRequiredTitle'),
    nameRequiredBody: t('usuario.nameRequiredBody'),
    myCouponsTitle: t('usuario.myCouponsTitle'),
    loadingCoupons: t('usuario.loadingCoupons'),
    noCouponsYet: t('usuario.noCouponsYet'),
    couponRedeemed: t('usuario.couponRedeemed'),
    couponSaved: t('usuario.couponSaved'),
    couponFallbackTitle: t('usuario.couponFallbackTitle'),
    couponFallbackComercio: t('usuario.couponFallbackComercio'),
    searchComercio: t('usuario.searchComercio'),
    searchLugar: t('usuario.searchLugar'),
    searchPlaya: t('usuario.searchPlaya'),
    filterMunicipio: t('usuario.filterMunicipio'),
    filterCategoria: t('usuario.filterCategoria'),
    filterOrden: t('usuario.filterOrden'),
    orderAlphabetical: t('usuario.orderAlphabetical'),
    orderRecent: t('usuario.orderRecent'),
    orderNearby: t('usuario.orderNearby'),
    loadingFavorites: t('usuario.loadingFavorites'),
    noFavorites: t('usuario.noFavorites'),
    favComerciosTitle: t('usuario.favComerciosTitle'),
    favLugaresTitle: t('usuario.favLugaresTitle'),
    favPlayasTitle: t('usuario.favPlayasTitle'),
    comercioNoName: t('usuario.comercioNoName'),
    lugarNoName: t('usuario.lugarNoName'),
    playaNoName: t('usuario.playaNoName'),
    categoryPrefix: t('usuario.categoryPrefix'),
    categorySwim: t('usuario.categorySwim'),
    categorySurf: t('usuario.categorySurf'),
    categorySnorkel: t('usuario.categorySnorkel'),
    coastPrefix: t('usuario.coastPrefix'),
    alertDeleteFavoriteTitle: t('usuario.alertDeleteFavoriteTitle'),
    alertDeleteCommerceBody: (name) =>
      t('usuario.alertDeleteCommerceBody', { name: name || t('usuario.thisCommerce') }),
    alertDeleteLugarBody: (name) => t('usuario.alertDeleteLugarBody', { name: name || t('usuario.thisPlace') }),
    alertDeletePlayaBody: (name) => t('usuario.alertDeletePlayaBody', { name: name || t('usuario.thisBeach') }),
    delete: t('usuario.delete'),
    deleteErrorTitle: t('usuario.deleteErrorTitle'),
    deleteCommerceError: t('usuario.deleteCommerceError'),
    deleteLugarError: t('usuario.deleteLugarError'),
    deletePlayaError: t('usuario.deletePlayaError'),
    errorLoadAccount: t('usuario.errorLoadAccount'),
    errorSignOut: t('usuario.errorSignOut'),
    errorSaveProfile: t('usuario.errorSaveProfile'),
    errorLoadCoupons: t('usuario.errorLoadCoupons'),
    errorLoadFavComercios: t('usuario.errorLoadFavComercios'),
    errorLoadFavLugares: t('usuario.errorLoadFavLugares'),
    errorLoadFavPlayas: t('usuario.errorLoadFavPlayas'),
  };
}

function normalizeString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function normalizeSearch(value: unknown): string {
  return String(value || '').toLowerCase().trim();
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toMunicipioId(raw: string): number | null {
  const parsed = Number(String(raw ?? '').trim());
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return null;
}

function resolveMunicipioNombre(rawValue: string, options: MunicipioOption[], fallback = 'Municipio no disponible'): string {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return fallback;

  const numeric = toMunicipioId(raw);
  if (numeric) {
    const byId = options.find((item) => item.id === numeric);
    if (byId) return byId.nombre;
  }

  const lower = raw.toLowerCase();
  const byName = options.find((item) => item.nombre.toLowerCase() === lower);
  if (byName) return byName.nombre;

  return raw;
}

function normalizeProfile(record: Record<string, unknown> | null): UserProfileSnapshot | null {
  if (!record) return null;
  return {
    nombre: normalizeString(record.nombre),
    apellido: normalizeString(record.apellido),
    telefono: normalizeString(record.telefono),
    email: normalizeString(record.email),
    imagen: normalizeString(record.imagen),
    municipio: normalizeString(record.municipio),
    membresiaUp: toBoolean(record.membresiaUp),
    notificarText: toBoolean(record.notificartext),
    creadoEn: normalizeString(record.creado_en),
  };
}

function formatCreatedDate(raw: string, locale: string): string {
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatPhoneInput(raw: string): string {
  const digits = String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, 10);
  if (!digits) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function normalizedPhoneForStorage(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 10);
}

function uniqueSortedOptions(values: string[], locale = 'es'): SelectOption[] {
  return Array.from(new Set(values.filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, locale, { sensitivity: 'base' }))
    .map((label) => ({ value: label, label }));
}

function categoryOptionsFromFavorites(
  list: Array<{ categoriaIds: string[]; categorias: string[] }>,
  locale = 'es',
  categoryPrefix = 'Categoria'
): SelectOption[] {
  const map = new Map<string, string>();
  list.forEach((item) => {
    item.categoriaIds.forEach((id, index) => {
      const key = String(id ?? '').trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, normalizeString(item.categorias[index]) || `${categoryPrefix} ${key}`);
      }
    });
  });

  return Array.from(map.entries())
    .sort((a, b) => a[1].localeCompare(b[1], locale, { sensitivity: 'base' }))
    .map(([value, label]) => ({ value, label }));
}

function sortFavorites<T extends FavoriteBase>(
  list: T[],
  order: FavoriteOrder,
  userCoords: UserLocation | null
): T[] {
  const copy = [...list];

  if (order === 'alfabetico') {
    copy.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    return copy;
  }

  if (order === 'recientes') {
    copy.sort((a, b) => new Date(b.creadoEn || 0).getTime() - new Date(a.creadoEn || 0).getTime());
    return copy;
  }

  if (!userCoords) return copy;

  copy.sort((a, b) => {
    const distA =
      a.latitud != null && a.longitud != null
        ? calcularDistanciaHaversineKm(userCoords.latitude, userCoords.longitude, a.latitud, a.longitud)
        : Number.POSITIVE_INFINITY;
    const distB =
      b.latitud != null && b.longitud != null
        ? calcularDistanciaHaversineKm(userCoords.latitude, userCoords.longitude, b.latitud, b.longitud)
        : Number.POSITIVE_INFINITY;
    return distA - distB;
  });

  return copy;
}

type ModalSelectProps = {
  value: string;
  placeholder: string;
  options: SelectOption[];
  onChange: (value: string) => void;
};

function ModalSelect({ value, placeholder, options, onChange }: ModalSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Pressable style={styles.filterSelectTrigger} onPress={() => setOpen(true)}>
        <Text numberOfLines={1} style={[styles.filterSelectValue, !selected ? styles.filterSelectPlaceholder : null]}>
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#6b7280" />
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.selectBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.selectSheet} onPress={(event) => event.stopPropagation()}>
            <ScrollView style={styles.selectSheetList}>
              <Pressable
                style={styles.selectOption}
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <Text style={styles.selectOptionText}>{placeholder}</Text>
                {!value ? <Ionicons name="checkmark" size={16} color="#2563eb" /> : null}
              </Pressable>

              {options.map((option) => (
                <Pressable
                  key={`${option.value}-${option.label}`}
                  style={styles.selectOption}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.selectOptionText}>{option.label}</Text>
                  {value === option.value ? <Ionicons name="checkmark" size={16} color="#2563eb" /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default function UsuarioScreen() {
  const router = useRouter();
  const { lang, t } = useI18n();
  const copy = useMemo(() => buildUsuarioCopy(t, lang), [lang, t]);

  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [profile, setProfile] = useState<UserProfileSnapshot | null>(null);
  const [municipios, setMunicipios] = useState<MunicipioOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [redirectingToLogin, setRedirectingToLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [showUpgradeDetails, setShowUpgradeDetails] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editApellido, setEditApellido] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editMunicipio, setEditMunicipio] = useState('');

  const [couponsModalVisible, setCouponsModalVisible] = useState(false);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [couponsError, setCouponsError] = useState('');
  const [coupons, setCoupons] = useState<CouponView[]>([]);

  const [favoritesCoords, setFavoritesCoords] = useState<UserLocation | null>(null);

  const [comerciosFavModalVisible, setComerciosFavModalVisible] = useState(false);
  const [loadingFavComercios, setLoadingFavComercios] = useState(false);
  const [errorFavComercios, setErrorFavComercios] = useState('');
  const [favoriteComercios, setFavoriteComercios] = useState<FavoriteComercio[]>([]);
  const [searchFavComercios, setSearchFavComercios] = useState('');
  const [municipioFavComercios, setMunicipioFavComercios] = useState('');
  const [categoriaFavComercios, setCategoriaFavComercios] = useState('');
  const [orderFavComercios, setOrderFavComercios] = useState<FavoriteOrder>('alfabetico');

  const [lugaresFavModalVisible, setLugaresFavModalVisible] = useState(false);
  const [loadingFavLugares, setLoadingFavLugares] = useState(false);
  const [errorFavLugares, setErrorFavLugares] = useState('');
  const [favoriteLugares, setFavoriteLugares] = useState<FavoriteLugar[]>([]);
  const [searchFavLugares, setSearchFavLugares] = useState('');
  const [municipioFavLugares, setMunicipioFavLugares] = useState('');
  const [categoriaFavLugares, setCategoriaFavLugares] = useState('');
  const [orderFavLugares, setOrderFavLugares] = useState<FavoriteOrder>('alfabetico');

  const [playasFavModalVisible, setPlayasFavModalVisible] = useState(false);
  const [loadingFavPlayas, setLoadingFavPlayas] = useState(false);
  const [errorFavPlayas, setErrorFavPlayas] = useState('');
  const [favoritePlayas, setFavoritePlayas] = useState<FavoritePlaya[]>([]);
  const [searchFavPlayas, setSearchFavPlayas] = useState('');
  const [municipioFavPlayas, setMunicipioFavPlayas] = useState('');
  const [categoriaFavPlayas, setCategoriaFavPlayas] = useState('');
  const [orderFavPlayas, setOrderFavPlayas] = useState<FavoriteOrder>('alfabetico');

  const avatarSource = useMemo(() => {
    const uri = normalizeString(profile?.imagen);
    if (!uri) return { uri: PLACEHOLDER_FOTO };
    return { uri };
  }, [profile?.imagen]);

  const nombreCompleto = useMemo(() => {
    const nombre = normalizeString(profile?.nombre);
    const apellido = normalizeString(profile?.apellido);
    const full = `${nombre} ${apellido}`.trim();
    if (full) return full;
    if (session?.email) return session.email;
    return copy.userFallbackName;
  }, [copy.userFallbackName, profile?.apellido, profile?.nombre, session?.email]);

  const municipioTexto = useMemo(
    () => resolveMunicipioNombre(profile?.municipio ?? '', municipios, copy.municipioUnavailable),
    [copy.municipioUnavailable, municipios, profile?.municipio]
  );

  const createdText = useMemo(() => {
    const profileDate = normalizeString(profile?.creadoEn);
    if (profileDate) return formatCreatedDate(profileDate, copy.locale);
    return formatCreatedDate(session?.createdAt ?? '', copy.locale);
  }, [copy.locale, profile?.creadoEn, session?.createdAt]);

  const ensureFavoritesLocation = useCallback(async (): Promise<UserLocation | null> => {
    if (favoritesCoords) return favoritesCoords;
    const location = await requestUserLocation();
    if (location) {
      setFavoritesCoords(location);
      return location;
    }
    return null;
  }, [favoritesCoords]);

  const maybeLoadSortLocation = useCallback(async () => {
    if (
      orderFavComercios === 'cercania' ||
      orderFavLugares === 'cercania' ||
      orderFavPlayas === 'cercania'
    ) {
      await ensureFavoritesLocation();
    }
  }, [ensureFavoritesLocation, orderFavComercios, orderFavLugares, orderFavPlayas]);

  const openUpgradeUrl = useCallback(() => {
    void openExternalUrl(`${DEFAULT_APP_BASE_URLS.public}/upgradeUp.html`, {
      loggerTag: 'mobile-public/usuario',
    });
  }, []);

  const loadSession = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const current = sessionData.session?.user;
      if (!current) {
        setSession(null);
        setProfile(null);
        setRedirectingToLogin(true);
        router.replace('/login?redirect=/usuario' as never);
        return;
      }

      setSession({
        userId: current.id,
        email: normalizeString(current.email),
        createdAt: normalizeString(current.created_at),
      });

      const [profileResult, municipiosResult] = await Promise.all([
        supabase
          .from('usuarios')
          .select('nombre,apellido,telefono,email,imagen,creado_en,municipio,notificartext,membresiaUp')
          .eq('id', current.id)
          .maybeSingle(),
        supabase.from('Municipios').select('id,nombre').order('nombre', { ascending: true }),
      ]);

      const municipioRows = Array.isArray(municipiosResult.data) ? municipiosResult.data : [];
      const municipioOptions = municipioRows
        .map((row) => ({
          id: Number((row as { id?: number | string | null }).id ?? 0),
          nombre: normalizeString((row as { nombre?: string | null }).nombre),
        }))
        .filter((row) => Number.isFinite(row.id) && row.id > 0 && row.nombre.length > 0);
      setMunicipios(municipioOptions);

      if (profileResult.error) {
        console.warn('[mobile-public] No se pudo cargar perfil de usuario:', profileResult.error.message);
      }

      const normalized = normalizeProfile((profileResult.data as Record<string, unknown> | null) ?? null);

      if (!normalized) {
        const fallback: UserProfileSnapshot = {
          nombre: '',
          apellido: '',
          telefono: '',
          email: normalizeString(current.email),
          imagen: '',
          municipio: '',
          membresiaUp: false,
          notificarText: true,
          creadoEn: normalizeString(current.created_at),
        };
        setProfile(fallback);

        const { error: upsertError } = await supabase
          .from('usuarios')
          .upsert([{ id: current.id, email: fallback.email, creado_en: fallback.creadoEn }], { onConflict: 'id' });
        if (upsertError) {
          console.warn('[mobile-public] No se pudo crear perfil inicial:', upsertError.message);
        }
      } else {
        if (!normalized.email) {
          normalized.email = normalizeString(current.email);
        }
        if (!normalized.creadoEn) {
          normalized.creadoEn = normalizeString(current.created_at);
        }
        setProfile(normalized);
      }

      setRedirectingToLogin(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorLoadAccount);
    } finally {
      setLoading(false);
    }
  }, [copy.errorLoadAccount, router]);

  useFocusEffect(
    useCallback(() => {
      void loadSession();
    }, [loadSession])
  );

  const signOut = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setSession(null);
      setProfile(null);
      router.replace('/login?redirect=/usuario' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorSignOut);
    } finally {
      setBusy(false);
    }
  }, [copy.errorSignOut, router]);

  const openEditModal = useCallback(() => {
    setEditNombre(normalizeString(profile?.nombre));
    setEditApellido(normalizeString(profile?.apellido));
    setEditTelefono(formatPhoneInput(normalizeString(profile?.telefono)));
    setEditMunicipio(normalizeString(profile?.municipio));
    setEditModalVisible(true);
  }, [profile?.apellido, profile?.municipio, profile?.nombre, profile?.telefono]);

  const saveProfile = useCallback(async () => {
    if (!session?.userId) return;

    const nombre = normalizeString(editNombre);
    if (!nombre) {
      Alert.alert(copy.nameRequiredTitle, copy.nameRequiredBody);
      return;
    }

    setBusy(true);
    setError('');

    try {
      const payload = {
        nombre,
        apellido: normalizeString(editApellido),
        telefono: normalizedPhoneForStorage(editTelefono),
        municipio: normalizeString(editMunicipio),
      };

      const { error: updateError } = await supabase.from('usuarios').update(payload).eq('id', session.userId);
      if (updateError) throw updateError;

      setProfile((prev) => {
        const current =
          prev ??
          ({
            nombre: '',
            apellido: '',
            telefono: '',
            email: session.email,
            imagen: '',
            municipio: '',
            membresiaUp: false,
            notificarText: true,
            creadoEn: session.createdAt,
          } as UserProfileSnapshot);

        return {
          ...current,
          nombre: payload.nombre,
          apellido: payload.apellido,
          telefono: payload.telefono,
          municipio: payload.municipio,
        };
      });

      setEditModalVisible(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.errorSaveProfile);
    } finally {
      setBusy(false);
    }
  }, [
    copy.errorSaveProfile,
    copy.nameRequiredBody,
    copy.nameRequiredTitle,
    editApellido,
    editMunicipio,
    editNombre,
    editTelefono,
    session?.createdAt,
    session?.email,
    session?.userId,
  ]);

  const loadCoupons = useCallback(async () => {
    if (!session?.userId) return;

    setLoadingCoupons(true);
    setCouponsError('');
    setCoupons([]);

    try {
      const { data: userCoupons, error: userCouponsError } = await supabase
        .from('cuponesUsuarios')
        .select('idCupon,redimido')
        .eq('idUsuario', session.userId);

      if (userCouponsError) throw userCouponsError;

      const normalizedUserCoupons: CouponRaw[] = (Array.isArray(userCoupons) ? userCoupons : [])
        .map((row) => ({
          idCupon: Number((row as { idCupon?: number | string | null }).idCupon ?? 0),
          redimido: toBoolean((row as { redimido?: unknown }).redimido),
        }))
        .filter((row) => Number.isFinite(row.idCupon) && row.idCupon > 0);

      if (normalizedUserCoupons.length === 0) {
        setCoupons([]);
        return;
      }

      const couponIds = Array.from(new Set(normalizedUserCoupons.map((row) => row.idCupon)));
      const { data: couponsData, error: couponsDataError } = await supabase
        .from('cupones')
        .select('id,titulo,descripcion,idComercio')
        .in('id', couponIds);

      if (couponsDataError) throw couponsDataError;

      const couponsRows = Array.isArray(couponsData) ? couponsData : [];
      const comercioIds = Array.from(
        new Set(
          couponsRows
            .map((row) => Number((row as { idComercio?: number | string | null }).idComercio ?? 0))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      );

      let comerciosById = new Map<number, string>();
      if (comercioIds.length > 0) {
        const { data: comerciosData, error: comerciosError } = await supabase
          .from('Comercios')
          .select('id,nombre')
          .in('id', comercioIds);

        if (!comerciosError && Array.isArray(comerciosData)) {
          const entries: Array<[number, string]> = [];
          comerciosData.forEach((row) => {
            const id = Number((row as { id?: number | string | null }).id ?? 0);
            const nombre = normalizeString((row as { nombre?: string | null }).nombre);
            if (Number.isFinite(id) && id > 0 && nombre.length > 0) {
              entries.push([id, nombre]);
            }
          });
          comerciosById = new Map<number, string>(entries);
        }
      }

      const userCouponMap = new Map<number, CouponRaw>();
      normalizedUserCoupons.forEach((item) => {
        if (!userCouponMap.has(item.idCupon)) userCouponMap.set(item.idCupon, item);
      });

      const mapped: CouponView[] = couponsRows
        .map((row) => {
          const id = Number((row as { id?: number | string | null }).id ?? 0);
          if (!Number.isFinite(id) || id <= 0) return null;

          const userRow = userCouponMap.get(id);
          const comercioId = Number((row as { idComercio?: number | string | null }).idComercio ?? 0);

          return {
            id,
            titulo: normalizeString((row as { titulo?: string | null }).titulo) || copy.couponFallbackTitle,
            descripcion: normalizeString((row as { descripcion?: string | null }).descripcion),
            comercio: comerciosById.get(comercioId) || copy.couponFallbackComercio,
            redimido: Boolean(userRow?.redimido),
          } as CouponView;
        })
        .filter((item): item is CouponView => Boolean(item));

      setCoupons(mapped);
    } catch (loadError) {
      setCouponsError(loadError instanceof Error ? loadError.message : copy.errorLoadCoupons);
    } finally {
      setLoadingCoupons(false);
    }
  }, [copy.couponFallbackComercio, copy.couponFallbackTitle, copy.errorLoadCoupons, session?.userId]);

  const loadFavoriteComercios = useCallback(async () => {
    if (!session?.userId) return;

    setLoadingFavComercios(true);
    setErrorFavComercios('');

    try {
      const { data, error: fetchError } = await supabase
        .from('favoritosusuarios')
        .select(
          `idcomercio,creado_en,Comercios(id,nombre,municipio,idMunicipio,latitud,longitud)`
        )
        .eq('idusuario', session.userId)
        .order('creado_en', { ascending: false });

      if (fetchError) throw fetchError;

      const rawRows = Array.isArray(data) ? data : [];
      if (rawRows.length === 0) {
        setFavoriteComercios([]);
        return;
      }

      const comercioIds = Array.from(
        new Set(
          rawRows
            .map((row) => Number((row as { idcomercio?: number | string | null }).idcomercio ?? 0))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      );

      let categoriasByComercio = new Map<number, { ids: string[]; nombres: string[] }>();
      if (comercioIds.length > 0) {
        const { data: categoriasRows, error: categoriasError } = await supabase
          .from('ComercioCategorias')
          .select('idComercio,idCategoria,Categorias(id,nombre)')
          .in('idComercio', comercioIds);

        if (!categoriasError && Array.isArray(categoriasRows)) {
          categoriasRows.forEach((row) => {
            const comercioId = Number((row as { idComercio?: number | string | null }).idComercio ?? 0);
            const categoriaId = normalizeString((row as { idCategoria?: number | string | null }).idCategoria);
            const categoriaField = (row as { Categorias?: unknown }).Categorias;
            const categoriaObj = Array.isArray(categoriaField) ? categoriaField[0] : categoriaField;
            const categoriaNombre = normalizeString((categoriaObj as { nombre?: string | null } | null)?.nombre);

            if (!Number.isFinite(comercioId) || comercioId <= 0 || !categoriaId) return;

            const current = categoriasByComercio.get(comercioId) ?? { ids: [], nombres: [] };
            if (!current.ids.includes(categoriaId)) {
              current.ids.push(categoriaId);
              current.nombres.push(categoriaNombre || `${copy.categoryPrefix} ${categoriaId}`);
            }
            categoriasByComercio.set(comercioId, current);
          });
        }
      }

      let logosByComercio = new Map<number, string>();
      if (comercioIds.length > 0) {
        const { data: logoRows, error: logoError } = await supabase
          .from('imagenesComercios')
          .select('idComercio,imagen')
          .in('idComercio', comercioIds)
          .eq('logo', true);

        if (!logoError && Array.isArray(logoRows)) {
          logoRows.forEach((row) => {
            const comercioId = Number((row as { idComercio?: number | string | null }).idComercio ?? 0);
            const imagenRaw = normalizeString((row as { imagen?: string | null }).imagen);
            if (!Number.isFinite(comercioId) || comercioId <= 0 || !imagenRaw) return;

            if (/^https?:\/\//i.test(imagenRaw)) {
              logosByComercio.set(comercioId, imagenRaw);
              return;
            }

            const { data: publicData } = supabase.storage.from('galeriacomercios').getPublicUrl(imagenRaw);
            logosByComercio.set(comercioId, publicData?.publicUrl || PLACEHOLDER_LOGO);
          });
        }
      }

      const mapped: FavoriteComercio[] = rawRows
        .map((row) => {
          const rowRecord = row as Record<string, unknown>;
          const rel = Array.isArray(rowRecord.Comercios) ? rowRecord.Comercios[0] : rowRecord.Comercios;
          const comercio = (rel as Record<string, unknown> | undefined) ?? null;
          if (!comercio) return null;

          const id = Number(comercio.id ?? rowRecord.idcomercio ?? 0);
          if (!Number.isFinite(id) || id <= 0) return null;

          const municipioRaw = normalizeString(comercio.idMunicipio ?? comercio.municipio);
          const municipioNombre = resolveMunicipioNombre(municipioRaw, municipios, copy.municipioUnavailable);
          const categoriaInfo = categoriasByComercio.get(id) ?? { ids: [], nombres: [] };

          return {
            id,
            nombre: normalizeString(comercio.nombre) || copy.comercioNoName,
            municipioNombre,
            categoriaIds: categoriaInfo.ids,
            categorias: categoriaInfo.nombres,
            latitud: toFiniteNumber(comercio.latitud),
            longitud: toFiniteNumber(comercio.longitud),
            creadoEn: normalizeString(rowRecord.creado_en),
            logo: logosByComercio.get(id) || PLACEHOLDER_LOGO,
          } satisfies FavoriteComercio;
        })
        .filter((item): item is FavoriteComercio => Boolean(item));

      setFavoriteComercios(mapped);
      setSearchFavComercios('');
      setMunicipioFavComercios('');
      setCategoriaFavComercios('');
      setOrderFavComercios('alfabetico');
    } catch (loadError) {
      setErrorFavComercios(loadError instanceof Error ? loadError.message : copy.errorLoadFavComercios);
      setFavoriteComercios([]);
    } finally {
      setLoadingFavComercios(false);
    }
  }, [
    copy.categoryPrefix,
    copy.comercioNoName,
    copy.errorLoadFavComercios,
    copy.municipioUnavailable,
    municipios,
    session?.userId,
  ]);

  const loadFavoriteLugares = useCallback(async () => {
    if (!session?.userId) return;

    setLoadingFavLugares(true);
    setErrorFavLugares('');

    try {
      const { data, error: fetchError } = await supabase
        .from('favoritosLugares')
        .select(
          `id,creado_en,idlugar,LugaresTuristicos(id,nombre,municipio,activo,imagen,latitud,longitud)`
        )
        .eq('idusuario', session.userId)
        .order('creado_en', { ascending: false });

      if (fetchError) throw fetchError;

      const rawRows = Array.isArray(data) ? data : [];
      const activeRows = rawRows.filter((row) => {
        const rel = (row as Record<string, unknown>).LugaresTuristicos;
        const lugar = (Array.isArray(rel) ? rel[0] : rel) as Record<string, unknown> | undefined;
        if (!lugar) return false;
        return toBoolean(lugar.activo) || lugar.activo === undefined || lugar.activo === null;
      });

      if (activeRows.length === 0) {
        setFavoriteLugares([]);
        return;
      }

      const lugarIds = Array.from(
        new Set(
          activeRows
            .map((row) => {
              const rel = (row as Record<string, unknown>).LugaresTuristicos;
              const lugar = (Array.isArray(rel) ? rel[0] : rel) as Record<string, unknown> | undefined;
              return Number(lugar?.id ?? (row as Record<string, unknown>).idlugar ?? 0);
            })
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      );

      let categoriasByLugar = new Map<number, { ids: string[]; nombres: string[] }>();
      if (lugarIds.length > 0) {
        const { data: categoriasRows, error: categoriasError } = await supabase
          .from('lugarCategoria')
          .select('idLugar,categoria:categoriaLugares(id,nombre)')
          .in('idLugar', lugarIds);

        if (!categoriasError && Array.isArray(categoriasRows)) {
          categoriasRows.forEach((row) => {
            const lugarId = Number((row as { idLugar?: number | string | null }).idLugar ?? 0);
            if (!Number.isFinite(lugarId) || lugarId <= 0) return;

            const categoriaField = (row as { categoria?: unknown }).categoria;
            const categorias = Array.isArray(categoriaField) ? categoriaField : [categoriaField];
            const current = categoriasByLugar.get(lugarId) ?? { ids: [], nombres: [] };

            categorias.forEach((entry) => {
              const categoriaId = normalizeString((entry as { id?: number | string | null } | null)?.id);
              const categoriaNombre = normalizeString((entry as { nombre?: string | null } | null)?.nombre);
              if (!categoriaId) return;
              if (!current.ids.includes(categoriaId)) {
                current.ids.push(categoriaId);
                current.nombres.push(categoriaNombre || `${copy.categoryPrefix} ${categoriaId}`);
              }
            });

            categoriasByLugar.set(lugarId, current);
          });
        }
      }

      const mapped: FavoriteLugar[] = activeRows
        .map((row) => {
          const rowRecord = row as Record<string, unknown>;
          const rel = Array.isArray(rowRecord.LugaresTuristicos) ? rowRecord.LugaresTuristicos[0] : rowRecord.LugaresTuristicos;
          const lugar = (rel as Record<string, unknown> | undefined) ?? null;
          if (!lugar) return null;

          const id = Number(lugar.id ?? rowRecord.idlugar ?? 0);
          if (!Number.isFinite(id) || id <= 0) return null;

          const municipioNombre = resolveMunicipioNombre(normalizeString(lugar.municipio), municipios, copy.municipioUnavailable);
          const categoriaInfo = categoriasByLugar.get(id) ?? { ids: [], nombres: [] };

          return {
            id,
            nombre: normalizeString(lugar.nombre) || copy.lugarNoName,
            municipioNombre,
            categoriaIds: categoriaInfo.ids,
            categorias: categoriaInfo.nombres,
            latitud: toFiniteNumber(lugar.latitud),
            longitud: toFiniteNumber(lugar.longitud),
            creadoEn: normalizeString(rowRecord.creado_en),
            imagen: normalizeString(lugar.imagen) || PLACEHOLDER_LUGAR,
          } satisfies FavoriteLugar;
        })
        .filter((item): item is FavoriteLugar => Boolean(item));

      setFavoriteLugares(mapped);
      setSearchFavLugares('');
      setMunicipioFavLugares('');
      setCategoriaFavLugares('');
      setOrderFavLugares('alfabetico');
    } catch (loadError) {
      setErrorFavLugares(loadError instanceof Error ? loadError.message : copy.errorLoadFavLugares);
      setFavoriteLugares([]);
    } finally {
      setLoadingFavLugares(false);
    }
  }, [
    copy.categoryPrefix,
    copy.errorLoadFavLugares,
    copy.lugarNoName,
    copy.municipioUnavailable,
    municipios,
    session?.userId,
  ]);

  const loadFavoritePlayas = useCallback(async () => {
    if (!session?.userId) return;

    setLoadingFavPlayas(true);
    setErrorFavPlayas('');

    try {
      const { data, error: fetchError } = await supabase
        .from('favoritosPlayas')
        .select(
          `id,creado_en,idplaya,playa:playas(id,nombre,municipio,activo,imagen,latitud,longitud,costa,nadar,surfear,snorkeling)`
        )
        .eq('idusuario', session.userId)
        .order('creado_en', { ascending: false });

      if (fetchError) throw fetchError;

      const rawRows = Array.isArray(data) ? data : [];
      const activeRows = rawRows.filter((row) => {
        const playaRel = (row as Record<string, unknown>).playa;
        const playa = (Array.isArray(playaRel) ? playaRel[0] : playaRel) as Record<string, unknown> | undefined;
        if (!playa) return false;
        if (playa.activo === false) return false;
        return true;
      });

      const mapped: FavoritePlaya[] = activeRows
        .map((row) => {
          const rowRecord = row as Record<string, unknown>;
          const playaRel = Array.isArray(rowRecord.playa) ? rowRecord.playa[0] : rowRecord.playa;
          const playa = (playaRel as Record<string, unknown> | undefined) ?? null;
          if (!playa) return null;

          const id = Number(playa.id ?? rowRecord.idplaya ?? 0);
          if (!Number.isFinite(id) || id <= 0) return null;

          const categorias: string[] = [];
          const categoriaIds: string[] = [];

          const costa = normalizeString(playa.costa);
          if (costa) {
            categorias.push(`${copy.coastPrefix} ${costa}`);
            categoriaIds.push(`costa-${costa}`);
          }
          if (toBoolean(playa.nadar)) {
            categorias.push(copy.categorySwim);
            categoriaIds.push('nadar');
          }
          if (toBoolean(playa.surfear)) {
            categorias.push(copy.categorySurf);
            categoriaIds.push('surfear');
          }
          if (toBoolean(playa.snorkeling)) {
            categorias.push(copy.categorySnorkel);
            categoriaIds.push('snorkeling');
          }

          return {
            id,
            nombre: normalizeString(playa.nombre) || copy.playaNoName,
            municipioNombre: resolveMunicipioNombre(
              normalizeString(playa.municipio),
              municipios,
              copy.municipioUnavailable
            ),
            categoriaIds,
            categorias,
            latitud: toFiniteNumber(playa.latitud),
            longitud: toFiniteNumber(playa.longitud),
            creadoEn: normalizeString(rowRecord.creado_en),
            imagen: normalizeString(playa.imagen) || PLACEHOLDER_PLAYA,
          } satisfies FavoritePlaya;
        })
        .filter((item): item is FavoritePlaya => Boolean(item));

      setFavoritePlayas(mapped);
      setSearchFavPlayas('');
      setMunicipioFavPlayas('');
      setCategoriaFavPlayas('');
      setOrderFavPlayas('alfabetico');
    } catch (loadError) {
      setErrorFavPlayas(loadError instanceof Error ? loadError.message : copy.errorLoadFavPlayas);
      setFavoritePlayas([]);
    } finally {
      setLoadingFavPlayas(false);
    }
  }, [
    copy.categorySnorkel,
    copy.categorySurf,
    copy.categorySwim,
    copy.coastPrefix,
    copy.errorLoadFavPlayas,
    copy.municipioUnavailable,
    copy.playaNoName,
    municipios,
    session?.userId,
  ]);

  const openCouponsModal = useCallback(() => {
    setCouponsModalVisible(true);
    void loadCoupons();
  }, [loadCoupons]);

  const openComerciosFavoritos = useCallback(() => {
    setComerciosFavModalVisible(true);
    void maybeLoadSortLocation();
    void loadFavoriteComercios();
  }, [loadFavoriteComercios, maybeLoadSortLocation]);

  const openLugaresFavoritos = useCallback(() => {
    setLugaresFavModalVisible(true);
    void maybeLoadSortLocation();
    void loadFavoriteLugares();
  }, [loadFavoriteLugares, maybeLoadSortLocation]);

  const openPlayasFavoritas = useCallback(() => {
    setPlayasFavModalVisible(true);
    void maybeLoadSortLocation();
    void loadFavoritePlayas();
  }, [loadFavoritePlayas, maybeLoadSortLocation]);

  const openPedidos = useCallback(() => {
    router.push('/pedidos');
  }, [router]);

  const removeFavoriteComercio = useCallback(
    async (idComercio: number, nombre: string) => {
      if (!session?.userId) return;

      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(copy.alertDeleteFavoriteTitle, copy.alertDeleteCommerceBody(nombre), [
          { text: copy.cancel, style: 'cancel', onPress: () => resolve(false) },
          { text: copy.delete, style: 'destructive', onPress: () => resolve(true) },
        ]);
      });

      if (!confirmed) return;

      const { error: deleteError } = await supabase
        .from('favoritosusuarios')
        .delete()
        .eq('idusuario', session.userId)
        .eq('idcomercio', idComercio);

      if (deleteError) {
        Alert.alert(copy.deleteErrorTitle, copy.deleteCommerceError);
        return;
      }

      setFavoriteComercios((prev) => prev.filter((item) => item.id !== idComercio));
    },
    [
      copy.alertDeleteCommerceBody,
      copy.alertDeleteFavoriteTitle,
      copy.cancel,
      copy.delete,
      copy.deleteCommerceError,
      copy.deleteErrorTitle,
      session?.userId,
    ]
  );

  const removeFavoriteLugar = useCallback(
    async (idLugar: number, nombre: string) => {
      if (!session?.userId) return;

      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(copy.alertDeleteFavoriteTitle, copy.alertDeleteLugarBody(nombre), [
          { text: copy.cancel, style: 'cancel', onPress: () => resolve(false) },
          { text: copy.delete, style: 'destructive', onPress: () => resolve(true) },
        ]);
      });

      if (!confirmed) return;

      const { error: deleteError } = await supabase
        .from('favoritosLugares')
        .delete()
        .eq('idusuario', session.userId)
        .eq('idlugar', idLugar);

      if (deleteError) {
        Alert.alert(copy.deleteErrorTitle, copy.deleteLugarError);
        return;
      }

      setFavoriteLugares((prev) => prev.filter((item) => item.id !== idLugar));
    },
    [
      copy.alertDeleteFavoriteTitle,
      copy.alertDeleteLugarBody,
      copy.cancel,
      copy.delete,
      copy.deleteErrorTitle,
      copy.deleteLugarError,
      session?.userId,
    ]
  );

  const removeFavoritePlaya = useCallback(
    async (idPlaya: number, nombre: string) => {
      if (!session?.userId) return;

      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(copy.alertDeleteFavoriteTitle, copy.alertDeletePlayaBody(nombre), [
          { text: copy.cancel, style: 'cancel', onPress: () => resolve(false) },
          { text: copy.delete, style: 'destructive', onPress: () => resolve(true) },
        ]);
      });

      if (!confirmed) return;

      const { error: deleteError } = await supabase
        .from('favoritosPlayas')
        .delete()
        .eq('idusuario', session.userId)
        .eq('idplaya', idPlaya);

      if (deleteError) {
        Alert.alert(copy.deleteErrorTitle, copy.deletePlayaError);
        return;
      }

      setFavoritePlayas((prev) => prev.filter((item) => item.id !== idPlaya));
    },
    [
      copy.alertDeleteFavoriteTitle,
      copy.alertDeletePlayaBody,
      copy.cancel,
      copy.delete,
      copy.deleteErrorTitle,
      copy.deletePlayaError,
      session?.userId,
    ]
  );

  const comercioMunicipioOptions = useMemo(
    () => uniqueSortedOptions(favoriteComercios.map((item) => item.municipioNombre), copy.locale),
    [copy.locale, favoriteComercios]
  );
  const comercioCategoriaOptions = useMemo(
    () => categoryOptionsFromFavorites(favoriteComercios, copy.locale, copy.categoryPrefix),
    [copy.categoryPrefix, copy.locale, favoriteComercios]
  );

  const lugarMunicipioOptions = useMemo(
    () => uniqueSortedOptions(favoriteLugares.map((item) => item.municipioNombre), copy.locale),
    [copy.locale, favoriteLugares]
  );
  const lugarCategoriaOptions = useMemo(
    () => categoryOptionsFromFavorites(favoriteLugares, copy.locale, copy.categoryPrefix),
    [copy.categoryPrefix, copy.locale, favoriteLugares]
  );

  const playaMunicipioOptions = useMemo(
    () => uniqueSortedOptions(favoritePlayas.map((item) => item.municipioNombre), copy.locale),
    [copy.locale, favoritePlayas]
  );
  const playaCategoriaOptions = useMemo(
    () => categoryOptionsFromFavorites(favoritePlayas, copy.locale, copy.categoryPrefix),
    [copy.categoryPrefix, copy.locale, favoritePlayas]
  );

  const orderOptions: SelectOption[] = useMemo(
    () => [
      { value: 'alfabetico', label: copy.orderAlphabetical },
      { value: 'recientes', label: copy.orderRecent },
      { value: 'cercania', label: copy.orderNearby },
    ],
    [copy.orderAlphabetical, copy.orderNearby, copy.orderRecent]
  );

  const favoriteComerciosView = useMemo(() => {
    const search = normalizeSearch(searchFavComercios);
    const filtered = favoriteComercios.filter((item) => {
      const byName = !search || normalizeSearch(item.nombre).includes(search);
      const byMunicipio = !municipioFavComercios || item.municipioNombre === municipioFavComercios;
      const byCategoria = !categoriaFavComercios || item.categoriaIds.includes(categoriaFavComercios);
      return byName && byMunicipio && byCategoria;
    });

    return sortFavorites(filtered, orderFavComercios, favoritesCoords);
  }, [
    categoriaFavComercios,
    favoriteComercios,
    favoritesCoords,
    municipioFavComercios,
    orderFavComercios,
    searchFavComercios,
  ]);

  const favoriteLugaresView = useMemo(() => {
    const search = normalizeSearch(searchFavLugares);
    const filtered = favoriteLugares.filter((item) => {
      const byName = !search || normalizeSearch(item.nombre).includes(search);
      const byMunicipio = !municipioFavLugares || item.municipioNombre === municipioFavLugares;
      const byCategoria = !categoriaFavLugares || item.categoriaIds.includes(categoriaFavLugares);
      return byName && byMunicipio && byCategoria;
    });

    return sortFavorites(filtered, orderFavLugares, favoritesCoords);
  }, [
    categoriaFavLugares,
    favoriteLugares,
    favoritesCoords,
    municipioFavLugares,
    orderFavLugares,
    searchFavLugares,
  ]);

  const favoritePlayasView = useMemo(() => {
    const search = normalizeSearch(searchFavPlayas);
    const filtered = favoritePlayas.filter((item) => {
      const byName = !search || normalizeSearch(item.nombre).includes(search);
      const byMunicipio = !municipioFavPlayas || item.municipioNombre === municipioFavPlayas;
      const byCategoria = !categoriaFavPlayas || item.categoriaIds.includes(categoriaFavPlayas);
      return byName && byMunicipio && byCategoria;
    });

    return sortFavorites(filtered, orderFavPlayas, favoritesCoords);
  }, [
    categoriaFavPlayas,
    favoritePlayas,
    favoritesCoords,
    municipioFavPlayas,
    orderFavPlayas,
    searchFavPlayas,
  ]);

  if (loading) {
    return (
      <PublicAppChrome>
        {({ contentPaddingStyle }) => (
            <View style={[styles.stateWrap, contentPaddingStyle]}>
            <ScreenState loading message={copy.loadingAccount} />
          </View>
        )}
      </PublicAppChrome>
    );
  }

  if (redirectingToLogin) {
    return (
      <PublicAppChrome>
        {({ contentPaddingStyle }) => (
            <View style={[styles.stateWrap, contentPaddingStyle]}>
            <ScreenState loading message={copy.redirectingLogin} />
          </View>
        )}
      </PublicAppChrome>
    );
  }

  return (
    <PublicAppChrome>
      {({ onScroll, scrollEventThrottle, contentPaddingStyle }) => (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.screen, contentPaddingStyle]}
            onScroll={onScroll}
            scrollEventThrottle={scrollEventThrottle}
          >
            <View style={styles.profileWrap}>
              <Pressable style={styles.messageButton} onPress={() => setMessagesModalVisible(true)}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#0e7490" />
              </Pressable>

              <Image source={avatarSource} style={styles.avatar} />
              <Text style={styles.profileName}>{nombreCompleto}</Text>

              {profile?.membresiaUp ? (
                <View style={[styles.membershipBadge, shadows.card]}>
                  <Image source={{ uri: UP_LOGO_CLARO }} style={styles.membershipLogo} resizeMode="contain" />
                  <Text style={styles.membershipTitle}>{copy.membershipActiveTitle}</Text>
                  <Text style={styles.membershipSub}>{copy.membershipActiveUntil}</Text>
                </View>
              ) : (
                <View style={[styles.upgradeCard, shadows.card]}>
                  <Image source={{ uri: UP_LOGO_CLARO }} style={styles.upgradeLogo} resizeMode="contain" />
                  <Text style={styles.upgradeTitle}>{copy.membershipFreeUntil}</Text>

                  <Pressable onPress={() => setShowUpgradeDetails((prev) => !prev)}>
                    <Text style={styles.upgradeToggle}>{showUpgradeDetails ? copy.seeLess : copy.seeMore}</Text>
                  </Pressable>

                  {showUpgradeDetails ? (
                    <View style={styles.upgradeDetails}>
                      <Text style={styles.upgradeDetailLine}>{copy.upCostLine}</Text>
                      <Text style={styles.upgradeDetailLine}>{copy.upBenefitCoupons}</Text>
                      <Text style={styles.upgradeDetailLine}>{copy.upBenefitDiscounts}</Text>
                      <Text style={styles.upgradeDetailLine}>{copy.upBenefitNotifications}</Text>

                      <Pressable style={styles.upgradeAction} onPress={() => setUpgradeModalVisible(true)}>
                        <Text style={styles.upgradeActionText}>{copy.becomeUpToday}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )}

              <Text style={styles.profileMeta}>{profile?.email || session?.email || copy.noEmail}</Text>
              <Text style={styles.profileMeta}>{municipioTexto}</Text>
              <Text style={styles.profileMeta}>{`${copy.activeSince} ${createdText}`}</Text>

              <Pressable style={styles.editButton} onPress={openEditModal}>
                <Text style={styles.editButtonText}>{copy.editProfile}</Text>
              </Pressable>
            </View>

            <View style={styles.quickActionsSection}>
              <Text style={styles.quickActionsTitle}>{copy.quickActions}</Text>
              <View style={styles.quickGrid}>
                <Pressable style={[styles.quickCard, styles.quickCardSky]} onPress={openComerciosFavoritos}>
                  <FontAwesome6 name="store" size={20} color="#0369a1" />
                  <Text style={styles.quickCardText}>{copy.favoriteComercios}</Text>
                </Pressable>

                <Pressable style={[styles.quickCard, styles.quickCardOrange]} onPress={openLugaresFavoritos}>
                  <FontAwesome6 name="location-dot" size={20} color="#c2410c" />
                  <Text style={styles.quickCardText}>{copy.favoriteLugares}</Text>
                </Pressable>

                <Pressable style={[styles.quickCard, styles.quickCardCyan]} onPress={openPlayasFavoritas}>
                  <FontAwesome6 name="umbrella-beach" size={20} color="#0e7490" />
                  <Text style={styles.quickCardText}>{copy.favoritePlayas}</Text>
                </Pressable>

                <Pressable style={[styles.quickCard, styles.quickCardViolet]} onPress={openCouponsModal}>
                  <FontAwesome6 name="ticket" size={20} color="#6d28d9" />
                  <Text style={styles.quickCardText}>{copy.myCoupons}</Text>
                </Pressable>
              </View>
            </View>

            <Pressable style={styles.ordersButton} onPress={openPedidos}>
              <FontAwesome6 name="bag-shopping" size={20} color="#ffffff" />
              <Text style={styles.ordersButtonText}>{copy.myOrders}</Text>
            </Pressable>

            <Pressable style={[styles.logoutButton, busy ? styles.buttonDisabled : null]} disabled={busy} onPress={() => void signOut()}>
              <Text style={styles.logoutButtonText}>{busy ? copy.processing : copy.signOut}</Text>
            </Pressable>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>

          <Modal transparent visible={messagesModalVisible} animationType="fade" onRequestClose={() => setMessagesModalVisible(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setMessagesModalVisible(false)}>
              <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalEyebrow}>{copy.messagesEyebrow}</Text>
                    <Text style={styles.modalTitle}>{copy.notifications}</Text>
                  </View>
                  <Pressable onPress={() => setMessagesModalVisible(false)}>
                    <Ionicons name="close" size={22} color="#4b5563" />
                  </Pressable>
                </View>
                <Text style={styles.emptyHint}>{copy.noMessages}</Text>
              </Pressable>
            </Pressable>
          </Modal>

          <Modal transparent visible={upgradeModalVisible} animationType="fade" onRequestClose={() => setUpgradeModalVisible(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setUpgradeModalVisible(false)}>
              <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
                <Image source={{ uri: UP_LOGO_CLARO }} style={styles.upgradeModalLogo} resizeMode="contain" />
                <Text style={styles.upgradeModalTitle}>{copy.upModalTitle}</Text>
                <Text style={styles.upgradeModalBody}>{copy.upModalBody}</Text>
                <Text style={styles.upgradeModalFine}>{copy.upModalFine}</Text>

                <Pressable style={styles.modalPrimaryButton} onPress={openUpgradeUrl}>
                  <Text style={styles.modalPrimaryButtonText}>{copy.becomeUpNow}</Text>
                </Pressable>
                <Pressable style={styles.modalSecondaryButton} onPress={() => setUpgradeModalVisible(false)}>
                  <Text style={styles.modalSecondaryButtonText}>{copy.close}</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          <Modal transparent visible={editModalVisible} animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setEditModalVisible(false)}>
              <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{copy.editProfile}</Text>
                  <Pressable onPress={() => setEditModalVisible(false)}>
                    <Ionicons name="close" size={22} color="#4b5563" />
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>{copy.fieldName}</Text>
                <TextInput value={editNombre} onChangeText={setEditNombre} style={styles.input} placeholder={copy.fieldName} />

                <Text style={styles.fieldLabel}>{copy.fieldLastName}</Text>
                <TextInput value={editApellido} onChangeText={setEditApellido} style={styles.input} placeholder={copy.fieldLastName} />

                <Text style={styles.fieldLabel}>{copy.fieldPhone}</Text>
                <TextInput
                  value={editTelefono}
                  onChangeText={(value) => setEditTelefono(formatPhoneInput(value))}
                  style={styles.input}
                  placeholder={copy.fieldPhone}
                  keyboardType="phone-pad"
                />

                <Text style={styles.fieldLabel}>{copy.fieldMunicipio}</Text>
                <ScrollView style={styles.municipioList} nestedScrollEnabled>
                  <Pressable style={styles.municipioOption} onPress={() => setEditMunicipio('')}>
                    <Text style={[styles.municipioOptionText, !editMunicipio ? styles.municipioOptionSelected : null]}>
                      {copy.municipalityEmpty}
                    </Text>
                  </Pressable>
                  {municipios.map((item) => (
                    <Pressable key={item.id} style={styles.municipioOption} onPress={() => setEditMunicipio(String(item.id))}>
                      <Text
                        style={[
                          styles.municipioOptionText,
                          editMunicipio === String(item.id) || editMunicipio.toLowerCase() === item.nombre.toLowerCase()
                            ? styles.municipioOptionSelected
                            : null,
                        ]}
                      >
                        {item.nombre}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={styles.modalActionsRow}>
                  <Pressable style={styles.modalSecondaryButtonInline} onPress={() => setEditModalVisible(false)}>
                    <Text style={styles.modalSecondaryButtonText}>{copy.cancel}</Text>
                  </Pressable>
                  <Pressable style={styles.modalPrimaryButtonInline} onPress={() => void saveProfile()}>
                    <Text style={styles.modalPrimaryButtonText}>{copy.save}</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          <Modal transparent visible={couponsModalVisible} animationType="fade" onRequestClose={() => setCouponsModalVisible(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setCouponsModalVisible(false)}>
              <Pressable style={[styles.modalCard, styles.couponModalCard]} onPress={(event) => event.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{copy.myCouponsTitle}</Text>
                  <Pressable onPress={() => setCouponsModalVisible(false)}>
                    <Ionicons name="close" size={22} color="#4b5563" />
                  </Pressable>
                </View>

                {loadingCoupons ? (
                  <View style={styles.couponStateWrap}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.emptyHint}>{copy.loadingCoupons}</Text>
                  </View>
                ) : couponsError ? (
                  <Text style={styles.errorText}>{couponsError}</Text>
                ) : coupons.length === 0 ? (
                  <Text style={styles.emptyHint}>{copy.noCouponsYet}</Text>
                ) : (
                  <ScrollView style={styles.couponList}>
                    {coupons.map((item) => (
                      <View key={`cupon-${item.id}`} style={styles.couponCard}>
                        <Text style={styles.couponTitle}>{item.titulo}</Text>
                        <Text style={styles.couponMerchant}>{item.comercio}</Text>
                        {item.descripcion ? <Text style={styles.couponDescription}>{item.descripcion}</Text> : null}
                        <Text style={[styles.couponState, item.redimido ? styles.couponRedeemed : styles.couponSaved]}>
                          {item.redimido ? copy.couponRedeemed : copy.couponSaved}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </Pressable>
            </Pressable>
          </Modal>

          <Modal transparent visible={comerciosFavModalVisible} animationType="fade" onRequestClose={() => setComerciosFavModalVisible(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setComerciosFavModalVisible(false)}>
              <Pressable style={[styles.modalCard, styles.favoriteModalCard]} onPress={(event) => event.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{copy.favComerciosTitle}</Text>
                  <Pressable onPress={() => setComerciosFavModalVisible(false)}>
                    <Ionicons name="close" size={22} color="#4b5563" />
                  </Pressable>
                </View>

                <View style={styles.searchRow}>
                  <Ionicons name="search" size={16} color="#6b7280" />
                  <TextInput
                    value={searchFavComercios}
                    onChangeText={setSearchFavComercios}
                    placeholder={copy.searchComercio}
                    placeholderTextColor="#94a3b8"
                    style={styles.searchInput}
                  />
                </View>

                <View style={styles.filtersRow}>
                  <View style={styles.filterCol}>
                    <ModalSelect
                      value={municipioFavComercios}
                      placeholder={copy.filterMunicipio}
                      options={comercioMunicipioOptions}
                      onChange={setMunicipioFavComercios}
                    />
                  </View>
                  <View style={styles.filterCol}>
                    <ModalSelect
                      value={categoriaFavComercios}
                      placeholder={copy.filterCategoria}
                      options={comercioCategoriaOptions}
                      onChange={setCategoriaFavComercios}
                    />
                  </View>
                  <View style={styles.filterCol}>
                    <ModalSelect
                      value={orderFavComercios}
                      placeholder={copy.filterOrden}
                      options={orderOptions}
                      onChange={(value) => {
                        const next = (value as FavoriteOrder) || 'alfabetico';
                        setOrderFavComercios(next);
                        if (next === 'cercania') void ensureFavoritesLocation();
                      }}
                    />
                  </View>
                </View>

                {loadingFavComercios ? (
                  <View style={styles.couponStateWrap}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.emptyHint}>{copy.loadingFavorites}</Text>
                  </View>
                ) : errorFavComercios ? (
                  <Text style={styles.errorText}>{errorFavComercios}</Text>
                ) : favoriteComerciosView.length === 0 ? (
                  <Text style={styles.emptyHint}>{copy.noFavorites}</Text>
                ) : (
                  <ScrollView style={styles.favoriteList}>
                    {favoriteComerciosView.map((item) => (
                      <Pressable
                        key={`fav-comercio-${item.id}`}
                        style={[styles.favoriteItemCard, shadows.card]}
                        onPress={() => router.push({ pathname: '/comercio/[id]', params: { id: String(item.id) } })}
                      >
                        <View style={styles.favoriteItemBody}>
                          <Image source={{ uri: item.logo || PLACEHOLDER_LOGO }} style={styles.favoriteLogoCircle} />
                          <View style={styles.favoriteTextWrap}>
                            <Text style={styles.favoriteName}>{item.nombre}</Text>
                            {item.municipioNombre ? <Text style={styles.favoriteMeta}>{item.municipioNombre}</Text> : null}
                            {item.categorias.length > 0 ? <Text style={styles.favoriteMeta}>{item.categorias.join(', ')}</Text> : null}
                          </View>
                        </View>
                        <Pressable
                          style={styles.favoriteDeleteBtn}
                          onPress={(event) => {
                            event.stopPropagation();
                            void removeFavoriteComercio(item.id, item.nombre);
                          }}
                        >
                          <FontAwesome6 name="trash" size={16} color="#ef4444" />
                        </Pressable>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </Pressable>
            </Pressable>
          </Modal>

          <Modal transparent visible={lugaresFavModalVisible} animationType="fade" onRequestClose={() => setLugaresFavModalVisible(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setLugaresFavModalVisible(false)}>
              <Pressable style={[styles.modalCard, styles.favoriteModalCard]} onPress={(event) => event.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{copy.favLugaresTitle}</Text>
                  <Pressable onPress={() => setLugaresFavModalVisible(false)}>
                    <Ionicons name="close" size={22} color="#4b5563" />
                  </Pressable>
                </View>

                <View style={styles.searchRow}>
                  <Ionicons name="search" size={16} color="#6b7280" />
                  <TextInput
                    value={searchFavLugares}
                    onChangeText={setSearchFavLugares}
                    placeholder={copy.searchLugar}
                    placeholderTextColor="#94a3b8"
                    style={styles.searchInput}
                  />
                </View>

                <View style={styles.filtersRow}>
                  <View style={styles.filterCol}>
                    <ModalSelect
                      value={municipioFavLugares}
                      placeholder={copy.filterMunicipio}
                      options={lugarMunicipioOptions}
                      onChange={setMunicipioFavLugares}
                    />
                  </View>
                  <View style={styles.filterCol}>
                    <ModalSelect
                      value={categoriaFavLugares}
                      placeholder={copy.filterCategoria}
                      options={lugarCategoriaOptions}
                      onChange={setCategoriaFavLugares}
                    />
                  </View>
                  <View style={styles.filterCol}>
                    <ModalSelect
                      value={orderFavLugares}
                      placeholder={copy.filterOrden}
                      options={orderOptions}
                      onChange={(value) => {
                        const next = (value as FavoriteOrder) || 'alfabetico';
                        setOrderFavLugares(next);
                        if (next === 'cercania') void ensureFavoritesLocation();
                      }}
                    />
                  </View>
                </View>

                {loadingFavLugares ? (
                  <View style={styles.couponStateWrap}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.emptyHint}>{copy.loadingFavorites}</Text>
                  </View>
                ) : errorFavLugares ? (
                  <Text style={styles.errorText}>{errorFavLugares}</Text>
                ) : favoriteLugaresView.length === 0 ? (
                  <Text style={styles.emptyHint}>{copy.noFavorites}</Text>
                ) : (
                  <ScrollView style={styles.favoriteList}>
                    {favoriteLugaresView.map((item) => (
                      <Pressable
                        key={`fav-lugar-${item.id}`}
                        style={[styles.favoriteItemCard, shadows.card]}
                        onPress={() =>
                          void openExternalUrl(`${DEFAULT_APP_BASE_URLS.public}/perfilLugar.html?id=${item.id}`, {
                            loggerTag: 'mobile-public/usuario',
                          })
                        }
                      >
                        <View style={styles.favoriteItemBody}>
                          <Image source={{ uri: item.imagen || PLACEHOLDER_LUGAR }} style={styles.favoriteImageRect} />
                          <View style={styles.favoriteTextWrap}>
                            <Text style={styles.favoriteName}>{item.nombre}</Text>
                            {item.municipioNombre ? <Text style={styles.favoriteMeta}>{item.municipioNombre}</Text> : null}
                            {item.categorias.length > 0 ? <Text style={styles.favoriteMeta}>{item.categorias.join(', ')}</Text> : null}
                          </View>
                        </View>
                        <Pressable
                          style={styles.favoriteDeleteBtn}
                          onPress={(event) => {
                            event.stopPropagation();
                            void removeFavoriteLugar(item.id, item.nombre);
                          }}
                        >
                          <FontAwesome6 name="trash" size={16} color="#ef4444" />
                        </Pressable>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </Pressable>
            </Pressable>
          </Modal>

          <Modal transparent visible={playasFavModalVisible} animationType="fade" onRequestClose={() => setPlayasFavModalVisible(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setPlayasFavModalVisible(false)}>
              <Pressable style={[styles.modalCard, styles.favoriteModalCard]} onPress={(event) => event.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{copy.favPlayasTitle}</Text>
                  <Pressable onPress={() => setPlayasFavModalVisible(false)}>
                    <Ionicons name="close" size={22} color="#4b5563" />
                  </Pressable>
                </View>

                <View style={styles.searchRow}>
                  <Ionicons name="search" size={16} color="#6b7280" />
                  <TextInput
                    value={searchFavPlayas}
                    onChangeText={setSearchFavPlayas}
                    placeholder={copy.searchPlaya}
                    placeholderTextColor="#94a3b8"
                    style={styles.searchInput}
                  />
                </View>

                <View style={styles.filtersRow}>
                  <View style={styles.filterCol}>
                    <ModalSelect
                      value={municipioFavPlayas}
                      placeholder={copy.filterMunicipio}
                      options={playaMunicipioOptions}
                      onChange={setMunicipioFavPlayas}
                    />
                  </View>
                  <View style={styles.filterCol}>
                    <ModalSelect
                      value={categoriaFavPlayas}
                      placeholder={copy.filterCategoria}
                      options={playaCategoriaOptions}
                      onChange={setCategoriaFavPlayas}
                    />
                  </View>
                  <View style={styles.filterCol}>
                    <ModalSelect
                      value={orderFavPlayas}
                      placeholder={copy.filterOrden}
                      options={orderOptions}
                      onChange={(value) => {
                        const next = (value as FavoriteOrder) || 'alfabetico';
                        setOrderFavPlayas(next);
                        if (next === 'cercania') void ensureFavoritesLocation();
                      }}
                    />
                  </View>
                </View>

                {loadingFavPlayas ? (
                  <View style={styles.couponStateWrap}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.emptyHint}>{copy.loadingFavorites}</Text>
                  </View>
                ) : errorFavPlayas ? (
                  <Text style={styles.errorText}>{errorFavPlayas}</Text>
                ) : favoritePlayasView.length === 0 ? (
                  <Text style={styles.emptyHint}>{copy.noFavorites}</Text>
                ) : (
                  <ScrollView style={styles.favoriteList}>
                    {favoritePlayasView.map((item) => (
                      <Pressable
                        key={`fav-playa-${item.id}`}
                        style={[styles.favoriteItemCard, shadows.card]}
                        onPress={() => router.push({ pathname: '/playa/[id]', params: { id: String(item.id) } })}
                      >
                        <View style={styles.favoriteItemBody}>
                          <Image source={{ uri: item.imagen || PLACEHOLDER_PLAYA }} style={styles.favoriteImageRect} />
                          <View style={styles.favoriteTextWrap}>
                            <Text style={styles.favoriteName}>{item.nombre}</Text>
                            {item.municipioNombre ? <Text style={styles.favoriteMeta}>{item.municipioNombre}</Text> : null}
                            {item.categorias.length > 0 ? <Text style={styles.favoriteMeta}>{item.categorias.join(', ')}</Text> : null}
                          </View>
                        </View>
                        <Pressable
                          style={styles.favoriteDeleteBtn}
                          onPress={(event) => {
                            event.stopPropagation();
                            void removeFavoritePlaya(item.id, item.nombre);
                          }}
                        >
                          <FontAwesome6 name="trash" size={16} color="#ef4444" />
                        </Pressable>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )}
    </PublicAppChrome>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  stateWrap: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  screen: {
    minHeight: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#f8fafc',
    gap: spacing.md,
  },
  profileWrap: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    position: 'relative',
  },
  messageButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#ecfeff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.pill,
    backgroundColor: '#e2e8f0',
  },
  profileName: {
    marginTop: 2,
    color: '#111827',
    fontSize: 25,
    lineHeight: 29,
    textAlign: 'center',
    fontFamily: fonts.bold,
  },
  membershipBadge: {
    width: '100%',
    borderRadius: borderRadius.md,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  membershipLogo: {
    width: 66,
    height: 66,
  },
  membershipTitle: {
    color: '#16a34a',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fonts.medium,
  },
  membershipSub: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  upgradeCard: {
    width: '100%',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  upgradeLogo: {
    width: 80,
    height: 80,
  },
  upgradeTitle: {
    color: '#1f2937',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: fonts.medium,
    marginTop: spacing.xs,
  },
  upgradeToggle: {
    marginTop: spacing.xs,
    color: '#2563eb',
    textDecorationLine: 'underline',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  upgradeDetails: {
    width: '100%',
    marginTop: spacing.sm,
    gap: spacing.xs,
    alignItems: 'center',
  },
  upgradeDetailLine: {
    color: '#374151',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  upgradeAction: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: '#2563eb',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  upgradeActionText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  profileMeta: {
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  editButton: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: '#f97316',
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  quickActionsSection: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  quickActionsTitle: {
    color: '#9ca3af',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
    fontFamily: fonts.medium,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickCard: {
    width: '48%',
    minHeight: 84,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  quickCardSky: {
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  quickCardOrange: {
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  quickCardCyan: {
    borderColor: '#a5f3fc',
    backgroundColor: '#ecfeff',
  },
  quickCardViolet: {
    borderColor: '#ddd6fe',
    backgroundColor: '#f5f3ff',
  },
  quickCardText: {
    color: '#334155',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.medium,
  },
  ordersButton: {
    width: '100%',
    minHeight: 64,
    borderRadius: borderRadius.md,
    backgroundColor: '#059669',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ordersButtonText: {
    color: '#ffffff',
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.medium,
  },
  logoutButton: {
    width: '100%',
    borderRadius: borderRadius.sm,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    padding: spacing.md,
    gap: spacing.sm,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modalEyebrow: {
    color: '#6b7280',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: fonts.medium,
  },
  modalTitle: {
    color: '#111827',
    fontSize: 22,
    lineHeight: 26,
    fontFamily: fonts.medium,
  },
  emptyHint: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  upgradeModalLogo: {
    width: 92,
    height: 92,
    alignSelf: 'center',
    marginTop: spacing.xs,
  },
  upgradeModalTitle: {
    color: '#1f2937',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    fontFamily: fonts.medium,
  },
  upgradeModalBody: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  upgradeModalFine: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  modalPrimaryButton: {
    borderRadius: borderRadius.sm,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    marginTop: spacing.xs,
  },
  modalPrimaryButtonInline: {
    flex: 1,
    borderRadius: borderRadius.sm,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  modalPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  modalSecondaryButton: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  modalSecondaryButtonInline: {
    flex: 1,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  modalSecondaryButtonText: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  fieldLabel: {
    color: '#374151',
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.medium,
    marginTop: 2,
  },
  input: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    color: '#111827',
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.regular,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  municipioList: {
    maxHeight: 170,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  municipioOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  municipioOptionText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
  municipioOptionSelected: {
    color: '#0284c7',
    fontFamily: fonts.medium,
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  couponModalCard: {
    maxHeight: '80%',
  },
  couponStateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  couponList: {
    maxHeight: 360,
  },
  couponCard: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 3,
    marginBottom: spacing.xs,
  },
  couponTitle: {
    color: '#111827',
    fontSize: 15,
    lineHeight: 19,
    fontFamily: fonts.medium,
  },
  couponMerchant: {
    color: '#374151',
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.medium,
  },
  couponDescription: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.regular,
  },
  couponState: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.medium,
    overflow: 'hidden',
  },
  couponSaved: {
    color: '#166534',
    backgroundColor: '#dcfce7',
  },
  couponRedeemed: {
    color: '#6b7280',
    backgroundColor: '#e5e7eb',
  },
  favoriteModalCard: {
    width: '95%',
    maxHeight: '85%',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.regular,
    paddingVertical: 8,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  filterCol: {
    flex: 1,
  },
  filterSelectTrigger: {
    minHeight: 38,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  filterSelectValue: {
    flex: 1,
    color: '#111827',
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.medium,
  },
  filterSelectPlaceholder: {
    color: '#64748b',
    fontFamily: fonts.regular,
  },
  selectBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  selectSheet: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    maxHeight: '60%',
    paddingVertical: spacing.xs,
  },
  selectSheetList: {
    maxHeight: 320,
  },
  selectOption: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  selectOptionText: {
    flex: 1,
    color: '#334155',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
  favoriteList: {
    maxHeight: 390,
  },
  favoriteItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  favoriteItemBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  favoriteLogoCircle: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
  },
  favoriteImageRect: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
  },
  favoriteTextWrap: {
    flex: 1,
    gap: 2,
  },
  favoriteName: {
    color: '#1f2937',
    fontSize: 15,
    lineHeight: 19,
    fontFamily: fonts.medium,
  },
  favoriteMeta: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
  },
  favoriteDeleteBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
