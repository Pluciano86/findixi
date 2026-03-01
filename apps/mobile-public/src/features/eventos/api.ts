import { getLatestISODate } from '@findixi/shared';

import type { LanguageCode } from '../../i18n/languages';
import { supabase } from '../../lib/supabase';
import type { HomeEventoFechaItem } from '../home/types';
import type { EventoListadoItem, EventoMunicipioOption, EventoOption, ListadoEventosData } from './types';

const PLACEHOLDER_IMAGE = 'https://placehold.co/560x700?text=Evento';

function normalizeString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLangCode(lang: string): string {
  return String(lang || 'es').toLowerCase().split('-')[0];
}

function normalizeImageUrl(value: unknown): string {
  const url = normalizeString(value);
  if (!url) return PLACEHOLDER_IMAGE;
  if (/^https?:\/\//i.test(url)) return url;
  return url;
}

async function fetchMunicipios(): Promise<Map<number, string>> {
  const { data, error } = await supabase.from('Municipios').select('id,nombre').order('nombre', { ascending: true });
  if (error || !Array.isArray(data)) return new Map<number, string>();

  const output = new Map<number, string>();
  data.forEach((row) => {
    const record = row as Record<string, unknown>;
    const id = toSafeNumber(record.id, -1);
    if (id <= 0) return;
    output.set(id, normalizeString(record.nombre));
  });

  return output;
}

async function fetchCategorias(lang: LanguageCode): Promise<Map<number, { nombre: string; icono: string }>> {
  const langCode = normalizeLangCode(lang);
  const column = `nombre_${langCode}`;
  const { data: rawData } = await supabase
    .from('categoriaEventos')
    .select('id,nombre,icono,nombre_es,nombre_en,nombre_zh,nombre_fr,nombre_pt,nombre_de,nombre_it,nombre_ko,nombre_ja')
    .order('nombre', { ascending: true });

  const data = (rawData as Array<Record<string, unknown>>) || [];

  const output = new Map<number, { nombre: string; icono: string }>();
  data.forEach((record) => {
    const id = toSafeNumber(record.id, -1);
    if (id <= 0) return;
    const localized = normalizeString(record[column]);
    output.set(id, {
      nombre: localized || normalizeString(record.nombre),
      icono: normalizeString(record.icono),
    });
  });

  return output;
}

function sortFechas(fechas: HomeEventoFechaItem[]): HomeEventoFechaItem[] {
  return [...fechas].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function toEventoFechaItems(
  sedes: unknown[],
  municipiosById: Map<number, string>
): { fechas: HomeEventoFechaItem[]; municipioIds: number[] } {
  const fechas: HomeEventoFechaItem[] = [];
  const municipioIds = new Set<number>();

  sedes.forEach((sede) => {
    const sedeRecord = sede as Record<string, unknown>;
    const municipioRaw = toSafeNumber(sedeRecord.municipio_id, 0);
    const municipioId = municipioRaw > 0 ? municipioRaw : null;
    if (municipioId) municipioIds.add(municipioId);

    const municipioNombre = municipioId ? municipiosById.get(municipioId) || '' : '';
    const lugar = normalizeString(sedeRecord.lugar);
    const direccion = normalizeString(sedeRecord.direccion);
    const enlaceboletos = normalizeString(sedeRecord.enlaceboletos) || null;
    const fechaList = Array.isArray(sedeRecord.eventoFechas) ? sedeRecord.eventoFechas : [];

    fechaList.forEach((fechaItem) => {
      const fechaRecord = fechaItem as Record<string, unknown>;
      const fecha = normalizeString(fechaRecord.fecha);
      if (!fecha) return;

      fechas.push({
        fecha,
        horainicio: normalizeString(fechaRecord.horainicio),
        mismahora: Boolean(fechaRecord.mismahora),
        municipioId,
        municipioNombre,
        lugar,
        direccion,
        enlaceboletos,
      });
    });
  });

  return {
    fechas: sortFechas(fechas),
    municipioIds: Array.from(municipioIds),
  };
}

export async function fetchListadoEventosData(lang: LanguageCode): Promise<ListadoEventosData> {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [municipiosById, categoriasById] = await Promise.all([fetchMunicipios(), fetchCategorias(lang)]);

  const { data, error } = await supabase
    .from('eventos')
    .select(
      'id,nombre,descripcion,costo,gratis,boletos_por_localidad,enlaceboletos,imagen,categoria,activo,eventos_municipios(id,municipio_id,lugar,direccion,enlaceboletos,eventoFechas(id,fecha,horainicio,mismahora))'
    )
    .eq('activo', true);

  if (error || !Array.isArray(data)) {
    throw new Error(error?.message || 'No se pudieron cargar los eventos');
  }

  const eventos = data
    .map((row) => {
      const record = row as Record<string, unknown>;
      const sedes = Array.isArray(record.eventos_municipios) ? record.eventos_municipios : [];
      const categoriaIdRaw = toSafeNumber(record.categoria, 0);
      const categoriaId = categoriaIdRaw > 0 ? categoriaIdRaw : null;
      const categoria = categoriaId ? categoriasById.get(categoriaId) : undefined;
      const { fechas, municipioIds } = toEventoFechaItems(sedes, municipiosById);

      const ultimaFecha = getLatestISODate(fechas.map((item) => item.fecha));
      if (ultimaFecha && ultimaFecha < todayISO) return null;

      const firstFecha = fechas[0];

      return {
        id: toSafeNumber(record.id),
        nombre: normalizeString(record.nombre) || 'Evento',
        descripcion: normalizeString(record.descripcion),
        imageUrl: normalizeImageUrl(record.imagen),
        lugar: firstFecha?.lugar || '',
        direccion: firstFecha?.direccion || '',
        costo: normalizeString(record.costo),
        gratis: Boolean(record.gratis),
        boletosPorLocalidad: Boolean(record.boletos_por_localidad),
        enlaceBoletosGlobal: normalizeString(record.enlaceboletos) || null,
        eventoFechas: fechas,
        categoriaId,
        categoriaNombre: categoria?.nombre || '',
        categoriaIcono: categoria?.icono || '',
        municipioIds,
        ultimaFecha,
      } satisfies EventoListadoItem;
    })
    .filter((item): item is EventoListadoItem => Boolean(item));

  const municipios: EventoMunicipioOption[] = Array.from(municipiosById.entries()).map(([id, nombre]) => ({
    value: String(id),
    label: nombre,
  }));

  const categorias: EventoOption[] = Array.from(categoriasById.entries()).map(([id, value]) => ({
    value: String(id),
    label: value.nombre || '',
    iconName: value.icono || '',
  }));

  return {
    eventos,
    municipios,
    categorias,
  } satisfies ListadoEventosData;
}
