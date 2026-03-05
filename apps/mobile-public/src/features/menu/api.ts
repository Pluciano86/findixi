import { supabase } from '../../lib/supabase';

import type {
  CloverTaxRate,
  MenuComercio,
  MenuProduct,
  MenuSection,
  MenuTheme,
  MenuTranslationResult,
  ModifierGroup,
  ModifierItem,
  ProductTaxRates,
} from './types';

const GALLERY_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/';

const DEFAULT_THEME: MenuTheme = {
  colortexto: '#1f2937',
  colortitulo: '#111827',
  colorprecio: '#2563eb',
  colorboton: '#2563eb',
  colorbotontexto: '#ffffff',
  colorComercio: '#111827',
  colorMenu: '#111827',
  overlayoscuro: 40,
  portadaimagen: null,
  backgroundimagen: null,
  backgroundcolor: '#ffffff',
  textomenu: 'Menú',
  pdfurl: null,
  colorBotonPDF: 'rgba(37, 99, 235, 0.8)',
  ocultar_nombre: false,
  ocultar_menu: false,
  nombre_font_size: 28,
  menu_font_size: 20,
  fontbody_size: 16,
  fonttitle_size: 18,
  fontbodyfamily: null,
  fontbodyurl: null,
  fonttitlefamily: null,
  fonttitleurl: null,
  fontnombrefamily: null,
  fontnombreurl: null,
  fontmenuwordfamily: null,
  fontmenuwordurl: null,
  nombre_shadow: null,
  nombre_stroke_width: 0,
  nombre_stroke_color: '#000000',
  menu_shadow: null,
  menu_stroke_width: 0,
  menu_stroke_color: '#000000',
  seccion_desc_font_family: null,
  seccion_desc_font_url: null,
  seccion_desc_font_size: 14,
  seccion_desc_color: null,
  item_bg_color: '#ffffff',
  item_overlay: 0,
  productoAlign: 'left',
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toNullableBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

export function toMenuStorageUrl(pathOrUrl: string | null | undefined): string | null {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${GALLERY_BASE}${raw.replace(/^public\//i, '').replace(/^\/+/, '')}`;
}

export function getProductoImageUrl(pathOrUrl: string | null | undefined): string | null {
  return toMenuStorageUrl(pathOrUrl);
}

export function isComercioVerificado(comercio: MenuComercio | null | undefined): boolean {
  const estadoPropiedad = String(comercio?.estado_propiedad || '').toLowerCase();
  const estadoVerificacion = String(comercio?.estado_verificacion || '').toLowerCase();
  const propietarioVerificado = comercio?.propietario_verificado === true;
  const verificacionOk = ['otp_verificado', 'sms_verificado', 'messenger_verificado', 'manual_aprobado'].includes(
    estadoVerificacion
  );
  return estadoPropiedad === 'verificado' && (propietarioVerificado || verificacionOk);
}

export async function fetchMenuTheme(idComercio: number): Promise<MenuTheme> {
  const { data, error } = await supabase
    .from('menu_tema')
    .select(
      'colortexto,colortitulo,colorprecio,colorboton,colorbotontexto,"colorComercio","colorMenu","productoAlign",ocultar_nombre,ocultar_menu,overlayoscuro,portadaimagen,backgroundimagen,backgroundcolor,textomenu,pdfurl,"colorBotonPDF",fontbodyfamily,fontbodyurl,fontbody_size,fonttitlefamily,fonttitleurl,fonttitle_size,fontnombrefamily,fontnombreurl,nombre_font_size,fontmenuwordfamily,fontmenuwordurl,menu_font_size,nombre_shadow,nombre_stroke_width,nombre_stroke_color,menu_shadow,menu_stroke_width,menu_stroke_color,seccion_desc_font_family,seccion_desc_font_url,seccion_desc_font_size,seccion_desc_color,item_bg_color,item_overlay'
    )
    .eq('idcomercio', idComercio)
    .maybeSingle();

  if (error) {
    console.warn('[mobile-public][menu] No se pudo cargar menu_tema:', error.message);
  }

  if (!data) return { ...DEFAULT_THEME };

  const record = data as Record<string, unknown>;
  const productoAlignRaw = String(record.productoAlign ?? DEFAULT_THEME.productoAlign)
    .trim()
    .toLowerCase();

  return {
    ...DEFAULT_THEME,
    colortexto: String(record.colortexto ?? DEFAULT_THEME.colortexto),
    colortitulo: String(record.colortitulo ?? DEFAULT_THEME.colortitulo),
    colorprecio: String(record.colorprecio ?? DEFAULT_THEME.colorprecio),
    colorboton: String(record.colorboton ?? DEFAULT_THEME.colorboton),
    colorbotontexto: String(record.colorbotontexto ?? DEFAULT_THEME.colorbotontexto),
    colorComercio: String(record.colorComercio ?? record.colortitulo ?? DEFAULT_THEME.colorComercio),
    colorMenu: String(record.colorMenu ?? record.colortitulo ?? DEFAULT_THEME.colorMenu),
    overlayoscuro: toFiniteNumber(record.overlayoscuro, DEFAULT_THEME.overlayoscuro),
    portadaimagen: String(record.portadaimagen ?? '').trim() || null,
    backgroundimagen: String(record.backgroundimagen ?? '').trim() || null,
    backgroundcolor: String(record.backgroundcolor ?? DEFAULT_THEME.backgroundcolor),
    textomenu: String(record.textomenu ?? DEFAULT_THEME.textomenu),
    pdfurl: String(record.pdfurl ?? '').trim() || null,
    colorBotonPDF: String(record.colorBotonPDF ?? '').trim() || DEFAULT_THEME.colorBotonPDF,
    ocultar_nombre: Boolean(record.ocultar_nombre),
    ocultar_menu: Boolean(record.ocultar_menu),
    nombre_font_size: toFiniteNumber(record.nombre_font_size, DEFAULT_THEME.nombre_font_size),
    menu_font_size: toFiniteNumber(record.menu_font_size, DEFAULT_THEME.menu_font_size),
    fontbody_size: toFiniteNumber(record.fontbody_size, DEFAULT_THEME.fontbody_size),
    fonttitle_size: toFiniteNumber(record.fonttitle_size, DEFAULT_THEME.fonttitle_size),
    fontbodyfamily: String(record.fontbodyfamily ?? '').trim() || null,
    fontbodyurl: String(record.fontbodyurl ?? '').trim() || null,
    fonttitlefamily: String(record.fonttitlefamily ?? '').trim() || null,
    fonttitleurl: String(record.fonttitleurl ?? '').trim() || null,
    fontnombrefamily: String(record.fontnombrefamily ?? '').trim() || null,
    fontnombreurl: String(record.fontnombreurl ?? '').trim() || null,
    fontmenuwordfamily: String(record.fontmenuwordfamily ?? '').trim() || null,
    fontmenuwordurl: String(record.fontmenuwordurl ?? '').trim() || null,
    nombre_shadow: String(record.nombre_shadow ?? '').trim() || null,
    nombre_stroke_width: toFiniteNumber(record.nombre_stroke_width, DEFAULT_THEME.nombre_stroke_width),
    nombre_stroke_color: String(record.nombre_stroke_color ?? '').trim() || DEFAULT_THEME.nombre_stroke_color,
    menu_shadow: String(record.menu_shadow ?? '').trim() || null,
    menu_stroke_width: toFiniteNumber(record.menu_stroke_width, DEFAULT_THEME.menu_stroke_width),
    menu_stroke_color: String(record.menu_stroke_color ?? '').trim() || DEFAULT_THEME.menu_stroke_color,
    seccion_desc_font_family: String(record.seccion_desc_font_family ?? '').trim() || null,
    seccion_desc_font_url: String(record.seccion_desc_font_url ?? '').trim() || null,
    seccion_desc_font_size: toFiniteNumber(record.seccion_desc_font_size, DEFAULT_THEME.seccion_desc_font_size),
    seccion_desc_color: String(record.seccion_desc_color ?? '').trim() || null,
    item_bg_color: String(record.item_bg_color ?? DEFAULT_THEME.item_bg_color),
    item_overlay: toFiniteNumber(record.item_overlay, DEFAULT_THEME.item_overlay),
    productoAlign: productoAlignRaw === 'center' ? 'center' : 'left',
  };
}

export async function fetchMenuComercio(idComercio: number): Promise<MenuComercio | null> {
  const { data, error } = await supabase
    .from('Comercios')
    .select(
      'id,nombre,colorPrimario,colorSecundario,logo,telefono,facebook,instagram,plan_id,plan_nivel,plan_nombre,permite_menu,permite_ordenes,estado_propiedad,estado_verificacion,propietario_verificado'
    )
    .eq('id', idComercio)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const record = data as Record<string, unknown>;
  return {
    id: Number(record.id ?? 0),
    nombre: String(record.nombre ?? '').trim(),
    colorPrimario: String(record.colorPrimario ?? '').trim() || null,
    colorSecundario: String(record.colorSecundario ?? '').trim() || null,
    logo: String(record.logo ?? '').trim() || null,
    telefono: String(record.telefono ?? '').trim() || null,
    facebook: String(record.facebook ?? '').trim() || null,
    instagram: String(record.instagram ?? '').trim() || null,
    plan_id: Number.isFinite(Number(record.plan_id)) ? Number(record.plan_id) : null,
    plan_nivel: String(record.plan_nivel ?? '').trim() || null,
    plan_nombre: String(record.plan_nombre ?? '').trim() || null,
    permite_menu: toNullableBoolean(record.permite_menu),
    permite_ordenes: toNullableBoolean(record.permite_ordenes),
    estado_propiedad: String(record.estado_propiedad ?? '').trim() || null,
    estado_verificacion: String(record.estado_verificacion ?? '').trim() || null,
    propietario_verificado: toNullableBoolean(record.propietario_verificado),
  };
}

export async function fetchMenuSections(idComercio: number): Promise<MenuSection[]> {
  const { data, error } = await supabase
    .from('menus')
    .select('id,titulo,descripcion,subtitulo,orden,no_traducir')
    .eq('idComercio', idComercio)
    .eq('activo', true)
    .order('orden', { ascending: true });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => {
      const record = row as Record<string, unknown>;
      const id = Number(record.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        id,
        titulo: String(record.titulo ?? '').trim() || 'Sin título',
        descripcion: String(record.descripcion ?? '').trim(),
        subtitulo: String(record.subtitulo ?? '').trim(),
        orden: toFiniteNumber(record.orden, 0),
        no_traducir: Boolean(record.no_traducir),
      } satisfies MenuSection;
    })
    .filter((entry): entry is MenuSection => Boolean(entry));
}

export async function fetchMenuProducts(menuIds: number[]): Promise<MenuProduct[]> {
  if (!menuIds.length) return [];

  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .in('idMenu', menuIds)
    .eq('activo', true)
    .order('orden', { ascending: true });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => {
      const record = row as Record<string, unknown>;
      const id = Number(record.id);
      const idMenu = Number(record.idMenu);
      if (!Number.isFinite(id) || !Number.isFinite(idMenu)) return null;
      return {
        id,
        idMenu,
        nombre: String(record.nombre ?? '').trim() || `Producto ${id}`,
        descripcion: String(record.descripcion ?? '').trim(),
        precio: toFiniteNumber(record.precio, 0),
        imagen: String(record.imagen ?? '').trim() || null,
        orden: toFiniteNumber(record.orden, 0),
        activo: Boolean(record.activo),
        no_traducir_nombre: record.no_traducir_nombre === true,
        no_traducir_descripcion: record.no_traducir_descripcion === true,
      } satisfies MenuProduct;
    })
    .filter((entry): entry is MenuProduct => Boolean(entry));
}

function normalizeLang(langRaw: string): string {
  return String(langRaw || 'es')
    .toLowerCase()
    .split('-')[0];
}

export async function fetchMenuTranslation(idMenu: number, langRaw: string): Promise<MenuTranslationResult> {
  const lang = normalizeLang(langRaw);
  if (lang === 'es') return null;

  try {
    const { data, error } = await supabase.functions.invoke('translate-menu', {
      body: {
        type: 'menu',
        idMenu,
        lang,
      },
    });
    if (error) throw error;
    const payload = data as { ok?: boolean; data?: MenuTranslationResult; error?: string } | null;
    if (payload?.ok !== true) return null;
    return payload.data ?? null;
  } catch (error) {
    console.warn('[mobile-public][menu] Error traduciendo menu:', error);
    return null;
  }
}

async function fetchWithColumnFallback(
  table: string,
  filterColumn: string,
  fallbackColumn: string,
  matchValue: number,
  orderColumn = 'orden'
): Promise<Record<string, unknown>[]> {
  let response = await supabase.from(table).select('*').eq(filterColumn, matchValue).eq('activo', true).order(orderColumn, {
    ascending: true,
  });

  if (!response.error) return (response.data as Record<string, unknown>[]) || [];
  const msg = (response.error.message || '').toLowerCase();

  if (msg.includes('column') && msg.includes('activo') && msg.includes('does not exist')) {
    response = await supabase.from(table).select('*').eq(filterColumn, matchValue).order(orderColumn, { ascending: true });
    if (!response.error) return (response.data as Record<string, unknown>[]) || [];
  }

  if (msg.includes('does not exist')) {
    response = await supabase.from(table).select('*').eq(fallbackColumn, matchValue).eq('activo', true).order(orderColumn, {
      ascending: true,
    });

    if (!response.error) return (response.data as Record<string, unknown>[]) || [];

    const fallbackMsg = (response.error.message || '').toLowerCase();
    if (fallbackMsg.includes('column') && fallbackMsg.includes('activo') && fallbackMsg.includes('does not exist')) {
      const secondFallback = await supabase
        .from(table)
        .select('*')
        .eq(fallbackColumn, matchValue)
        .order(orderColumn, { ascending: true });
      if (!secondFallback.error) return (secondFallback.data as Record<string, unknown>[]) || [];
      throw secondFallback.error;
    }
  }

  throw response.error;
}

export async function fetchModifierGroups(productId: number): Promise<ModifierGroup[]> {
  const rows = await fetchWithColumnFallback('producto_opcion_grupos', 'idproducto', 'idProducto', productId);

  return rows
    .map((record) => {
      const id = Number(record.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        id,
        nombre: String(record.nombre ?? '').trim() || 'Opciones',
        min_sel: toFiniteNumber(record.min_sel, 0),
        max_sel: toFiniteNumber(record.max_sel, 0),
        requerido: Boolean(record.requerido),
        orden: toFiniteNumber(record.orden, 0),
      } satisfies ModifierGroup;
    })
    .filter((entry): entry is ModifierGroup => Boolean(entry));
}

export async function fetchModifierItems(groupId: number): Promise<ModifierItem[]> {
  const rows = await fetchWithColumnFallback('producto_opcion_items', 'idgrupo', 'idGrupo', groupId);

  return rows
    .map((record) => {
      const id = Number(record.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        id,
        idgrupo: Number.isFinite(Number(record.idgrupo)) ? Number(record.idgrupo) : null,
        idGrupo: Number.isFinite(Number(record.idGrupo)) ? Number(record.idGrupo) : null,
        nombre: String(record.nombre ?? '').trim() || 'Opción',
        precio_extra: toFiniteNumber(record.precio_extra, 0),
        orden: toFiniteNumber(record.orden, 0),
      } satisfies ModifierItem;
    })
    .filter((entry): entry is ModifierItem => Boolean(entry));
}

export async function fetchProductTaxRates(idComercio: number, productIds: number[]): Promise<ProductTaxRates> {
  const defaultOutput: ProductTaxRates = {
    defaultRates: [],
    byProductId: new Map<number, CloverTaxRate[]>(),
  };

  if (!productIds.length) return defaultOutput;

  let ptrRows: Record<string, unknown>[] = [];
  {
    const primary = await supabase.from('producto_tax_rates').select('*').in('idproducto', productIds);
    if (!primary.error) {
      ptrRows = (primary.data as Record<string, unknown>[]) || [];
    } else {
      const msg = (primary.error.message || '').toLowerCase();
      if (!(msg.includes('column') && msg.includes('idproducto') && msg.includes('does not exist'))) {
        throw primary.error;
      }
      const fallback = await supabase.from('producto_tax_rates').select('*').in('idProducto', productIds);
      if (fallback.error) throw fallback.error;
      ptrRows = (fallback.data as Record<string, unknown>[]) || [];
    }
  }

  let taxRatesRows: Record<string, unknown>[] = [];
  {
    const primary = await supabase.from('clover_tax_rates').select('*').eq('idcomercio', idComercio);
    if (!primary.error) {
      taxRatesRows = (primary.data as Record<string, unknown>[]) || [];
    } else {
      const msg = (primary.error.message || '').toLowerCase();
      if (!(msg.includes('column') && msg.includes('idcomercio') && msg.includes('does not exist'))) {
        throw primary.error;
      }
      const fallback = await supabase.from('clover_tax_rates').select('*').eq('idComercio', idComercio);
      if (fallback.error) throw fallback.error;
      taxRatesRows = (fallback.data as Record<string, unknown>[]) || [];
    }
  }

  const normalizedTaxRates: CloverTaxRate[] = taxRatesRows
    .map((record) => {
      const id = Number(record.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        id,
        rate: toFiniteNumber(record.rate, 0),
        is_default: record.is_default === true,
      } satisfies CloverTaxRate;
    })
    .filter((entry): entry is CloverTaxRate => Boolean(entry));

  const taxRateById = new Map<number, CloverTaxRate>();
  normalizedTaxRates.forEach((rate) => taxRateById.set(rate.id, rate));

  const byProductId = new Map<number, CloverTaxRate[]>();
  ptrRows.forEach((record) => {
    const idProducto = Number(record.idproducto ?? record.idProducto);
    const idTaxRate = Number(record.idtaxrate ?? record.idTaxRate);
    if (!Number.isFinite(idProducto) || !Number.isFinite(idTaxRate)) return;
    const rate = taxRateById.get(idTaxRate);
    if (!rate) return;
    const list = byProductId.get(idProducto) || [];
    list.push(rate);
    byProductId.set(idProducto, list);
  });

  return {
    defaultRates: normalizedTaxRates.filter((rate) => rate.is_default),
    byProductId,
  };
}
