import { resolverPlanComercio } from '@findixi/shared';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/env';
import { supabase } from './supabase';

export type MenuProduct = {
  id: number;
  idMenu: number;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string;
  orden: number;
  activo: boolean;
  noTraducirNombre: boolean;
};

export type MenuSection = {
  id: number;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  orden: number;
  activo: boolean;
  noTraducir: boolean;
  productos: MenuProduct[];
};

export type MenuSectionDraft = {
  titulo: string;
  subtitulo: string;
  descripcion: string;
  orden: number;
  activo: boolean;
  noTraducir: boolean;
};

export type MenuProductDraft = {
  nombre: string;
  descripcion: string;
  precio: number;
  orden: number;
  activo: boolean;
  noTraducirNombre: boolean;
};

export type MenuTheme = {
  colortexto: string;
  colortitulo: string;
  colorprecio: string;
  colorboton: string;
  colorbotontexto: string;
  colorComercio: string;
  colorMenu: string;
  overlayoscuro: number;
  pdfurl: string;
  colorBotonPDF: string;
  backgroundcolor: string;
  textomenu: string;
  ocultar_nombre: boolean;
  ocultar_menu: boolean;
  item_bg_color: string;
  item_overlay: number;
  productoAlign: 'left' | 'center';
  portadaimagen: string;
  backgroundimagen: string;
  fontbodyfamily: string | null;
  fontbodyurl: string | null;
  fontbody_size: number;
  fonttitlefamily: string | null;
  fonttitleurl: string | null;
  fonttitle_size: number;
  fontnombrefamily: string | null;
  fontnombreurl: string | null;
  nombre_font_size: number;
  fontmenuwordfamily: string | null;
  fontmenuwordurl: string | null;
  menu_font_size: number;
  nombre_shadow: string;
  nombre_stroke_width: number;
  nombre_stroke_color: string;
  menu_shadow: string;
  menu_stroke_width: number;
  menu_stroke_color: string;
  seccion_desc_font_family: string | null;
  seccion_desc_font_url: string | null;
  seccion_desc_font_size: number;
  seccion_desc_color: string;
};

export type MenuAdminContext = {
  idComercio: number;
  nombreComercio: string;
  planNombre: string;
  planNivel: number;
  planPermiteMenu: boolean;
  planPermiteOrdenes: boolean;
  comercioVerificado: boolean;
  logoUrl: string;
  cloverConnected: boolean;
  sections: MenuSection[];
  menuTheme: MenuTheme;
};

export type CloverImportResult = {
  menus: number;
  productos: number;
  opciones: number;
};

export type MenuThemeImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
const STORAGE_PUBLIC_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/';
const MENU_THEME_BUCKET = 'galeriacomercios';
const MENU_THEME_DEFAULT: MenuTheme = {
  colortexto: '#1f2937',
  colortitulo: '#111827',
  colorprecio: '#2563eb',
  colorboton: '#2563eb',
  colorbotontexto: '#ffffff',
  colorComercio: '#111827',
  colorMenu: '#111827',
  overlayoscuro: 40,
  pdfurl: '',
  colorBotonPDF: 'rgba(37, 99, 235, 0.8)',
  backgroundcolor: '#ffffff',
  textomenu: 'Menu',
  ocultar_nombre: false,
  ocultar_menu: false,
  item_bg_color: '#ffffff',
  item_overlay: 0,
  productoAlign: 'left',
  portadaimagen: '',
  backgroundimagen: '',
  fontbodyfamily: null,
  fontbodyurl: null,
  fontbody_size: 16,
  fonttitlefamily: null,
  fonttitleurl: null,
  fonttitle_size: 18,
  fontnombrefamily: null,
  fontnombreurl: null,
  nombre_font_size: 28,
  fontmenuwordfamily: null,
  fontmenuwordurl: null,
  menu_font_size: 20,
  nombre_shadow: '',
  nombre_stroke_width: 0,
  nombre_stroke_color: '#000000',
  menu_shadow: '',
  menu_stroke_width: 0,
  menu_stroke_color: '#000000',
  seccion_desc_font_family: null,
  seccion_desc_font_url: null,
  seccion_desc_font_size: 14,
  seccion_desc_color: '#ffffff',
};

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'si'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeComparableText(value: unknown): string {
  return String(value ?? '').trim();
}

function isMissingResourceError(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  const message = String((error as { message?: unknown } | null)?.message ?? '').toLowerCase();
  return code === '42P01' || code === '42703' || message.includes('does not exist') || message.includes('relation');
}

function isOnConflictTargetError(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  const message = String((error as { message?: unknown } | null)?.message ?? '').toLowerCase();
  return code === '42P10' || message.includes('no unique or exclusion constraint') || message.includes('on conflict');
}

function formatSupabaseError(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  const source = (error || {}) as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
  const message = toText(source.message) || fallback;
  const code = toText(source.code);
  const details = toText(source.details);
  const hint = toText(source.hint);
  return [message, code ? `(code: ${code})` : '', details, hint ? `Hint: ${hint}` : ''].filter(Boolean).join(' ');
}

function getPublicImageUrl(pathOrUrl: string): string {
  const raw = toText(pathOrUrl);
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${STORAGE_PUBLIC_BASE}${raw}`;
}

function comercioVerificado(comercio: Record<string, unknown>): boolean {
  const estadoPropiedad = toText(comercio.estado_propiedad).toLowerCase();
  const estadoVerificacion = toText(comercio.estado_verificacion).toLowerCase();
  const propietarioVerificado = comercio.propietario_verificado === true;
  const verificacionOk = ['otp_verificado', 'sms_verificado', 'messenger_verificado', 'manual_aprobado'].includes(
    estadoVerificacion
  );
  return estadoPropiedad === 'verificado' && (propietarioVerificado || verificacionOk);
}

async function invokeTranslateMenuInvalidate(payload: Record<string, unknown>): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = toText(session?.access_token) || SUPABASE_ANON_KEY;

  const response = await fetch(`${FUNCTIONS_BASE}/translate-menu`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      type: 'invalidate',
      ...payload,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || (body as { ok?: boolean } | null)?.ok === false) {
    throw new Error((body as { error?: string } | null)?.error || `HTTP ${response.status}`);
  }
}

async function invalidateMenuTranslationCells(
  idMenu: number,
  { titleChanged = false, descriptionChanged = false }: { titleChanged?: boolean; descriptionChanged?: boolean } = {}
): Promise<void> {
  if (!Number.isFinite(idMenu) || idMenu <= 0) return;
  if (!titleChanged && !descriptionChanged) return;

  const fields: string[] = [];
  if (titleChanged) fields.push('titulo');
  if (descriptionChanged) fields.push('descripcion');

  try {
    await invokeTranslateMenuInvalidate({
      entity: 'menu',
      idMenu,
      mode: 'nullify',
      fields,
    });
  } catch (invokeError) {
    const patch: Record<string, null> = {};
    if (titleChanged) patch.titulo = null;
    if (descriptionChanged) patch.descripcion = null;
    const { error } = await supabase.from('menus_traducciones').update(patch).eq('idmenu', idMenu);
    if (error) {
      console.warn('[mobile-business][menu-admin] No se pudo invalidar traducción de sección:', {
        idMenu,
        invokeError,
        error,
      });
    }
  }
}

async function invalidateProductTranslationCells(
  idProducto: number,
  {
    nameChanged = false,
    descriptionChanged = false,
    mode = 'nullify',
  }: { nameChanged?: boolean; descriptionChanged?: boolean; mode?: 'nullify' | 'delete' } = {}
): Promise<void> {
  if (!Number.isFinite(idProducto) || idProducto <= 0) return;
  if (mode !== 'delete' && !nameChanged && !descriptionChanged) return;

  const fields: string[] = [];
  if (nameChanged) fields.push('nombre');
  if (descriptionChanged) fields.push('descripcion');

  try {
    await invokeTranslateMenuInvalidate({
      entity: 'producto',
      idProducto,
      mode,
      fields,
    });
  } catch (invokeError) {
    if (mode === 'delete') {
      const { error } = await supabase.from('productos_traducciones').delete().eq('idproducto', idProducto);
      if (error) {
        console.warn('[mobile-business][menu-admin] No se pudo eliminar traducciones de producto:', {
          idProducto,
          invokeError,
          error,
        });
      }
      return;
    }

    const patch: Record<string, null> = {};
    if (nameChanged) patch.nombre = null;
    if (descriptionChanged) patch.descripcion = null;

    const { error } = await supabase.from('productos_traducciones').update(patch).eq('idproducto', idProducto);
    if (error) {
      console.warn('[mobile-business][menu-admin] No se pudo invalidar traducciones de producto:', {
        idProducto,
        invokeError,
        error,
      });
    }
  }
}

async function fetchCommerceBasics(idComercio: number): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('Comercios')
    .select(
      'id,nombre,plan_id,plan_nivel,plan_nombre,permite_menu,permite_ordenes,estado_propiedad,estado_verificacion,propietario_verificado'
    )
    .eq('id', idComercio)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Comercio no encontrado.');
  return data as Record<string, unknown>;
}

async function fetchCommerceLogo(idComercio: number): Promise<string> {
  const { data, error } = await supabase
    .from('imagenesComercios')
    .select('imagen')
    .eq('idComercio', idComercio)
    .eq('logo', true)
    .maybeSingle();

  if (error) {
    if (isMissingResourceError(error)) return '';
    throw error;
  }

  return getPublicImageUrl(toText((data as Record<string, unknown> | null)?.imagen));
}

async function fetchMenuRows(idComercio: number): Promise<Array<Record<string, unknown>>> {
  const fullSelect = 'id, titulo, descripcion, subtitulo, orden, activo, idComercio, no_traducir';
  const fallbackSelect = 'id, titulo, descripcion, subtitulo, orden, activo, idComercio';

  const full = await supabase.from('menus').select(fullSelect).eq('idComercio', idComercio).order('orden', { ascending: true });
  if (!full.error) {
    return (Array.isArray(full.data) ? full.data : []) as Array<Record<string, unknown>>;
  }

  if (!isMissingResourceError(full.error)) throw full.error;

  const fallback = await supabase
    .from('menus')
    .select(fallbackSelect)
    .eq('idComercio', idComercio)
    .order('orden', { ascending: true });

  if (fallback.error) throw fallback.error;
  return (Array.isArray(fallback.data) ? fallback.data : []) as Array<Record<string, unknown>>;
}

async function fetchProductRows(menuIds: number[]): Promise<Array<Record<string, unknown>>> {
  if (!menuIds.length) return [];

  const fullSelect = 'id, nombre, descripcion, precio, imagen, orden, activo, no_traducir_nombre, idMenu';
  const fallbackSelect = 'id, nombre, descripcion, precio, imagen, orden, activo, idMenu';

  const full = await supabase.from('productos').select(fullSelect).in('idMenu', menuIds).order('orden', { ascending: true });
  if (!full.error) {
    return (Array.isArray(full.data) ? full.data : []) as Array<Record<string, unknown>>;
  }

  if (!isMissingResourceError(full.error)) throw full.error;

  const fallback = await supabase
    .from('productos')
    .select(fallbackSelect)
    .in('idMenu', menuIds)
    .order('orden', { ascending: true });

  if (fallback.error) throw fallback.error;
  return (Array.isArray(fallback.data) ? fallback.data : []) as Array<Record<string, unknown>>;
}

async function fetchCloverConnection(idComercio: number): Promise<{ connected: boolean }> {
  const attempts = [
    { table: 'clover_conexiones', idColumn: 'idComercio' },
    { table: 'clover_conexiones', idColumn: 'idcomercio' },
  ];

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from(attempt.table)
      .select('clover_merchant_id,access_token')
      .eq(attempt.idColumn, idComercio)
      .maybeSingle();

    if (error) {
      if (isMissingResourceError(error)) continue;
      throw error;
    }

    const merchantId = toText((data as Record<string, unknown> | null)?.clover_merchant_id);
    const accessToken = toText((data as Record<string, unknown> | null)?.access_token);
    return {
      connected: merchantId.length > 0 && accessToken.length > 0,
    };
  }

  return { connected: false };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function extensionFromAsset(asset: MenuThemeImageAsset): string {
  const fileName = toText(asset.fileName);
  const fromName = fileName.includes('.') ? toText(fileName.split('.').pop()).toLowerCase() : '';
  if (fromName) return fromName;

  const mime = toText(asset.mimeType).toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('heic')) return 'heic';
  return 'jpg';
}

function normalizeThemeRow(row: Record<string, unknown> | null): MenuTheme {
  const source = row || {};
  const alignRaw = toText(source.productoAlign || source.productoalign).toLowerCase();
  return {
    colortexto: toText(source.colortexto) || MENU_THEME_DEFAULT.colortexto,
    colortitulo: toText(source.colortitulo) || MENU_THEME_DEFAULT.colortitulo,
    colorprecio: toText(source.colorprecio) || MENU_THEME_DEFAULT.colorprecio,
    colorboton: toText(source.colorboton) || MENU_THEME_DEFAULT.colorboton,
    colorbotontexto: toText(source.colorbotontexto) || MENU_THEME_DEFAULT.colorbotontexto,
    colorComercio: toText(source.colorComercio) || MENU_THEME_DEFAULT.colorComercio,
    colorMenu: toText(source.colorMenu) || MENU_THEME_DEFAULT.colorMenu,
    overlayoscuro: clamp(toNumber(source.overlayoscuro, MENU_THEME_DEFAULT.overlayoscuro), 0, 80),
    pdfurl: toText(source.pdfurl),
    colorBotonPDF: toText(source.colorBotonPDF) || MENU_THEME_DEFAULT.colorBotonPDF,
    backgroundcolor: toText(source.backgroundcolor) || MENU_THEME_DEFAULT.backgroundcolor,
    textomenu: toText(source.textomenu) || MENU_THEME_DEFAULT.textomenu,
    ocultar_nombre: toBoolean(source.ocultar_nombre, false),
    ocultar_menu: toBoolean(source.ocultar_menu, false),
    item_bg_color: toText(source.item_bg_color) || MENU_THEME_DEFAULT.item_bg_color,
    item_overlay: clamp(toNumber(source.item_overlay, MENU_THEME_DEFAULT.item_overlay), 0, 80),
    productoAlign: alignRaw === 'center' ? 'center' : 'left',
    portadaimagen: toText(source.portadaimagen),
    backgroundimagen: toText(source.backgroundimagen),
    fontbodyfamily: toText(source.fontbodyfamily) || null,
    fontbodyurl: toText(source.fontbodyurl) || null,
    fontbody_size: clamp(toNumber(source.fontbody_size, MENU_THEME_DEFAULT.fontbody_size), 10, 80),
    fonttitlefamily: toText(source.fonttitlefamily) || null,
    fonttitleurl: toText(source.fonttitleurl) || null,
    fonttitle_size: clamp(toNumber(source.fonttitle_size, MENU_THEME_DEFAULT.fonttitle_size), 10, 80),
    fontnombrefamily: toText(source.fontnombrefamily) || null,
    fontnombreurl: toText(source.fontnombreurl) || null,
    nombre_font_size: clamp(toNumber(source.nombre_font_size, MENU_THEME_DEFAULT.nombre_font_size), 10, 100),
    fontmenuwordfamily: toText(source.fontmenuwordfamily) || null,
    fontmenuwordurl: toText(source.fontmenuwordurl) || null,
    menu_font_size: clamp(toNumber(source.menu_font_size, MENU_THEME_DEFAULT.menu_font_size), 10, 80),
    nombre_shadow: toText(source.nombre_shadow),
    nombre_stroke_width: clamp(toNumber(source.nombre_stroke_width, MENU_THEME_DEFAULT.nombre_stroke_width), 0, 8),
    nombre_stroke_color: toText(source.nombre_stroke_color) || MENU_THEME_DEFAULT.nombre_stroke_color,
    menu_shadow: toText(source.menu_shadow),
    menu_stroke_width: clamp(toNumber(source.menu_stroke_width, MENU_THEME_DEFAULT.menu_stroke_width), 0, 8),
    menu_stroke_color: toText(source.menu_stroke_color) || MENU_THEME_DEFAULT.menu_stroke_color,
    seccion_desc_font_family: toText(source.seccion_desc_font_family) || null,
    seccion_desc_font_url: toText(source.seccion_desc_font_url) || null,
    seccion_desc_font_size: clamp(toNumber(source.seccion_desc_font_size, MENU_THEME_DEFAULT.seccion_desc_font_size), 10, 80),
    seccion_desc_color: toText(source.seccion_desc_color) || MENU_THEME_DEFAULT.seccion_desc_color,
  };
}

async function fetchMenuTheme(idComercio: number): Promise<MenuTheme> {
  const selectColumnsBase =
    'colortexto,colortitulo,colorprecio,colorboton,colorbotontexto,"colorComercio","colorMenu",overlayoscuro,pdfurl,"colorBotonPDF",backgroundcolor,textomenu,ocultar_nombre,ocultar_menu,item_bg_color,item_overlay,"productoAlign",portadaimagen,backgroundimagen,fontbodyfamily,fontbodyurl,fontbody_size,fonttitlefamily,fonttitleurl,fonttitle_size,fontnombrefamily,fontnombreurl,nombre_font_size,fontmenuwordfamily,fontmenuwordurl,menu_font_size,seccion_desc_font_family,seccion_desc_font_url,seccion_desc_font_size,seccion_desc_color';
  const selectColumnsExtended = `${selectColumnsBase},nombre_shadow,nombre_stroke_width,nombre_stroke_color,menu_shadow,menu_stroke_width,menu_stroke_color`;
  const attempts = [
    { idColumn: 'idcomercio' },
    { idColumn: 'idComercio' },
  ];

  for (const attempt of attempts) {
    const extended = await supabase
      .from('menu_tema')
      .select(selectColumnsExtended)
      .eq(attempt.idColumn, idComercio)
      .maybeSingle();

    if (!extended.error) {
      return normalizeThemeRow((extended.data || null) as Record<string, unknown> | null);
    }

    if (!isMissingResourceError(extended.error)) {
      throw extended.error;
    }

    const base = await supabase
      .from('menu_tema')
      .select(selectColumnsBase)
      .eq(attempt.idColumn, idComercio)
      .maybeSingle();

    if (base.error) {
      if (isMissingResourceError(base.error)) continue;
      throw base.error;
    }
    return normalizeThemeRow((base.data || null) as Record<string, unknown> | null);
  }

  return { ...MENU_THEME_DEFAULT };
}

export async function fetchMenuAdminContext(idComercio: number): Promise<MenuAdminContext> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    throw new Error('Comercio inválido para cargar Admin Menú.');
  }

  const comercio = await fetchCommerceBasics(idComercio);
  const planInfo = resolverPlanComercio(comercio);
  const [logoUrl, menuRows, clover, menuTheme] = await Promise.all([
    fetchCommerceLogo(idComercio),
    fetchMenuRows(idComercio),
    planInfo.permite_ordenes ? fetchCloverConnection(idComercio) : Promise.resolve({ connected: false }),
    fetchMenuTheme(idComercio),
  ]);

  const menuIds = menuRows
    .map((row) => toNumber(row.id, 0))
    .filter((id) => Number.isFinite(id) && id > 0);

  const productRows = await fetchProductRows(menuIds);
  const productsByMenu = new Map<number, MenuProduct[]>();

  productRows.forEach((row) => {
    const idMenu = toNumber(row.idMenu, 0);
    if (!Number.isFinite(idMenu) || idMenu <= 0) return;

    const product: MenuProduct = {
      id: toNumber(row.id, 0),
      idMenu,
      nombre: toText(row.nombre),
      descripcion: toText(row.descripcion),
      precio: toNumber(row.precio, 0),
      imagen: toText(row.imagen),
      orden: toNumber(row.orden, 1),
      activo: toBoolean(row.activo, true),
      noTraducirNombre: toBoolean(row.no_traducir_nombre, false),
    };

    const list = productsByMenu.get(idMenu) || [];
    list.push(product);
    productsByMenu.set(idMenu, list);
  });

  const sections: MenuSection[] = menuRows
    .map((row) => {
      const id = toNumber(row.id, 0);
      if (!Number.isFinite(id) || id <= 0) return null;

      const productos = (productsByMenu.get(id) || []).sort((a, b) => a.orden - b.orden);
      return {
        id,
        titulo: toText(row.titulo),
        subtitulo: toText(row.subtitulo),
        descripcion: toText(row.descripcion),
        orden: toNumber(row.orden, 1),
        activo: toBoolean(row.activo, true),
        noTraducir: toBoolean(row.no_traducir, false),
        productos,
      } as MenuSection;
    })
    .filter((row): row is MenuSection => Boolean(row))
    .sort((a, b) => a.orden - b.orden);

  return {
    idComercio,
    nombreComercio: toText(comercio.nombre),
    planNombre: toText(planInfo.nombre),
    planNivel: toNumber(planInfo.nivel, 0),
    planPermiteMenu: Boolean(planInfo.permite_menu),
    planPermiteOrdenes: Boolean(planInfo.permite_ordenes),
    comercioVerificado: comercioVerificado(comercio),
    logoUrl,
    cloverConnected: clover.connected,
    sections,
    menuTheme,
  };
}

export async function saveMenuTheme(idComercio: number, theme: MenuTheme): Promise<void> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    throw new Error('Comercio inválido para guardar diseño de menú.');
  }

  const normalized = normalizeThemeRow(theme as unknown as Record<string, unknown>);
  const payloadBase = {
    colortexto: normalized.colortexto,
    colortitulo: normalized.colortitulo,
    colorprecio: normalized.colorprecio,
    colorboton: normalized.colorboton,
    colorbotontexto: normalized.colorbotontexto,
    colorComercio: normalized.colorComercio,
    colorMenu: normalized.colorMenu,
    overlayoscuro: normalized.overlayoscuro,
    pdfurl: normalized.pdfurl,
    colorBotonPDF: normalized.colorBotonPDF,
    backgroundcolor: normalized.backgroundcolor,
    textomenu: normalized.textomenu,
    ocultar_nombre: normalized.ocultar_nombre,
    ocultar_menu: normalized.ocultar_menu,
    item_bg_color: normalized.item_bg_color,
    item_overlay: normalized.item_overlay,
    productoAlign: normalized.productoAlign,
    portadaimagen: normalized.portadaimagen,
    backgroundimagen: normalized.backgroundimagen,
    fontbodyfamily: normalized.fontbodyfamily,
    fontbodyurl: normalized.fontbodyurl,
    fontbody_size: normalized.fontbody_size,
    fonttitlefamily: normalized.fonttitlefamily,
    fonttitleurl: normalized.fonttitleurl,
    fonttitle_size: normalized.fonttitle_size,
    fontnombrefamily: normalized.fontnombrefamily,
    fontnombreurl: normalized.fontnombreurl,
    nombre_font_size: normalized.nombre_font_size,
    fontmenuwordfamily: normalized.fontmenuwordfamily,
    fontmenuwordurl: normalized.fontmenuwordurl,
    menu_font_size: normalized.menu_font_size,
    seccion_desc_font_family: normalized.seccion_desc_font_family,
    seccion_desc_font_url: normalized.seccion_desc_font_url,
    seccion_desc_font_size: normalized.seccion_desc_font_size,
    seccion_desc_color: normalized.seccion_desc_color,
  };
  const payloadExtended = {
    ...payloadBase,
    nombre_shadow: normalized.nombre_shadow,
    nombre_stroke_width: normalized.nombre_stroke_width,
    nombre_stroke_color: normalized.nombre_stroke_color,
    menu_shadow: normalized.menu_shadow,
    menu_stroke_width: normalized.menu_stroke_width,
    menu_stroke_color: normalized.menu_stroke_color,
  };

  const attempts = [
    { idColumn: 'idcomercio', onConflict: 'idcomercio' },
    { idColumn: 'idComercio', onConflict: 'idComercio' },
  ];

  const tryUpsert = async (payload: Record<string, unknown>): Promise<boolean> => {
    for (const attempt of attempts) {
      const upsertPayload = {
        [attempt.idColumn]: idComercio,
        ...payload,
      };
      const { error } = await supabase
        .from('menu_tema')
        .upsert(upsertPayload, { onConflict: attempt.onConflict });
      if (error) {
        if (isMissingResourceError(error) || isOnConflictTargetError(error)) continue;
        throw new Error(formatSupabaseError(error, 'No se pudo guardar diseño del menú.'));
      }
      return true;
    }
    return false;
  };

  if (await tryUpsert(payloadExtended)) return;
  if (await tryUpsert(payloadBase)) return;

  const tryUpdateInsert = async (payload: Record<string, unknown>): Promise<boolean> => {
    for (const attempt of attempts) {
      const { data: updated, error: updateError } = await supabase
        .from('menu_tema')
        .update(payload)
        .eq(attempt.idColumn, idComercio)
        .select(attempt.idColumn)
        .limit(1);
      if (updateError) {
        if (isMissingResourceError(updateError)) continue;
        throw new Error(formatSupabaseError(updateError, 'No se pudo actualizar diseño del menú.'));
      }
      if (Array.isArray(updated) && updated.length > 0) return true;

      const insertPayload = {
        [attempt.idColumn]: idComercio,
        ...payload,
      };
      const { error: insertError } = await supabase.from('menu_tema').insert(insertPayload);
      if (insertError) {
        if (isMissingResourceError(insertError)) continue;
        throw new Error(formatSupabaseError(insertError, 'No se pudo crear diseño del menú.'));
      }
      return true;
    }
    return false;
  };

  if (await tryUpdateInsert(payloadExtended)) return;
  if (await tryUpdateInsert(payloadBase)) return;

  throw new Error('No se encontró estructura de menu_tema compatible para guardar.');
}

export async function uploadMenuThemeImage(
  idComercio: number,
  type: 'portada' | 'background',
  asset: MenuThemeImageAsset
): Promise<string> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    throw new Error('Comercio inválido para subir imagen del menú.');
  }
  if (!toText(asset.uri)) {
    throw new Error('Imagen inválida para subir.');
  }

  const ext = extensionFromAsset(asset);
  const folder = type === 'portada' ? 'menus/portada' : 'menus/background';
  const baseName = type === 'portada' ? 'portada' : 'background';
  const path = `${folder}/${idComercio}/${baseName}.${ext}`;

  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error('No se pudo leer la imagen seleccionada.');
  }
  const blob = await response.blob();
  const contentType = toText(asset.mimeType) || blob.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  const { error } = await supabase.storage.from(MENU_THEME_BUCKET).upload(path, blob, {
    upsert: true,
    contentType,
    cacheControl: '0',
  });
  if (error) throw error;

  return path;
}

export async function saveMenuSection(
  idComercio: number,
  draft: MenuSectionDraft,
  editingId: number | null
): Promise<void> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    throw new Error('Comercio inválido para guardar sección.');
  }

  const payload = {
    titulo: toText(draft.titulo),
    subtitulo: toText(draft.subtitulo),
    descripcion: toText(draft.descripcion),
    no_traducir: Boolean(draft.noTraducir),
    orden: Math.max(1, toNumber(draft.orden, 1)),
    activo: Boolean(draft.activo),
    idComercio,
  };

  if (!payload.titulo) {
    throw new Error('El título de la sección es requerido.');
  }

  if (editingId && Number.isFinite(editingId) && editingId > 0) {
    const { data: previousRow, error: previousError } = await supabase
      .from('menus')
      .select('id,titulo,descripcion,no_traducir')
      .eq('id', editingId)
      .maybeSingle();

    if (previousError) throw previousError;

    const { error: updateError } = await supabase.from('menus').update(payload).eq('id', editingId);
    if (updateError) throw updateError;

    const prev = (previousRow || null) as Record<string, unknown> | null;
    const titleChanged =
      normalizeComparableText(prev?.titulo) !== normalizeComparableText(payload.titulo) ||
      toBoolean(prev?.no_traducir, false) !== payload.no_traducir;
    const descriptionChanged = normalizeComparableText(prev?.descripcion) !== normalizeComparableText(payload.descripcion);

    await invalidateMenuTranslationCells(editingId, { titleChanged, descriptionChanged });
    return;
  }

  const { error: insertError } = await supabase.from('menus').insert(payload);
  if (insertError) throw insertError;
}

export async function reorderMenuSections(updates: Array<{ id: number; orden: number }>): Promise<void> {
  const valid = updates
    .filter((item) => Number.isFinite(item.id) && item.id > 0)
    .map((item) => ({
      id: item.id,
      orden: Math.max(1, toNumber(item.orden, 1)),
    }));

  if (!valid.length) return;

  const results = await Promise.all(valid.map((item) => supabase.from('menus').update({ orden: item.orden }).eq('id', item.id)));
  const failure = results.find((result) => result.error)?.error;
  if (failure) throw failure;
}

export async function saveMenuProduct(
  idMenu: number,
  draft: MenuProductDraft,
  editingId: number | null
): Promise<void> {
  if (!Number.isFinite(idMenu) || idMenu <= 0) {
    throw new Error('Sección inválida para guardar producto.');
  }

  const payload = {
    nombre: toText(draft.nombre),
    descripcion: toText(draft.descripcion),
    precio: Number(draft.precio),
    orden: Math.max(1, toNumber(draft.orden, 1)),
    activo: Boolean(draft.activo),
    idMenu,
    no_traducir_nombre: Boolean(draft.noTraducirNombre),
  };

  if (!payload.nombre || !Number.isFinite(payload.precio)) {
    throw new Error('Nombre y precio son requeridos para el producto.');
  }

  if (editingId && Number.isFinite(editingId) && editingId > 0) {
    const { data: previousRow, error: previousError } = await supabase
      .from('productos')
      .select('id,nombre,descripcion,no_traducir_nombre')
      .eq('id', editingId)
      .maybeSingle();

    if (previousError) throw previousError;

    const { error: updateError } = await supabase.from('productos').update(payload).eq('id', editingId);
    if (updateError) throw updateError;

    const prev = (previousRow || null) as Record<string, unknown> | null;
    const nameChanged =
      normalizeComparableText(prev?.nombre) !== normalizeComparableText(payload.nombre) ||
      toBoolean(prev?.no_traducir_nombre, false) !== payload.no_traducir_nombre;
    const descriptionChanged = normalizeComparableText(prev?.descripcion) !== normalizeComparableText(payload.descripcion);

    await invalidateProductTranslationCells(editingId, { nameChanged, descriptionChanged });
    return;
  }

  const { error: insertError } = await supabase.from('productos').insert(payload);
  if (insertError) throw insertError;
}

export async function deleteMenuProduct(idProducto: number, imagePath?: string): Promise<void> {
  if (!Number.isFinite(idProducto) || idProducto <= 0) {
    throw new Error('Producto inválido para eliminar.');
  }

  const image = toText(imagePath);
  if (image) {
    await supabase.storage.from('galeriacomercios').remove([image]).catch(() => {
      // Keep delete flow even if image removal fails.
    });
  }

  const { error } = await supabase.from('productos').delete().eq('id', idProducto);
  if (error) throw error;

  await invalidateProductTranslationCells(idProducto, { mode: 'delete' });
}

export function getCloverOauthStartUrl(idComercio: number): string {
  return `${FUNCTIONS_BASE}/clover-oauth-start?idComercio=${idComercio}`;
}

export async function runCloverImport(idComercio: number): Promise<CloverImportResult> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    throw new Error('Comercio inválido para importar Clover.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = toText(session?.access_token);
  if (!accessToken) {
    throw new Error('Debes iniciar sesión para importar desde Clover.');
  }

  const importResponse = await fetch(`${FUNCTIONS_BASE}/clover-import-menu?idComercio=${idComercio}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const importBody = (await importResponse.json().catch(() => ({}))) as Record<string, unknown>;

  if (!importResponse.ok) {
    if (importResponse.status === 401 && importBody.needs_reconnect === true) {
      throw new Error('La conexión con Clover expiró. Debes reconectar tu cuenta.');
    }

    const detailedMessage = toText((importBody.details as Record<string, unknown> | undefined)?.message);
    const generic = toText(importBody.error);
    throw new Error(detailedMessage || generic || `No se pudo importar desde Clover (status ${importResponse.status}).`);
  }

  await fetch(`${FUNCTIONS_BASE}/clover-sync-tax-rates?idComercio=${idComercio}`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(() => {
    // Tax sync is best effort.
  });

  return {
    menus: toNumber(importBody.menus, 0),
    productos: toNumber(importBody.productos, 0),
    opciones: toNumber(importBody.opciones, 0),
  };
}
