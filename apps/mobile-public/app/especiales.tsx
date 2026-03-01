import {
  calcularDistanciaHaversineKm,
  formatearMonedaUSD,
  formatearTelefonoDisplay,
  formatearTelefonoHref,
} from '@findixi/shared';
import { FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PublicAppChrome } from '../src/components/layout/PublicAppChrome';
import { fetchEspecialesDelDia } from '../src/features/especiales/api';
import { getEspecialesDayLabel, tEspeciales } from '../src/features/especiales/i18n';
import type { EspecialComercio, EspecialGrupo, EspecialTipo } from '../src/features/especiales/types';
import { useI18n } from '../src/i18n/provider';
import { getFavoriteComercioIds } from '../src/lib/favorites';
import { requestUserLocation, type UserLocation } from '../src/lib/location';
import { borderRadius, fonts, shadows, spacing } from '../src/theme/tokens';

type OrderValue = 'ubicacion' | 'az' | 'recientes';
type SelectOption = { value: string; label: string };

const ESPECIAL_IMAGE_FALLBACK = 'https://via.placeholder.com/100x100.png?text=Especial';
const WEB_LOADER_IMAGE_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/loader.png';

function isLunchTime(date = new Date()): boolean {
  const hour = date.getHours() + date.getMinutes() / 60;
  return hour >= 2 && hour < 15.5;
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function estimateMinutesByCar(from: UserLocation | null, comercio: EspecialComercio): number | null {
  if (!from) return null;
  if (!Number.isFinite(comercio.latitud) || !Number.isFinite(comercio.longitud)) return null;
  const km = calcularDistanciaHaversineKm(from.latitude, from.longitude, Number(comercio.latitud), Number(comercio.longitud));
  if (!Number.isFinite(km) || km <= 0) return null;
  return Math.max(1, Math.round((km / 40) * 60));
}

type WebLoaderProps = {
  text: string;
};

function WebLoader({ text }: WebLoaderProps) {
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
    <View style={styles.loaderWrap}>
      <Animated.Image source={{ uri: WEB_LOADER_IMAGE_URL }} style={[styles.loaderImage, { transform: [{ rotate: spin }] }]} />
      <Text style={styles.loaderText}>{text}</Text>
    </View>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  placeholder: string;
  options: SelectOption[];
  onChange: (value: string) => void;
};

function FilterSelect({ label, value, placeholder, options, onChange }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.selectBlock}>
      <Text style={styles.selectLabel}>{label}</Text>
      <Pressable style={styles.selectTrigger} onPress={() => setOpen(true)}>
        <View style={styles.selectChevronSlot} />
        <Text numberOfLines={1} style={[styles.selectValue, !selected ? styles.selectValuePlaceholder : null]}>
          {selected?.label || placeholder}
        </Text>
        <View style={styles.selectChevronSlot}>
          <Ionicons name="chevron-down" size={14} color="#6b7280" />
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
      <Text style={styles.toggleLabel}>{label}</Text>
      <Pressable onPress={() => onToggle(!value)} style={[styles.toggleTrack, value ? { backgroundColor: color } : null]}>
        <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : null]} />
      </Pressable>
    </View>
  );
}

type EspecialCardProps = {
  group: EspecialGrupo;
  lang: string;
  location: UserLocation | null;
};

function EspecialCard({ group, lang, location }: EspecialCardProps) {
  const router = useRouter();
  const comercio = group.comercio;
  const telefono = formatearTelefonoDisplay(comercio.telefono || '');
  const telefonoHref = formatearTelefonoHref(comercio.telefono || '');
  const minutos = estimateMinutesByCar(location, comercio);

  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.cardHeader}>
        {comercio.logoUrl ? (
          <Image source={{ uri: comercio.logoUrl }} style={styles.cardLogo} resizeMode="cover" />
        ) : (
          <View style={styles.cardLogoFallback}>
            <FontAwesome name="building-o" size={24} color="#6b7280" />
          </View>
        )}

        <View style={styles.cardHeaderTextCol}>
          <Pressable
            onPress={() => {
              router.push({
                pathname: '/comercio/[id]',
                params: { id: String(comercio.id) },
              });
            }}
          >
            <Text numberOfLines={2} style={styles.cardComercioName}>
              {comercio.nombre || tEspeciales('especiales.comercio', lang)}
            </Text>
          </Pressable>

          <View style={styles.cardMetaWrap}>
            {comercio.municipio ? (
              <View style={styles.cardMetaRow}>
                <FontAwesome name="map-pin" size={12} color="#3ea6c4" />
                <Text style={styles.cardMetaText} numberOfLines={1}>
                  {comercio.municipio}
                </Text>
              </View>
            ) : null}
            {Number.isFinite(minutos) ? (
              <View style={styles.cardMetaRow}>
                <FontAwesome name="car" size={12} color="#6b7280" />
                <Text style={styles.cardMetaSoftText}>{tEspeciales('especiales.minVehiculo', lang, { min: Number(minutos) })}</Text>
              </View>
            ) : null}
          </View>

          {telefonoHref ? (
            <Pressable
              style={({ pressed }) => [styles.phonePill, pressed ? styles.phonePillPressed : null]}
              onPress={() => void Linking.openURL(telefonoHref)}
            >
              <FontAwesome name="phone" size={12} color="#fff" />
              <Text style={styles.phoneText}>{telefono || comercio.telefono}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.specialsWrap}>
        {group.especiales.map((especial) => (
          <View key={especial.id} style={styles.specialRow}>
            <Image source={{ uri: especial.imagenUrl || ESPECIAL_IMAGE_FALLBACK }} style={styles.specialImage} resizeMode="cover" />
            <View style={styles.specialTextCol}>
              <Text numberOfLines={2} style={styles.specialName}>
                {especial.nombre}
              </Text>
              {especial.descripcion ? (
                <Text numberOfLines={3} style={styles.specialDesc}>
                  {especial.descripcion}
                </Text>
              ) : null}
              <Text style={styles.specialPrice}>
                {formatearMonedaUSD(especial.precio, {
                  fallback: tEspeciales('especiales.precioNoDisponible', lang),
                })}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function EspecialesScreen() {
  const { lang } = useI18n();
  const selectedTipo: EspecialTipo = isLunchTime() ? 'almuerzo' : 'happyhour';
  const [allGroups, setAllGroups] = useState<EspecialGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [selectedMunicipio, setSelectedMunicipio] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderValue>('ubicacion');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [especialesData, userLocation] = await Promise.all([
        fetchEspecialesDelDia(),
        requestUserLocation().catch(() => null),
      ]);
      setAllGroups(especialesData);
      setLocation(userLocation);
    } catch (loadError) {
      console.error('[mobile-public] Error cargando especiales:', loadError);
      setError(tEspeciales('especiales.error', lang));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getFavoriteComercioIds().then((ids) => {
        if (!active) return;
        setFavoriteIds(new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))));
      });

      return () => {
        active = false;
      };
    }, [])
  );

  const municipios = useMemo<SelectOption[]>(() => {
    const values = Array.from(
      new Set(
        allGroups
          .map((group) => String(group.comercio.municipio || '').trim())
          .filter((value) => value.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b, 'es'));

    return values.map((value) => ({ value, label: value }));
  }, [allGroups]);

  const orderOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'ubicacion', label: tEspeciales('especiales.ordenCercania', lang) },
      { value: 'az', label: tEspeciales('especiales.ordenAz', lang) },
      { value: 'recientes', label: tEspeciales('especiales.ordenRecientes', lang) },
    ],
    [lang]
  );

  const filteredGroups = useMemo(() => {
    const text = normalizeText(searchText);
    const municipioNorm = normalizeText(selectedMunicipio);

    const base = allGroups
      .map((group) => ({
        ...group,
        especiales: group.especiales.filter((item) => item.tipo === selectedTipo),
      }))
      .filter((group) => group.especiales.length > 0)
      .filter((group) => {
        const comercioName = normalizeText(group.comercio.nombre);
        const byName = !text || comercioName.includes(text);
        const byMunicipio = !municipioNorm || normalizeText(group.comercio.municipio) === municipioNorm;
        const byFav = !onlyFavorites || favoriteIds.has(group.comercio.id);
        return byName && byMunicipio && byFav;
      });

    const output = [...base];
    if (selectedOrder === 'az') {
      output.sort((a, b) => a.comercio.nombre.localeCompare(b.comercio.nombre, 'es'));
    } else if (selectedOrder === 'recientes') {
      output.sort((a, b) => {
        const maxA = Math.max(...a.especiales.map((item) => item.id));
        const maxB = Math.max(...b.especiales.map((item) => item.id));
        return maxB - maxA;
      });
    } else if (selectedOrder === 'ubicacion' && location) {
      output.sort((a, b) => {
        const minA = estimateMinutesByCar(location, a.comercio);
        const minB = estimateMinutesByCar(location, b.comercio);
        if (!Number.isFinite(minA) && !Number.isFinite(minB)) return 0;
        if (!Number.isFinite(minA)) return 1;
        if (!Number.isFinite(minB)) return -1;
        return Number(minA) - Number(minB);
      });
    }

    return output;
  }, [allGroups, favoriteIds, location, onlyFavorites, searchText, selectedMunicipio, selectedOrder, selectedTipo]);

  const dayLabel = useMemo(() => getEspecialesDayLabel(lang), [lang]);
  const titleLabel = selectedTipo === 'almuerzo' ? tEspeciales('especiales.almuerzo', lang) : tEspeciales('especiales.happyHour', lang);
  const titleIcon: keyof typeof FontAwesome5.glyphMap = selectedTipo === 'almuerzo' ? 'utensils' : 'glass-cheers';
  const titleIconColor = selectedTipo === 'almuerzo' ? '#3ea6c4' : '#ec4899';

  return (
    <PublicAppChrome>
      {({ onScroll, scrollEventThrottle, contentPaddingStyle }) => (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.content, contentPaddingStyle]}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
        >
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <FontAwesome5 name={titleIcon} size={20} color={titleIconColor} />
              <Text style={styles.pageTitle}>{titleLabel}</Text>
            </View>
            <Text style={styles.pageSubtitle}>{tEspeciales('especiales.paraHoy', lang, { dia: dayLabel })}</Text>
          </View>

          <View style={[styles.filterCard, shadows.card]}>
            <View style={styles.searchRow}>
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder={tEspeciales('especiales.buscar', lang)}
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
              <FontAwesome name="search" size={16} color="#9ca3af" />
            </View>

            <View style={styles.filtersRow}>
              <FilterSelect
                label={tEspeciales('especiales.municipios', lang)}
                value={selectedMunicipio}
                placeholder={tEspeciales('especiales.todosMunicipios', lang)}
                options={municipios}
                onChange={setSelectedMunicipio}
              />
              <FilterSelect
                label={tEspeciales('especiales.ordenarPor', lang)}
                value={selectedOrder}
                placeholder={tEspeciales('especiales.ordenCercania', lang)}
                options={orderOptions}
                onChange={(value) => setSelectedOrder((value as OrderValue) || 'ubicacion')}
              />
              <View style={styles.toggleInlineWrap}>
                <FilterToggle
                  label={tEspeciales('especiales.misFavoritos', lang)}
                  value={onlyFavorites}
                  color="#ec4899"
                  onToggle={setOnlyFavorites}
                />
              </View>
            </View>
          </View>

          {loading ? <WebLoader text={tEspeciales('especiales.cargando', lang)} /> : null}

          {!loading && error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={() => void loadData()}>
                <Text style={styles.retryButtonText}>{tEspeciales('especiales.reintentar', lang)}</Text>
              </Pressable>
            </View>
          ) : null}

          {!loading && !error ? (
            <View style={styles.cardsWrap}>
              {filteredGroups.length ? (
                filteredGroups.map((group) => (
                  <EspecialCard key={group.comercio.id} group={group} lang={lang} location={location} />
                ))
              ) : (
                <View style={[styles.emptyWrap, shadows.card]}>
                  <Text style={styles.emptyEmoji}>{selectedTipo === 'almuerzo' ? '🍴' : '🍻'}</Text>
                  <Text style={styles.emptyText}>
                    {selectedTipo === 'almuerzo'
                      ? tEspeciales('especiales.emptyAlmuerzo', lang)
                      : tEspeciales('especiales.emptyHappy', lang)}
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
    </PublicAppChrome>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  titleSection: {
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageTitle: {
    fontSize: 34,
    color: '#111827',
    fontFamily: fonts.semibold,
  },
  pageSubtitle: {
    fontSize: 20,
    color: '#6b7280',
    fontFamily: fonts.regular,
  },
  filterCard: {
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: spacing.md,
    gap: spacing.md,
  },
  searchRow: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: spacing.md,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontFamily: fonts.regular,
    fontSize: 16,
    paddingVertical: spacing.sm,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  selectBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  selectLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: fonts.semibold,
  },
  selectTrigger: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: borderRadius.sm,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  selectChevronSlot: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectValue: {
    flex: 1,
    textAlign: 'center',
    color: '#111827',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  selectValuePlaceholder: {
    color: '#94a3b8',
  },
  selectBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  selectSheet: {
    maxHeight: 320,
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: spacing.xs,
  },
  selectOption: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  selectOptionText: {
    color: '#111827',
    fontSize: 14,
    fontFamily: fonts.regular,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  selectOptionCheck: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleInlineWrap: {
    width: 88,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  toggleWrap: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleLabel: {
    color: '#374151',
    fontSize: 13,
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
  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  loaderImage: {
    width: 44,
    height: 44,
  },
  loaderText: {
    color: '#374151',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  errorWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    fontFamily: fonts.medium,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  retryButton: {
    borderRadius: borderRadius.pill,
    backgroundColor: '#ef4444',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  cardsWrap: {
    gap: spacing.md,
  },
  emptyWrap: {
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyEmoji: {
    fontSize: 26,
  },
  emptyText: {
    color: '#4b5563',
    fontSize: 15,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  card: {
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardLogo: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.pill,
    backgroundColor: '#f8fafc',
  },
  cardLogoFallback: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.pill,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTextCol: {
    flex: 1,
    gap: spacing.xs,
  },
  cardComercioName: {
    color: '#1f2937',
    fontSize: 26,
    lineHeight: 30,
    fontFamily: fonts.semibold,
  },
  cardMetaWrap: {
    gap: 2,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardMetaText: {
    flex: 1,
    color: '#3ea6c4',
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  cardMetaSoftText: {
    flex: 1,
    color: '#6b7280',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  phonePill: {
    alignSelf: 'flex-start',
    marginTop: 2,
    borderRadius: borderRadius.pill,
    backgroundColor: '#dc2626',
    paddingHorizontal: spacing.md,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  phonePillPressed: {
    opacity: 0.88,
  },
  phoneText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  specialsWrap: {
    gap: spacing.md,
  },
  specialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  specialImage: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  specialTextCol: {
    flex: 1,
    gap: spacing.xs,
  },
  specialName: {
    color: '#111827',
    fontSize: 21,
    lineHeight: 24,
    fontFamily: fonts.regular,
  },
  specialDesc: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.light,
  },
  specialPrice: {
    color: '#111827',
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.medium,
    marginTop: 2,
  },
});
