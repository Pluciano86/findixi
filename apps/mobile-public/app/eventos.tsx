import { FontAwesome, FontAwesome5, FontAwesome6, Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { HomeCarousel } from '../src/components/home/HomeCarousel';
import { HomeEventoModal } from '../src/components/home/HomeEventoModal';
import { fetchListadoEventosData } from '../src/features/eventos/api';
import { tEventos } from '../src/features/eventos/i18n';
import type { EventoListadoItem, EventoOption } from '../src/features/eventos/types';
import { fetchGlobalBanners } from '../src/features/home/api';
import { preloadEventoTraducciones } from '../src/features/home/eventoI18n';
import type { HomeBannerItem, HomeEventoCard, HomeEventoFechaItem } from '../src/features/home/types';
import { useI18n } from '../src/i18n/provider';
import { borderRadius, fonts, shadows, spacing } from '../src/theme/tokens';

type OrderValue = 'fechaAsc' | 'fechaDesc' | 'alfabetico';

type FilterSelectProps = {
  label: string;
  value: string;
  placeholder: string;
  options: EventoOption[];
  onChange: (value: string) => void;
  showIcons?: boolean;
};

type EventCardProps = {
  item: EventoListadoItem;
  lang: string;
  desdeLabel: string;
  municipioFilterId: number | null;
  onPress: () => void;
};

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function parseIsoDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function resolveLocale(lang: string): string {
  const code = String(lang || 'es').toLowerCase().split('-')[0];
  const map: Record<string, string> = {
    es: 'es-PR',
    en: 'en-US',
    fr: 'fr-FR',
    pt: 'pt-PT',
    de: 'de-DE',
    it: 'it-IT',
    zh: 'zh-CN',
    ko: 'ko-KR',
    ja: 'ja-JP',
  };
  return map[code] || 'es-PR';
}

function capitalizeWord(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sortDates(items: HomeEventoFechaItem[]): HomeEventoFechaItem[] {
  return [...items].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function getUpcomingDate(item: EventoListadoItem): HomeEventoFechaItem | null {
  const todayISO = new Date().toISOString().slice(0, 10);
  const sorted = sortDates(item.eventoFechas || []);
  return sorted.find((entry) => entry.fecha >= todayISO) || sorted[sorted.length - 1] || null;
}

function formatDateParts(value: string, lang: string): { weekday: string; rest: string } | null {
  const date = parseIsoDate(value);
  if (!date) return null;

  const locale = resolveLocale(lang);
  const weekday = capitalizeWord(
    date.toLocaleDateString(locale, {
      weekday: 'long',
      timeZone: 'UTC',
    })
  );

  const rest = date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return { weekday, rest };
}

function formatTime(value: string, lang: string): string {
  if (!value) return '';
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';

  const date = new Date(Date.UTC(1970, 0, 1, hour, minute));
  return date
    .toLocaleTimeString(resolveLocale(lang), {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    })
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '');
}

function normalizeAmount(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  const withoutSymbol = raw.replace(/^\s*\$\s*/, '');
  const numericLike = /^[\d,.]+$/.test(withoutSymbol);
  if (!raw.startsWith('$') && numericLike) return `$${withoutSymbol}`;
  return raw;
}

function splitTwoLinesLabel(value: string): { top: string; bottom: string } {
  const text = String(value || '').trim();
  if (!text) return { top: '', bottom: '' };

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { top: text, bottom: '' };

  return {
    top: words.slice(0, -1).join(' '),
    bottom: words[words.length - 1],
  };
}

function getCardCostText(item: EventoListadoItem, lang: string, desdeLabel: string): string {
  if (item.gratis) return tEventos('eventos.gratis', lang);

  const raw = String(item.costo || '').trim();
  if (!raw) return tEventos('evento.costoNoDisponible', lang);

  const lower = raw.toLowerCase();
  if (lower.startsWith('desde')) {
    const amount = raw.replace(/^desde\s*:?/i, '').trim();
    return `${desdeLabel} ${normalizeAmount(amount)}`;
  }

  if (lower.startsWith('costo')) return raw;
  return tEventos('evento.costoLabel', lang, { costo: normalizeAmount(raw) });
}

function eventIsToday(item: EventoListadoItem): boolean {
  const todayISO = new Date().toISOString().slice(0, 10);
  return item.eventoFechas.some((fecha) => fecha.fecha === todayISO);
}

function eventIsThisWeek(item: EventoListadoItem): boolean {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return item.eventoFechas.some((fecha) => {
    const date = new Date(`${fecha.fecha}T00:00:00`);
    return date >= start && date <= end;
  });
}

type ParsedCategoryIcon = {
  name: string;
  iconStyle: 'solid' | 'regular' | 'brands';
};

function parseCategoryIcon(value: string): ParsedCategoryIcon | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const tokens = raw.split(/\s+/).filter(Boolean);
  const iconStyle: ParsedCategoryIcon['iconStyle'] = tokens.includes('fa-brands') || tokens.includes('fab')
    ? 'brands'
    : tokens.includes('fa-regular') || tokens.includes('far')
      ? 'regular'
      : 'solid';

  const iconToken = tokens.find(
    (token) =>
      token.startsWith('fa-') &&
      token !== 'fa-solid' &&
      token !== 'fa-regular' &&
      token !== 'fa-light' &&
      token !== 'fa-thin' &&
      token !== 'fa-brands'
  );

  if (iconToken) return { name: iconToken.replace(/^fa-/, ''), iconStyle };
  if (raw.startsWith('fa-')) return { name: raw.replace(/^fa-/, ''), iconStyle };
  if (/^[a-z0-9-]+$/i.test(raw)) return { name: raw, iconStyle };
  return null;
}

function CategoryIcon({
  rawValue,
  size,
  color,
}: {
  rawValue: string;
  size: number;
  color: string;
}) {
  const parsed = parseCategoryIcon(rawValue);
  if (!parsed) return null;

  if (parsed.iconStyle === 'brands') {
    return <FontAwesome5 name={parsed.name as never} size={size} color={color} brand />;
  }

  return <FontAwesome5 name={parsed.name as never} size={size} color={color} solid={parsed.iconStyle === 'solid'} />;
}

function FilterSelect({ label, value, placeholder, options, onChange, showIcons = false }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.selectBlock}>
      <Text style={styles.selectLabel}>{label}</Text>

      <Pressable style={styles.selectTrigger} onPress={() => setOpen(true)}>
        <View style={styles.selectChevronSlot} />
        <View style={styles.selectValueContent}>
          {showIcons && selected?.iconName ? <CategoryIcon rawValue={selected.iconName} size={12} color="#f97316" /> : null}
          <Text numberOfLines={1} style={[styles.selectValue, !selected ? styles.selectValuePlaceholder : null]}>
            {selected?.label || placeholder}
          </Text>
        </View>
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
                <View style={styles.selectOptionContent}>
                  <Text style={styles.selectOptionText}>{placeholder}</Text>
                </View>
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
                  <View style={styles.selectOptionContent}>
                    {showIcons && option.iconName ? <CategoryIcon rawValue={option.iconName} size={13} color="#f97316" /> : null}
                    <Text style={styles.selectOptionText}>{option.label}</Text>
                  </View>
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

function FilterToggle({ label, value, color, onToggle }: { label: string; value: boolean; color: string; onToggle: (next: boolean) => void }) {
  return (
    <View style={styles.toggleWrap}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Pressable onPress={() => onToggle(!value)} style={[styles.toggleTrack, value ? { backgroundColor: color } : null]}>
        <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : null]} />
      </Pressable>
    </View>
  );
}

function EventCard({ item, lang, desdeLabel, municipioFilterId, onPress }: EventCardProps) {
  const eventDates = useMemo(() => {
    const base = Array.isArray(item.eventoFechas) ? item.eventoFechas : [];
    return municipioFilterId ? base.filter((entry) => entry.municipioId === municipioFilterId) : base;
  }, [item.eventoFechas, municipioFilterId]);

  const hasMultipleDates = eventDates.length > 1;
  const nextDate = !hasMultipleDates ? eventDates[0] || getUpcomingDate(item) : null;
  const dateParts = nextDate ? formatDateParts(nextDate.fecha, lang) : null;
  const timeText = nextDate?.horainicio ? formatTime(nextDate.horainicio, lang) : '';
  const multipleDatesLabel = splitTwoLinesLabel(tEventos('evento.variasFechas', lang));

  const titleSmall = (item.nombre || '').length > 25;
  const municipioLabel =
    item.municipioIds.length > 1
      ? tEventos('evento.variosMunicipios', lang)
      : eventDates[0]?.municipioNombre || item.eventoFechas[0]?.municipioNombre || '';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardImageWrap}>
        <Image source={{ uri: item.imageUrl }} style={styles.cardImageBg} resizeMode="cover" blurRadius={14} />
        <Image source={{ uri: item.imageUrl }} style={styles.cardImageFg} resizeMode="contain" />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardBodyTop}>
          <View style={styles.cardTitleWrap}>
            <Text style={[styles.cardTitle, titleSmall ? styles.cardTitleSmall : null]} numberOfLines={2}>
              {item.nombre}
            </Text>
          </View>

          <View style={styles.cardCategoryRow}>
            <CategoryIcon rawValue={item.categoriaIcono} size={11} color="#f97316" />
            <Text style={styles.cardCategoryText} numberOfLines={1}>
              {item.categoriaNombre}
            </Text>
          </View>

          {hasMultipleDates ? (
            <View style={styles.cardDateWrap}>
              <Text style={styles.cardDateText}>{multipleDatesLabel.top}</Text>
              <Text style={styles.cardDateText}>{multipleDatesLabel.bottom}</Text>
            </View>
          ) : dateParts ? (
            <View style={styles.cardDateWrap}>
              <Text style={styles.cardDateText}>{dateParts.weekday}</Text>
              <Text style={styles.cardDateText}>{dateParts.rest}</Text>
            </View>
          ) : (
            <View style={styles.cardDateWrap}>
              <Text style={styles.cardDateText}>{tEventos('evento.sinFecha', lang)}</Text>
            </View>
          )}

          <View style={styles.cardTimeSlot}>
            {!hasMultipleDates && timeText ? <Text style={styles.cardTimeText}>{timeText}</Text> : null}
          </View>

          <View style={styles.cardMunicipioRow}>
            <FontAwesome name="map-pin" size={11} color="#23B4E9" />
            <Text style={styles.cardMunicipioText} numberOfLines={2}>
              {municipioLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.cardCostText}>{getCardCostText(item, lang, desdeLabel)}</Text>
      </View>
    </Pressable>
  );
}

export default function EventosScreen() {
  const { lang, t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventos, setEventos] = useState<EventoListadoItem[]>([]);
  const [municipios, setMunicipios] = useState<EventoOption[]>([]);
  const [categorias, setCategorias] = useState<EventoOption[]>([]);
  const [banners, setBanners] = useState<HomeBannerItem[]>([]);

  const [searchText, setSearchText] = useState('');
  const [selectedMunicipio, setSelectedMunicipio] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderValue>('fechaAsc');
  const [onlyToday, setOnlyToday] = useState(false);
  const [onlyWeek, setOnlyWeek] = useState(false);
  const [onlyFree, setOnlyFree] = useState(false);

  const [selectedEvento, setSelectedEvento] = useState<HomeEventoCard | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [listadoData, bannerData] = await Promise.all([fetchListadoEventosData(lang), fetchGlobalBanners()]);
      setEventos(listadoData.eventos);
      setMunicipios(listadoData.municipios.map((item) => ({ ...item, iconName: '' })));
      setCategorias(listadoData.categorias);
      setBanners(bannerData);
    } catch (loadError) {
      console.error('[mobile-public] Error cargando listado de eventos:', loadError);
      setError(tEventos('eventos.errorCargar', lang));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!eventos.length) return;
    void preloadEventoTraducciones(
      eventos.map((item) => item.id).filter((id) => Number.isFinite(id) && id > 0),
      lang
    );
  }, [eventos, lang]);

  const orderOptions = useMemo<EventoOption[]>(
    () => [
      { value: 'fechaAsc', label: tEventos('eventos.fechaAsc', lang), iconName: '' },
      { value: 'fechaDesc', label: tEventos('eventos.fechaDesc', lang), iconName: '' },
      { value: 'alfabetico', label: tEventos('eventos.alfabetico', lang), iconName: '' },
    ],
    [lang]
  );

  const filteredEvents = useMemo(() => {
    const text = normalizeText(searchText);
    const municipioId = selectedMunicipio ? Number(selectedMunicipio) : null;
    const categoriaId = selectedCategoria ? Number(selectedCategoria) : null;

    const output = eventos.filter((item) => {
      const byName = !text || normalizeText(item.nombre).includes(text);
      const byMunicipio = !municipioId || item.municipioIds.includes(municipioId);
      const byCategory = !categoriaId || item.categoriaId === categoriaId;

      let bySwitch = true;
      if (onlyToday) {
        bySwitch = eventIsToday(item);
      } else if (onlyWeek) {
        bySwitch = eventIsThisWeek(item);
      }

      if (onlyFree) {
        bySwitch = bySwitch && item.gratis;
      }

      return byName && byMunicipio && byCategory && bySwitch;
    });

    if (selectedOrder === 'fechaAsc') {
      output.sort((a, b) => {
        const fa = getUpcomingDate(a)?.fecha || '9999-12-31';
        const fb = getUpcomingDate(b)?.fecha || '9999-12-31';
        return fa.localeCompare(fb);
      });
    } else if (selectedOrder === 'fechaDesc') {
      output.sort((a, b) => {
        const fa = getUpcomingDate(a)?.fecha || '0000-01-01';
        const fb = getUpcomingDate(b)?.fecha || '0000-01-01';
        return fb.localeCompare(fa);
      });
    } else {
      output.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));
    }

    return output;
  }, [eventos, onlyFree, onlyToday, onlyWeek, searchText, selectedCategoria, selectedMunicipio, selectedOrder]);

  const rows = useMemo(() => {
    const grouped: EventoListadoItem[][] = [];
    for (let index = 0; index < filteredEvents.length; index += 2) {
      grouped.push(filteredEvents.slice(index, index + 2));
    }
    return grouped;
  }, [filteredEvents]);

  const showBottomBanner = useMemo(() => {
    if (!banners.length) return false;
    return rows.length === 0 || rows.length % 4 !== 0;
  }, [banners.length, rows.length]);

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
            <Text style={styles.pageTitle}>{tEventos('eventos.titulo', lang)}</Text>

            <View style={styles.filterCard}>
              <View style={styles.searchRow}>
                <View style={styles.searchIconLeftWrap}>
                  <FontAwesome6 name="calendar-day" size={16} color="#3ea6c4" />
                </View>

                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder={tEventos('eventos.buscarNombre', lang)}
                  placeholderTextColor="#94a3b8"
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <FontAwesome name="search" size={16} color="#9ca3af" />
              </View>

              <View style={styles.selectsRow}>
                <FilterSelect
                  label={tEventos('eventos.municipio', lang)}
                  value={selectedMunicipio}
                  placeholder={tEventos('eventos.todosMunicipios', lang)}
                  options={municipios}
                  onChange={setSelectedMunicipio}
                />

                <FilterSelect
                  label={tEventos('eventos.categoria', lang)}
                  value={selectedCategoria}
                  placeholder={tEventos('eventos.todasCategorias', lang)}
                  options={categorias}
                  onChange={setSelectedCategoria}
                  showIcons
                />

                <FilterSelect
                  label={tEventos('eventos.ordenarPor', lang)}
                  value={selectedOrder}
                  placeholder={tEventos('eventos.fechaAsc', lang)}
                  options={orderOptions}
                  onChange={(value) => setSelectedOrder((value as OrderValue) || 'fechaAsc')}
                />
              </View>

              <View style={styles.togglesRow}>
                <FilterToggle
                  label={tEventos('eventos.soloHoy', lang)}
                  value={onlyToday}
                  color="#3b82f6"
                  onToggle={(next) => {
                    setOnlyToday(next);
                    if (next) setOnlyWeek(false);
                  }}
                />

                <FilterToggle
                  label={tEventos('eventos.estaSemana', lang)}
                  value={onlyWeek}
                  color="#eab308"
                  onToggle={(next) => {
                    setOnlyWeek(next);
                    if (next) setOnlyToday(false);
                  }}
                />

                <FilterToggle
                  label={tEventos('eventos.gratis', lang)}
                  value={onlyFree}
                  color="#22c55e"
                  onToggle={setOnlyFree}
                />
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color="#3ea6c4" />
              <Text style={styles.loadingText}>{tEventos('eventos.loading', lang)}</Text>
            </View>
          ) : null}

          {!loading && error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={() => void loadData()}>
                <Text style={styles.retryButtonText}>{tEventos('eventos.reintentar', lang)}</Text>
              </Pressable>
            </View>
          ) : null}

          {!loading && !error ? (
            <View style={styles.gridWrap}>
              {rows.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>🗓️</Text>
                  <Text style={styles.emptyText}>{tEventos('evento.sinResultados', lang)}</Text>
                </View>
              ) : (
                rows.map((row, rowIndex) => {
                  const isLastRow = rowIndex === rows.length - 1;
                  const shouldInsertBanner = banners.length > 0 && (rowIndex + 1) % 4 === 0 && !isLastRow;

                  return (
                    <View key={`event-row-${rowIndex}`}>
                      <View style={styles.gridRow}>
                        {row.map((item) => (
                          <View key={`event-${item.id}`} style={styles.gridColumn}>
                            <EventCard
                              item={item}
                              lang={lang}
                              desdeLabel={t('evento.desde')}
                              municipioFilterId={selectedMunicipio ? Number(selectedMunicipio) : null}
                              onPress={() => setSelectedEvento(item)}
                            />
                          </View>
                        ))}

                        {row.length === 1 ? <View style={styles.gridColumn} /> : null}
                      </View>

                      {shouldInsertBanner ? <HomeCarousel items={banners} /> : null}
                    </View>
                  );
                })
              )}

              {showBottomBanner ? <HomeCarousel items={banners} /> : null}
            </View>
          ) : null}

          <HomeEventoModal visible={Boolean(selectedEvento)} event={selectedEvento} onClose={() => setSelectedEvento(null)} />
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
    marginTop: spacing.md,
  },
  pageTitle: {
    textAlign: 'center',
    color: '#111827',
    fontSize: 28,
    fontFamily: fonts.medium,
    marginBottom: spacing.md,
  },
  filterCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  searchRow: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  searchIconLeftWrap: {
    width: 18,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 15,
    fontFamily: fonts.regular,
    paddingVertical: 0,
  },
  selectsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  selectBlock: {
    flex: 1,
    minWidth: 0,
  },
  selectLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: fonts.medium,
    marginBottom: 4,
    textAlign: 'center',
  },
  selectTrigger: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    minHeight: 36,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectValue: {
    color: '#0f172a',
    fontSize: 12,
    fontFamily: fonts.medium,
    textAlign: 'left',
    flexShrink: 1,
  },
  selectValueContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
  },
  selectValuePlaceholder: {
    color: '#94a3b8',
  },
  selectChevronSlot: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  selectSheet: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    maxHeight: '65%',
    backgroundColor: '#fff',
  },
  selectOption: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  selectOptionText: {
    color: '#111827',
    fontSize: 14,
    fontFamily: fonts.medium,
    textAlign: 'left',
    paddingHorizontal: 2,
  },
  selectOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 22,
  },
  selectOptionCheck: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  toggleWrap: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleLabel: {
    color: '#374151',
    fontSize: 13,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  toggleTrack: {
    width: 44,
    height: 25,
    borderRadius: borderRadius.pill,
    backgroundColor: '#d1d5db',
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 21,
    height: 21,
    borderRadius: borderRadius.pill,
    backgroundColor: '#fff',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  loadingWrap: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  errorWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: borderRadius.pill,
    backgroundColor: '#023047',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 24,
  },
  emptyText: {
    color: '#4b5563',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  gridWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  gridColumn: {
    flex: 1,
  },
  card: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    ...shadows.card,
  },
  cardImageWrap: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#e5e7eb',
    position: 'relative',
    overflow: 'hidden',
  },
  cardImageBg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.1 }],
  },
  cardImageFg: {
    width: '100%',
    height: '100%',
  },
  cardBody: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    minHeight: 174,
    justifyContent: 'space-between',
  },
  cardBodyTop: {
    alignItems: 'center',
    gap: 4,
  },
  cardTitleWrap: {
    width: '100%',
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    textAlign: 'center',
    color: '#111827',
    fontSize: 17,
    lineHeight: 19,
    fontFamily: fonts.bold,
  },
  cardTitleSmall: {
    fontSize: 15,
    lineHeight: 17,
  },
  cardCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cardCategoryText: {
    color: '#f97316',
    fontSize: 15,
    fontFamily: fonts.regular,
    textAlign: 'center',
    maxWidth: 120,
  },
  cardDateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  cardDateText: {
    color: '#dc2626',
    fontSize: 16,
    lineHeight: 16,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  cardTimeText: {
    color: '#6b7280',
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  cardTimeSlot: {
    minHeight: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMunicipioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cardMunicipioText: {
    color: '#23B4E9',
    fontSize: 14,
    lineHeight: 16,
    textAlign: 'center',
    fontFamily: fonts.regular,
    maxWidth: 128,
  },
  cardCostText: {
    marginTop: spacing.sm,
    color: '#16a34a',
    textAlign: 'center',
    fontSize: 14,
    fontFamily: fonts.regular,
  },
});
