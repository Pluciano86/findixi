import { DEFAULT_APP_BASE_URLS, resolverPlanComercio } from '@findixi/shared';
import { FontAwesome5, FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BusinessChrome, type FooterItem } from '../../src/components/BusinessChrome';
import { ScreenState } from '../../src/components/ScreenState';
import { getSessionOrReset } from '../../src/lib/auth-session';
import {
  fetchAmenitiesCatalog,
  fetchBusinessAccessByUser,
  fetchBusinessAmenities,
  fetchBusinessHours,
  fetchBusinessLogoPath,
  saveBusinessAmenities,
  type BusinessAmenity,
  type BusinessHour,
  type BusinessProfile,
  updateBusinessInfo,
  upsertBusinessHours,
} from '../../src/lib/business-profile';
import { supabase } from '../../src/lib/supabase';
import { borderRadius, fonts, shadows, spacing } from '../../src/theme/tokens';

type InfoDraft = {
  telefono: string;
  direccion: string;
  whatsapp: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  webpage: string;
  descripcion: string;
};

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const STORAGE_PUBLIC_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/';
const LOGO_PLACEHOLDER = 'https://placehold.co/220x220?text=Logo';

type AmenidadIconStyle = 'solid' | 'regular' | 'brands';
type AmenidadIconResolved = {
  preferFamily: 'fa6' | 'fa5';
  name: string;
  iconStyle?: AmenidadIconStyle;
};

function createInfoDraft(profile: BusinessProfile | null): InfoDraft {
  return {
    telefono: String(profile?.telefono || ''),
    direccion: String(profile?.direccion || ''),
    whatsapp: String(profile?.whatsapp || ''),
    facebook: String(profile?.facebook || ''),
    instagram: String(profile?.instagram || ''),
    tiktok: String(profile?.tiktok || ''),
    webpage: String(profile?.webpage || ''),
    descripcion: String(profile?.descripcion || ''),
  };
}

function resolveLogoUrl(pathOrUrl: string): string {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${STORAGE_PUBLIC_BASE}${raw}`;
}

function toDisplayText(value: string | null | undefined): string {
  const normalized = String(value || '').trim();
  return normalized || 'No disponible';
}

function normalizeHours(hours: BusinessHour[]): BusinessHour[] {
  const byDay = new Map<number, BusinessHour>();
  (hours || []).forEach((entry) => {
    const day = Number(entry.diaSemana);
    if (!Number.isFinite(day) || day < 0 || day > 6) return;
    byDay.set(day, {
      id: entry.id ?? null,
      diaSemana: day,
      apertura: entry.apertura || null,
      cierre: entry.cierre || null,
      cerrado: Boolean(entry.cerrado),
    });
  });

  const completed: BusinessHour[] = [];
  for (let day = 0; day <= 6; day += 1) {
    const existing = byDay.get(day);
    completed.push(
      existing || {
        id: null,
        diaSemana: day,
        apertura: null,
        cierre: null,
        cerrado: true,
      }
    );
  }

  return completed;
}

function formatHoursLine(entry: BusinessHour): string {
  if (entry.cerrado) return 'Cerrado';
  if (!entry.apertura || !entry.cierre) return 'Horario no definido';
  return `${formatTime12h(entry.apertura)} - ${formatTime12h(entry.cierre)}`;
}

function formatTime12h(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return raw;

  let hour = Number(match[1]);
  const minute = match[2];
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return raw;

  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
}

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
    utensils: 'utensils',
    'martini-glass': 'glass-martini',
    'martini-glass-citrus': 'cocktail',
    'person-swimming': 'swimmer',
    'water-ladder': 'swimmer',
    house: 'home',
    'house-chimney': 'home',
    'bell-concierge': 'concierge-bell',
    'handshake-angle': 'hands-helping',
    person: 'user',
    xmark: 'times',
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

function renderAmenityIcon(iconClass: string | null | undefined, amenityName: string | null | undefined, size = 18) {
  const icono = amenidadIconName(iconClass, amenityName);
  if (icono.preferFamily === 'fa6') {
    return <FontAwesome6 name={icono.name as never} iconStyle={icono.iconStyle as never} size={size} color="#3ea6c4" />;
  }
  return (
    <FontAwesome5
      name={icono.name as never}
      size={size}
      color="#3ea6c4"
      solid={icono.iconStyle !== 'regular'}
      brand={icono.iconStyle === 'brands'}
    />
  );
}

function buildWebUrl(path: string, idComercio: number): string {
  return `${DEFAULT_APP_BASE_URLS.comercio}${path}?id=${idComercio}`;
}

export default function BusinessProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ idComercio?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [idComercio, setIdComercio] = useState(0);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [sessionEmail, setSessionEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const [horarios, setHorarios] = useState<BusinessHour[]>([]);
  const [amenidades, setAmenidades] = useState<BusinessAmenity[]>([]);
  const [catalogoAmenidades, setCatalogoAmenidades] = useState<BusinessAmenity[]>([]);

  const [infoDraft, setInfoDraft] = useState<InfoDraft>(createInfoDraft(null));
  const [horariosDraft, setHorariosDraft] = useState<BusinessHour[]>([]);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<number[]>([]);

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [horarioModalVisible, setHorarioModalVisible] = useState(false);
  const [amenidadesModalVisible, setAmenidadesModalVisible] = useState(false);

  const [savingInfo, setSavingInfo] = useState(false);
  const [savingDescripcion, setSavingDescripcion] = useState(false);
  const [savingHorario, setSavingHorario] = useState(false);
  const [savingAmenidades, setSavingAmenidades] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [descripcionExpanded, setDescripcionExpanded] = useState(false);
  const [horarioExpanded, setHorarioExpanded] = useState(false);
  const [amenidadesExpanded, setAmenidadesExpanded] = useState(false);
  const [descripcionModalVisible, setDescripcionModalVisible] = useState(false);
  const [descripcionDraft, setDescripcionDraft] = useState('');
  const targetComercioId = Number(params.idComercio || 0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const session = await getSessionOrReset();
      if (!session?.user) {
        setProfile(null);
        setIdComercio(0);
        setSessionEmail('');
        setAssignmentCount(0);
        setLogoUrl('');
        setHorarios([]);
        setAmenidades([]);
        setCatalogoAmenidades([]);
        router.replace('/login');
        return;
      }

      const access = await fetchBusinessAccessByUser(session.user.id);
      setSessionEmail(String(session.user.email || ''));
      setAssignmentCount(access.assignmentCount);
      const selectedComercio =
        Number.isFinite(targetComercioId) && targetComercioId > 0
          ? access.comercios.find((entry) => entry.idComercio === targetComercioId) || null
          : null;
      const selectedProfile = selectedComercio?.profile || access.profile;
      setProfile(selectedProfile);

      const comercioId = Number(selectedComercio?.idComercio || access.primaryComercioId || selectedProfile?.id || 0);
      setIdComercio(comercioId);

      if (!selectedProfile || !comercioId) {
        setLogoUrl('');
        setHorarios([]);
        setAmenidades([]);
        setCatalogoAmenidades([]);
        setInfoDraft(createInfoDraft(selectedProfile));
        setDescripcionDraft(String(selectedProfile?.descripcion || ''));
        return;
      }

      const [logoPath, hours, selectedAmenities, allAmenities] = await Promise.all([
        fetchBusinessLogoPath(comercioId),
        fetchBusinessHours(comercioId),
        fetchBusinessAmenities(comercioId),
        fetchAmenitiesCatalog(),
      ]);

      setLogoUrl(resolveLogoUrl(logoPath));
      setHorarios(normalizeHours(hours));
      setAmenidades(selectedAmenities);
      setCatalogoAmenidades(allAmenities);
      setInfoDraft(createInfoDraft(selectedProfile));
      setDescripcionDraft(String(selectedProfile?.descripcion || ''));
      setSelectedAmenityIds(selectedAmenities.map((item) => item.id));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'No se pudo cargar el perfil del comercio.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router, targetComercioId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      return undefined;
    }, [loadData])
  );

  const title = profile?.nombre ? `Perfil ${profile.nombre}` : 'Perfil comercio';
  const planName = useMemo(() => {
    if (!profile) return 'Sin plan';
    const resolved = resolverPlanComercio(profile as unknown as Record<string, unknown>);
    return profile.plan_nombre || resolved.nombre;
  }, [profile]);
  const horariosNormalizados = useMemo(() => normalizeHours(horarios), [horarios]);
  const dayIndexToday = new Date().getDay();
  const horarioHoy = horariosNormalizados.find((item) => item.diaSemana === dayIndexToday) || null;
  const horarioResumen = horarioHoy ? `${DAY_LABELS[dayIndexToday]}: ${formatHoursLine(horarioHoy)}` : 'Horario no definido';
  const amenidadesResumen =
    amenidades.length > 0 ? `${amenidades.length} amenidad(es) registradas` : 'Sin amenidades registradas.';
  const descripcionTexto = toDisplayText(profile?.descripcion);
  const footerItems = useMemo<FooterItem[]>(() => {
    return [
      {
        key: 'edit-profile',
        label: 'Editar Perfil',
        onPress: () => router.push((idComercio ? `/perfil?idComercio=${idComercio}` : '/perfil') as never),
        active: true,
      },
      {
        key: 'stats',
        label: 'Estadísticas',
        onPress: () => router.push((idComercio ? `/estadisticas?idComercio=${idComercio}` : '/estadisticas') as never),
      },
      {
        key: 'menu',
        label: 'Admin Menú',
        onPress: () => router.push((idComercio ? `/admin-menu?idComercio=${idComercio}` : '/admin-menu') as never),
      },
      {
        key: 'specials',
        label: 'Especiales',
        onPress: () => {
          if (!idComercio) return;
          void Linking.openURL(buildWebUrl('/especiales/adminEspeciales.html', idComercio));
        },
      },
      {
        key: 'promo',
        label: 'Promocionar',
        onPress: () => {
          if (!idComercio) return;
          void Linking.openURL(buildWebUrl('/paquetes.html', idComercio));
        },
      },
      {
        key: 'account',
        label: 'Editar cuenta',
        onPress: () => {
          if (!idComercio) return;
          void Linking.openURL(buildWebUrl('/editarPerfilComercio.html', idComercio));
        },
      },
    ];
  }, [idComercio, router]);

  const openInfoModal = useCallback(() => {
    setInfoDraft(createInfoDraft(profile));
    setInfoModalVisible(true);
  }, [profile]);

  const openHorarioModal = useCallback(() => {
    setHorariosDraft(normalizeHours(horarios));
    setHorarioModalVisible(true);
  }, [horarios]);

  const openAmenidadesModal = useCallback(() => {
    setSelectedAmenityIds(amenidades.map((item) => item.id));
    setAmenidadesModalVisible(true);
  }, [amenidades]);

  const onSaveInfo = useCallback(async () => {
    if (!idComercio) return;

    setSavingInfo(true);
    setError('');
    try {
      await updateBusinessInfo(idComercio, {
        telefono: infoDraft.telefono,
        direccion: infoDraft.direccion,
        whatsapp: infoDraft.whatsapp,
        facebook: infoDraft.facebook,
        instagram: infoDraft.instagram,
        tiktok: infoDraft.tiktok,
        webpage: infoDraft.webpage,
        descripcion: infoDraft.descripcion,
      });
      setInfoModalVisible(false);
      await loadData();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'No se pudo guardar la información.';
      setError(message);
    } finally {
      setSavingInfo(false);
    }
  }, [idComercio, infoDraft, loadData]);

  const openDescripcionModal = useCallback(() => {
    setDescripcionDraft(String(profile?.descripcion || ''));
    setDescripcionModalVisible(true);
  }, [profile?.descripcion]);

  const onSaveDescripcion = useCallback(async () => {
    if (!idComercio || !profile) return;

    setSavingDescripcion(true);
    setError('');
    try {
      await updateBusinessInfo(idComercio, {
        telefono: profile.telefono,
        direccion: profile.direccion,
        whatsapp: profile.whatsapp,
        facebook: profile.facebook,
        instagram: profile.instagram,
        tiktok: profile.tiktok,
        webpage: profile.webpage,
        descripcion: descripcionDraft,
      });
      setDescripcionModalVisible(false);
      await loadData();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'No se pudo guardar la descripción.';
      setError(message);
    } finally {
      setSavingDescripcion(false);
    }
  }, [descripcionDraft, idComercio, loadData, profile]);

  const onSaveHorario = useCallback(async () => {
    if (!idComercio) return;

    setSavingHorario(true);
    setError('');
    try {
      await upsertBusinessHours(idComercio, normalizeHours(horariosDraft));
      setHorarioModalVisible(false);
      await loadData();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'No se pudo guardar el horario.';
      setError(message);
    } finally {
      setSavingHorario(false);
    }
  }, [idComercio, horariosDraft, loadData]);

  const onSaveAmenidades = useCallback(async () => {
    if (!idComercio) return;

    setSavingAmenidades(true);
    setError('');
    try {
      await saveBusinessAmenities(idComercio, selectedAmenityIds);
      setAmenidadesModalVisible(false);
      await loadData();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'No se pudieron guardar las amenidades.';
      setError(message);
    } finally {
      setSavingAmenidades(false);
    }
  }, [idComercio, loadData, selectedAmenityIds]);

  const onToggleAmenidad = useCallback((id: number) => {
    setSelectedAmenityIds((prev) => {
      if (prev.includes(id)) return prev.filter((value) => value !== id);
      return [...prev, id];
    });
  }, []);

  const onRequestBrandEdit = useCallback(() => {
    const subject = encodeURIComponent(`Solicitud edición perfil comercio ${profile?.nombre || ''}`.trim());
    const body = encodeURIComponent(
      `Hola Findixi,\n\nSolicito aprobación para editar logo/nombre del comercio.\n\nComercio ID: ${idComercio || 'N/D'}\nCuenta: ${sessionEmail || 'N/D'}\nNombre actual: ${profile?.nombre || 'N/D'}\n\nGracias.`
    );
    void Linking.openURL(`mailto:info@findixi.com?subject=${subject}&body=${body}`);
  }, [idComercio, profile?.nombre, sessionEmail]);

  return (
    <BusinessChrome title={title} footerItems={footerItems}>
      {loading ? <ScreenState loading message="Cargando perfil..." /> : null}

      {!loading && error ? <ScreenState message={error} /> : null}

      {!loading && !error && !profile ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.emptyTitle}>Cuenta activa sin comercio vinculado</Text>
          <Text style={styles.emptyBody}>
            No encontramos un comercio para esta cuenta.
            {assignmentCount > 0 ? ` (${assignmentCount} asignación(es) detectada(s))` : ''}
          </Text>
          {sessionEmail ? <Text style={styles.infoValue}>Cuenta: {sessionEmail}</Text> : null}
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/')}>
            <Text style={styles.btnText}>Volver al dashboard</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              void supabase.auth.signOut({ scope: 'local' });
              router.replace('/login');
            }}
          >
            <Text style={styles.btnText}>Cambiar cuenta</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && profile ? (
        <ScrollView contentContainerStyle={styles.scrollWrap}>
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Plan seleccionado</Text>
            <Text style={styles.planText}>{planName}</Text>
          </View>

          <View style={[styles.card, shadows.card]}>
            <View style={styles.brandRow}>
              <Image source={{ uri: logoUrl || LOGO_PLACEHOLDER }} style={styles.logo} />
              <View style={styles.brandInfo}>
                <Text style={styles.brandName}>{profile.nombre || 'Comercio sin nombre'}</Text>
                <Text style={styles.infoValue}>Categoría: {toDisplayText(profile.categoria)}</Text>
              </View>
            </View>
            <Pressable style={styles.secondaryBtn} onPress={onRequestBrandEdit}>
              <Text style={styles.btnText}>Solicitar edición de logo y nombre</Text>
            </Pressable>
            <Text style={styles.helperText}>La edición de logo y nombre requiere solicitud a Findixi para aprobación.</Text>
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Información de {profile.nombre}</Text>
            <View style={styles.detailPanel}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Teléfono:</Text>
                <Text style={styles.detailValue}>{toDisplayText(profile.telefono)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Dirección:</Text>
                <Text style={styles.detailValue}>{toDisplayText(profile.direccion)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Municipio:</Text>
                <Text style={styles.detailValue}>{toDisplayText(profile.municipio)}</Text>
              </View>
              {infoExpanded ? (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Whatsapp:</Text>
                    <Text style={styles.detailValue}>{toDisplayText(profile.whatsapp)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Facebook:</Text>
                    <Text style={styles.detailValue}>{toDisplayText(profile.facebook)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Instagram:</Text>
                    <Text style={styles.detailValue}>{toDisplayText(profile.instagram)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tik-Tok:</Text>
                    <Text style={styles.detailValue}>{toDisplayText(profile.tiktok)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Webpage:</Text>
                    <Text style={styles.detailValue}>{toDisplayText(profile.webpage)}</Text>
                  </View>
                </>
              ) : null}
            </View>
            <View style={styles.actionsRow}>
              <Pressable style={[styles.secondaryBtn, styles.actionBtn]} onPress={() => setInfoExpanded((prev) => !prev)}>
                <Text style={styles.btnText}>{infoExpanded ? 'Ver menos' : 'Ver más'}</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.editBtn, styles.actionBtn]} onPress={openInfoModal}>
                <Text style={styles.btnTextInverted}>Editar información</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Descripción del comercio</Text>
            <View style={styles.detailPanel}>
              <Text style={styles.descriptionValue} numberOfLines={descripcionExpanded ? undefined : 3}>
                {descripcionTexto}
              </Text>
            </View>
            <View style={styles.actionsRow}>
              <Pressable style={[styles.secondaryBtn, styles.actionBtn]} onPress={() => setDescripcionExpanded((prev) => !prev)}>
                <Text style={styles.btnText}>{descripcionExpanded ? 'Ver menos' : 'Ver más'}</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.editBtn, styles.actionBtn]} onPress={openDescripcionModal}>
                <Text style={styles.btnTextInverted}>Editar</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Horario</Text>
            <View style={styles.detailPanel}>
              {!horarioExpanded ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Hoy:</Text>
                  <Text style={styles.detailValue}>{horarioResumen}</Text>
                </View>
              ) : (
                horariosNormalizados.map((entry) => (
                  <View key={`day-${entry.diaSemana}`} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{DAY_LABELS[entry.diaSemana]}:</Text>
                    <Text style={styles.detailValue}>{formatHoursLine(entry)}</Text>
                  </View>
                ))
              )}
            </View>
            <View style={styles.actionsRow}>
              <Pressable style={[styles.secondaryBtn, styles.actionBtn]} onPress={() => setHorarioExpanded((prev) => !prev)}>
                <Text style={styles.btnText}>{horarioExpanded ? 'Ver menos' : 'Ver más'}</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.editBtn, styles.actionBtn]} onPress={openHorarioModal}>
                <Text style={styles.btnTextInverted}>Editar horario</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Amenidades</Text>
            <View style={styles.detailPanel}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Resumen:</Text>
                <Text style={styles.detailValue}>{amenidadesResumen}</Text>
              </View>
              {amenidadesExpanded && amenidades.length ? (
                <View style={styles.amenitiesWrap}>
                  {amenidades.map((item) => (
                    <View key={`amenity-${item.id}`} style={styles.amenityChip}>
                      <View style={styles.amenityIconWrap}>{renderAmenityIcon(item.icono, item.nombre, 16)}</View>
                      <Text style={styles.amenityText}>{item.nombre}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            <View style={styles.actionsRow}>
              <Pressable style={[styles.secondaryBtn, styles.actionBtn]} onPress={() => setAmenidadesExpanded((prev) => !prev)}>
                <Text style={styles.btnText}>{amenidadesExpanded ? 'Ver menos' : 'Ver más'}</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, styles.editBtn, styles.actionBtn]} onPress={openAmenidadesModal}>
                <Text style={styles.btnTextInverted}>Editar amenidades</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      ) : null}

      <Modal visible={infoModalVisible} animationType="slide" transparent onRequestClose={() => setInfoModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar información</Text>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.inputLabel}>Telefono</Text>
              <TextInput
                value={infoDraft.telefono}
                onChangeText={(value) => setInfoDraft((prev) => ({ ...prev, telefono: value }))}
                style={styles.input}
                placeholder="Telefono"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Dirección</Text>
              <TextInput
                value={infoDraft.direccion}
                onChangeText={(value) => setInfoDraft((prev) => ({ ...prev, direccion: value }))}
                style={styles.input}
                placeholder="Dirección"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Whatsapp</Text>
              <TextInput
                value={infoDraft.whatsapp}
                onChangeText={(value) => setInfoDraft((prev) => ({ ...prev, whatsapp: value }))}
                style={styles.input}
                placeholder="Whatsapp"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Facebook</Text>
              <TextInput
                value={infoDraft.facebook}
                onChangeText={(value) => setInfoDraft((prev) => ({ ...prev, facebook: value }))}
                style={styles.input}
                placeholder="Facebook"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Instagram</Text>
              <TextInput
                value={infoDraft.instagram}
                onChangeText={(value) => setInfoDraft((prev) => ({ ...prev, instagram: value }))}
                style={styles.input}
                placeholder="Instagram"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Tik-Tok</Text>
              <TextInput
                value={infoDraft.tiktok}
                onChangeText={(value) => setInfoDraft((prev) => ({ ...prev, tiktok: value }))}
                style={styles.input}
                placeholder="Tik-Tok"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.inputLabel}>Webpage</Text>
              <TextInput
                value={infoDraft.webpage}
                onChangeText={(value) => setInfoDraft((prev) => ({ ...prev, webpage: value }))}
                style={styles.input}
                placeholder="Webpage"
                placeholderTextColor="#94a3b8"
              />

            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryBtn} onPress={() => setInfoModalVisible(false)} disabled={savingInfo}>
                <Text style={styles.btnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => void onSaveInfo()} disabled={savingInfo}>
                <Text style={styles.btnTextInverted}>{savingInfo ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={descripcionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDescripcionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar descripción</Text>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.inputLabel}>Descripción del comercio</Text>
              <TextInput
                value={descripcionDraft}
                onChangeText={setDescripcionDraft}
                style={[styles.input, styles.inputMultiline]}
                placeholder="Describe tu comercio para atraer más clientes"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryBtn} onPress={() => setDescripcionModalVisible(false)} disabled={savingDescripcion}>
                <Text style={styles.btnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => void onSaveDescripcion()} disabled={savingDescripcion}>
                <Text style={styles.btnTextInverted}>{savingDescripcion ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={horarioModalVisible} animationType="slide" transparent onRequestClose={() => setHorarioModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar horario</Text>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {normalizeHours(horariosDraft).map((entry) => (
                <View key={`schedule-${entry.diaSemana}`} style={styles.dayCard}>
                  <Text style={styles.dayTitle}>{DAY_LABELS[entry.diaSemana]}</Text>
                  <View style={styles.daySwitchRow}>
                    <Text style={styles.infoValue}>Cerrado</Text>
                    <Switch
                      value={entry.cerrado}
                      onValueChange={(value) => {
                        setHorariosDraft((prev) =>
                          normalizeHours(prev).map((item) => {
                            if (item.diaSemana !== entry.diaSemana) return item;
                            return {
                              ...item,
                              cerrado: value,
                              apertura: value ? null : item.apertura || '09:00',
                              cierre: value ? null : item.cierre || '17:00',
                            };
                          })
                        );
                      }}
                    />
                  </View>
                  {!entry.cerrado ? (
                    <View style={styles.dayInputsRow}>
                      <TextInput
                        value={entry.apertura || ''}
                        onChangeText={(value) => {
                          setHorariosDraft((prev) =>
                            normalizeHours(prev).map((item) => {
                              if (item.diaSemana !== entry.diaSemana) return item;
                              return { ...item, apertura: value };
                            })
                          );
                        }}
                        style={[styles.input, styles.dayInput]}
                        placeholder="Apertura"
                        placeholderTextColor="#94a3b8"
                      />
                      <TextInput
                        value={entry.cierre || ''}
                        onChangeText={(value) => {
                          setHorariosDraft((prev) =>
                            normalizeHours(prev).map((item) => {
                              if (item.diaSemana !== entry.diaSemana) return item;
                              return { ...item, cierre: value };
                            })
                          );
                        }}
                        style={[styles.input, styles.dayInput]}
                        placeholder="Cierre"
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryBtn} onPress={() => setHorarioModalVisible(false)} disabled={savingHorario}>
                <Text style={styles.btnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => void onSaveHorario()} disabled={savingHorario}>
                <Text style={styles.btnTextInverted}>{savingHorario ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={amenidadesModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAmenidadesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar amenidades</Text>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {(catalogoAmenidades.length ? catalogoAmenidades : amenidades).map((item) => {
                const selected = selectedAmenityIds.includes(item.id);
                return (
                  <Pressable key={`catalog-${item.id}`} style={styles.amenityOption} onPress={() => onToggleAmenidad(item.id)}>
                    <View style={[styles.checkCircle, selected ? styles.checkCircleActive : null]} />
                    <View style={styles.amenityOptionIconWrap}>{renderAmenityIcon(item.icono, item.nombre, 18)}</View>
                    <Text style={styles.amenityOptionText}>{item.nombre}</Text>
                  </Pressable>
                );
              })}
              {!catalogoAmenidades.length && !amenidades.length ? (
                <Text style={styles.infoValue}>No hay amenidades disponibles en el catálogo.</Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryBtn} onPress={() => setAmenidadesModalVisible(false)} disabled={savingAmenidades}>
                <Text style={styles.btnText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => void onSaveAmenidades()} disabled={savingAmenidades}>
                <Text style={styles.btnTextInverted}>{savingAmenidades ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </BusinessChrome>
  );
}

const styles = StyleSheet.create({
  scrollWrap: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 24,
    textAlign: 'center',
  },
  planText: {
    color: '#1d4ed8',
    fontFamily: fonts.semibold,
    fontSize: 16,
    backgroundColor: '#eff6ff',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  brandRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  brandInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  brandName: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 24,
  },
  helperText: {
    color: '#475569',
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  toggleBtn: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  toggleBtnText: {
    color: '#1d4ed8',
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  detailPanel: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: spacing.md,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  detailLabel: {
    width: 96,
    color: '#0f172a',
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  detailValue: {
    flex: 1,
    color: '#334155',
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  descriptionValue: {
    color: '#334155',
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  infoValue: {
    color: '#334155',
    fontFamily: fonts.medium,
    fontSize: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  amenitiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  amenityChip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amenityIconWrap: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityText: {
    color: '#1e3a8a',
    fontFamily: fonts.medium,
    fontSize: 16,
  },
  primaryBtn: {
    borderRadius: borderRadius.md,
    backgroundColor: '#EC7F25',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  editBtn: {
    backgroundColor: '#219ebc',
  },
  secondaryBtn: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  btnText: {
    color: '#0f172a',
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  btnTextInverted: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  emptyTitle: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 24,
    textAlign: 'center',
  },
  emptyBody: {
    color: '#475569',
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: '90%',
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 24,
    textAlign: 'center',
  },
  modalBody: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  inputLabel: {
    color: '#334155',
    fontFamily: fonts.medium,
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: borderRadius.md,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: '#0f172a',
    fontFamily: fonts.regular,
    backgroundColor: '#fff',
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dayCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  dayTitle: {
    color: '#0f172a',
    fontFamily: fonts.semibold,
    fontSize: 18,
  },
  daySwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayInputsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dayInput: {
    flex: 1,
  },
  amenityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  amenityOptionIconWrap: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: borderRadius.pill,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  checkCircleActive: {
    borderColor: '#EC7F25',
    backgroundColor: '#EC7F25',
  },
  amenityOptionText: {
    color: '#0f172a',
    fontFamily: fonts.medium,
    fontSize: 16,
  },
});
