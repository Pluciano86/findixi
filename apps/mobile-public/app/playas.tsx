import {
  calcularDistanciaHaversineKm,
  calcularTiempoEnVehiculo,
  DEFAULT_APP_BASE_URLS,
} from '@findixi/shared';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
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
import { SvgCssUri } from 'react-native-svg/css';

import { PublicAppChrome } from '../src/components/layout/PublicAppChrome';
import { HomeCarousel } from '../src/components/home/HomeCarousel';
import { fetchGlobalBanners } from '../src/features/home/api';
import type { HomeBannerItem } from '../src/features/home/types';
import { fetchBeachWeather, fetchListadoPlayasData } from '../src/features/playas/api';
import { tPlayas, traducirCosta } from '../src/features/playas/i18n';
import type { PlayaListItem, PlayaWeather } from '../src/features/playas/types';
import { useI18n } from '../src/i18n/provider';
import { requestUserLocation, type UserLocation } from '../src/lib/location';
import { getDrivingDistance } from '../src/lib/osrm';
import { borderRadius, fonts, shadows, spacing } from '../src/theme/tokens';

const PAGE_SIZE = 20;
const PLAYA_PLACEHOLDER =
  'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/imgPlayaNoDisponible.jpg';
const WEB_LOADER_IMAGE_URL =
  'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/loader.png';

type SelectOption = {
  value: string;
  label: string;
};

type PlayaCardProps = {
  item: PlayaListItem;
  lang: string;
  clima: PlayaWeather | null;
  tiempoTexto: string;
  onPress: () => void;
};

function normalizeFilterText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function formatTravelConversational(minutes: number): string {
  if (!Number.isFinite(minutes)) return 'N/D';
  if (minutes < 60) return `a ${minutes} minutos`;
  const horas = Math.floor(minutes / 60);
  const mins = minutes % 60;
  let texto = `a ${horas} hora${horas === 1 ? '' : 's'}`;
  if (mins > 0) texto += ` y ${mins} minutos`;
  return texto;
}

function toFinite(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function WebLoader({ text }: { text: string }) {
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
        <Text numberOfLines={1} style={[styles.selectValue, !selected ? styles.selectValuePlaceholder : null]}>
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#6b7280" />
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
                {!value ? <Ionicons name="checkmark" size={16} color="#3ea6c4" /> : null}
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
                  {value === option.value ? <Ionicons name="checkmark" size={16} color="#3ea6c4" /> : null}
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
      <Pressable
        onPress={() => onToggle(!value)}
        style={[styles.toggleTrack, value ? { backgroundColor: color } : null]}
      >
        <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : null]} />
      </Pressable>
    </View>
  );
}

function PlayaCard({ item, lang, clima, tiempoTexto, onPress }: PlayaCardProps) {
  const [imageUri, setImageUri] = useState<string>(item.imagen || PLAYA_PLACEHOLDER);

  useEffect(() => {
    setImageUri(item.imagen || PLAYA_PLACEHOLDER);
  }, [item.imagen]);

  const tieneImagen = Boolean(item.imagen && item.imagen.trim() !== '');

  return (
    <Pressable style={[styles.card, shadows.card]} onPress={onPress}>
      <View style={styles.cardImageWrap}>
        <Image
          source={{ uri: imageUri || PLAYA_PLACEHOLDER }}
          style={styles.cardImage}
          resizeMode="cover"
          onError={() => {
            setImageUri(PLAYA_PLACEHOLDER);
          }}
        />

        {!tieneImagen ? (
          <View style={styles.noImageOverlay}>
            <Text style={styles.noImageText}>{tPlayas('playa.noImageTitle', lang)}</Text>
            <Text style={styles.noImageText}>{tPlayas('playa.noImageSubtitle', lang)}</Text>
          </View>
        ) : null}

        {item.favorito ? (
          <View style={styles.favoriteBadge}>
            <View style={styles.favoriteBadgeInner}>
              <FontAwesome name="heart" size={9} color="#dc2626" />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={2}>
          {item.nombre}
        </Text>

        <Text style={styles.cardAptaLabel}>{tPlayas('playas.aptaPara', lang)}</Text>

        <View style={styles.cardAptitudesRow}>
          {item.nadar ? (
            <View style={styles.aptitudCol}>
              <Text style={styles.aptitudEmoji}>🏊‍♂️</Text>
              <Text style={styles.aptitudText}>{tPlayas('playas.nadar', lang)}</Text>
            </View>
          ) : null}
          {item.surfear ? (
            <View style={styles.aptitudCol}>
              <Text style={styles.aptitudEmoji}>🏄‍♂️</Text>
              <Text style={styles.aptitudText}>{tPlayas('playas.surfear', lang)}</Text>
            </View>
          ) : null}
          {item.snorkel ? (
            <View style={styles.aptitudCol}>
              <Text style={styles.aptitudEmoji}>🤿</Text>
              <Text style={styles.aptitudText}>{tPlayas('playas.snorkel', lang)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.weatherRow}>
          {clima?.iconoUrl ? (
            <SvgCssUri width={22} height={22} uri={clima.iconoUrl} />
          ) : (
            <FontAwesome name="sun-o" size={16} color="#facc15" />
          )}
          <Text style={styles.weatherStateText} numberOfLines={1}>
            {clima?.estado || tPlayas('playas.climaDesconocido', lang)}
          </Text>
        </View>

        <View style={styles.windRow}>
          <FontAwesome name="send-o" size={12} color="#9ca3af" />
          <Text style={styles.windText} numberOfLines={1}>
            {tPlayas('playas.vientoDe', lang, {
              valor: clima?.viento || '-- mph',
            })}
          </Text>
        </View>

        <View style={styles.municipioRow}>
          <FontAwesome name="map-pin" size={12} color="#3ea6c4" />
          <Text style={styles.municipioText} numberOfLines={1}>
            {item.municipio}
          </Text>
        </View>

        {tiempoTexto ? (
          <View style={styles.transportRow}>
            <FontAwesome name={item.bote ? 'ship' : 'car'} size={12} color="#9c9c9c" />
            <Text style={styles.transportText} numberOfLines={2}>
              {tiempoTexto}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ListadoPlayasScreen() {
  const { lang } = useI18n();
  const [allPlayas, setAllPlayas] = useState<PlayaListItem[]>([]);
  const [banners, setBanners] = useState<HomeBannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedCosta, setSelectedCosta] = useState('');
  const [selectedMunicipio, setSelectedMunicipio] = useState('');
  const [onlyNadar, setOnlyNadar] = useState(false);
  const [onlySurfear, setOnlySurfear] = useState(false);
  const [onlySnorkel, setOnlySnorkel] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [weatherByPlayaId, setWeatherByPlayaId] = useState<Record<number, PlayaWeather | null>>({});
  const [travelByPlayaId, setTravelByPlayaId] = useState<Record<number, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [playasData, bannerData, userLocation] = await Promise.all([
        fetchListadoPlayasData(),
        fetchGlobalBanners(),
        requestUserLocation().catch(() => null),
      ]);

      setAllPlayas(playasData);
      setBanners(bannerData);
      setLocation(userLocation);
      setWeatherByPlayaId({});
      setTravelByPlayaId({});
    } catch (loadError) {
      console.error('[mobile-public] Error cargando listadoPlayas:', loadError);
      setError(tPlayas('playas.errorCargar', lang));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchText, selectedCosta, selectedMunicipio, onlyNadar, onlySurfear, onlySnorkel]);

  const costaOptions = useMemo<SelectOption[]>(() => {
    const seen = new Set<string>();

    allPlayas.forEach((playa) => {
      const value = (playa.costa || '').trim();
      if (!value) return;
      seen.add(value);
    });

    return Array.from(seen)
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((value) => ({ value, label: traducirCosta(lang, value) }));
  }, [allPlayas, lang]);

  const municipioOptions = useMemo<SelectOption[]>(() => {
    const coastValue = normalizeFilterText(selectedCosta);
    const seen = new Set<string>();

    allPlayas.forEach((playa) => {
      const playaCosta = normalizeFilterText(playa.costa);
      if (coastValue && playaCosta !== coastValue) return;
      const municipio = (playa.municipio || '').trim();
      if (municipio) seen.add(municipio);
    });

    return Array.from(seen)
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((value) => ({ value, label: value }));
  }, [allPlayas, selectedCosta]);

  useEffect(() => {
    if (!selectedMunicipio) return;
    const exists = municipioOptions.some((option) => option.value === selectedMunicipio);
    if (!exists) {
      setSelectedMunicipio('');
    }
  }, [municipioOptions, selectedMunicipio]);

  const filteredFull = useMemo(() => {
    const searchNormalized = normalizeFilterText(searchText);
    const coastNormalized = normalizeFilterText(selectedCosta);

    return allPlayas.filter((playa) => {
      const nombre = normalizeFilterText(playa.nombre);
      const costa = normalizeFilterText(playa.costa);
      const municipio = normalizeFilterText(playa.municipio);

      const coincideNombre = !searchNormalized || nombre.includes(searchNormalized);
      const coincideCosta = !coastNormalized || costa === coastNormalized;
      const coincideMunicipio = !selectedMunicipio || municipio === normalizeFilterText(selectedMunicipio);
      const coincideNadar = !onlyNadar || playa.nadar;
      const coincideSurfear = !onlySurfear || playa.surfear;
      const coincideSnorkel = !onlySnorkel || playa.snorkel;

      return (
        coincideNombre &&
        coincideCosta &&
        coincideMunicipio &&
        coincideNadar &&
        coincideSurfear &&
        coincideSnorkel
      );
    });
  }, [
    allPlayas,
    onlyNadar,
    onlySnorkel,
    onlySurfear,
    searchText,
    selectedCosta,
    selectedMunicipio,
  ]);

  const visiblePlayas = useMemo(() => {
    if (!location) {
      return filteredFull.slice(0, visibleCount);
    }

    const withCoords = filteredFull
      .filter((playa) => Number.isFinite(playa.latitud) && Number.isFinite(playa.longitud))
      .map((playa) => {
        const distancia = calcularDistanciaHaversineKm(
          location.latitude,
          location.longitude,
          Number(playa.latitud),
          Number(playa.longitud)
        );
        return {
          ...playa,
          _distance: distancia,
        };
      })
      .sort((a, b) => a._distance - b._distance);

    const withoutCoords = filteredFull.filter((playa) => !Number.isFinite(playa.latitud) || !Number.isFinite(playa.longitud));

    const prioritized = withCoords.slice(0, visibleCount);
    if (prioritized.length < visibleCount) {
      const missingCount = visibleCount - prioritized.length;
      return [...prioritized, ...withoutCoords.slice(0, missingCount)];
    }

    return prioritized;
  }, [filteredFull, location, visibleCount]);

  const filterSummary = useMemo(() => {
    const activeFilters: string[] = [];
    const searchNormalized = normalizeFilterText(searchText);

    if (searchNormalized) {
      activeFilters.push(
        tPlayas('playas.filtroNombre', lang, {
          valor: searchText.trim(),
        })
      );
    }

    if (selectedCosta) {
      activeFilters.push(
        tPlayas('playas.filtroCosta', lang, {
          valor: traducirCosta(lang, selectedCosta),
        })
      );
    }

    if (selectedMunicipio) {
      activeFilters.push(
        tPlayas('playas.filtroMunicipio', lang, {
          valor: selectedMunicipio,
        })
      );
    }

    if (onlyNadar) activeFilters.push(tPlayas('playas.filtroNadar', lang));
    if (onlySurfear) activeFilters.push(tPlayas('playas.filtroSurfear', lang));
    if (onlySnorkel) activeFilters.push(tPlayas('playas.filtroSnorkel', lang));

    if (!activeFilters.length) {
      return tPlayas('playas.sinResultados', lang);
    }

    return tPlayas('playas.sinResultadosConFiltros', lang, {
      filtros: activeFilters.join(', '),
    });
  }, [lang, onlyNadar, onlySnorkel, onlySurfear, searchText, selectedCosta, selectedMunicipio]);

  const weatherTargets = useMemo(
    () =>
      visiblePlayas.filter((playa) => {
        if (weatherByPlayaId[playa.id] !== undefined) return false;
        const lat = toFinite(playa.latitud);
        const lon = toFinite(playa.longitud);
        return Number.isFinite(lat) && Number.isFinite(lon);
      }),
    [visiblePlayas, weatherByPlayaId]
  );

  useEffect(() => {
    if (!weatherTargets.length) return;

    let active = true;

    void Promise.all(
      weatherTargets.map(async (playa) => {
        const lat = Number(playa.latitud);
        const lon = Number(playa.longitud);
        const clima = await fetchBeachWeather(lat, lon, lang);
        return [playa.id, clima] as const;
      })
    ).then((results) => {
      if (!active) return;
      setWeatherByPlayaId((current) => {
        const next = { ...current };
        results.forEach(([id, clima]) => {
          next[id] = clima;
        });
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [lang, weatherTargets]);

  const travelTargets = useMemo(
    () =>
      visiblePlayas.filter((playa) => {
        if (!location) return false;
        if (playa.bote) return false;
        if (travelByPlayaId[playa.id]) return false;
        const lat = toFinite(playa.latitud);
        const lon = toFinite(playa.longitud);
        return Number.isFinite(lat) && Number.isFinite(lon);
      }),
    [visiblePlayas, travelByPlayaId, location]
  );

  useEffect(() => {
    if (!location || !travelTargets.length) return;

    let active = true;

    void Promise.all(
      travelTargets.map(async (playa) => {
        const lat = Number(playa.latitud);
        const lon = Number(playa.longitud);

        const fallbackKm = calcularDistanciaHaversineKm(location.latitude, location.longitude, lat, lon);
        const fallbackTravel = calcularTiempoEnVehiculo(fallbackKm);
        let minutos = Number.isFinite(fallbackTravel.minutos)
          ? Math.max(0, Math.round(Number(fallbackTravel.minutos)))
          : null;

        try {
          const route = await getDrivingDistance(
            { lat: location.latitude, lng: location.longitude },
            { lat, lng: lon }
          );
          if (route && Number.isFinite(route.duracion)) {
            minutos = Math.max(0, Math.round(route.duracion / 60));
          }
        } catch {
          // usa fallback
        }

        const texto = Number.isFinite(minutos) ? formatTravelConversational(Number(minutos)) : 'N/D';
        return [playa.id, texto] as const;
      })
    ).then((results) => {
      if (!active) return;
      setTravelByPlayaId((current) => {
        const next = { ...current };
        results.forEach(([id, texto]) => {
          next[id] = texto;
        });
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [location, travelTargets]);

  const groupedRows = useMemo(() => {
    const rows: PlayaListItem[][] = [];
    for (let index = 0; index < visiblePlayas.length; index += 2) {
      rows.push(visiblePlayas.slice(index, index + 2));
    }
    return rows;
  }, [visiblePlayas]);

  const showBottomBanner = groupedRows.length === 0 || groupedRows.length % 4 !== 0;
  const canShowMore = filteredFull.length > visibleCount;

  return (
    <PublicAppChrome>
      {({ onScroll, scrollEventThrottle, contentPaddingStyle }) => (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.content, contentPaddingStyle]}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
        >
          {banners.length ? <HomeCarousel items={banners} /> : null}

          <View style={styles.filterSection}>
            <Text style={styles.title}>{tPlayas('playas.heading', lang)}</Text>

            <View style={styles.filterCard}>
              <View style={styles.searchRow}>
                <View style={styles.searchIconLeftWrap}>
                  <FontAwesome name="umbrella" size={17} color="#3ea6c4" />
                </View>

                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder={tPlayas('playas.searchPlaceholder', lang)}
                  placeholderTextColor="#94a3b8"
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <FontAwesome name="search" size={16} color="#9ca3af" />
              </View>

              <View style={styles.selectsRow}>
                <FilterSelect
                  label={tPlayas('playas.costaLabel', lang)}
                  value={selectedCosta}
                  placeholder={tPlayas('playas.todasCostas', lang)}
                  options={costaOptions}
                  onChange={setSelectedCosta}
                />

                <FilterSelect
                  label={tPlayas('playas.municipiosLabel', lang)}
                  value={selectedMunicipio}
                  placeholder={tPlayas('playas.todosMunicipios', lang)}
                  options={municipioOptions}
                  onChange={setSelectedMunicipio}
                />
              </View>

              <View style={styles.togglesRow}>
                <FilterToggle
                  label={tPlayas('playas.aptaNadar', lang)}
                  value={onlyNadar}
                  color="#3b82f6"
                  onToggle={setOnlyNadar}
                />
                <FilterToggle
                  label={tPlayas('playas.aptaSurfear', lang)}
                  value={onlySurfear}
                  color="#eab308"
                  onToggle={setOnlySurfear}
                />
                <FilterToggle
                  label={tPlayas('playas.aptaSnorkel', lang)}
                  value={onlySnorkel}
                  color="#16a34a"
                  onToggle={setOnlySnorkel}
                />
              </View>
            </View>
          </View>

          {loading ? <WebLoader text={tPlayas('playas.loading', lang)} /> : null}

          {!loading && error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={() => void loadData()}>
                <Text style={styles.retryButtonText}>{tPlayas('playas.reintentar', lang)}</Text>
              </Pressable>
            </View>
          ) : null}

          {!loading && !error && filteredFull.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🏖️</Text>
              <Text style={styles.emptyText}>{filterSummary}</Text>
            </View>
          ) : null}

          {!loading && !error && filteredFull.length > 0 ? (
            <View style={styles.gridWrap}>
              {groupedRows.map((row, rowIndex) => {
                const isLastRow = rowIndex === groupedRows.length - 1;
                const shouldInsertBanner = banners.length > 0 && (rowIndex + 1) % 4 === 0 && !isLastRow;

                return (
                  <View key={`playa-row-${rowIndex}`}>
                    <View style={styles.gridRow}>
                      {row.map((item) => {
                        const weather = weatherByPlayaId[item.id] ?? null;

                        const travelText = item.bote
                          ? tPlayas('playas.accesoBote', lang)
                          : travelByPlayaId[item.id] ||
                            (location && Number.isFinite(item.latitud) && Number.isFinite(item.longitud)
                              ? tPlayas('playas.calculando', lang)
                              : '');

                        return (
                          <View key={`playa-${item.id}`} style={styles.gridColumn}>
                            <PlayaCard
                              item={item}
                              lang={lang}
                              clima={weather}
                              tiempoTexto={travelText}
                              onPress={() => {
                                void Linking.openURL(`${DEFAULT_APP_BASE_URLS.public}/perfilPlaya.html?id=${item.id}`);
                              }}
                            />
                          </View>
                        );
                      })}

                      {row.length === 1 ? <View style={styles.gridColumn} /> : null}
                    </View>

                    {shouldInsertBanner ? <HomeCarousel items={banners} /> : null}
                  </View>
                );
              })}

              {banners.length > 0 && showBottomBanner ? <HomeCarousel items={banners} /> : null}

              {canShowMore ? (
                <View style={styles.moreWrap}>
                  <Pressable style={styles.moreButton} onPress={() => setVisibleCount((current) => current + PAGE_SIZE)}>
                    <Text style={styles.moreButtonText}>{tPlayas('playas.verSiguientes', lang)}</Text>
                  </Pressable>
                </View>
              ) : null}
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
    backgroundColor: '#ffffff',
  },
  content: {
    paddingBottom: spacing.xl,
  },
  filterSection: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    textAlign: 'center',
    color: '#111827',
    fontSize: 31,
    fontFamily: fonts.medium,
    marginBottom: spacing.sm,
  },
  filterCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchIconLeftWrap: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: '#0f172a',
    fontSize: 15,
    fontFamily: fonts.regular,
  },
  selectsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selectBlock: {
    flex: 1,
  },
  selectLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: fonts.semibold,
    marginBottom: 4,
  },
  selectTrigger: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    minHeight: 33,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  selectValue: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  selectValuePlaceholder: {
    color: '#94a3b8',
  },
  selectBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.35)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  selectSheet: {
    maxHeight: '60%',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  selectOptionText: {
    color: '#111827',
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  togglesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  toggleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  toggleLabel: {
    marginBottom: 6,
    color: '#374151',
    fontSize: 12,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d1d5db',
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    transform: [{ translateX: 0 }],
  },
  toggleKnobOn: {
    transform: [{ translateX: 20 }],
  },
  loaderWrap: {
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loaderImage: {
    width: 64,
    height: 64,
  },
  loaderText: {
    color: '#6b7280',
    fontSize: 18,
    fontFamily: fonts.medium,
  },
  errorWrap: {
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: borderRadius.pill,
    backgroundColor: '#023047',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  emptyWrap: {
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  emptyEmoji: {
    fontSize: 44,
    lineHeight: 50,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: fonts.medium,
  },
  gridWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridColumn: {
    flex: 1,
  },
  card: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  cardImageWrap: {
    height: 160,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  noImageOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.35)',
    paddingHorizontal: spacing.sm,
  },
  noImageText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: fonts.semibold,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  favoriteBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  favoriteBadgeInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cardName: {
    color: '#424242',
    fontSize: 20,
    lineHeight: 19,
    minHeight: 38,
    fontFamily: fonts.medium,
    textAlign: 'center',
    marginBottom: 2,
  },
  cardAptaLabel: {
    color: '#6b7280',
    fontSize: 14,
    fontFamily: fonts.regular,
    marginBottom: 4,
    marginTop: -2,
  },
  cardAptitudesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 55,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  aptitudCol: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  aptitudEmoji: {
    fontSize: 32,
    lineHeight: 34,
  },
  aptitudText: {
    color: '#3ea6c4',
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: -2,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  weatherStateText: {
    color: '#4b5563',
    fontSize: 12,
    fontFamily: fonts.regular,
    maxWidth: 100,
  },
  windRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  windText: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: fonts.regular,
    maxWidth: 100,
  },
  municipioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  municipioText: {
    color: '#3ea6c4',
    fontSize: 13,
    fontFamily: fonts.medium,
    maxWidth: 104,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  transportText: {
    color: '#9c9c9c',
    fontSize: 12,
    fontFamily: fonts.regular,
    textAlign: 'center',
    maxWidth: 104,
  },
  moreWrap: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  moreButton: {
    borderRadius: borderRadius.pill,
    backgroundColor: '#023047',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadows.card,
  },
  moreButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
});
