import { formatearTelefonoDisplay, formatearTelefonoHref } from '@findixi/shared';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PublicAppChrome } from '../src/components/layout/PublicAppChrome';
import { ScreenState } from '../src/components/ScreenState';
import { useI18n } from '../src/i18n/provider';
import { openExternalUrl } from '../src/lib/external-link';
import { authStorage } from '../src/lib/storage';
import { supabase } from '../src/lib/supabase';
import { borderRadius, fonts, shadows, spacing } from '../src/theme/tokens';

type PedidoTab = 'activos' | 'pasados';

type PedidoRaw = {
  id: number;
  idcomercio: number;
  clover_order_id?: string | null;
  checkout_url?: string | null;
  total?: number | string | null;
  status?: string | null;
  created_at?: string | null;
  order_type?: string | null;
  mesa?: string | number | null;
  source?: string | null;
  order_link_expires_at?: string | null;
  link_expired?: boolean;
};

type ComercioRaw = {
  id: number;
  nombre?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  latitud?: number | string | null;
  longitud?: number | string | null;
  logo?: string | null;
};

type OrderItemRow = {
  idorden: number;
  idproducto: number;
  qty?: number | string | null;
  price_snapshot?: number | string | null;
  modifiers?: unknown;
};

type ProductoRow = {
  id: number;
  nombre?: string | null;
};

type PedidoItemView = {
  nombre: string;
  lineTotal: number;
};

type PedidoView = {
  order: PedidoRaw;
  comercio: {
    id: number;
    nombre: string;
    direccion: string;
    telefono: string;
    latitud: number | null;
    longitud: number | null;
    logoUrl: string;
  };
  items: PedidoItemView[];
};

const ORDER_HISTORY_KEY = 'findixi_orders';
const STATUS_ACTIVE = new Set(['pending', 'sent', 'open', 'confirmed', 'preparing', 'ready', 'paid']);
const STATUS_PAST = new Set(['cancelled', 'canceled', 'completed', 'delivered', 'refunded']);

type PedidosCopy = {
  inProcess: string;
  noDate: string;
  deliveredOrder: string;
  latestStatus: string;
  total: string;
  expiredLink: string;
  table: string;
  orderStatus: string;
  stepConfirmed: string;
  stepPreparing: string;
  stepReady: string;
  orderPrefix: string;
  orderSummary: string;
  noItemDetails: string;
  loadError: string;
  title: string;
  subtitle: string;
  tabActive: string;
  tabPast: string;
  loadingOrders: string;
  emptyTitle: string;
  emptySubtitle: string;
  productFallback: string;
  commerceFallback: string;
};
const GOOGLE_MAPS_LOGO =
  'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios//google%20map.jpg';
const WAZE_LOGO = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios//waze.jpg';

function normalizeStatus(status: unknown): string {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');

  if (!raw) return 'pending';
  if (raw.includes('cancel')) return 'cancelled';
  if (raw.includes('refund') || raw.includes('reembols')) return 'refunded';
  if (raw.includes('deliver') || raw.includes('entreg')) return 'delivered';
  if (raw.includes('complete') || raw.includes('complet') || raw.includes('closed') || raw.includes('done')) return 'completed';
  if (raw.includes('ready') || raw.includes('list')) return 'ready';
  if (raw.includes('prepar')) return 'preparing';
  if (raw.includes('confirm')) return 'confirmed';
  if (raw.includes('paid') || raw.includes('pagad')) return 'paid';
  if (raw.includes('open') || raw.includes('sent') || raw.includes('pending') || raw.includes('recib')) return 'pending';

  return raw;
}

function getStatusLabel(status: unknown, statusLabels: Record<string, string>, inProcessLabel: string): string {
  const normalized = normalizeStatus(status);
  if (statusLabels[normalized]) return statusLabels[normalized];

  const raw = String(status || '').trim();
  if (!raw) return inProcessLabel;

  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function isActiveStatus(status: unknown): boolean {
  const normalized = normalizeStatus(status);
  if (STATUS_PAST.has(normalized)) return false;
  if (STATUS_ACTIVE.has(normalized)) return true;
  return true;
}

function formatMoney(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '$0.00';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(value: unknown, locale: string): string {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildMapsUrl(lat: number | null, lon: number | null): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

function buildWazeUrl(lat: number | null, lon: number | null): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
}

function getCurrentTabFromParam(tabParam: unknown): PedidoTab {
  return String(tabParam || '').toLowerCase() === 'pasados' ? 'pasados' : 'activos';
}

async function loadOrderHistoryIds(): Promise<number[]> {
  try {
    const raw = await authStorage.getItem(ORDER_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (typeof item === 'number' || typeof item === 'string') return Number(item);
        if (item && typeof item === 'object' && 'id' in item) return Number((item as { id?: unknown }).id);
        return NaN;
      })
      .filter((id) => Number.isFinite(id));
  } catch {
    return [];
  }
}

function statusToStep(status: unknown): number {
  const normalized = normalizeStatus(status);
  if (STATUS_PAST.has(normalized)) return 3;
  if (normalized === 'ready') return 3;
  if (normalized === 'preparing' || normalized === 'confirmed') return 2;
  return 1;
}

function resolveLogoUrl(rawValue: unknown): string {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const { data } = supabase.storage.from('galeriacomercios').getPublicUrl(raw);
  return data?.publicUrl || '';
}

type PedidoCardProps = {
  item: PedidoView;
  copy: PedidosCopy;
  statusLabels: Record<string, string>;
  dateLocale: string;
};

function PedidoCard({ item, copy, statusLabels, dateLocale }: PedidoCardProps) {
  const [expanded, setExpanded] = useState(false);

  const status = normalizeStatus(item.order.status);
  const statusLabel = getStatusLabel(item.order.status, statusLabels, copy.inProcess);
  const isActiveOrder = isActiveStatus(item.order.status);
  const step = statusToStep(item.order.status);
  const created = formatDate(item.order.created_at, dateLocale);
  const total = Number(item.order.total) || item.items.reduce((sum, row) => sum + row.lineTotal, 0);

  const mapsUrl = buildMapsUrl(item.comercio.latitud, item.comercio.longitud);
  const wazeUrl = buildWazeUrl(item.comercio.latitud, item.comercio.longitud);

  const telefonoDisplay = item.comercio.telefono ? formatearTelefonoDisplay(item.comercio.telefono) : '';
  const telefonoHref = item.comercio.telefono ? formatearTelefonoHref(item.comercio.telefono) : '';

  return (
    <View style={[styles.orderCard, shadows.card]}>
      <Pressable onPress={() => setExpanded((prev) => !prev)} style={styles.orderHeader}>
        <View style={styles.orderLogoWrap}>
          {item.comercio.logoUrl ? (
            <Image source={{ uri: item.comercio.logoUrl }} style={styles.orderLogoImage} resizeMode="contain" />
          ) : (
            <Text style={styles.logoFallback}>{copy.commerceFallback}</Text>
          )}
        </View>

        <View style={styles.orderMainInfo}>
          <Text numberOfLines={1} style={styles.orderCommerceName}>
            {item.comercio.nombre}
          </Text>
          <Text numberOfLines={1} style={styles.orderMetaText}>
            {created || copy.noDate}
          </Text>
          <Text numberOfLines={1} style={styles.orderMetaTextStrong}>
            {status === 'delivered' ? copy.deliveredOrder : `${copy.latestStatus}: ${statusLabel}`}
          </Text>
        </View>

        <View style={styles.orderAmountCol}>
          <Text style={styles.orderAmountLabel}>{copy.total}</Text>
          <Text style={styles.orderAmountValue}>{formatMoney(total)}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#94a3b8" />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.orderDetails}>
          {item.order.link_expired ? <Text style={styles.expiredText}>{copy.expiredLink}</Text> : null}

          {telefonoDisplay && telefonoHref ? (
            <Pressable
              style={styles.callBtn}
              onPress={() => void openExternalUrl(telefonoHref, { loggerTag: 'mobile-public/pedidos' })}
            >
              <FontAwesome6 name="phone" size={14} color="#fff" />
              <Text style={styles.callBtnText}>{telefonoDisplay}</Text>
            </Pressable>
          ) : null}

          <View style={styles.locationWrap}>
            {item.order.order_type === 'mesa' && item.order.mesa ? (
              <Text style={styles.mesaText}>{copy.table} {String(item.order.mesa)}</Text>
            ) : null}
            {item.comercio.direccion ? (
              <Text style={styles.addressText}>
                <FontAwesome6 name="location-pin" size={12} color="#0284c7" /> {item.comercio.direccion}
              </Text>
            ) : null}

            {mapsUrl || wazeUrl ? (
              <View style={styles.mapsActions}>
                {mapsUrl ? (
                  <Pressable
                    style={styles.mapBtn}
                    onPress={() => void openExternalUrl(mapsUrl, { loggerTag: 'mobile-public/pedidos' })}
                  >
                    <Image source={{ uri: GOOGLE_MAPS_LOGO }} style={styles.mapLogo} resizeMode="contain" />
                  </Pressable>
                ) : null}
                {wazeUrl ? (
                  <Pressable
                    style={styles.mapBtn}
                    onPress={() => void openExternalUrl(wazeUrl, { loggerTag: 'mobile-public/pedidos' })}
                  >
                    <Image source={{ uri: WAZE_LOGO }} style={styles.mapLogo} resizeMode="contain" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.statusBox}>
            <Text style={styles.statusTitle}>{copy.orderStatus}</Text>
            {isActiveOrder ? (
              <View style={styles.statusStepsRow}>
                {[1, 2, 3].map((index) => {
                  const active = step >= index;
                  const icon = index === 1 ? 'circle-check' : index === 2 ? 'kitchen-set' : 'bag-shopping';
                  const label = index === 1 ? copy.stepConfirmed : index === 2 ? copy.stepPreparing : copy.stepReady;
                  return (
                    <View key={`step-${index}`} style={styles.statusStepItem}>
                      <View style={[styles.statusStepCircle, active ? styles.statusStepCircleOn : styles.statusStepCircleOff]}>
                        <FontAwesome6 name={icon} size={12} color={active ? '#16a34a' : '#9ca3af'} />
                      </View>
                      <Text style={[styles.statusStepLabel, active ? styles.statusStepLabelOn : styles.statusStepLabelOff]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.pastStatusText}>{status === 'delivered' ? copy.deliveredOrder : `${copy.orderPrefix} ${statusLabel}`}</Text>
            )}
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>{copy.orderSummary}</Text>
            {item.items.length === 0 ? (
              <Text style={styles.summaryEmpty}>{copy.noItemDetails}</Text>
            ) : (
              item.items.map((row, idx) => (
                <View key={`item-${item.order.id}-${idx}`} style={styles.summaryRow}>
                  <Text style={styles.summaryItemName}>{row.nombre}</Text>
                  <Text style={styles.summaryItemPrice}>{formatMoney(row.lineTotal)}</Text>
                </View>
              ))
            )}
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>{copy.total}</Text>
              <Text style={styles.summaryTotalValue}>{formatMoney(total)}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function PedidosScreen() {
  const { lang, t } = useI18n();
  const params = useLocalSearchParams<{ tab?: string; token?: string }>();
  const copy = useMemo<PedidosCopy>(
    () => ({
      inProcess: t('pedidos.inProcess'),
      noDate: t('pedidos.noDate'),
      deliveredOrder: t('pedidos.deliveredOrder'),
      latestStatus: t('pedidos.latestStatus'),
      total: t('pedidos.total'),
      expiredLink: t('pedidos.expiredLink'),
      table: t('pedidos.table'),
      orderStatus: t('pedidos.orderStatus'),
      stepConfirmed: t('pedidos.stepConfirmed'),
      stepPreparing: t('pedidos.stepPreparing'),
      stepReady: t('pedidos.stepReady'),
      orderPrefix: t('pedidos.orderPrefix'),
      orderSummary: t('pedidos.orderSummary'),
      noItemDetails: t('pedidos.noItemDetails'),
      loadError: t('pedidos.loadError'),
      title: t('pedidos.title'),
      subtitle: t('pedidos.subtitle'),
      tabActive: t('pedidos.tabActive'),
      tabPast: t('pedidos.tabPast'),
      loadingOrders: t('pedidos.loadingOrders'),
      emptyTitle: t('pedidos.emptyTitle'),
      emptySubtitle: t('pedidos.emptySubtitle'),
      productFallback: t('pedidos.productFallback'),
      commerceFallback: t('pedidos.commerceFallback'),
    }),
    [t]
  );
  const statusLabels = useMemo(
    () => ({
      pending: t('pedidos.status.pending'),
      sent: t('pedidos.status.sent'),
      open: t('pedidos.status.open'),
      confirmed: t('pedidos.status.confirmed'),
      preparing: t('pedidos.status.preparing'),
      ready: t('pedidos.status.ready'),
      paid: t('pedidos.status.paid'),
      delivered: t('pedidos.status.delivered'),
      completed: t('pedidos.status.completed'),
      cancelled: t('pedidos.status.cancelled'),
      canceled: t('pedidos.status.canceled'),
      refunded: t('pedidos.status.refunded'),
    }),
    [t]
  );
  const dateLocale = useMemo(() => (lang === 'es' ? 'es-PR' : 'en-US'), [lang]);

  const [tab, setTab] = useState<PedidoTab>(getCurrentTabFromParam(params.tab));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<PedidoView[]>([]);

  const token = useMemo(() => String(params.token || '').trim(), [params.token]);

  useEffect(() => {
    setTab(getCurrentTabFromParam(params.tab));
  }, [params.tab]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let fetchedOrders: PedidoRaw[] = [];

      if (token) {
        const { data, error: tokenError } = await supabase
          .from('ordenes')
          .select('id,idcomercio,clover_order_id,checkout_url,total,status,created_at,order_type,mesa,source,order_link_expires_at')
          .eq('order_link_token', token)
          .maybeSingle();

        if (!tokenError && data) {
          const expired =
            data.order_link_expires_at && new Date(String(data.order_link_expires_at)).getTime() < Date.now();
          fetchedOrders = [
            {
              ...(data as PedidoRaw),
              link_expired: Boolean(expired || STATUS_PAST.has(normalizeStatus(data.status))),
            },
          ];
        }
      }

      if (fetchedOrders.length === 0) {
        const historyOrderIds = await loadOrderHistoryIds();
        if (historyOrderIds.length > 0) {
          const { data: historyData, error: historyError } = await supabase
            .from('ordenes')
            .select('id,idcomercio,clover_order_id,checkout_url,total,status,created_at,order_type,mesa,source')
            .in('id', historyOrderIds)
            .order('created_at', { ascending: false });

          if (!historyError && Array.isArray(historyData)) {
            fetchedOrders = historyData as PedidoRaw[];
          }
        }
      }

      if (fetchedOrders.length === 0) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const userId = String(user?.id || '');
        const userEmail = String(user?.email || '');

        if (userId) {
          const { data: byUserData, error: byUserError } = await supabase
            .from('ordenes')
            .select('id,idcomercio,clover_order_id,checkout_url,total,status,created_at,order_type,mesa,source')
            .eq('customer_user_id', userId)
            .order('created_at', { ascending: false });

          if (!byUserError && Array.isArray(byUserData)) {
            fetchedOrders = byUserData as PedidoRaw[];
          }
        }

        if (fetchedOrders.length === 0 && userEmail) {
          const { data: byEmailData, error: byEmailError } = await supabase
            .from('ordenes')
            .select('id,idcomercio,clover_order_id,checkout_url,total,status,created_at,order_type,mesa,source')
            .eq('customer_email', userEmail)
            .order('created_at', { ascending: false });

          if (!byEmailError && Array.isArray(byEmailData)) {
            fetchedOrders = byEmailData as PedidoRaw[];
          }
        }
      }

      if (fetchedOrders.length === 0) {
        setOrders([]);
        return;
      }

      const comercioIds = Array.from(
        new Set(fetchedOrders.map((order) => Number(order.idcomercio)).filter((id) => Number.isFinite(id) && id > 0))
      );

      const [comerciosResult, logosResult] = await Promise.all([
        supabase
          .from('Comercios')
          .select('id,nombre,direccion,telefono,latitud,longitud,logo')
          .in('id', comercioIds),
        supabase
          .from('imagenesComercios')
          .select('idComercio,imagen')
          .in('idComercio', comercioIds)
          .eq('logo', true),
      ]);

      const comercioLogoMap = new Map<number, string>();
      if (!logosResult.error && Array.isArray(logosResult.data)) {
        logosResult.data.forEach((entry) => {
          const id = Number((entry as { idComercio?: number | string | null }).idComercio ?? 0);
          const imageRaw = (entry as { imagen?: unknown }).imagen;
          const url = resolveLogoUrl(imageRaw);
          if (Number.isFinite(id) && id > 0 && url) comercioLogoMap.set(id, url);
        });
      }

      const comercioMap = new Map<number, PedidoView['comercio']>();
      if (!comerciosResult.error && Array.isArray(comerciosResult.data)) {
        (comerciosResult.data as ComercioRaw[]).forEach((comercio) => {
          const id = Number(comercio.id ?? 0);
          if (!Number.isFinite(id) || id <= 0) return;

          const logoByColumn = resolveLogoUrl(comercio.logo);
          const logoByTable = comercioLogoMap.get(id) || '';

          comercioMap.set(id, {
            id,
            nombre: String(comercio.nombre || copy.commerceFallback),
            direccion: String(comercio.direccion || ''),
            telefono: String(comercio.telefono || ''),
            latitud: toFiniteNumber(comercio.latitud),
            longitud: toFiniteNumber(comercio.longitud),
            logoUrl: logoByColumn || logoByTable,
          });
        });
      }

      const orderIds = fetchedOrders.map((order) => Number(order.id)).filter((id) => Number.isFinite(id));
      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('orden_items')
        .select('idorden,idproducto,qty,price_snapshot,modifiers')
        .in('idorden', orderIds);

      const orderItems = !orderItemsError && Array.isArray(orderItemsData) ? (orderItemsData as OrderItemRow[]) : [];
      const productIds = Array.from(
        new Set(orderItems.map((item) => Number(item.idproducto)).filter((id) => Number.isFinite(id) && id > 0))
      );

      let productMap = new Map<number, ProductoRow>();
      if (productIds.length > 0) {
        const { data: productsData, error: productsError } = await supabase
          .from('productos')
          .select('id,nombre,imagen')
          .in('id', productIds);
        if (!productsError && Array.isArray(productsData)) {
          productMap = new Map(
            (productsData as ProductoRow[])
              .map((product) => [Number(product.id), product] as const)
              .filter(([id]) => Number.isFinite(id) && id > 0)
          );
        }
      }

      const itemsByOrder = new Map<number, PedidoItemView[]>();
      orderItems.forEach((row) => {
        const idOrden = Number(row.idorden);
        if (!Number.isFinite(idOrden)) return;

        const list = itemsByOrder.get(idOrden) || [];
        const product = productMap.get(Number(row.idproducto));

        const unitPrice = Number(row.price_snapshot) || 0;
        const qty = Number(row.qty) || 0;

        list.push({
          nombre: String(product?.nombre || `${copy.productFallback} ${row.idproducto}`),
          lineTotal: unitPrice * qty,
        });

        itemsByOrder.set(idOrden, list);
      });

      const mapped: PedidoView[] = fetchedOrders
        .map((order) => {
          const orderId = Number(order.id);
          const comercioId = Number(order.idcomercio);

          if (!Number.isFinite(orderId) || !Number.isFinite(comercioId) || comercioId <= 0) return null;

          const comercio =
            comercioMap.get(comercioId) ||
            ({
              id: comercioId,
              nombre: copy.commerceFallback,
              direccion: '',
              telefono: '',
              latitud: null,
              longitud: null,
              logoUrl: '',
            } as PedidoView['comercio']);

          return {
            order,
            comercio,
            items: itemsByOrder.get(orderId) || [],
          };
        })
        .filter((entry): entry is PedidoView => Boolean(entry));

      setOrders(mapped);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : copy.loadError;
      setError(message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [copy.commerceFallback, copy.loadError, copy.productFallback, token]);

  useFocusEffect(
    useCallback(() => {
      void loadOrders();
    }, [loadOrders])
  );

  const filtered = useMemo(
    () => orders.filter((entry) => (tab === 'activos' ? isActiveStatus(entry.order.status) : !isActiveStatus(entry.order.status))),
    [orders, tab]
  );

  return (
    <PublicAppChrome>
      {({ onScroll, scrollEventThrottle, contentPaddingStyle }) => (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.screen, contentPaddingStyle]}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.subtitle}>{copy.subtitle}</Text>
            </View>
            <Pressable style={styles.refreshBtn} onPress={() => void loadOrders()}>
              <Ionicons name="refresh" size={18} color="#334155" />
            </Pressable>
          </View>

          <View style={styles.tabsWrap}>
            <Pressable style={[styles.tabBtn, tab === 'activos' ? styles.tabBtnActive : null]} onPress={() => setTab('activos')}>
              <Text style={[styles.tabText, tab === 'activos' ? styles.tabTextActive : null]}>{copy.tabActive}</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, tab === 'pasados' ? styles.tabBtnActive : null]} onPress={() => setTab('pasados')}>
              <Text style={[styles.tabText, tab === 'pasados' ? styles.tabTextActive : null]}>{copy.tabPast}</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.stateText}>{copy.loadingOrders}</Text>
            </View>
          ) : error ? (
            <View style={styles.stateCard}>
              <ScreenState message={error} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.stateCard}>
              <Text style={styles.emptyEmoji}>🧾</Text>
              <Text style={styles.stateTitle}>{copy.emptyTitle}</Text>
              <Text style={styles.stateText}>{copy.emptySubtitle}</Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {filtered.map((entry) => (
                <PedidoCard
                  key={`pedido-${entry.order.id}`}
                  item={entry}
                  copy={copy}
                  statusLabels={statusLabels}
                  dateLocale={dateLocale}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </PublicAppChrome>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  screen: {
    minHeight: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    color: '#1e293b',
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.medium,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.regular,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  tabsWrap: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    backgroundColor: '#e2e8f0',
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#fff',
    ...shadows.card,
  },
  tabText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  tabTextActive: {
    color: '#0f172a',
  },
  stateCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emptyEmoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  stateTitle: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: fonts.medium,
  },
  stateText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  listWrap: {
    gap: spacing.sm,
  },
  orderCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  orderLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orderLogoImage: {
    width: '100%',
    height: '100%',
  },
  logoFallback: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.medium,
  },
  orderMainInfo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  orderCommerceName: {
    color: '#1e293b',
    fontSize: 15,
    lineHeight: 19,
    fontFamily: fonts.medium,
  },
  orderMetaText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
  },
  orderMetaTextStrong: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.medium,
  },
  orderAmountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 84,
    gap: 2,
  },
  orderAmountLabel: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.regular,
  },
  orderAmountValue: {
    color: '#0f172a',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  orderDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  callBtn: {
    alignSelf: 'center',
    borderRadius: borderRadius.pill,
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  callBtnText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  expiredText: {
    color: '#ef4444',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontFamily: fonts.medium,
  },
  locationWrap: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  mesaText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.medium,
  },
  addressText: {
    color: '#0369a1',
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
    fontFamily: fonts.medium,
  },
  mapsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mapBtn: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    ...shadows.card,
  },
  mapLogo: {
    width: 110,
    height: 28,
  },
  statusBox: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  statusTitle: {
    color: '#334155',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.medium,
  },
  statusStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  statusStepItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusStepCircle: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusStepCircleOn: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  statusStepCircleOff: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  statusStepLabel: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
  statusStepLabelOn: {
    color: '#15803d',
    fontFamily: fonts.medium,
  },
  statusStepLabelOff: {
    color: '#64748b',
    fontFamily: fonts.regular,
  },
  pastStatusText: {
    color: '#15803d',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.medium,
  },
  summaryBox: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  summaryTitle: {
    color: '#334155',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.medium,
  },
  summaryEmpty: {
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  summaryItemName: {
    flex: 1,
    color: '#1f2937',
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.regular,
  },
  summaryItemPrice: {
    color: '#1f2937',
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.medium,
  },
  summaryTotalRow: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTotalLabel: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
  summaryTotalValue: {
    color: '#0f172a',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
});
