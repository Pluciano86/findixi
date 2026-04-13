import { DEFAULT_APP_BASE_URLS } from '@findixi/shared';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { BusinessChrome, type FooterItem } from '../src/components/BusinessChrome';
import { ScreenState } from '../src/components/ScreenState';
import { getSessionOrReset } from '../src/lib/auth-session';
import { fetchBusinessAnalyticsDashboard, type AnalyticsChannelDrilldown, type AnalyticsSegmentRow } from '../src/lib/business-analytics';
import { fetchBusinessAccessByUser, type BusinessProfile } from '../src/lib/business-profile';
import { borderRadius, fonts, primaryBlue, primaryOrange, shadows, spacing } from '../src/theme/tokens';

type KpiMetricKey =
  | 'favoritesLive'
  | 'viewsProfile'
  | 'viewsMenu'
  | 'clicksTotal'
  | 'ordersCompleted'
  | 'conversionAction';
type TrendTone = 'up' | 'down' | 'flat';

type PercentRow = {
  label: string;
  total: number;
  percent: number;
  color: string;
};

const KPI_CARDS: Array<{ key: KpiMetricKey; label: string; asPercent?: boolean }> = [
  { key: 'favoritesLive', label: 'Favoritos' },
  { key: 'viewsProfile', label: 'Vistas perfil' },
  { key: 'viewsMenu', label: 'Vistas menu' },
  { key: 'clicksTotal', label: 'Clicks accion' },
  { key: 'ordersCompleted', label: 'Ordenes' },
  { key: 'conversionAction', label: 'Conversion accion', asPercent: true },
];

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: '#22c55e',
  call: '#ef4444',
  waze: '#06b6d4',
  googleMaps: '#3b82f6',
  facebook: '#2563eb',
  instagram: '#ec4899',
  tiktok: '#111827',
  webpage: '#f59e0b',
};

const PERCENT_COLORS = ['#f97316', '#219ebc', '#7c3aed', '#16a34a', '#ef4444', '#0ea5e9', '#d97706'];

function buildWebUrl(path: string, idComercio: number): string {
  return `${DEFAULT_APP_BASE_URLS.comercio}${path}?id=${idComercio}`;
}

function calcTrendPct(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous <= 0 && current > 0) return 100;
  if (previous <= 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function getTrendMeta(current: number, previous: number): { tone: TrendTone; text: string } {
  const pct = calcTrendPct(current, previous);
  if (pct >= 0.1) return { tone: 'up', text: `+${pct}%` };
  if (pct <= -0.1) return { tone: 'down', text: `${pct}%` };
  return { tone: 'flat', text: '0%' };
}

function trendColors(tone: TrendTone): { text: string; bg: string; border: string } {
  if (tone === 'up') return { text: '#047857', bg: '#ecfdf5', border: '#6ee7b7' };
  if (tone === 'down') return { text: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' };
  return { text: '#475569', bg: '#f8fafc', border: '#cbd5e1' };
}

function formatMetricValue(value: number, asPercent: boolean): string {
  if (!Number.isFinite(value)) return asPercent ? '0%' : '0';
  if (asPercent) return `${Math.round(value)}%`;
  return String(Math.round(value));
}

function toPercentRows(rows: AnalyticsSegmentRow[], forcedOrder: string[] = [], palette: string[] = PERCENT_COLORS): PercentRow[] {
  const totals = new Map<string, number>();
  rows.forEach((row) => totals.set(row.label, Number(row.total) || 0));
  forcedOrder.forEach((label) => {
    if (!totals.has(label)) totals.set(label, 0);
  });

  const total = Array.from(totals.values()).reduce((acc, value) => acc + value, 0);
  const list = Array.from(totals.entries()).map(([label, value], index) => ({
    label,
    total: value,
    percent: total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0,
    color: palette[index % palette.length],
  }));

  return list.sort((a, b) => b.total - a.total);
}

function normalizeGenderRows(rows: AnalyticsSegmentRow[]): AnalyticsSegmentRow[] {
  const mapping = new Map<string, number>([
    ['Hombre', 0],
    ['Mujer', 0],
    ['Desconocido', 0],
  ]);

  rows.forEach((row) => {
    const key = String(row.label || '').trim().toLowerCase();
    const value = Number(row.total) || 0;
    if (key === 'hombre' || key === 'm' || key === 'masculino') {
      mapping.set('Hombre', (mapping.get('Hombre') || 0) + value);
    } else if (key === 'mujer' || key === 'f' || key === 'femenino') {
      mapping.set('Mujer', (mapping.get('Mujer') || 0) + value);
    } else {
      mapping.set('Desconocido', (mapping.get('Desconocido') || 0) + value);
    }
  });

  return Array.from(mapping.entries()).map(([label, total]) => ({ label, total }));
}

function DonutLegendChart({ rows, emptyText }: { rows: PercentRow[]; emptyText: string }) {
  const nonZeroRows = rows.filter((row) => row.total > 0);
  const renderRows = nonZeroRows.length ? nonZeroRows : rows;

  if (!renderRows.length) {
    return <Text style={styles.helperText}>{emptyText}</Text>;
  }

  const total = renderRows.reduce((acc, row) => acc + row.total, 0);
  const size = 138;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let consumed = 0;
  const segments = renderRows.map((row) => {
    const ratio = Math.max(0, Math.min(1, row.percent / 100));
    const arcLength = Math.max(ratio * circumference, row.total > 0 ? 2 : 0);
    const startOffset = consumed;
    consumed += arcLength;
    return {
      ...row,
      arcLength,
      startOffset,
    };
  });

  return (
    <View style={styles.donutChartBlock}>
      <View style={styles.donutWrap}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${center}, ${center}`}>
            <Circle cx={center} cy={center} r={radius} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
            {segments.map((segment) => (
              <Circle
                key={`seg-${segment.label}`}
                cx={center}
                cy={center}
                r={radius}
                stroke={segment.color}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="butt"
                strokeDasharray={`${segment.arcLength} ${Math.max(circumference - segment.arcLength, 0)}`}
                strokeDashoffset={-segment.startOffset}
              />
            ))}
          </G>
        </Svg>
        <View style={styles.donutCenter}>
          <Text style={styles.donutCenterValue}>{total}</Text>
          <Text style={styles.donutCenterLabel}>Total</Text>
        </View>
      </View>

      <View style={styles.donutLegendList}>
        {renderRows.map((row) => (
          <View key={`legend-${row.label}`} style={styles.donutLegendRow}>
            <View style={[styles.legendDot, { backgroundColor: row.color }]} />
            <Text style={styles.donutLegendLabel}>{row.label}</Text>
            <Text style={styles.donutLegendValue}>
              {row.percent}% ({row.total})
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SegmentList({ rows, emptyText }: { rows: AnalyticsSegmentRow[]; emptyText: string }) {
  if (!rows.length) {
    return <Text style={styles.helperText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.segmentList}>
      {rows.map((row, index) => (
        <View key={`${row.label}-${row.total}-${index}`} style={styles.segmentRow}>
          <Text style={styles.segmentLabel}>{row.label}</Text>
          <Text style={styles.segmentValue}>{row.total}</Text>
        </View>
      ))}
    </View>
  );
}

function MonthBars({ channel }: { channel: AnalyticsChannelDrilldown }) {
  const maxValue = Math.max(1, ...channel.monthly.map((row) => row.total));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthBarsRow}>
      {channel.monthly.map((month, index) => {
        const barHeight = month.total <= 0 ? 6 : Math.max((month.total / maxValue) * 84, 10);
        return (
          <View key={`month-${channel.key}-${month.month}`} style={styles.monthBarCol}>
            <Text style={styles.monthBarValue}>{month.total}</Text>
            <View style={styles.monthBarTrack}>
              <View
                style={[
                  styles.monthBarFill,
                  {
                    height: barHeight,
                    backgroundColor: CHANNEL_COLORS[channel.key] || PERCENT_COLORS[index % PERCENT_COLORS.length],
                  },
                ]}
              />
            </View>
            <Text style={styles.monthBarLabel}>{month.label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function HorizontalPercentBars({ rows, emptyText }: { rows: PercentRow[]; emptyText: string }) {
  const nonZeroRows = rows.filter((row) => row.total > 0);
  const renderRows = nonZeroRows.length ? nonZeroRows : rows;

  if (!renderRows.length) {
    return <Text style={styles.helperText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.hBarList}>
      {renderRows.map((row) => (
        <View key={`hbar-${row.label}`} style={styles.hBarRow}>
          <View style={styles.hBarTopRow}>
            <View style={[styles.legendDot, { backgroundColor: row.color }]} />
            <Text style={styles.hBarLabel}>{row.label}</Text>
            <Text style={styles.hBarValue}>
              {row.total} ({row.percent}%)
            </Text>
          </View>
          <View style={styles.hBarTrack}>
            <View style={[styles.hBarFill, { width: `${Math.max(0, Math.min(100, row.percent))}%`, backgroundColor: row.color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function BusinessStatsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ idComercio?: string }>();
  const [loading, setLoading] = useState(true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [idComercio, setIdComercio] = useState(0);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [expandedChannelKey, setExpandedChannelKey] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof fetchBusinessAnalyticsDashboard>> | null>(null);
  const targetComercioId = Number(params.idComercio || 0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const session = await getSessionOrReset();
      if (!session?.user) {
        setProfile(null);
        setIdComercio(0);
        setAssignmentCount(0);
        setDashboard(null);
        router.replace('/login');
        return;
      }

      const access = await fetchBusinessAccessByUser(session.user.id);
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
        setDashboard(null);
        return;
      }

      const data = await fetchBusinessAnalyticsDashboard(comercioId, 7);
      setDashboard(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'No se pudieron cargar las estadisticas.';
      setError(message);
      setDashboard(null);
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

  const onManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await loadData();
    } finally {
      setManualRefreshing(false);
    }
  }, [loadData]);

  const footerItems = useMemo<FooterItem[]>(() => {
    return [
      {
        key: 'edit-profile',
        label: 'Editar Perfil',
        onPress: () => router.push((idComercio ? `/perfil?idComercio=${idComercio}` : '/perfil') as never),
      },
      {
        key: 'stats',
        label: 'Estadisticas',
        onPress: () => router.push((idComercio ? `/estadisticas?idComercio=${idComercio}` : '/estadisticas') as never),
        active: true,
      },
      {
        key: 'menu',
        label: 'Admin Menu',
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

  const kpiCards = useMemo(() => {
    if (!dashboard) return [];

    return KPI_CARDS.map((item) => {
      const current = Number(dashboard.kpis[item.key] || 0);
      const previous = Number(dashboard.previousKpis[item.key] || 0);
      return {
        ...item,
        current,
        previous,
        trend: getTrendMeta(current, previous),
      };
    });
  }, [dashboard]);

  const channelRows = useMemo(() => {
    if (!dashboard) return [];
    const total = dashboard.channelDrilldown.reduce((acc, row) => acc + row.total, 0);
    return dashboard.channelDrilldown.map((row) => ({
      ...row,
      percent: total > 0 ? Number(((row.total / total) * 100).toFixed(1)) : 0,
      color: CHANNEL_COLORS[row.key] || '#64748b',
    }));
  }, [dashboard]);

  const selectedChannel = useMemo(() => {
    if (!expandedChannelKey) return null;
    return channelRows.find((row) => row.key === expandedChannelKey) || null;
  }, [channelRows, expandedChannelKey]);

  const channelRowsGrid = useMemo(() => {
    const groups: Array<typeof channelRows> = [];
    for (let index = 0; index < channelRows.length; index += 2) {
      groups.push(channelRows.slice(index, index + 2));
    }
    return groups;
  }, [channelRows]);

  const selectedChannelGenderRows = useMemo(() => {
    if (!selectedChannel) return [] as PercentRow[];
    return toPercentRows(normalizeGenderRows(selectedChannel.genders), ['Hombre', 'Mujer', 'Desconocido'], ['#2563eb', '#ec4899', '#64748b']);
  }, [selectedChannel]);

  const profileAudienceGenderRows = useMemo(() => {
    if (!dashboard) return [] as PercentRow[];
    return toPercentRows(normalizeGenderRows(dashboard.profileAudienceGeneros), ['Hombre', 'Mujer', 'Desconocido'], ['#2563eb', '#ec4899', '#64748b']);
  }, [dashboard]);

  const profileAudienceAgeRows = useMemo(() => {
    if (!dashboard) return [] as PercentRow[];
    return toPercentRows(dashboard.profileAudienceEdades, [], PERCENT_COLORS);
  }, [dashboard]);

  return (
    <BusinessChrome title="Estadisticas" footerItems={footerItems}>
      {loading ? <ScreenState loading message="Cargando estadisticas..." /> : null}

      {!loading && error ? <ScreenState message={error} /> : null}

      {!loading && !error && !profile ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Cuenta activa sin comercio vinculado</Text>
          <Text style={styles.cardBody}>
            Esta cuenta inicio sesion, pero no encontramos un comercio disponible para mostrar.
            {assignmentCount > 0 ? ` (${assignmentCount} asignacion(es) detectada(s))` : ''}
          </Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/perfil')}>
            <Text style={styles.secondaryBtnText}>Volver al perfil</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && profile && dashboard ? (
        <ScrollView contentContainerStyle={styles.scrollWrap}>
          <View style={[styles.card, shadows.card]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Resumen comparativo de los últimos 7 días</Text>
              <Pressable
                style={[styles.refreshBtn, manualRefreshing ? styles.refreshBtnDisabled : null]}
                disabled={manualRefreshing || loading}
                onPress={() => {
                  void onManualRefresh();
                }}
              >
                <Text style={styles.refreshBtnText}>{manualRefreshing ? 'Actualizando...' : 'Actualizar'}</Text>
              </Pressable>
            </View>

            <View style={styles.kpiGrid}>
              {kpiCards.map((item) => {
                const tone = trendColors(item.trend.tone);
                return (
                  <View key={item.key} style={styles.kpiBox}>
                    <View style={styles.kpiHeaderRow}>
                      <Text style={styles.kpiLabel}>{item.label}</Text>
                      <View style={[styles.kpiTrendChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                        <Text style={[styles.kpiTrendText, { color: tone.text }]}>{item.trend.text}</Text>
                      </View>
                    </View>
                    <Text style={styles.kpiValue}>{formatMetricValue(item.current, Boolean(item.asPercent))}</Text>
                    <Text style={styles.kpiPrevious}>Previo: {formatMetricValue(item.previous, Boolean(item.asPercent))}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Clicks contacto y redes sociales</Text>
            <View style={styles.channelGrid}>
              {channelRowsGrid.map((rowGroup, rowIndex) => {
                const selectedInRow = rowGroup.find((item) => item.key === expandedChannelKey) || null;
                return (
                  <View key={`channel-row-${rowIndex}`} style={styles.channelRowGroup}>
                    <View style={styles.channelRow}>
                      {rowGroup.map((channel) => (
                        <View key={`channel-card-${channel.key}`} style={styles.channelCol}>
                          <View style={[styles.channelCard, expandedChannelKey === channel.key ? styles.channelCardActive : null]}>
                            <Text style={styles.channelCardTitle}>{channel.label}</Text>
                            <Text style={styles.channelCardClicks}>{channel.total}</Text>
                            <Text style={styles.channelCardClicksLabel}>clicks</Text>
                            <Pressable style={styles.channelCardBtn} onPress={() => setExpandedChannelKey((prev) => (prev === channel.key ? null : String(channel.key)))}>
                              <Text style={styles.channelCardBtnText}>{expandedChannelKey === channel.key ? 'Ver menos' : 'Ver mas'}</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                      {rowGroup.length === 1 ? <View style={styles.channelCol} /> : null}
                    </View>

                    {selectedInRow ? (
                      <View style={styles.channelDetailBox}>
                        <Text style={styles.detailSectionTitle}>{selectedInRow.label}: clicks por mes</Text>
                        <MonthBars channel={selectedInRow} />

                        <Text style={styles.detailSectionTitle}>Genero (%)</Text>
                        <HorizontalPercentBars rows={selectedChannelGenderRows} emptyText="Sin datos de genero para este canal." />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {!selectedChannel ? <Text style={styles.helperText}>Selecciona un canal para ver el detalle por mes y por genero.</Text> : null}
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Audiencia visitas perfil por usuario</Text>
            <View style={styles.dualRow}>
              <View style={[styles.infoCard, styles.halfCard]}>
                <Text style={styles.infoCardTitle}>Genero</Text>
                <DonutLegendChart rows={profileAudienceGenderRows} emptyText="Sin datos de genero en visitas de perfil." />
              </View>
              <View style={[styles.infoCard, styles.halfCard]}>
                <Text style={styles.infoCardTitle}>Edad</Text>
                <DonutLegendChart rows={profileAudienceAgeRows} emptyText="Sin datos de edad en visitas de perfil." />
              </View>
            </View>
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Productos top por vistas</Text>
            <SegmentList
              rows={dashboard.topViewedItems.map((item) => ({ label: item.nombre, total: item.views }))}
              emptyText="Sin vistas de productos en este rango."
            />
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Productos top por ordenes</Text>
            <SegmentList
              rows={dashboard.topOrderedItems.map((item) => ({ label: item.nombre, total: item.orders }))}
              emptyText="Sin ordenes de productos en este rango."
            />
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Insights</Text>
            {dashboard.insights.map((item) => (
              <View key={item} style={styles.insightRow}>
                <View style={styles.insightDot} />
                <Text style={styles.insightText}>{item}</Text>
              </View>
            ))}
            {!dashboard.hasData ? <Text style={styles.helperText}>Aun no hay suficiente actividad para metricas avanzadas.</Text> : null}
          </View>
        </ScrollView>
      ) : null}
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
    gap: spacing.sm,
  },
  cardTitle: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 24,
  },
  cardBody: {
    color: '#475569',
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 20,
    flex: 1,
  },
  refreshBtn: {
    minHeight: 34,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  refreshBtnDisabled: {
    opacity: 0.6,
  },
  refreshBtnText: {
    color: '#1d4ed8',
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiBox: {
    width: '48%',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  kpiLabel: {
    color: '#475569',
    fontFamily: fonts.medium,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  kpiTrendChip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  kpiTrendText: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  kpiValue: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 30,
  },
  kpiPrevious: {
    color: '#64748b',
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  channelGrid: {
    gap: spacing.sm,
  },
  channelRowGroup: {
    gap: spacing.xs,
  },
  channelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  channelCol: {
    flex: 1,
  },
  channelCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    padding: spacing.sm,
    gap: 2,
    minHeight: 122,
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelCardActive: {
    borderColor: primaryOrange,
    backgroundColor: '#fff7ed',
  },
  channelCardTitle: {
    color: '#0f172a',
    fontFamily: fonts.semibold,
    fontSize: 15,
    textAlign: 'center',
  },
  channelCardClicks: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 32,
    textAlign: 'center',
  },
  channelCardClicksLabel: {
    color: '#475569',
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  channelCardBtn: {
    alignSelf: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  channelCardBtnText: {
    color: '#1d4ed8',
    fontFamily: fonts.medium,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  channelDetailBox: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  detailSectionTitle: {
    color: '#334155',
    fontFamily: fonts.semibold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  monthBarsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  monthBarCol: {
    width: 28,
    alignItems: 'center',
    gap: 4,
  },
  monthBarValue: {
    color: '#334155',
    fontFamily: fonts.medium,
    fontSize: 10,
    minHeight: 12,
  },
  monthBarTrack: {
    width: 16,
    height: 88,
    borderRadius: borderRadius.pill,
    backgroundColor: '#e2e8f0',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  monthBarFill: {
    width: '100%',
    borderRadius: borderRadius.pill,
  },
  monthBarLabel: {
    color: '#64748b',
    fontFamily: fonts.regular,
    fontSize: 10,
  },
  hBarList: {
    gap: spacing.sm,
  },
  hBarRow: {
    gap: 6,
  },
  hBarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hBarLabel: {
    color: '#334155',
    fontFamily: fonts.medium,
    fontSize: 13,
    flex: 1,
  },
  hBarValue: {
    color: '#0f172a',
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  hBarTrack: {
    width: '100%',
    height: 10,
    borderRadius: borderRadius.pill,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  hBarFill: {
    height: '100%',
    borderRadius: borderRadius.pill,
    minWidth: 2,
  },
  donutChartBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  donutWrap: {
    width: 138,
    height: 138,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterValue: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 22,
  },
  donutCenterLabel: {
    color: '#64748b',
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  donutLegendList: {
    width: '100%',
    gap: 6,
  },
  donutLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.pill,
  },
  donutLegendLabel: {
    color: '#334155',
    fontFamily: fonts.regular,
    fontSize: 11,
    flex: 1,
  },
  donutLegendValue: {
    color: '#0f172a',
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  dualRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  infoCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  halfCard: {
    flex: 1,
  },
  infoCardTitle: {
    color: '#0f172a',
    fontFamily: fonts.semibold,
    fontSize: 15,
    textAlign: 'center',
  },
  segmentList: {
    gap: spacing.xs,
  },
  segmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  segmentLabel: {
    flex: 1,
    color: '#0f172a',
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  segmentValue: {
    color: primaryBlue,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  insightRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  insightDot: {
    marginTop: 8,
    width: 8,
    height: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: primaryOrange,
  },
  insightText: {
    flex: 1,
    color: '#334155',
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  helperText: {
    color: '#64748b',
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  secondaryBtn: {
    minHeight: 42,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: spacing.md,
  },
  secondaryBtnText: {
    color: primaryBlue,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
});
