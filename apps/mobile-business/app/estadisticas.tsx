import { DEFAULT_APP_BASE_URLS } from '@findixi/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BusinessChrome, type FooterItem } from '../src/components/BusinessChrome';
import { ScreenState } from '../src/components/ScreenState';
import { getSessionOrReset } from '../src/lib/auth-session';
import {
  ANALYTICS_RANGE_PRESETS,
  fetchBusinessAnalyticsDashboard,
  type AnalyticsChannelClicks,
  type AnalyticsDailyRow,
  type AnalyticsDashboardData,
  type AnalyticsRangeKey,
  type AnalyticsSegmentRow,
} from '../src/lib/business-analytics';
import { fetchBusinessAccessByUser, type BusinessProfile } from '../src/lib/business-profile';
import { borderRadius, fonts, primaryBlue, primaryOrange, shadows, spacing } from '../src/theme/tokens';

const CHANNEL_ROWS: Array<{ key: keyof AnalyticsChannelClicks; label: string }> = [
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'call', label: 'Llamadas' },
  { key: 'waze', label: 'Waze' },
  { key: 'googleMaps', label: 'Google Maps' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'webpage', label: 'Web' },
];

type KpiMetricKey =
  | 'favoritesLive'
  | 'viewsProfile'
  | 'viewsMenu'
  | 'clicksTotal'
  | 'ordersCompleted'
  | 'conversionAction';
type ChartMetricKey = 'viewsProfile' | 'viewsMenu' | 'ordersCompleted' | 'clicksTotal';
type TrendTone = 'up' | 'down' | 'flat';
type CompareRow = {
  key: ChartMetricKey;
  label: string;
  color: string;
  current: number;
  previous: number;
  trend: { pct: number; tone: TrendTone; text: string };
};

const KPI_CARDS: Array<{ key: KpiMetricKey; label: string; asPercent?: boolean }> = [
  { key: 'favoritesLive', label: 'Favoritos' },
  { key: 'viewsProfile', label: 'Vistas perfil' },
  { key: 'viewsMenu', label: 'Vistas menu' },
  { key: 'clicksTotal', label: 'Clicks accion' },
  { key: 'ordersCompleted', label: 'Ordenes' },
  { key: 'conversionAction', label: 'Conversion accion', asPercent: true },
];

const CHART_METRICS: Array<{ key: ChartMetricKey; label: string; color: string }> = [
  { key: 'viewsProfile', label: 'Vistas perfil', color: '#f97316' },
  { key: 'viewsMenu', label: 'Vistas menu', color: '#219ebc' },
  { key: 'ordersCompleted', label: 'Ordenes', color: '#16a34a' },
  { key: 'clicksTotal', label: 'Clicks accion', color: '#7c3aed' },
];

const COMPARISON_METRICS: Array<{ key: ChartMetricKey; label: string; color: string }> = [
  { key: 'viewsProfile', label: 'Perfil', color: '#f97316' },
  { key: 'viewsMenu', label: 'Menu', color: '#219ebc' },
  { key: 'ordersCompleted', label: 'Ordenes', color: '#16a34a' },
  { key: 'clicksTotal', label: 'Clicks', color: '#7c3aed' },
];

function buildWebUrl(path: string, idComercio: number): string {
  return `${DEFAULT_APP_BASE_URLS.comercio}${path}?id=${idComercio}`;
}

function calcTrendPct(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous <= 0 && current > 0) return 100;
  if (previous <= 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function getTrendMeta(current: number, previous: number): { pct: number; tone: TrendTone; text: string } {
  const pct = calcTrendPct(current, previous);
  if (pct >= 0.1) return { pct, tone: 'up', text: `+${pct}%` };
  if (pct <= -0.1) return { pct, tone: 'down', text: `${pct}%` };
  return { pct, tone: 'flat', text: '0%' };
}

function trendColors(tone: TrendTone): { text: string; bg: string; border: string } {
  if (tone === 'up') return { text: '#047857', bg: '#ecfdf5', border: '#6ee7b7' };
  if (tone === 'down') return { text: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' };
  return { text: '#475569', bg: '#f8fafc', border: '#cbd5e1' };
}

function formatDayLabel(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function formatMetricValue(value: number, asPercent: boolean): string {
  if (!Number.isFinite(value)) return asPercent ? '0%' : '0';
  if (asPercent) return `${Math.round(value)}%`;
  return String(Math.round(value));
}

function barFlexParts(value: number, maxValue: number): { fill: number; rest: number } {
  const safeMax = Math.max(1, maxValue);
  const safeValue = Math.max(0, Number(value) || 0);
  if (safeValue <= 0) {
    return { fill: 0.12, rest: safeMax };
  }
  return {
    fill: safeValue,
    rest: Math.max(safeMax - safeValue, 0.001),
  };
}

function DailyBarsChart({
  rows,
  metric,
  color,
}: {
  rows: AnalyticsDailyRow[];
  metric: ChartMetricKey;
  color: string;
}) {
  const visibleRows = rows.length > 14 ? rows.slice(rows.length - 14) : rows;
  const max = Math.max(
    1,
    ...visibleRows.map((row) => {
      const value = Number(row[metric]);
      return Number.isFinite(value) ? value : 0;
    })
  );

  if (!visibleRows.length) {
    return <Text style={styles.emptyInline}>Sin datos diarios para este rango.</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartColumnsWrap}>
      {visibleRows.map((row) => {
        const value = Math.max(0, Number(row[metric]) || 0);
        const heightPct = value <= 0 ? 0 : Math.max((value / max) * 100, 6);

        return (
          <View key={`${metric}-${row.day}`} style={styles.chartColumn}>
            <Text style={styles.chartColumnValue}>{value}</Text>
            <View style={styles.chartColumnTrack}>
              <View style={[styles.chartColumnFill, { height: `${heightPct}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.chartColumnDay}>{formatDayLabel(row.day)}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function SegmentList({ rows, emptyText }: { rows: AnalyticsSegmentRow[]; emptyText: string }) {
  if (!rows.length) {
    return <Text style={styles.emptyInline}>{emptyText}</Text>;
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

export default function BusinessStatsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [idComercio, setIdComercio] = useState(0);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [rangeKey, setRangeKey] = useState<AnalyticsRangeKey>('30d');
  const [chartMetric, setChartMetric] = useState<ChartMetricKey>('viewsProfile');
  const [dashboard, setDashboard] = useState<AnalyticsDashboardData | null>(null);

  const selectedRange = useMemo(() => {
    return ANALYTICS_RANGE_PRESETS.find((item) => item.key === rangeKey) || ANALYTICS_RANGE_PRESETS[1];
  }, [rangeKey]);

  const selectedChartMetric = useMemo(() => {
    return CHART_METRICS.find((item) => item.key === chartMetric) || CHART_METRICS[0];
  }, [chartMetric]);

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
      setProfile(access.profile);
      setAssignmentCount(access.assignmentCount);

      const comercioId = Number(access.primaryComercioId || access.profile?.id || 0);
      setIdComercio(comercioId);

      if (!access.profile || !comercioId) {
        setDashboard(null);
        return;
      }

      const data = await fetchBusinessAnalyticsDashboard(comercioId, selectedRange.days);
      setDashboard(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'No se pudieron cargar las estadisticas.';
      setError(message);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [router, selectedRange.days]);

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
        onPress: () => router.replace('/perfil'),
      },
      {
        key: 'stats',
        label: 'Estadisticas',
        onPress: () => router.replace('/estadisticas' as never),
        active: true,
      },
      {
        key: 'menu',
        label: 'Admin Menu',
        onPress: () => {
          if (!idComercio) return;
          void Linking.openURL(buildWebUrl('/adminMenuComercio.html', idComercio));
        },
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

  const channelsTotal = useMemo(() => {
    if (!dashboard) return 0;
    return CHANNEL_ROWS.reduce((acc, row) => acc + (dashboard.channels[row.key] || 0), 0);
  }, [dashboard]);

  const kpiCards = useMemo(() => {
    if (!dashboard) return [];

    return KPI_CARDS.map((item) => {
      const current = Number(dashboard.kpis[item.key] || 0);
      const previous = Number(dashboard.previousKpis[item.key] || 0);
      const trend = getTrendMeta(current, previous);
      return {
        ...item,
        current,
        previous,
        trend,
      };
    });
  }, [dashboard]);

  const comparisonRows = useMemo<CompareRow[]>(() => {
    if (!dashboard) return [];
    return COMPARISON_METRICS.map((metric) => {
      const current = Number(dashboard.kpis[metric.key] || 0);
      const previous = Number(dashboard.previousKpis[metric.key] || 0);
      return {
        key: metric.key,
        label: metric.label,
        color: metric.color,
        current,
        previous,
        trend: getTrendMeta(current, previous),
      };
    });
  }, [dashboard]);

  const comparisonMax = useMemo(() => {
    if (!comparisonRows.length) return 1;
    return Math.max(1, ...comparisonRows.flatMap((row) => [row.current, row.previous]));
  }, [comparisonRows]);

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
              <Text style={styles.sectionTitle}>Rango</Text>
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
            <View style={styles.rangesRow}>
              {ANALYTICS_RANGE_PRESETS.map((preset) => (
                <Pressable
                  key={preset.key}
                  style={[styles.rangeChip, preset.key === rangeKey ? styles.rangeChipActive : null]}
                  onPress={() => setRangeKey(preset.key)}
                >
                  <Text style={[styles.rangeChipText, preset.key === rangeKey ? styles.rangeChipTextActive : null]}>
                    {preset.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.rangeHelper}>
              Del {dashboard.range.from} al {dashboard.range.to}
            </Text>
            <Text style={styles.helperText}>Si haces pruebas ahora mismo, pulsa Actualizar para recargar resultados.</Text>
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Resumen comparativo</Text>
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
                    <Text style={styles.kpiPrevious}>
                      Previo: {formatMetricValue(item.previous, Boolean(item.asPercent))}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Tendencia diaria</Text>
            <View style={styles.chartMetricRow}>
              {CHART_METRICS.map((metric) => (
                <Pressable
                  key={metric.key}
                  style={[styles.metricChip, chartMetric === metric.key ? styles.metricChipActive : null]}
                  onPress={() => setChartMetric(metric.key)}
                >
                  <View style={[styles.metricDot, { backgroundColor: metric.color }]} />
                  <Text style={[styles.metricChipText, chartMetric === metric.key ? styles.metricChipTextActive : null]}>
                    {metric.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <DailyBarsChart rows={dashboard.daily} metric={chartMetric} color={selectedChartMetric.color} />
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Comparativo actual vs anterior</Text>
            <View style={styles.compareWrap}>
              {comparisonRows.map((row) => {
                const tone = trendColors(row.trend.tone);
                const currentBar = barFlexParts(row.current, comparisonMax);
                const previousBar = barFlexParts(row.previous, comparisonMax);
                return (
                  <View key={`compare-${row.key}`} style={styles.compareMetricCard}>
                    <View style={styles.compareHeader}>
                      <Text style={styles.compareTitle}>{row.label}</Text>
                      <View style={[styles.compareTrendChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                        <Text style={[styles.compareTrendText, { color: tone.text }]}>{row.trend.text}</Text>
                      </View>
                    </View>

                    <View style={styles.compareBarRow}>
                      <Text style={styles.compareLegend}>Actual</Text>
                      <View style={styles.compareTrack}>
                        <View style={styles.compareTrackInner}>
                          <View style={[styles.compareFill, { flex: currentBar.fill, backgroundColor: row.color }]} />
                          <View style={[styles.compareRest, { flex: currentBar.rest }]} />
                        </View>
                      </View>
                      <Text style={styles.compareValue}>{row.current}</Text>
                    </View>

                    <View style={styles.compareBarRow}>
                      <Text style={styles.compareLegend}>Previo</Text>
                      <View style={styles.compareTrack}>
                        <View style={styles.compareTrackInner}>
                          <View style={[styles.compareFillMuted, { flex: previousBar.fill, borderColor: row.color }]} />
                          <View style={[styles.compareRest, { flex: previousBar.rest }]} />
                        </View>
                      </View>
                      <Text style={styles.compareValue}>{row.previous}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Clicks de contacto y redes</Text>
            <View style={styles.segmentList}>
              {CHANNEL_ROWS.map((row) => {
                const value = dashboard.channels[row.key] || 0;
                return (
                  <View key={row.key} style={styles.segmentRow}>
                    <Text style={styles.segmentLabel}>{row.label}</Text>
                    <Text style={styles.segmentValue}>{value}</Text>
                  </View>
                );
              })}
            </View>
            {channelsTotal <= 0 ? <Text style={styles.helperText}>Aun no hay interacciones registradas en este rango.</Text> : null}
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Audiencia por origen</Text>
            <SegmentList rows={dashboard.sourceBreakdown} emptyText="Sin datos de origen en este rango." />
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.sectionTitle}>Municipios top</Text>
            <SegmentList rows={dashboard.municipios} emptyText="Sin datos de municipio en este rango." />
          </View>

          <View style={styles.dualRow}>
            <View style={[styles.card, styles.halfCard, shadows.card]}>
              <Text style={styles.sectionTitle}>Genero</Text>
              <SegmentList rows={dashboard.generos} emptyText="Sin datos de genero." />
            </View>
            <View style={[styles.card, styles.halfCard, shadows.card]}>
              <Text style={styles.sectionTitle}>Edad</Text>
              <SegmentList rows={dashboard.edades} emptyText="Sin datos de edad." />
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
  sectionTitle: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
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
  rangesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rangeChip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  rangeChipActive: {
    borderColor: primaryOrange,
    backgroundColor: '#fff7ed',
  },
  rangeChipText: {
    color: '#334155',
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  rangeChipTextActive: {
    color: '#9a3412',
    fontFamily: fonts.bold,
  },
  rangeHelper: {
    color: '#64748b',
    fontFamily: fonts.regular,
    fontSize: 14,
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
  chartMetricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  metricChip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricChipActive: {
    borderColor: '#94a3b8',
    backgroundColor: '#f8fafc',
  },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.pill,
  },
  metricChipText: {
    color: '#475569',
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  metricChipTextActive: {
    color: '#0f172a',
    fontFamily: fonts.bold,
  },
  chartColumnsWrap: {
    gap: 10,
    paddingVertical: spacing.xs,
  },
  chartColumn: {
    width: 34,
    alignItems: 'center',
    gap: 4,
  },
  chartColumnValue: {
    color: '#334155',
    fontFamily: fonts.medium,
    fontSize: 11,
    minHeight: 14,
  },
  chartColumnTrack: {
    width: 18,
    height: 92,
    borderRadius: borderRadius.pill,
    backgroundColor: '#e2e8f0',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartColumnFill: {
    width: '100%',
    borderRadius: borderRadius.pill,
    minHeight: 0,
  },
  chartColumnDay: {
    color: '#64748b',
    fontFamily: fonts.regular,
    fontSize: 10,
  },
  compareWrap: {
    gap: spacing.sm,
  },
  compareMetricCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  compareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  compareTitle: {
    color: '#0f172a',
    fontFamily: fonts.semibold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  compareTrendChip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  compareTrendText: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  compareBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compareLegend: {
    width: 44,
    color: '#64748b',
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  compareTrack: {
    flex: 1,
    height: 10,
    borderRadius: borderRadius.pill,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  compareTrackInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  compareFill: {
    height: '100%',
    borderRadius: borderRadius.pill,
  },
  compareFillMuted: {
    height: '100%',
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  compareRest: {
    height: '100%',
  },
  compareValue: {
    width: 44,
    textAlign: 'right',
    color: '#0f172a',
    fontFamily: fonts.semibold,
    fontSize: 13,
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
  dualRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfCard: {
    flex: 1,
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
    fontSize: 14,
  },
  emptyInline: {
    color: '#64748b',
    fontFamily: fonts.regular,
    fontSize: 14,
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
