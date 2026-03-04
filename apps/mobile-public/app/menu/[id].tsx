import { formatearTelefonoDisplay, formatearTelefonoHref, resolverPlanComercio } from '@findixi/shared';
import * as Font from 'expo-font';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../src/config/env';
import {
  fetchMenuComercio,
  fetchMenuProducts,
  fetchMenuSections,
  fetchMenuTheme,
  fetchMenuTranslation,
  fetchModifierGroups,
  fetchModifierItems,
  fetchProductTaxRates,
  getProductoImageUrl,
  isComercioVerificado,
  toMenuStorageUrl,
} from '../../src/features/menu/api';
import type {
  MenuComercio,
  MenuProduct,
  MenuSection,
  MenuTheme,
  MenuTranslationResult,
  ModifierGroup,
  ModifierItem,
  ProductTaxRates,
} from '../../src/features/menu/types';
import { useI18n } from '../../src/i18n/provider';
import type { LanguageCode } from '../../src/i18n/languages';
import { openExternalUrl } from '../../src/lib/external-link';
import { authStorage } from '../../src/lib/storage';
import { supabase } from '../../src/lib/supabase';
import { borderRadius, fonts, shadows, spacing } from '../../src/theme/tokens';

type OrderMode = 'view' | 'pickup' | 'mesa';

type CartModifier = {
  idOpcionItem: number;
  nombre: string;
  precio_extra: number;
  grupo: string;
};

type CartLineItem = {
  key: string;
  idProducto: number;
  qty: number;
  modifiers: CartModifier[];
  nota: string;
};

type GroupWithItems = {
  group: ModifierGroup;
  items: ModifierItem[];
};

type MenuFontRole = 'body' | 'title' | 'nombre' | 'menuWord' | 'sectionDesc';
type MenuFontSet = Record<MenuFontRole, string>;
type FontRenderMetrics = { lineHeight: number; paddingTop: number; paddingBottom: number };

type PickerTexts = {
  loading: string;
  loadError: string;
  blockedByPlanTitle: string;
  blockedByPlanBody: string;
  blockedPendingTitle: string;
  blockedPendingBody: string;
  viewOrder: string;
  sectionLoading: string;
  add: string;
  optionsLoadError: string;
  customizeOrder: string;
  cancel: string;
  optional: string;
  notePlaceholder: string;
  addToCart: string;
  saveChanges: string;
  requiredFmt: string;
  optionalLabel: string;
  maxFmt: string;
  noOptions: string;
  cartTitle: string;
  close: string;
  customerFieldsTitle: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notePhone: string;
  noteEmail: string;
  subtotal: string;
  tax: string;
  total: string;
  checkoutPickup: string;
  checkoutMesa: string;
  emptyCart: string;
  edit: string;
  remove: string;
  deleteConfirmFmt: string;
  completePickup: string;
  invalidEmail: string;
  invalidPhone: string;
  cloverReconnect: string;
  orderLinkError: string;
  orderSentMesa: string;
  orderGenericError: string;
  menuWordDefault: string;
  backToCommerce: string;
  menuPdf: string;
  loadingSectionTitle: string;
  updatedItemFmt: string;
  addedItemFmt: string;
  onlineOrdersPremiumOnly: string;
  orderCreateErrorFmt: string;
  emptyProducts: string;
  retry: string;
  productFallbackFmt: string;
  noteLabel: string;
  phonePlaceholder: string;
  emailPlaceholder: string;
  footerDesignBy: string;
  footerCopyright: string;
  footerPrivacyPolicy: string;
  footerTermsOfService: string;
  optionItemFallback: string;
  optionGroupFallback: string;
};

const TEXTS_BY_LANG: Record<LanguageCode, PickerTexts> = {
  es: {
    loading: 'Cargando menú...',
    loadError: 'No se pudo cargar el menú de este comercio.',
    blockedByPlanTitle: 'Menú disponible en Findixi Plus',
    blockedByPlanBody: 'Este comercio aún no tiene habilitado su menú en Findixi.',
    blockedPendingTitle: 'Perfil pendiente de verificación',
    blockedPendingBody:
      'Este comercio aún no ha completado la verificación de propiedad. Su menú estará disponible cuando se valide.',
    viewOrder: 'Ver Orden',
    sectionLoading: 'Cargando...',
    add: 'Agregar',
    optionsLoadError: 'No se pudieron cargar opciones. Se añadió el producto sin opciones.',
    customizeOrder: 'Personaliza tu orden',
    cancel: 'Cancelar',
    optional: 'opcional',
    notePlaceholder: 'Ej: sin cebolla, salsa aparte',
    addToCart: 'Agregar al carrito',
    saveChanges: 'Guardar cambios',
    requiredFmt: 'Requerido (mín {min})',
    optionalLabel: 'Opcional',
    maxFmt: 'máx {max}',
    noOptions: 'Sin opciones disponibles.',
    cartTitle: 'Tu pedido',
    close: 'Cerrar',
    customerFieldsTitle: 'Datos para el recibo',
    firstName: 'Nombre',
    lastName: 'Apellido',
    phone: 'Teléfono',
    email: 'Email',
    notePhone: 'Necesario para enviarte el enlace del pedido.',
    noteEmail: 'El recibo será enviado a este email.',
    subtotal: 'Subtotal',
    tax: 'Tax',
    total: 'Total',
    checkoutPickup: 'Proceder con el pago',
    checkoutMesa: 'Enviar orden a cocina',
    emptyCart: 'Tu carrito está vacío.',
    edit: 'Editar',
    remove: 'Eliminar',
    deleteConfirmFmt: '¿Seguro deseas eliminar {name} del pedido?',
    completePickup: 'Por favor completa nombre, apellido, teléfono y email antes de pagar.',
    invalidEmail: 'Ingresa un email válido para recibir el recibo.',
    invalidPhone: 'Ingresa un teléfono válido.',
    cloverReconnect: 'Este comercio debe reconectar Clover para aceptar pagos.',
    orderLinkError: 'No se pudo obtener el enlace de pago.',
    orderSentMesa: 'Orden enviada. El pago se realiza en el local.',
    orderGenericError: 'Error inesperado al enviar la orden.',
    menuWordDefault: 'Menú',
    backToCommerce: 'Volver al comercio',
    menuPdf: 'Ver menú PDF',
    loadingSectionTitle: 'Cargando...',
    updatedItemFmt: '{name} actualizado correctamente',
    addedItemFmt: '{name} añadido correctamente',
    onlineOrdersPremiumOnly: 'Las órdenes en línea están disponibles solo en Findixi Premium.',
    orderCreateErrorFmt: 'Error creando orden ({status})',
    emptyProducts: 'No hay productos disponibles.',
    retry: 'Reintentar',
    productFallbackFmt: 'Producto {id}',
    noteLabel: 'Nota',
    phonePlaceholder: '787-000-0000',
    emailPlaceholder: 'correo@ejemplo.com',
    footerDesignBy: 'Diseño y Creación por www.findixi.com',
    footerCopyright: 'Copyright © 2026. Todos los derechos reservados.',
    footerPrivacyPolicy: 'Privacy Policy',
    footerTermsOfService: 'Terms of Service',
    optionItemFallback: 'Opción',
    optionGroupFallback: 'Opciones',
  },
  en: {
    loading: 'Loading menu...',
    loadError: 'Could not load this business menu.',
    blockedByPlanTitle: 'Menu available in Findixi Plus',
    blockedByPlanBody: 'This business has not enabled its menu in Findixi yet.',
    blockedPendingTitle: 'Profile pending verification',
    blockedPendingBody: 'This business has not completed ownership verification yet. The menu will be available once approved.',
    viewOrder: 'View Order',
    sectionLoading: 'Loading...',
    add: 'Add',
    optionsLoadError: 'Could not load options. Product was added without options.',
    customizeOrder: 'Customize your order',
    cancel: 'Cancel',
    optional: 'optional',
    notePlaceholder: 'e.g. no onions, sauce on the side',
    addToCart: 'Add to cart',
    saveChanges: 'Save changes',
    requiredFmt: 'Required (min {min})',
    optionalLabel: 'Optional',
    maxFmt: 'max {max}',
    noOptions: 'No options available.',
    cartTitle: 'Your order',
    close: 'Close',
    customerFieldsTitle: 'Receipt information',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone',
    email: 'Email',
    notePhone: 'Required to send your order link.',
    noteEmail: 'Receipt will be sent to this email.',
    subtotal: 'Subtotal',
    tax: 'Tax',
    total: 'Total',
    checkoutPickup: 'Proceed to payment',
    checkoutMesa: 'Send order to kitchen',
    emptyCart: 'Your cart is empty.',
    edit: 'Edit',
    remove: 'Remove',
    deleteConfirmFmt: 'Are you sure you want to remove {name} from the order?',
    completePickup: 'Please complete first name, last name, phone and email before checkout.',
    invalidEmail: 'Enter a valid email to receive the receipt.',
    invalidPhone: 'Enter a valid phone number.',
    cloverReconnect: 'This business must reconnect Clover to accept payments.',
    orderLinkError: 'Could not get payment link.',
    orderSentMesa: 'Order sent. Payment is completed at the store.',
    orderGenericError: 'Unexpected error sending the order.',
    menuWordDefault: 'Menu',
    backToCommerce: 'Back to business',
    menuPdf: 'View menu PDF',
    loadingSectionTitle: 'Loading...',
    updatedItemFmt: '{name} updated successfully',
    addedItemFmt: '{name} added successfully',
    onlineOrdersPremiumOnly: 'Online orders are available only with Findixi Premium.',
    orderCreateErrorFmt: 'Error creating order ({status})',
    emptyProducts: 'No products available.',
    retry: 'Retry',
    productFallbackFmt: 'Product {id}',
    noteLabel: 'Note',
    phonePlaceholder: '787-000-0000',
    emailPlaceholder: 'email@example.com',
    footerDesignBy: 'Design and Creation by www.findixi.com',
    footerCopyright: 'Copyright © 2026. All rights reserved.',
    footerPrivacyPolicy: 'Privacy Policy',
    footerTermsOfService: 'Terms of Service',
    optionItemFallback: 'Option',
    optionGroupFallback: 'Options',
  },
  zh: {} as PickerTexts,
  fr: {} as PickerTexts,
  pt: {} as PickerTexts,
  de: {} as PickerTexts,
  it: {} as PickerTexts,
  ko: {} as PickerTexts,
  ja: {} as PickerTexts,
};

const GALLERY_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/';
const LOGO_FINDIXI = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/logoFindixi.png';
const DEFAULT_PRODUCT_IMAGE = `${GALLERY_BASE}NoActivoPortada.jpg`;
const DEFAULT_LOGO = `${GALLERY_BASE}NoActivoLogo.png`;
const ORDER_HISTORY_KEY = 'findixi_orders';
const TAX_RATE_DENOMINATOR = 10000000;
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

const DEFAULT_MENU_FONTS: MenuFontSet = {
  body: fonts.regular,
  title: fonts.medium,
  nombre: fonts.bold,
  menuWord: fonts.semibold,
  sectionDesc: fonts.regular,
};

const GOOGLE_FONT_TTF_BY_NAME: Record<string, string> = {
  kanit: 'https://raw.githubusercontent.com/google/fonts/main/ofl/kanit/Kanit-Regular.ttf',
  poppins: 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf',
  inter: 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf',
  montserrat: 'https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf',
  roboto: 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf',
  nunito: 'https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/Nunito%5Bwght%5D.ttf',
  mulish: 'https://raw.githubusercontent.com/google/fonts/main/ofl/mulish/Mulish%5Bwght%5D.ttf',
  sourcesanspro: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/SourceSans3%5Bwght%5D.ttf',
  opensans: 'https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/OpenSans%5Bwdth%2Cwght%5D.ttf',
  worksans: 'https://raw.githubusercontent.com/google/fonts/main/ofl/worksans/WorkSans%5Bwght%5D.ttf',
  playfairdisplay: 'https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf',
  merriweather: 'https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/Merriweather-Regular.ttf',
  librebaskerville: 'https://raw.githubusercontent.com/google/fonts/main/ofl/librebaskerville/LibreBaskerville-Regular.ttf',
  cormorantgaramond: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf',
  dancingscript: 'https://raw.githubusercontent.com/google/fonts/main/ofl/dancingscript/DancingScript%5Bwght%5D.ttf',
  pacifico: 'https://raw.githubusercontent.com/google/fonts/main/ofl/pacifico/Pacifico-Regular.ttf',
  caveat: 'https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/Caveat%5Bwght%5D.ttf',
  greatvibes: 'https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf',
  bebasneue: 'https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/BebasNeue-Regular.ttf',
  oswald: 'https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf',
  anton: 'https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf',
  fjallaone: 'https://raw.githubusercontent.com/google/fonts/main/ofl/fjallaone/FjallaOne-Regular.ttf',
};

function getTexts(lang: LanguageCode): PickerTexts {
  if (lang === 'es' || lang === 'en') return TEXTS_BY_LANG[lang];
  return TEXTS_BY_LANG.en;
}

function parseId(value: string | string[] | undefined): number {
  if (Array.isArray(value)) return Number(value[0] ?? 0);
  return Number(value ?? 0);
}

function resolveOrderMode(modeRaw: string | string[] | undefined): OrderMode {
  const value = (Array.isArray(modeRaw) ? modeRaw[0] : modeRaw || 'view').toLowerCase();
  if (value === 'pickup') return 'pickup';
  if (value === 'mesa') return 'mesa';
  return 'view';
}

function normalizeQueryValue(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] ?? '' : value ?? '').trim();
}

function replaceTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ''));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getFontRenderMetrics(fontFamilyRaw: string | null | undefined, fontSizeRaw: number): FontRenderMetrics {
  const fontSize = Math.max(10, Number.isFinite(fontSizeRaw) ? fontSizeRaw : 16);
  const key = normalizeFontKey(fontFamilyRaw);

  const scriptLikeFonts = new Set(['pacifico', 'greatvibes', 'dancingscript', 'caveat']);
  const tallFonts = new Set(['bebasneue', 'anton', 'oswald', 'fjallaone']);
  const serifTallFonts = new Set(['playfairdisplay', 'merriweather', 'librebaskerville', 'cormorantgaramond']);

  const isScript = scriptLikeFonts.has(key);
  const isTall = isScript || tallFonts.has(key) || serifTallFonts.has(key);

  const multiplier = isScript ? 1.72 : isTall ? 1.5 : 1.34;
  const paddingTop = isScript ? 4 : isTall ? 2 : 1;
  const paddingBottom = isScript ? 6 : isTall ? 3 : 1;

  const lineHeight = Math.max(
    Math.ceil(fontSize * multiplier),
    fontSize + paddingTop + paddingBottom + 4
  );

  return { lineHeight, paddingTop, paddingBottom };
}

function rgbaFromHexOrRgb(colorRaw: string, alphaRaw: number): string {
  const alpha = clamp(alphaRaw, 0, 1);
  const color = String(colorRaw || '').trim();

  if (color.startsWith('rgb')) {
    const parts = color
      .replace(/rgba?\(|\)/g, '')
      .split(',')
      .map((part) => part.trim());
    const r = Number(parts[0] ?? 0);
    const g = Number(parts[1] ?? 0);
    const b = Number(parts[2] ?? 0);
    return `rgba(${Number.isFinite(r) ? r : 0}, ${Number.isFinite(g) ? g : 0}, ${Number.isFinite(b) ? b : 0}, ${alpha})`;
  }

  const cleaned = color.replace('#', '');
  const full = cleaned.length === 3 ? cleaned.split('').map((x) => `${x}${x}`).join('') : cleaned;
  const parsed = Number.parseInt(full, 16);

  if (!Number.isFinite(parsed)) return `rgba(255,255,255,${alpha})`;

  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeExternalUrl(urlRaw: string | null | undefined): string | null {
  const value = String(urlRaw ?? '').trim();
  if (!value) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) return value;
  return `https://${value}`;
}

function normalizeFontKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function ensureWebFontLink(urlRaw: string | null | undefined): void {
  if (Platform.OS !== 'web') return;
  const url = String(urlRaw ?? '').trim();
  if (!url) return;
  if (typeof document === 'undefined') return;

  const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
    (entry) => entry.getAttribute('href') === url
  );
  if (existing) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

function extractDirectFontUrl(urlRaw: string | null | undefined): string | null {
  const url = String(urlRaw ?? '').trim();
  if (!url) return null;
  if (/\.(ttf|otf)(\?|$)/i.test(url)) return url;
  return null;
}

function loadLineKey(idProducto: number, modifiers: CartModifier[], nota: string): string {
  const ids = modifiers
    .map((modifier) => Number(modifier.idOpcionItem))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b);
  const note = String(nota || '')
    .trim()
    .toLowerCase();
  return `${idProducto}:${ids.join(',')}:${note}`;
}

function parseCartStorage(
  raw: string | null,
  fallback: { optionItem: string; optionGroup: string }
): CartLineItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { items?: unknown } | null;
    if (!parsed || typeof parsed !== 'object') return [];

    if (!Array.isArray(parsed.items)) return [];

    return parsed.items
      .map((item) => {
        const row = item as Record<string, unknown>;
        const idProducto = Number(row.idProducto);
        const qty = Number(row.qty ?? 0);
        if (!Number.isFinite(idProducto) || !Number.isFinite(qty) || qty <= 0) return null;

        const modifiers = Array.isArray(row.modifiers)
          ? row.modifiers
              .map((mod) => {
                const modRow = mod as Record<string, unknown>;
                const idOpcionItem = Number(modRow.idOpcionItem ?? modRow.id);
                if (!Number.isFinite(idOpcionItem)) return null;
                return {
                  idOpcionItem,
                  nombre: String(modRow.nombre ?? modRow.name ?? fallback.optionItem).trim(),
                  precio_extra: Number(modRow.precio_extra ?? 0) || 0,
                  grupo: String(modRow.grupo ?? modRow.grupo_nombre ?? modRow.group ?? fallback.optionGroup).trim(),
                } as CartModifier;
              })
              .filter((entry): entry is CartModifier => Boolean(entry))
          : [];

        const nota = String(row.nota ?? '').trim();
        const keyRaw = String(row.key ?? '').trim();
        const key = keyRaw || loadLineKey(idProducto, modifiers, nota);

        return {
          key,
          idProducto,
          qty,
          modifiers,
          nota,
        } satisfies CartLineItem;
      })
      .filter((entry): entry is CartLineItem => Boolean(entry));
  } catch {
    return [];
  }
}

async function rememberOrder(orderIdRaw: unknown, comercioIdRaw: unknown): Promise<void> {
  const orderId = Number(orderIdRaw);
  const comercioId = Number(comercioIdRaw);
  if (!Number.isFinite(orderId) || orderId <= 0) return;

  const raw = await authStorage.getItem(ORDER_HISTORY_KEY);
  const history = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
  const safeHistory = Array.isArray(history) ? history : [];

  const alreadyExists = safeHistory.some((item) => Number((item as { id?: unknown }).id) === orderId);
  if (alreadyExists) return;

  const next = [
    {
      id: orderId,
      idComercio: Number.isFinite(comercioId) ? comercioId : null,
      created_at_local: new Date().toISOString(),
    },
    ...safeHistory,
  ].slice(0, 50);

  await authStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(next));
}

function getMenuTranslationMap(translation: MenuTranslationResult | null): Map<number, { nombre?: string | null; descripcion?: string | null }> {
  const map = new Map<number, { nombre?: string | null; descripcion?: string | null }>();
  const productos = Array.isArray(translation?.productos) ? translation?.productos : [];
  productos.forEach((entry) => {
    const id = Number(entry?.id ?? entry?.idproducto);
    if (!Number.isFinite(id)) return;
    map.set(id, {
      nombre: entry?.nombre,
      descripcion: entry?.descripcion,
    });
  });
  return map;
}

function getTaxRateForProduct(productId: number, rates: ProductTaxRates): number {
  const direct = rates.byProductId.get(Number(productId)) || [];
  const used = direct.length > 0 ? direct : rates.defaultRates;
  const sum = used.reduce((acc, rate) => acc + (Number(rate.rate) || 0), 0);
  return sum / TAX_RATE_DENOMINATOR;
}

export default function MenuComercioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    idComercio?: string;
    mode?: string;
    modo?: string;
    mesa?: string;
    table?: string;
    source?: string;
  }>();
  const { lang, currentLanguage, languages, setLang, t } = useI18n();
  const texts = getTexts(lang);

  const idComercio = useMemo(() => {
    return parseId(params.idComercio || params.id);
  }, [params.id, params.idComercio]);

  const orderMode = useMemo(() => resolveOrderMode(params.modo || params.mode), [params.mode, params.modo]);
  const mesaParam = useMemo(() => normalizeQueryValue(params.mesa || params.table), [params.mesa, params.table]);
  const sourceParam = useMemo(() => normalizeQueryValue(params.source).toLowerCase(), [params.source]);

  const allowPickup = orderMode === 'pickup' && sourceParam === 'app';
  const allowMesa = orderMode === 'mesa';
  const allowOrdering = allowPickup || allowMesa;
  const orderSource = allowPickup ? 'app' : allowMesa ? 'qr' : 'qr';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planBlocked, setPlanBlocked] = useState<{ title: string; body: string } | null>(null);

  const [theme, setTheme] = useState<MenuTheme | null>(null);
  const [menuFonts, setMenuFonts] = useState<MenuFontSet>(DEFAULT_MENU_FONTS);
  const [comercio, setComercio] = useState<MenuComercio | null>(null);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [expandedSectionId, setExpandedSectionId] = useState<number | null>(null);
  const [sectionLoadingId, setSectionLoadingId] = useState<number | null>(null);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [langModalOpen, setLangModalOpen] = useState(false);

  const [translationsByMenu, setTranslationsByMenu] = useState<Record<number, MenuTranslationResult | null>>({});
  const translationCacheRef = useRef<Map<string, MenuTranslationResult | null>>(new Map());

  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [taxRates, setTaxRates] = useState<ProductTaxRates>({ defaultRates: [], byProductId: new Map() });
  const [planPermiteOrdenes, setPlanPermiteOrdenes] = useState(true);

  const [modifierOpen, setModifierOpen] = useState(false);
  const [modifierLoading, setModifierLoading] = useState(false);
  const [modifierGroups, setModifierGroups] = useState<GroupWithItems[]>([]);
  const [modifierSelected, setModifierSelected] = useState<Record<number, number[]>>({});
  const [modifierNote, setModifierNote] = useState('');
  const [modifierProduct, setModifierProduct] = useState<MenuProduct | null>(null);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [editingLineQty, setEditingLineQty] = useState(1);

  const groupsCacheRef = useRef<Map<number, ModifierGroup[]>>(new Map());
  const itemsCacheRef = useRef<Map<number, ModifierItem[]>>(new Map());
  const loadedFontAliasesRef = useRef<Set<string>>(new Set());

  const menuWord = (theme?.textomenu || texts.menuWordDefault || 'Menú').trim();
  const nombreFontSize = Math.max(18, Number(theme?.nombre_font_size || 28));
  const menuWordFontSize = Math.max(16, Number(theme?.menu_font_size || 20));
  const sectionTitleFontSize = Math.max(16, Number(theme?.fonttitle_size || 18));
  const bodyFontSize = Math.max(13, Number(theme?.fontbody_size || 16));
  const sectionDescFontSize = Math.max(
    12,
    Number(theme?.seccion_desc_font_size || Math.round(Number(theme?.fonttitle_size || 18) * 0.8))
  );
  const nombreFontMetrics = useMemo(
    () => getFontRenderMetrics(theme?.fontnombrefamily, nombreFontSize),
    [nombreFontSize, theme?.fontnombrefamily]
  );
  const menuWordFontMetrics = useMemo(
    () => getFontRenderMetrics(theme?.fontmenuwordfamily, menuWordFontSize),
    [menuWordFontSize, theme?.fontmenuwordfamily]
  );
  const titleFontMetrics = useMemo(
    () => getFontRenderMetrics(theme?.fonttitlefamily, sectionTitleFontSize),
    [sectionTitleFontSize, theme?.fonttitlefamily]
  );
  const sectionDescFontMetrics = useMemo(
    () => getFontRenderMetrics(theme?.seccion_desc_font_family || theme?.fonttitlefamily, sectionDescFontSize),
    [sectionDescFontSize, theme?.fonttitlefamily, theme?.seccion_desc_font_family]
  );
  const bodyFontMetrics = useMemo(
    () => getFontRenderMetrics(theme?.fontbodyfamily, bodyFontSize),
    [bodyFontSize, theme?.fontbodyfamily]
  );
  const coverUrl = useMemo(() => toMenuStorageUrl(theme?.portadaimagen ?? null), [theme?.portadaimagen]);
  const backgroundUrl = useMemo(() => toMenuStorageUrl(theme?.backgroundimagen ?? null), [theme?.backgroundimagen]);

  useEffect(() => {
    let active = true;

    async function loadThemeFonts() {
      if (!theme) {
        if (active) setMenuFonts(DEFAULT_MENU_FONTS);
        return;
      }

      const roleConfig: Record<MenuFontRole, { family: string | null; url: string | null; fallback: string }> = {
        body: {
          family: theme.fontbodyfamily,
          url: theme.fontbodyurl,
          fallback: DEFAULT_MENU_FONTS.body,
        },
        title: {
          family: theme.fonttitlefamily,
          url: theme.fonttitleurl,
          fallback: DEFAULT_MENU_FONTS.title,
        },
        nombre: {
          family: theme.fontnombrefamily,
          url: theme.fontnombreurl,
          fallback: DEFAULT_MENU_FONTS.nombre,
        },
        menuWord: {
          family: theme.fontmenuwordfamily,
          url: theme.fontmenuwordurl,
          fallback: DEFAULT_MENU_FONTS.menuWord,
        },
        sectionDesc: {
          family: theme.seccion_desc_font_family || theme.fonttitlefamily,
          url: theme.seccion_desc_font_url || theme.fonttitleurl,
          fallback: DEFAULT_MENU_FONTS.sectionDesc,
        },
      };

      const resolved: MenuFontSet = { ...DEFAULT_MENU_FONTS };

      const resolveRoleFont = async (role: MenuFontRole): Promise<string> => {
        const config = roleConfig[role];
        const family = String(config.family ?? '').trim();
        const url = String(config.url ?? '').trim();
        if (!family) return config.fallback;

        if (Platform.OS === 'web') {
          ensureWebFontLink(url);
          return family;
        }

        const normalizedKey = normalizeFontKey(family);
        if (normalizedKey === 'kanit') return config.fallback;

        const directUrl = extractDirectFontUrl(url);
        const mappedUrl = GOOGLE_FONT_TTF_BY_NAME[normalizedKey] || null;
        const fontUrl = directUrl || mappedUrl;
        if (!fontUrl) return config.fallback;

        const alias = `menufont_${normalizedKey}`;
        if (!loadedFontAliasesRef.current.has(alias)) {
          try {
            await Font.loadAsync({
              [alias]: { uri: fontUrl },
            });
            loadedFontAliasesRef.current.add(alias);
          } catch (fontError) {
            console.warn(`[mobile-public][menu] No se pudo cargar fuente \"${family}\":`, fontError);
            return config.fallback;
          }
        }

        return alias;
      };

      resolved.body = await resolveRoleFont('body');
      resolved.title = await resolveRoleFont('title');
      resolved.nombre = await resolveRoleFont('nombre');
      resolved.menuWord = await resolveRoleFont('menuWord');
      resolved.sectionDesc = await resolveRoleFont('sectionDesc');

      if (active) setMenuFonts(resolved);
    }

    void loadThemeFonts();
    return () => {
      active = false;
    };
  }, [theme]);

  const cartKey = useMemo(() => {
    if (!Number.isFinite(idComercio) || idComercio <= 0) return null;
    return `cart_${idComercio}_${orderMode}${mesaParam ? `_mesa_${mesaParam}` : ''}`;
  }, [idComercio, mesaParam, orderMode]);

  const productsById = useMemo(() => {
    const map = new Map<number, MenuProduct>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);

  const productsByMenu = useMemo(() => {
    const map = new Map<number, MenuProduct[]>();
    sections.forEach((section) => {
      map.set(
        section.id,
        products
          .filter((product) => product.idMenu === section.id)
          .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      );
    });
    return map;
  }, [products, sections]);

  const itemBgColor = useMemo(() => {
    const base = theme?.item_bg_color || '#ffffff';
    const overlay = clamp(Number(theme?.item_overlay ?? 0), 0, 80);
    const alpha = 1 - overlay / 100;
    return rgbaFromHexOrRgb(base, alpha);
  }, [theme?.item_bg_color, theme?.item_overlay]);

  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;

    cartItems.forEach((line) => {
      const product = productsById.get(line.idProducto);
      const basePrice = Number(product?.precio ?? 0);
      const modifierExtra = (line.modifiers || []).reduce((sum, modifier) => sum + (Number(modifier.precio_extra) || 0), 0);
      const unit = basePrice + modifierExtra;
      const lineSubtotal = unit * Number(line.qty || 0);
      subtotal += lineSubtotal;
      tax += lineSubtotal * getTaxRateForProduct(line.idProducto, taxRates);
    });

    return {
      subtotal,
      tax,
      total: subtotal + tax,
      count: cartItems.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    };
  }, [cartItems, productsById, taxRates]);

  const ensureMenuTranslation = useCallback(
    async (menuId: number) => {
      const langNorm = String(lang || 'es')
        .toLowerCase()
        .split('-')[0];
      if (langNorm === 'es') return;

      const cacheKey = `${menuId}:${langNorm}`;
      if (translationCacheRef.current.has(cacheKey)) {
        const cached = translationCacheRef.current.get(cacheKey) ?? null;
        setTranslationsByMenu((prev) => ({ ...prev, [menuId]: cached }));
        return;
      }

      setSectionLoadingId(menuId);
      try {
        const translated = await fetchMenuTranslation(menuId, langNorm);
        translationCacheRef.current.set(cacheKey, translated);
        setTranslationsByMenu((prev) => ({ ...prev, [menuId]: translated }));
      } finally {
        setSectionLoadingId((current) => (current === menuId ? null : current));
      }
    },
    [lang]
  );

  const loadData = useCallback(async () => {
    if (!Number.isFinite(idComercio) || idComercio <= 0) {
      setError(texts.loadError);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPlanBlocked(null);
    setExpandedSectionId(null);

    try {
      const [themeRes, comercioRes, sectionsRes] = await Promise.all([
        fetchMenuTheme(idComercio),
        fetchMenuComercio(idComercio),
        fetchMenuSections(idComercio),
      ]);

      if (!comercioRes) {
        setError(texts.loadError);
        setLoading(false);
        return;
      }

      setTheme(themeRes);
      setComercio(comercioRes);
      setSections(sectionsRes);

      const plan = resolverPlanComercio(comercioRes as Record<string, unknown>);
      setPlanPermiteOrdenes(plan.permite_ordenes);

      if (!plan.permite_menu) {
        if (isComercioVerificado(comercioRes)) {
          setPlanBlocked({
            title: texts.blockedByPlanTitle,
            body: texts.blockedByPlanBody,
          });
        } else {
          setPlanBlocked({
            title: texts.blockedPendingTitle,
            body: texts.blockedPendingBody,
          });
        }
        setLoading(false);
        return;
      }

      const menuIds = sectionsRes.map((section) => section.id).filter((id) => Number.isFinite(id));
      const productsRes = await fetchMenuProducts(menuIds);
      setProducts(productsRes);

      if (allowOrdering && plan.permite_ordenes) {
        try {
          const rates = await fetchProductTaxRates(
            idComercio,
            productsRes.map((product) => product.id)
          );
          setTaxRates(rates);
        } catch (taxError) {
          console.warn('[mobile-public][menu] No se pudieron cargar taxes:', taxError);
          setTaxRates({ defaultRates: [], byProductId: new Map() });
        }
      } else {
        setTaxRates({ defaultRates: [], byProductId: new Map() });
      }
    } catch (loadError) {
      console.error('[mobile-public][menu] Error cargando menu:', loadError);
      setError(texts.loadError);
    } finally {
      setLoading(false);
    }
  }, [allowOrdering, idComercio, texts.blockedByPlanBody, texts.blockedByPlanTitle, texts.blockedPendingBody, texts.blockedPendingTitle, texts.loadError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    let active = true;

    async function loadCart() {
      if (!cartKey) {
        if (active) {
          setCartItems([]);
          setCartLoaded(true);
        }
        return;
      }

      try {
        const raw = await authStorage.getItem(cartKey);
        if (!active) return;
        setCartItems(
          parseCartStorage(raw, {
            optionItem: texts.optionItemFallback,
            optionGroup: texts.optionGroupFallback,
          })
        );
      } catch {
        if (active) setCartItems([]);
      } finally {
        if (active) setCartLoaded(true);
      }
    }

    setCartLoaded(false);
    void loadCart();

    return () => {
      active = false;
    };
  }, [cartKey, texts.optionGroupFallback, texts.optionItemFallback]);

  useEffect(() => {
    if (!cartLoaded || !cartKey) return;
    void authStorage.setItem(cartKey, JSON.stringify({ items: cartItems }));
  }, [cartItems, cartKey, cartLoaded]);

  useEffect(() => {
    if (!expandedSectionId) return;
    void ensureMenuTranslation(expandedSectionId);
  }, [ensureMenuTranslation, expandedSectionId, lang]);

  const addLineItem = useCallback((product: MenuProduct, modifiers: CartModifier[] = [], nota = '') => {
    const key = loadLineKey(product.id, modifiers, nota);
    setCartItems((prev) => {
      const next = [...prev];
      const index = next.findIndex((line) => line.key === key);
      if (index >= 0) {
        next[index] = { ...next[index], qty: next[index].qty + 1 };
        return next;
      }
      next.push({
        key,
        idProducto: product.id,
        qty: 1,
        modifiers,
        nota: String(nota || '').trim(),
      });
      return next;
    });

    Alert.alert(
      replaceTemplate(texts.addedItemFmt, {
        name: product.nombre || replaceTemplate(texts.productFallbackFmt, { id: product.id }),
      })
    );
  }, [texts.addedItemFmt, texts.productFallbackFmt]);

  const replaceLineItem = useCallback(
    (oldKey: string, product: MenuProduct, modifiers: CartModifier[], qty: number, nota = '') => {
      const newKey = loadLineKey(product.id, modifiers, nota);
      setCartItems((prev) => {
        const next = [...prev];
        const oldIndex = next.findIndex((line) => line.key === oldKey);
        if (oldIndex < 0) return next;

        const duplicateIndex = next.findIndex((line) => line.key === newKey && line.key !== oldKey);
        if (duplicateIndex >= 0) {
          next[duplicateIndex] = { ...next[duplicateIndex], qty: next[duplicateIndex].qty + qty };
          next.splice(oldIndex, 1);
          return next;
        }

        next[oldIndex] = {
          key: newKey,
          idProducto: product.id,
          qty,
          modifiers,
          nota: String(nota || '').trim(),
        };
        return next;
      });

      Alert.alert(
        replaceTemplate(texts.updatedItemFmt, {
          name: product.nombre || replaceTemplate(texts.productFallbackFmt, { id: product.id }),
        })
      );
    },
    [texts.productFallbackFmt, texts.updatedItemFmt]
  );

  const updateLineQty = useCallback((key: string, delta: number) => {
    setCartItems((prev) => {
      const next = [...prev];
      const index = next.findIndex((line) => line.key === key);
      if (index < 0) return prev;
      const nextQty = Math.max(0, Number(next[index].qty || 0) + delta);
      if (nextQty <= 0) {
        next.splice(index, 1);
        return next;
      }
      next[index] = { ...next[index], qty: nextQty };
      return next;
    });
  }, []);

  const removeLineItem = useCallback(
    (key: string) => {
      const line = cartItems.find((entry) => entry.key === key);
      if (!line) return;
      const productName =
        productsById.get(line.idProducto)?.nombre ||
        replaceTemplate(texts.productFallbackFmt, { id: line.idProducto });

      Alert.alert(
        texts.remove,
        replaceTemplate(texts.deleteConfirmFmt, { name: productName }),
        [
          { text: texts.cancel, style: 'cancel' },
          {
            text: texts.remove,
            style: 'destructive',
            onPress: () => {
              setCartItems((prev) => prev.filter((entry) => entry.key !== key));
            },
          },
        ],
        { cancelable: true }
      );
    },
    [cartItems, productsById, texts.cancel, texts.deleteConfirmFmt, texts.productFallbackFmt, texts.remove]
  );

  const loadGroupsWithItems = useCallback(async (productId: number): Promise<GroupWithItems[]> => {
    let groups = groupsCacheRef.current.get(productId);
    if (!groups) {
      groups = await fetchModifierGroups(productId);
      groupsCacheRef.current.set(productId, groups);
    }

    if (!groups.length) return [];

    const entries = await Promise.all(
      groups.map(async (group) => {
        let items = itemsCacheRef.current.get(group.id);
        if (!items) {
          items = await fetchModifierItems(group.id);
          itemsCacheRef.current.set(group.id, items);
        }
        return {
          group,
          items,
        } satisfies GroupWithItems;
      })
    );

    return entries;
  }, []);

  const openModifiersForProduct = useCallback(
    async (product: MenuProduct, lineToEdit?: CartLineItem) => {
      setModifierLoading(true);
      setModifierProduct(product);
      setModifierOpen(true);
      setEditingLineKey(lineToEdit?.key ?? null);
      setEditingLineQty(Number(lineToEdit?.qty ?? 1));

      try {
        const groupsWithItems = await loadGroupsWithItems(product.id);

        if (!groupsWithItems.length) {
          setModifierOpen(false);
          setModifierLoading(false);
          setModifierProduct(null);
          setEditingLineKey(null);
          if (lineToEdit) {
            replaceLineItem(lineToEdit.key, product, [], lineToEdit.qty, lineToEdit.nota || '');
          } else {
            addLineItem(product, [], '');
          }
          return;
        }

        setModifierGroups(groupsWithItems);
        setModifierNote(String(lineToEdit?.nota || ''));

        const selectedByGroup: Record<number, number[]> = {};
        const preselected = new Set(
          (lineToEdit?.modifiers || [])
            .map((modifier) => Number(modifier.idOpcionItem))
            .filter((id) => Number.isFinite(id))
        );

        groupsWithItems.forEach((entry) => {
          selectedByGroup[entry.group.id] = entry.items
            .filter((item) => preselected.has(item.id))
            .map((item) => item.id);
        });

        setModifierSelected(selectedByGroup);
      } catch (optionsError) {
        console.warn('[mobile-public][menu] Error cargando modificadores:', optionsError);
        setModifierOpen(false);
        if (lineToEdit) {
          replaceLineItem(lineToEdit.key, product, [], lineToEdit.qty, lineToEdit.nota || '');
        } else {
          addLineItem(product, [], '');
        }
        Alert.alert(texts.optionsLoadError);
      } finally {
        setModifierLoading(false);
      }
    },
    [addLineItem, loadGroupsWithItems, replaceLineItem, texts.optionsLoadError]
  );

  const confirmModifiers = useCallback(() => {
    if (!modifierProduct) return;

    const compiled: CartModifier[] = [];

    for (const entry of modifierGroups) {
      const selectedIds = modifierSelected[entry.group.id] || [];
      const minSel = Number(entry.group.min_sel || 0);
      const required = Boolean(entry.group.requerido) || minSel > 0;

      if (required && selectedIds.length < Math.max(minSel, 1)) {
        Alert.alert(
          replaceTemplate(texts.requiredFmt, { min: Math.max(minSel, 1) })
        );
        return;
      }

      selectedIds.forEach((id) => {
        const item = entry.items.find((opt) => opt.id === id);
        if (!item) return;
        compiled.push({
          idOpcionItem: item.id,
          nombre: item.nombre,
          precio_extra: Number(item.precio_extra || 0),
          grupo: entry.group.nombre || texts.optionGroupFallback,
        });
      });
    }

    if (editingLineKey) {
      replaceLineItem(editingLineKey, modifierProduct, compiled, editingLineQty, modifierNote);
    } else {
      addLineItem(modifierProduct, compiled, modifierNote);
    }

    setModifierOpen(false);
    setModifierProduct(null);
    setModifierGroups([]);
    setModifierSelected({});
    setModifierNote('');
    setEditingLineKey(null);
    setEditingLineQty(1);
  }, [
    addLineItem,
    editingLineKey,
    editingLineQty,
    modifierGroups,
    modifierNote,
    modifierProduct,
    modifierSelected,
    replaceLineItem,
    texts.optionGroupFallback,
    texts.requiredFmt,
  ]);

  const toggleModifierSelection = useCallback((entry: GroupWithItems, item: ModifierItem) => {
    const maxRaw = Number(entry.group.max_sel || 0);
    const max = maxRaw > 1 ? maxRaw : 1;
    const isSingle = max <= 1;

    setModifierSelected((prev) => {
      const current = prev[entry.group.id] || [];
      const alreadySelected = current.includes(item.id);

      if (isSingle) {
        return {
          ...prev,
          [entry.group.id]: alreadySelected ? [] : [item.id],
        };
      }

      if (alreadySelected) {
        return {
          ...prev,
          [entry.group.id]: current.filter((id) => id !== item.id),
        };
      }

      if (max > 0 && current.length >= max) {
        Alert.alert(replaceTemplate(texts.maxFmt, { max }));
        return prev;
      }

      return {
        ...prev,
        [entry.group.id]: [...current, item.id],
      };
    });
  }, [texts.maxFmt]);

  const submitOrder = useCallback(async () => {
    if (!planPermiteOrdenes) {
      Alert.alert(texts.onlineOrdersPremiumOnly);
      return;
    }

    if (!cartItems.length || !comercio) return;

    let customer:
      | {
          firstName: string;
          lastName: string;
          name: string;
          email: string;
          phone: string;
          phoneNumber: string;
        }
      | undefined;

    if (allowPickup) {
      const firstName = customerFirstName.trim();
      const lastName = customerLastName.trim();
      const phone = customerPhone.trim();
      const email = customerEmail.trim();

      if (!firstName || !lastName || !phone || !email) {
        Alert.alert(texts.completePickup);
        return;
      }

      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailValid) {
        Alert.alert(texts.invalidEmail);
        return;
      }

      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 7) {
        Alert.alert(texts.invalidPhone);
        return;
      }

      customer = {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        email,
        phone,
        phoneNumber: phone,
      };
    }

    setCheckoutBusy(true);
    try {
      const payload: Record<string, unknown> = {
        idComercio: comercio.id,
        items: cartItems.map((item) => ({
          idProducto: item.idProducto,
          qty: item.qty,
          modifiers: (item.modifiers || []).map((modifier) => ({ idOpcionItem: modifier.idOpcionItem })),
          nota: item.nota || '',
        })),
        mode: orderMode,
        mesa: mesaParam || null,
        source: orderSource,
        idempotencyKey: `order_${comercio.id}_${orderMode}_${mesaParam || 'na'}_${Date.now()}`,
      };

      if (customer) payload.customer = customer;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token || SUPABASE_ANON_KEY;
      const response = await fetch(`${FUNCTIONS_BASE}/clover-create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        if (response.status === 401 && (json as { needs_reconnect?: boolean }).needs_reconnect === true) {
          Alert.alert(texts.cloverReconnect);
          return;
        }

        const errorMessage =
          String((json as { error?: unknown }).error || '').trim() ||
          String((json as { message?: unknown }).message || '').trim() ||
          replaceTemplate(texts.orderCreateErrorFmt, { status: response.status });

        Alert.alert(errorMessage);
        return;
      }

      const orderData = (json as { order?: Record<string, unknown> }).order || {};
      const orderId = Number(orderData.id);
      if (Number.isFinite(orderId)) {
        await rememberOrder(orderId, comercio.id);
      }

      if (orderMode === 'pickup') {
        const checkoutUrl =
          String((json as { checkout_url?: unknown }).checkout_url || '').trim() ||
          String(orderData.checkout_url || '').trim();

        if (!checkoutUrl) {
          Alert.alert(texts.orderLinkError);
          return;
        }

        const openedCheckout = await openExternalUrl(checkoutUrl, { loggerTag: 'mobile-public/menu' });
        if (!openedCheckout) {
          Alert.alert(texts.orderLinkError);
          return;
        }
        return;
      }

      Alert.alert(texts.orderSentMesa);
      setCartItems([]);
      setCartOpen(false);
    } catch (submitError) {
      console.warn('[mobile-public][menu] Error creando orden:', submitError);
      Alert.alert(texts.orderGenericError);
    } finally {
      setCheckoutBusy(false);
    }
  }, [
    allowPickup,
    cartItems,
    comercio,
    customerEmail,
    customerFirstName,
    customerLastName,
    customerPhone,
    mesaParam,
    orderMode,
    orderSource,
    planPermiteOrdenes,
    texts.cloverReconnect,
    texts.completePickup,
    texts.invalidEmail,
    texts.invalidPhone,
    texts.onlineOrdersPremiumOnly,
    texts.orderGenericError,
    texts.orderCreateErrorFmt,
    texts.orderLinkError,
    texts.orderSentMesa,
  ]);

  const renderSectionProducts = useCallback(
    (section: MenuSection) => {
      const sectionProducts = productsByMenu.get(section.id) || [];
      if (!sectionProducts.length) {
        return <Text style={styles.emptyProducts}>{texts.emptyProducts}</Text>;
      }

      const translationMap = getMenuTranslationMap(translationsByMenu[section.id] ?? null);

      return sectionProducts.map((product) => {
        const translated = translationMap.get(product.id);
        const translatedName = !product.no_traducir_nombre && translated?.nombre ? String(translated.nombre).trim() : product.nombre;
        const translatedDescription =
          !product.no_traducir_descripcion && translated?.descripcion != null
            ? String(translated.descripcion ?? '').trim()
            : product.descripcion;

        const imageUrl = getProductoImageUrl(product.imagen) || DEFAULT_PRODUCT_IMAGE;

        return (
          <View
            key={`menu-product-${product.id}`}
            style={[
              styles.productCard,
              shadows.card,
              {
                backgroundColor: itemBgColor,
                alignItems: theme?.productoAlign === 'center' ? 'center' : 'flex-start',
              },
            ]}
          >
            <View style={styles.productRow}>
              <Pressable onPress={() => setImageModalUrl(imageUrl)}>
                <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
              </Pressable>

              <View style={styles.productInfo}>
                <Text
                  style={[
                    styles.productName,
                    {
                      color: theme?.colortitulo || '#111827',
                      fontSize: sectionTitleFontSize,
                      lineHeight: titleFontMetrics.lineHeight,
                      paddingTop: titleFontMetrics.paddingTop,
                      paddingBottom: titleFontMetrics.paddingBottom,
                      fontFamily: menuFonts.title,
                      textAlign: theme?.productoAlign === 'center' ? 'center' : 'left',
                    },
                  ]}
                >
                  {translatedName || replaceTemplate(texts.productFallbackFmt, { id: product.id })}
                </Text>

                {translatedDescription ? (
                  <Text
                  style={[
                    styles.productDescription,
                    {
                      color: theme?.colortexto || '#1f2937',
                      fontSize: bodyFontSize,
                      lineHeight: bodyFontMetrics.lineHeight,
                      paddingTop: bodyFontMetrics.paddingTop,
                      paddingBottom: bodyFontMetrics.paddingBottom,
                      fontFamily: menuFonts.body,
                      textAlign: theme?.productoAlign === 'center' ? 'center' : 'left',
                    },
                  ]}
                >
                    {translatedDescription}
                  </Text>
                ) : null}

                <View style={styles.productFooterRow}>
                  <Text style={[styles.productPrice, { color: theme?.colorprecio || '#2563eb', fontFamily: menuFonts.body }]}>
                    ${Number(product.precio || 0).toFixed(2)}
                  </Text>

                  {allowOrdering && planPermiteOrdenes ? (
                    <Pressable style={styles.addButton} onPress={() => void openModifiersForProduct(product)}>
                      <Text style={styles.addButtonText}>{texts.add}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        );
      });
    },
    [
      allowOrdering,
      bodyFontMetrics.lineHeight,
      bodyFontMetrics.paddingBottom,
      bodyFontMetrics.paddingTop,
      bodyFontSize,
      itemBgColor,
      menuFonts.body,
      menuFonts.title,
      openModifiersForProduct,
      planPermiteOrdenes,
      productsByMenu,
      sectionTitleFontSize,
      texts.add,
      texts.emptyProducts,
      texts.productFallbackFmt,
      theme?.colorprecio,
      theme?.colortexto,
      theme?.colortitulo,
      theme?.productoAlign,
      titleFontMetrics.lineHeight,
      titleFontMetrics.paddingBottom,
      titleFontMetrics.paddingTop,
      translationsByMenu,
    ]
  );

  const socialUrls = useMemo(() => {
    if (!comercio) return { phone: null, facebook: null, instagram: null };

    return {
      phone: comercio.telefono ? formatearTelefonoHref(comercio.telefono) : null,
      facebook: normalizeExternalUrl(comercio.facebook),
      instagram: normalizeExternalUrl(comercio.instagram),
    };
  }, [comercio]);

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.centeredText}>{texts.loading}</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadData()}>
            <Text style={styles.retryButtonText}>{texts.retry}</Text>
          </Pressable>
        </View>
      );
    }

    if (planBlocked) {
      return (
        <View style={styles.centeredState}>
          <Text style={styles.blockedTitle}>{planBlocked.title}</Text>
          <Text style={styles.blockedBody}>{planBlocked.body}</Text>
          <Pressable style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>{texts.backToCommerce}</Text>
          </Pressable>
        </View>
      );
    }

    const heroSource = coverUrl || backgroundUrl || null;

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroContainer}>
          {heroSource ? (
            <Image source={{ uri: heroSource }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: theme?.backgroundcolor || '#ffffff' }]} />
          )}
          <View style={styles.heroOverlay} />

          <Pressable style={[styles.heroTopIcon, styles.backIconWrap]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </Pressable>
        </View>

        <View style={styles.headerTextBlock}>
          {!theme?.ocultar_nombre ? (
            <Text
              style={[
                styles.comercioName,
                {
                  color: theme?.colorComercio || theme?.colortitulo || '#111827',
                  fontSize: nombreFontSize,
                  lineHeight: nombreFontMetrics.lineHeight,
                  paddingTop: nombreFontMetrics.paddingTop,
                  paddingBottom: nombreFontMetrics.paddingBottom,
                  fontFamily: menuFonts.nombre,
                },
              ]}
            >
              {comercio?.nombre || ''}
            </Text>
          ) : null}

          {!theme?.ocultar_menu ? (
            <Text
              style={[
                styles.menuWord,
                {
                  color: theme?.colorMenu || theme?.colortitulo || '#111827',
                  fontSize: menuWordFontSize,
                  lineHeight: menuWordFontMetrics.lineHeight,
                  paddingTop: menuWordFontMetrics.paddingTop,
                  paddingBottom: menuWordFontMetrics.paddingBottom,
                  fontFamily: menuFonts.menuWord,
                },
              ]}
            >
              {menuWord}
            </Text>
          ) : null}

          <View style={styles.headerLangRow}>
            <Pressable style={styles.langToggleInline} onPress={() => setLangModalOpen(true)}>
              <Text style={styles.langToggleInlineText}>🌐 {currentLanguage.flag} ▾</Text>
            </Pressable>
          </View>

          {theme?.pdfurl ? (
            <Pressable
              style={[
                styles.pdfButton,
                {
                  backgroundColor: theme.colorBotonPDF
                    ? rgbaFromHexOrRgb(theme.colorBotonPDF, 0.85)
                    : 'rgba(37, 99, 235, 0.85)',
                },
              ]}
              onPress={() => {
                if (!theme.pdfurl) return;
                void openExternalUrl(theme.pdfurl, { loggerTag: 'mobile-public/menu' });
              }}
            >
              <FontAwesome6 name="file-pdf" size={14} color="#fff" iconStyle="solid" />
              <Text style={styles.pdfButtonText}>{texts.menuPdf}</Text>
            </Pressable>
          ) : null}
        </View>

        {allowOrdering && planPermiteOrdenes ? (
          <Pressable
            style={[
              styles.cartInlineBar,
              {
                opacity: cartTotals.count > 0 ? 1 : 0.75,
              },
            ]}
            onPress={() => setCartOpen(true)}
          >
            <View style={styles.cartBarLeft}>
              <View style={styles.cartBarIconBubble}>
                <FontAwesome6 name="basket-shopping" size={15} color="#fff" iconStyle="solid" />
              </View>
              <Text style={styles.cartBarText}>{texts.viewOrder}</Text>
            </View>

            <Text style={styles.cartBarCount}>{cartTotals.count}</Text>
          </Pressable>
        ) : null}

        <View style={styles.sectionsWrap}>
          {sections.map((section) => {
            const translated = translationsByMenu[section.id]?.menu;
            const title = translated?.titulo?.trim() || section.titulo || texts.loadingSectionTitle;
            const description = translated?.descripcion?.trim() || section.descripcion || '';
            const isOpen = expandedSectionId === section.id;

            return (
              <View key={`menu-section-${section.id}`} style={styles.sectionBlock}>
                <Pressable
                  style={[
                    styles.sectionHeader,
                    isOpen ? styles.sectionHeaderOpen : null,
                    {
                      backgroundColor: theme?.colorboton || '#2563eb',
                    },
                  ]}
                  onPress={() => {
                    if (isOpen) {
                      setExpandedSectionId(null);
                      return;
                    }
                    setExpandedSectionId(section.id);
                    void ensureMenuTranslation(section.id);
                  }}
                >
                  <Text
                    style={[
                      styles.sectionTitle,
                      {
                        color: theme?.colorbotontexto || '#ffffff',
                        fontSize: sectionTitleFontSize,
                        lineHeight: titleFontMetrics.lineHeight,
                        paddingTop: titleFontMetrics.paddingTop,
                        paddingBottom: titleFontMetrics.paddingBottom,
                        fontFamily: menuFonts.title,
                      },
                    ]}
                  >
                    {title}
                  </Text>
                  {isOpen && description ? (
                    <Text
                      style={[
                        styles.sectionDescription,
                        {
                          color: theme?.seccion_desc_color || theme?.colorbotontexto || '#ffffff',
                          fontSize: sectionDescFontSize,
                          lineHeight: sectionDescFontMetrics.lineHeight,
                          paddingTop: sectionDescFontMetrics.paddingTop,
                          paddingBottom: sectionDescFontMetrics.paddingBottom,
                          fontFamily: menuFonts.sectionDesc,
                        },
                      ]}
                    >
                      {description}
                    </Text>
                  ) : null}
                </Pressable>

                {isOpen ? (
                  <View style={styles.productsWrap}>
                    {sectionLoadingId === section.id && !translationsByMenu[section.id] ? (
                      <Text style={styles.sectionLoadingText}>{texts.sectionLoading}</Text>
                    ) : (
                      renderSectionProducts(section)
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ImageBackground
        source={backgroundUrl ? { uri: backgroundUrl } : undefined}
        style={[styles.container, { backgroundColor: theme?.backgroundcolor || '#ffffff' }]}
        resizeMode="cover"
      >
        {renderBody()}
        {comercio ? (
          <View style={[styles.fixedFooterShell, { paddingBottom: Math.max(insets.bottom, 4) }]}>
            <View style={styles.footerWrap}>
              <View style={styles.footerTop}>
                <View style={styles.footerBusinessRow}>
                  <Pressable
                    onPress={() => {
                      if (!comercio?.id) return;
                      router.push({ pathname: '/comercio/[id]', params: { id: String(comercio.id) } });
                    }}
                    style={styles.footerBusinessIdentity}
                  >
                    <View style={styles.footerLogoCircle}>
                      <Image
                        source={{ uri: toMenuStorageUrl(comercio?.logo || null) || DEFAULT_LOGO }}
                        style={styles.footerLogo}
                        resizeMode="cover"
                      />
                    </View>
                    <Text numberOfLines={1} style={styles.footerBusinessName}>
                      {comercio?.nombre || ''}
                    </Text>
                  </Pressable>

                  <View style={styles.footerActionsRow}>
                    {socialUrls.phone ? (
                      <Pressable
                        style={styles.footerActionBtn}
                        onPress={() => void openExternalUrl(socialUrls.phone as string, { loggerTag: 'mobile-public/menu' })}
                      >
                        <FontAwesome6 name="phone" size={13} color="#fff" iconStyle="solid" />
                      </Pressable>
                    ) : null}
                    {socialUrls.facebook ? (
                      <Pressable
                        style={styles.footerActionBtn}
                        onPress={() => void openExternalUrl(socialUrls.facebook as string, { loggerTag: 'mobile-public/menu' })}
                      >
                        <FontAwesome6 name="facebook-f" size={13} color="#fff" iconStyle="brands" />
                      </Pressable>
                    ) : null}
                    {socialUrls.instagram ? (
                      <Pressable
                        style={styles.footerActionBtn}
                        onPress={() => void openExternalUrl(socialUrls.instagram as string, { loggerTag: 'mobile-public/menu' })}
                      >
                        <FontAwesome6 name="instagram" size={13} color="#fff" iconStyle="brands" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={styles.footerBottom}>
                <Image source={{ uri: LOGO_FINDIXI }} style={styles.footerFindixiLogo} resizeMode="contain" />
                <Text style={styles.footerCopyright}>{texts.footerDesignBy}</Text>
                <Text style={styles.footerCopyright}>{texts.footerCopyright}</Text>

                <View style={styles.footerLinksRow}>
                  <Pressable onPress={() => router.push('/privacy-policy')}>
                    <Text style={styles.footerLinkText}>{t('login.privacyPolicy')}</Text>
                  </Pressable>
                  <Text style={styles.footerLinkDot}>•</Text>
                  <Pressable onPress={() => router.push('/terms-of-service')}>
                    <Text style={styles.footerLinkText}>{t('login.termsOfService')}</Text>
                  </Pressable>
                  <Text style={styles.footerLinkDot}>•</Text>
                  <Pressable onPress={() => void openExternalUrl('mailto:info@findixi.com', { loggerTag: 'mobile-public/menu' })}>
                    <Text style={styles.footerLinkText}>info@findixi.com</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        <Modal visible={Boolean(imageModalUrl)} transparent animationType="fade" onRequestClose={() => setImageModalUrl(null)}>
          <Pressable style={styles.imageModalBackdrop} onPress={() => setImageModalUrl(null)}>
            <Image source={{ uri: imageModalUrl || DEFAULT_PRODUCT_IMAGE }} style={styles.imageModalImage} resizeMode="contain" />
          </Pressable>
        </Modal>

        <Modal visible={langModalOpen} transparent animationType="fade" onRequestClose={() => setLangModalOpen(false)}>
          <Pressable style={styles.langBackdrop} onPress={() => setLangModalOpen(false)}>
            <View style={styles.langCard}>
              {languages.map((language) => (
                <Pressable
                  key={`menu-lang-${language.code}`}
                  style={styles.langItem}
                  onPress={() => {
                    void setLang(language.code);
                    setLangModalOpen(false);
                  }}
                >
                  <Text style={styles.langItemFlag}>{language.flag}</Text>
                  <Text style={styles.langItemText}>{language.native}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        <Modal visible={cartOpen} transparent animationType="slide" onRequestClose={() => setCartOpen(false)}>
          <Pressable style={styles.overlayBackdrop} onPress={() => setCartOpen(false)}>
            <Pressable style={styles.drawerSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>{texts.cartTitle}</Text>
                <Pressable onPress={() => setCartOpen(false)}>
                  <Text style={styles.drawerClose}>{texts.close}</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.drawerScroll}>
                {cartItems.length === 0 ? <Text style={styles.emptyCartText}>{texts.emptyCart}</Text> : null}

                {cartItems.map((line) => {
                  const product = productsById.get(line.idProducto);
                  const img = getProductoImageUrl(product?.imagen || null);
                  const lineSubtotal =
                    (Number(product?.precio || 0) +
                      (line.modifiers || []).reduce((sum, modifier) => sum + Number(modifier.precio_extra || 0), 0)) *
                    Number(line.qty || 0);

                  return (
                    <View key={`cart-line-${line.key}`} style={styles.cartLineCard}>
                      <View style={styles.cartLineTop}>
                        {img ? <Image source={{ uri: img }} style={styles.cartLineImage} resizeMode="cover" /> : null}
                        <View style={styles.cartLineInfo}>
                          <Text style={styles.cartLineName}>
                            {product?.nombre || replaceTemplate(texts.productFallbackFmt, { id: line.idProducto })}
                          </Text>

                          {(line.modifiers || []).length > 0 ? (
                            <View style={styles.modifiersWrap}>
                              {line.modifiers.map((modifier, index) => (
                                <Text key={`line-mod-${line.key}-${index}`} style={styles.modifierText}>
                                  • {modifier.grupo}: {modifier.nombre}
                                  {Number(modifier.precio_extra || 0) ? ` +$${Number(modifier.precio_extra).toFixed(2)}` : ''}
                                </Text>
                              ))}
                            </View>
                          ) : null}

                          {line.nota ? <Text style={styles.noteText}>{texts.noteLabel}: {line.nota}</Text> : null}
                          <Text style={styles.lineTotalText}>${lineSubtotal.toFixed(2)}</Text>
                        </View>
                      </View>

                      <View style={styles.cartLineActions}>
                        <View style={styles.qtyWrap}>
                          <Pressable style={styles.qtyBtn} onPress={() => updateLineQty(line.key, -1)}>
                            <Text style={styles.qtyBtnText}>-</Text>
                          </Pressable>
                          <Text style={styles.qtyValue}>{line.qty}</Text>
                          <Pressable style={styles.qtyBtn} onPress={() => updateLineQty(line.key, 1)}>
                            <Text style={styles.qtyBtnText}>+</Text>
                          </Pressable>
                        </View>

                        <View style={styles.lineLinksWrap}>
                          <Pressable onPress={() => {
                            const productToEdit = productsById.get(line.idProducto);
                            if (!productToEdit) return;
                            void openModifiersForProduct(productToEdit, line);
                            setCartOpen(false);
                          }}>
                            <Text style={styles.lineLink}>{texts.edit}</Text>
                          </Pressable>
                          <Pressable onPress={() => removeLineItem(line.key)}>
                            <Text style={[styles.lineLink, styles.removeLink]}>{texts.remove}</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {allowPickup ? (
                  <View style={styles.customerFieldsWrap}>
                    <Text style={styles.customerFieldsTitle}>{texts.customerFieldsTitle}</Text>

                    <View style={styles.customerGridRow}>
                      <View style={styles.customerFieldCol}>
                        <Text style={styles.customerLabel}>{texts.firstName}</Text>
                        <TextInput
                          value={customerFirstName}
                          onChangeText={setCustomerFirstName}
                          style={styles.customerInput}
                          autoCapitalize="words"
                          placeholder={texts.firstName}
                          placeholderTextColor="#9ca3af"
                        />
                      </View>

                      <View style={styles.customerFieldCol}>
                        <Text style={styles.customerLabel}>{texts.lastName}</Text>
                        <TextInput
                          value={customerLastName}
                          onChangeText={setCustomerLastName}
                          style={styles.customerInput}
                          autoCapitalize="words"
                          placeholder={texts.lastName}
                          placeholderTextColor="#9ca3af"
                        />
                      </View>
                    </View>

                    <View style={styles.customerFieldCol}>
                      <Text style={styles.customerLabel}>{texts.phone}</Text>
                      <TextInput
                        value={customerPhone}
                        onChangeText={setCustomerPhone}
                        style={styles.customerInput}
                        keyboardType="phone-pad"
                        placeholder={texts.phonePlaceholder}
                        placeholderTextColor="#9ca3af"
                      />
                      <Text style={styles.customerHint}>{texts.notePhone}</Text>
                    </View>

                    <View style={styles.customerFieldCol}>
                      <Text style={styles.customerLabel}>{texts.email}</Text>
                      <TextInput
                        value={customerEmail}
                        onChangeText={setCustomerEmail}
                        style={styles.customerInput}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholder={texts.emailPlaceholder}
                        placeholderTextColor="#9ca3af"
                      />
                      <Text style={styles.customerHint}>{texts.noteEmail}</Text>
                    </View>
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.totalsWrap}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{texts.subtotal}</Text>
                  <Text style={styles.totalValue}>${cartTotals.subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{texts.tax}</Text>
                  <Text style={styles.totalValue}>${cartTotals.tax.toFixed(2)}</Text>
                </View>
                <View style={[styles.totalRow, styles.totalRowFinal]}>
                  <Text style={styles.totalLabelFinal}>{texts.total}</Text>
                  <Text style={styles.totalValueFinal}>${cartTotals.total.toFixed(2)}</Text>
                </View>
              </View>

              <Pressable
                style={[styles.checkoutBtn, (checkoutBusy || cartItems.length === 0) ? styles.checkoutBtnDisabled : null]}
                disabled={checkoutBusy || cartItems.length === 0}
                onPress={() => void submitOrder()}
              >
                {checkoutBusy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.checkoutBtnText}>{allowMesa ? texts.checkoutMesa : texts.checkoutPickup}</Text>
                )}
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={modifierOpen} transparent animationType="slide" onRequestClose={() => setModifierOpen(false)}>
          <Pressable style={styles.overlayBackdrop} onPress={() => setModifierOpen(false)}>
            <Pressable style={styles.drawerSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>{texts.customizeOrder}</Text>
                <Pressable
                  onPress={() => {
                    setModifierOpen(false);
                    setModifierProduct(null);
                  }}
                >
                  <Text style={styles.drawerClose}>{texts.cancel}</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.drawerScroll}>
                {modifierProduct?.imagen ? (
                  <Image
                    source={{ uri: getProductoImageUrl(modifierProduct.imagen) || DEFAULT_PRODUCT_IMAGE }}
                    style={styles.modProductImage}
                    resizeMode="cover"
                  />
                ) : null}
                <Text style={styles.modProductTitle}>{modifierProduct?.nombre || ''}</Text>

                {modifierLoading ? (
                  <View style={styles.modLoadingWrap}>
                    <ActivityIndicator size="small" color="#111827" />
                    <Text style={styles.modLoadingText}>{texts.sectionLoading}</Text>
                  </View>
                ) : null}

                {!modifierLoading
                  ? modifierGroups.map((entry) => {
                      const selected = modifierSelected[entry.group.id] || [];
                      const minSel = Number(entry.group.min_sel || 0);
                      const maxSel = Number(entry.group.max_sel || 0);
                      const required = Boolean(entry.group.requerido) || minSel > 0;

                      return (
                        <View key={`mod-group-${entry.group.id}`} style={styles.modGroupCard}>
                          <View style={styles.modGroupHeader}>
                            <Text style={styles.modGroupName}>{entry.group.nombre || texts.optionGroupFallback}</Text>
                            <Text style={styles.modGroupMeta}>
                              {required ? replaceTemplate(texts.requiredFmt, { min: Math.max(minSel, 1) }) : texts.optionalLabel}
                              {maxSel > 1 ? ` · ${replaceTemplate(texts.maxFmt, { max: maxSel })}` : ''}
                            </Text>
                          </View>

                          {!entry.items.length ? <Text style={styles.modNoOptions}>{texts.noOptions}</Text> : null}

                          {entry.items.map((item) => {
                            const checked = selected.includes(item.id);
                            return (
                              <Pressable
                                key={`mod-item-${entry.group.id}-${item.id}`}
                                style={styles.modOptionRow}
                                onPress={() => toggleModifierSelection(entry, item)}
                              >
                                <View style={styles.modOptionLeft}>
                                  <View style={[styles.modCheckbox, checked ? styles.modCheckboxOn : null]}>
                                    {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                                  </View>
                                  <Text style={styles.modOptionName}>{item.nombre}</Text>
                                </View>
                                <Text style={styles.modOptionPrice}>
                                  {Number(item.precio_extra || 0) ? `+ $${Number(item.precio_extra).toFixed(2)}` : ''}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      );
                    })
                  : null}

                {!modifierLoading ? (
                  <View style={styles.noteFieldWrap}>
                    <Text style={styles.noteFieldLabel}>
                      Nota ({texts.optional})
                    </Text>
                    <TextInput
                      value={modifierNote}
                      onChangeText={setModifierNote}
                      style={styles.noteInput}
                      multiline
                      numberOfLines={3}
                      placeholder={texts.notePlaceholder}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                ) : null}
              </ScrollView>

              <Pressable style={styles.checkoutBtn} onPress={confirmModifiers}>
                <Text style={styles.checkoutBtnText}>{editingLineKey ? texts.saveChanges : texts.addToCart}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 232,
  },
  centeredState: {
    flex: 1,
    minHeight: 320,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  centeredText: {
    color: '#374151',
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 16,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  blockedTitle: {
    color: '#111827',
    fontSize: 20,
    fontFamily: fonts.semibold,
    textAlign: 'center',
  },
  blockedBody: {
    color: '#4b5563',
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  heroContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  heroTopIcon: {
    position: 'absolute',
    top: spacing.md,
    zIndex: 3,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  backIconWrap: {
    left: spacing.md,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextBlock: {
    alignItems: 'stretch',
    paddingHorizontal: spacing.md,
    paddingTop: 16,
    paddingBottom: 16,
    gap: spacing.xs,
  },
  comercioName: {
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  menuWord: {
    fontFamily: fonts.semibold,
    textAlign: 'center',
  },
  headerLangRow: {
    alignItems: 'flex-end',
    width: '100%',
    marginTop: 0,
  },
  langToggleInline: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  langToggleInlineText: {
    color: '#111827',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  pdfButton: {
    marginTop: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'center',
    ...shadows.card,
  },
  pdfButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  sectionsWrap: {
    paddingHorizontal: 0,
    gap: spacing.sm,
    marginTop: 0,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionBlock: {
    width: '90%',
    alignSelf: 'center',
  },
  sectionHeader: {
    width: '100%',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadows.card,
  },
  sectionHeaderOpen: {
    paddingVertical: 22,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  sectionDescription: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: fonts.regular,
    opacity: 0.95,
    textAlign: 'center',
  },
  productsWrap: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  sectionLoadingText: {
    color: '#6b7280',
    fontSize: 13,
    fontFamily: fonts.regular,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  productCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  productRow: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.md,
  },
  productImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  productName: {
    fontFamily: fonts.semibold,
  },
  productDescription: {
    fontFamily: fonts.light,
    lineHeight: 20,
  },
  productFooterRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 22,
    fontFamily: fonts.bold,
  },
  addButton: {
    backgroundColor: '#111827',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  emptyProducts: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: fonts.regular,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  footerWrap: {
    marginTop: 0,
    backgroundColor: '#231F20',
  },
  footerTop: {
    backgroundColor: '#4a4a4a',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  footerBusinessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  footerBusinessIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  footerLogoCircle: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.pill,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  footerLogo: {
    width: '100%',
    height: '100%',
  },
  footerBusinessName: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontFamily: fonts.medium,
  },
  footerActionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  footerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.pill,
    backgroundColor: '#3a3a3a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBottom: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  footerFindixiLogo: {
    width: 96,
    height: 28,
  },
  footerCopyright: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontFamily: fonts.light,
    textAlign: 'center',
  },
  footerLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: 6,
  },
  footerLinkText: {
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'underline',
    fontSize: 11,
    fontFamily: fonts.light,
  },
  footerLinkDot: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  fixedFooterShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
  },
  cartInlineBar: {
    width: '90%',
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 10,
    height: 54,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card,
  },
  cartBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cartBarIconBubble: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.pill,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBarText: {
    color: '#111827',
    fontSize: 15,
    fontFamily: fonts.semibold,
  },
  cartBarCount: {
    color: '#fff',
    backgroundColor: '#111827',
    borderRadius: borderRadius.pill,
    minWidth: 30,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  imageModalImage: {
    width: '100%',
    height: '80%',
  },
  langBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  langCard: {
    position: 'absolute',
    top: 96,
    right: spacing.md,
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 130,
    overflow: 'hidden',
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  langItemFlag: {
    fontSize: 18,
  },
  langItemText: {
    color: '#111827',
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  drawerSheet: {
    maxHeight: '84%',
    backgroundColor: '#fff',
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  drawerTitle: {
    color: '#111827',
    fontSize: 20,
    fontFamily: fonts.semibold,
  },
  drawerClose: {
    color: '#6b7280',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  drawerScroll: {
    maxHeight: '74%',
  },
  emptyCartText: {
    color: '#6b7280',
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  cartLineCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  cartLineTop: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cartLineImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  cartLineInfo: {
    flex: 1,
    gap: 4,
  },
  cartLineName: {
    color: '#111827',
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  modifiersWrap: {
    gap: 2,
  },
  modifierText: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: fonts.regular,
    lineHeight: 15,
  },
  noteText: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  lineTotalText: {
    color: '#111827',
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  cartLineActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    color: '#111827',
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  qtyValue: {
    color: '#111827',
    minWidth: 20,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  lineLinksWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  lineLink: {
    color: '#2563eb',
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  removeLink: {
    color: '#dc2626',
  },
  customerFieldsWrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  customerFieldsTitle: {
    color: '#111827',
    fontSize: 13,
    fontFamily: fonts.semibold,
  },
  customerGridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  customerFieldCol: {
    flex: 1,
    gap: 4,
  },
  customerLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  customerInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: '#111827',
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  customerHint: {
    color: '#9ca3af',
    fontSize: 11,
    fontFamily: fonts.light,
  },
  totalsWrap: {
    marginTop: spacing.md,
    gap: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#374151',
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  totalValue: {
    color: '#111827',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  totalRowFinal: {
    marginTop: 2,
  },
  totalLabelFinal: {
    color: '#111827',
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  totalValueFinal: {
    color: '#111827',
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  checkoutBtn: {
    marginTop: spacing.md,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: fonts.semibold,
  },
  modProductImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: spacing.sm,
    backgroundColor: '#e5e7eb',
  },
  modProductTitle: {
    color: '#111827',
    fontSize: 18,
    fontFamily: fonts.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  modLoadingText: {
    color: '#374151',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  modGroupCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  modGroupHeader: {
    gap: 2,
  },
  modGroupName: {
    color: '#111827',
    fontSize: 14,
    fontFamily: fonts.semibold,
  },
  modGroupMeta: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  modNoOptions: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  modOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  modOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  modCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modCheckboxOn: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  modOptionName: {
    color: '#111827',
    fontSize: 14,
    fontFamily: fonts.regular,
    flexShrink: 1,
  },
  modOptionPrice: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: fonts.regular,
    marginLeft: spacing.sm,
  },
  noteFieldWrap: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  noteFieldLabel: {
    color: '#374151',
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: borderRadius.sm,
    minHeight: 84,
    textAlignVertical: 'top',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: '#111827',
    fontSize: 14,
    fontFamily: fonts.regular,
  },
});
