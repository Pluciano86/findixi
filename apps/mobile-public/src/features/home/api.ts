import {
  compareByNearestUpcomingDate,
  getLatestISODate,
  pickRandomItems,
  resolverPlanComercio,
} from '@findixi/shared';

import { supabase } from '../../lib/supabase';
import type { LanguageCode } from '../../i18n/languages';
import type {
  HomeAreaCard,
  HomeBannerItem,
  HomeCategoryItem,
  HomeComercioCard,
  HomeEventoFechaItem,
  HomeEventoCard,
  HomeIndexData,
} from './types';

const PLACEHOLDER_IMAGE = 'https://placehold.co/800x500?text=Findixi';
const PLACEHOLDER_AREA = 'https://placehold.co/700x420?text=Area';
const PLACEHOLDER_LOGO = 'https://placehold.co/80x80?text=Logo';
const GALLERY_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/';

const CATEGORIA_RESTAURANTES_ID = 1;
const CATEGORIA_JANGUEO_ID = 11;

const CATEGORIAS_ORDEN = [
  'Restaurantes',
  'Coffee Shops',
  'Jangueo',
  'Antojitos Dulces',
  'Food Trucks',
  'Dispensarios',
  'Panaderias',
  'Playground',
  'Bares',
];

const LANGUAGE_CODES: readonly LanguageCode[] = ['es', 'en', 'zh', 'fr', 'pt', 'de', 'it', 'ko', 'ja'];

function normalizeString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeTextKey(value: unknown): string {
  return normalizeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function toStorageUrl(pathOrUrl: unknown, fallback = PLACEHOLDER_IMAGE): string {
  const raw = normalizeString(pathOrUrl);
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^public\//i, '').replace(/^\/+/, '');
  return `${GALLERY_BASE}${clean}`;
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function buildLocalizedLabels(record: Record<string, unknown>): Partial<Record<LanguageCode, string>> {
  return LANGUAGE_CODES.reduce<Partial<Record<LanguageCode, string>>>((acc, code) => {
    const key = `nombre_${code}`;
    const value = normalizeString(record[key]);
    if (value) acc[code] = value;
    return acc;
  }, {});
}

function isCurrentBanner(banner: Record<string, unknown>): boolean {
  const now = new Date();
  const startRaw = normalizeString(banner.fechaInicio);
  const endRaw = normalizeString(banner.fechaFin);

  const start = startRaw ? new Date(startRaw) : null;
  const end = endRaw ? new Date(endRaw) : null;

  if (start && Number.isNaN(start.getTime())) return false;
  if (end && Number.isNaN(end.getTime())) return false;
  if (start && start > now) return false;
  if (end && end < now) return false;

  return true;
}

export async function fetchGlobalBanners(): Promise<HomeBannerItem[]> {
  const { data, error } = await supabase
    .from('banners')
    .select('id, titulo, descripcion, tipo, imagenurl, videourl, activo, fechaInicio, fechaFin, urlExterna, idComercio')
    .eq('tipo', 'global')
    .eq('activo', true)
    .limit(20);

  if (error || !Array.isArray(data)) return [];

  return data
    .filter((row) => isCurrentBanner(row as Record<string, unknown>))
    .map((row) => {
      const record = row as Record<string, unknown>;
      const imageUrl = normalizeString(record.imagenurl);
      if (!imageUrl) return null;

      return {
        id: toSafeNumber(record.id),
        title: normalizeString(record.titulo) || 'Findixi',
        subtitle: normalizeString(record.descripcion),
        imageUrl,
        idComercio: Number.isFinite(Number(record.idComercio)) ? Number(record.idComercio) : null,
        externalUrl: normalizeString(record.urlExterna) || null,
      } satisfies HomeBannerItem;
    })
    .filter((row): row is HomeBannerItem => Boolean(row));
}

async function fetchCategories(): Promise<HomeCategoryItem[]> {
  const { data, error } = await supabase
    .from('Categorias')
    .select('id, imagen, color_hex, icono, nombre, nombre_es, nombre_en, nombre_zh, nombre_fr, nombre_pt, nombre_de, nombre_it, nombre_ko, nombre_ja')
    .order('id', { ascending: true });

  if (error || !Array.isArray(data)) return [];

  const sorted = [...data].sort((a, b) => {
    const aName = normalizeTextKey((a as Record<string, unknown>).nombre_es || (a as Record<string, unknown>).nombre);
    const bName = normalizeTextKey((b as Record<string, unknown>).nombre_es || (b as Record<string, unknown>).nombre);
    const aIndex = CATEGORIAS_ORDEN.map((name) => normalizeTextKey(name)).indexOf(aName);
    const bIndex = CATEGORIAS_ORDEN.map((name) => normalizeTextKey(name)).indexOf(bName);

    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return sorted.map((row) => {
    const record = row as Record<string, unknown>;
    const imageUrl = normalizeString(record.imagen);
    const labels = buildLocalizedLabels(record);
    const fallbackLabel = labels.es || normalizeString(record.nombre) || 'Categoria';

    return {
      id: toSafeNumber(record.id),
      labels,
      fallbackLabel,
      imageUrl: imageUrl || PLACEHOLDER_IMAGE,
      colorHex: normalizeString(record.color_hex) || null,
      iconName: normalizeString(record.icono) || null,
    } satisfies HomeCategoryItem;
  });
}

async function fetchComercioImages(ids: number[]): Promise<Map<number, { cover: string; logo: string }>> {
  const output = new Map<number, { cover: string; logo: string }>();
  if (!ids.length) return output;

  const { data, error } = await supabase
    .from('imagenesComercios')
    .select('idComercio, imagen, logo, portada')
    .in('idComercio', ids);

  if (error || !Array.isArray(data)) return output;

  ids.forEach((id) => {
    const rows = data.filter((row) => toSafeNumber((row as Record<string, unknown>).idComercio) === id);
    const portada = rows.find((row) => Boolean((row as Record<string, unknown>).portada));
    const firstMedia = rows.find((row) => !Boolean((row as Record<string, unknown>).logo));
    const logo = rows.find((row) => Boolean((row as Record<string, unknown>).logo));

    output.set(id, {
      cover: toStorageUrl((portada as Record<string, unknown> | undefined)?.imagen || (firstMedia as Record<string, unknown> | undefined)?.imagen, PLACEHOLDER_IMAGE),
      logo: toStorageUrl((logo as Record<string, unknown> | undefined)?.imagen, PLACEHOLDER_LOGO),
    });
  });

  return output;
}

function hasCategoria(record: Record<string, unknown>, categoriaId: number): boolean {
  const rel = Array.isArray(record.ComercioCategorias) ? record.ComercioCategorias : [];
  return rel.some((entry) => toSafeNumber((entry as Record<string, unknown>).idCategoria) === categoriaId);
}

function toHomeComercioCard(record: Record<string, unknown>, imagesByComercio: Map<number, { cover: string; logo: string }>): HomeComercioCard {
  const id = toSafeNumber(record.id);
  const imageSet = imagesByComercio.get(id);

  return {
    id,
    nombre: normalizeString(record.nombre) || 'Comercio',
    municipio: normalizeString(record.municipio) || 'Puerto Rico',
    coverUrl: imageSet?.cover || toStorageUrl(record.portada, PLACEHOLDER_IMAGE),
    logoUrl: imageSet?.logo || toStorageUrl(record.logo, PLACEHOLDER_LOGO),
  } satisfies HomeComercioCard;
}

async function fetchComercioRails(limit = 24): Promise<{ comidaCards: HomeComercioCard[]; jangueoCards: HomeComercioCard[] }> {
  const maxQueryRows = Math.max(limit * 10, 200);

  const { data, error } = await supabase
    .from('Comercios')
    .select(
      'id,nombre,municipio,activo,logo,portada,plan_id,plan_nivel,plan_nombre,permite_perfil,aparece_en_cercanos,permite_menu,permite_especiales,permite_ordenes,estado_propiedad,estado_verificacion,propietario_verificado,ComercioCategorias ( idCategoria )'
    )
    .eq('activo', true)
    .limit(maxQueryRows);

  if (error || !Array.isArray(data)) {
    return { comidaCards: [], jangueoCards: [] };
  }

  const visibles = data
    .map((row) => row as Record<string, unknown>)
    .filter((record) => resolverPlanComercio(record).aparece_en_cercanos);

  const comidaSeleccionados = pickRandomItems(
    visibles.filter((record) => hasCategoria(record, CATEGORIA_RESTAURANTES_ID)),
    limit
  );
  const jangueoSeleccionados = pickRandomItems(
    visibles.filter((record) => hasCategoria(record, CATEGORIA_JANGUEO_ID)),
    limit
  );

  const ids = Array.from(
    new Set(
      [...comidaSeleccionados, ...jangueoSeleccionados]
        .map((record) => toSafeNumber(record.id))
        .filter((id) => id > 0)
    )
  );

  const imagesByComercio = await fetchComercioImages(ids);

  return {
    comidaCards: comidaSeleccionados.map((record) => toHomeComercioCard(record, imagesByComercio)),
    jangueoCards: jangueoSeleccionados.map((record) => toHomeComercioCard(record, imagesByComercio)),
  };
}

async function fetchEventos(limit = 20): Promise<HomeEventoCard[]> {
  const todayISO = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('eventos')
    .select(
      'id, nombre, descripcion, imagen, activo, costo, gratis, boletos_por_localidad, enlaceboletos, eventos_municipios ( municipio_id, lugar, direccion, enlaceboletos, eventoFechas ( fecha, horainicio, mismahora ) )'
    )
    .eq('activo', true)
    .order('creado', { ascending: false })
    .limit(30);

  if (error || !Array.isArray(data)) return [];

  const municipioIds = Array.from(
    new Set(
      data.flatMap((row) => {
        const sedes = Array.isArray((row as Record<string, unknown>).eventos_municipios)
          ? ((row as Record<string, unknown>).eventos_municipios as Record<string, unknown>[])
          : [];
        return sedes
          .map((sede) => toSafeNumber(sede.municipio_id, -1))
          .filter((id) => id > 0);
      })
    )
  );

  const municipioNombreById = new Map<number, string>();
  if (municipioIds.length > 0) {
    const { data: municipios } = await supabase
      .from('Municipios')
      .select('id, nombre')
      .in('id', municipioIds);

    (municipios || []).forEach((municipio) => {
      const record = municipio as Record<string, unknown>;
      const id = toSafeNumber(record.id, -1);
      if (id > 0) {
        municipioNombreById.set(id, normalizeString(record.nombre));
      }
    });
  }

  const normalized = data
    .map((row) => {
      const record = row as Record<string, unknown>;
      const sedes = Array.isArray(record.eventos_municipios) ? record.eventos_municipios : [];
      const eventoFechas: HomeEventoFechaItem[] = sedes.flatMap((sede) => {
        const sedeRecord = sede as Record<string, unknown>;
        const municipioIdRaw = toSafeNumber(sedeRecord.municipio_id, 0);
        const municipioId = municipioIdRaw > 0 ? municipioIdRaw : null;
        const municipioNombre = municipioId ? municipioNombreById.get(municipioId) || '' : '';
        const lugar = normalizeString(sedeRecord.lugar);
        const direccion = normalizeString(sedeRecord.direccion);
        const enlaceboletos = normalizeString(sedeRecord.enlaceboletos) || null;
        const fechaList = sedeRecord.eventoFechas;
        if (!Array.isArray(fechaList)) return [];

        return fechaList
          .map((item) => {
            const fechaRecord = item as Record<string, unknown>;
            return {
              fecha: normalizeString(fechaRecord.fecha),
              horainicio: normalizeString(fechaRecord.horainicio),
              mismahora: Boolean(fechaRecord.mismahora),
              municipioId,
              municipioNombre,
              lugar,
              direccion,
              enlaceboletos,
            } satisfies HomeEventoFechaItem;
          })
          .filter((item) => Boolean(item.fecha));
      });
      const firstFecha = eventoFechas[0];
      const dateValues = eventoFechas.map((item) => item.fecha);
      const ultimaFecha = getLatestISODate(dateValues);

      return {
        item: {
          id: toSafeNumber(record.id),
          nombre: normalizeString(record.nombre) || 'Evento',
          descripcion: normalizeString(record.descripcion),
          imageUrl: toStorageUrl(record.imagen, PLACEHOLDER_IMAGE),
          lugar: firstFecha?.lugar || 'Puerto Rico',
          direccion: firstFecha?.direccion || '',
          costo: normalizeString(record.costo),
          gratis: Boolean(record.gratis),
          boletosPorLocalidad: Boolean(record.boletos_por_localidad),
          enlaceBoletosGlobal: normalizeString(record.enlaceboletos) || null,
          eventoFechas,
        } satisfies HomeEventoCard,
        dateValues,
        ultimaFecha,
      };
    })
    .filter((entry) => !entry.ultimaFecha || entry.ultimaFecha >= todayISO)
    .sort((a, b) => {
      const byDate = compareByNearestUpcomingDate(a.dateValues, b.dateValues, todayISO);
      if (byDate !== 0) return byDate;
      return b.item.id - a.item.id;
    });

  return normalized.slice(0, limit).map((entry) => entry.item);
}

async function fetchAreas(limit = 6): Promise<HomeAreaCard[]> {
  const { data, error } = await supabase
    .from('Area')
    .select('idArea, slug, imagen, nombre, nombre_es, nombre_en, nombre_zh, nombre_fr, nombre_pt, nombre_de, nombre_it, nombre_ko, nombre_ja')
    .limit(20);

  if (error || !Array.isArray(data)) return [];

  const filtered = data.filter((row) => {
    const record = row as Record<string, unknown>;
    const slug = normalizeTextKey(record.slug);
    const nombre = normalizeTextKey(record.nombre_es || record.nombre);
    return slug !== 'islas-municipio' && nombre !== 'islas municipio';
  });

  const shuffled = [...filtered].sort(() => Math.random() - 0.5).slice(0, limit);

  return shuffled.map((row) => {
    const record = row as Record<string, unknown>;
    const labels = buildLocalizedLabels(record);
    const fallbackLabel = labels.es || normalizeString(record.nombre) || 'Area';

    return {
      idArea: toSafeNumber(record.idArea),
      slug: normalizeString(record.slug),
      labels,
      fallbackLabel,
      imageUrl: normalizeString(record.imagen) || PLACEHOLDER_AREA,
    } satisfies HomeAreaCard;
  });
}

export async function fetchHomeIndexData(): Promise<HomeIndexData> {
  const [topBanners, categories, comercioRails, eventos, areas] = await Promise.all([
    fetchGlobalBanners(),
    fetchCategories(),
    fetchComercioRails(),
    fetchEventos(),
    fetchAreas(),
  ]);

  return {
    topBanners,
    categories,
    comidaCards: comercioRails.comidaCards,
    jangueoCards: comercioRails.jangueoCards,
    eventos,
    areas,
  };
}
