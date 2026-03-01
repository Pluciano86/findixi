import { supabase } from '../../lib/supabase';

import type { EspecialComercio, EspecialGrupo, EspecialItem, EspecialTipo } from './types';

type EspecialDiaRow = {
  id?: number | string | null;
  idcomercio?: number | string | null;
  nombre?: string | null;
  descripcion?: string | null;
  precio?: number | string | null;
  tipo?: string | null;
  imagen?: string | null;
};

type ComercioRow = {
  id?: number | string | null;
  nombre?: string | null;
  nombreSucursal?: string | null;
  municipio?: string | null;
  categoria?: string | null;
  telefono?: string | null;
  latitud?: number | string | null;
  longitud?: number | string | null;
  logo?: string | null;
};

type ImagenComercioRow = {
  idComercio?: number | string | null;
  imagen?: string | null;
};

type ImagenEspecialRow = {
  idEspecial?: number | string | null;
  imagen?: string | null;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toPublicStorageUrl(pathOrUrl: string | null | undefined, bucket = 'galeriacomercios'): string | null {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const cleanPath = raw.replace(/^public\//i, '').replace(/^\/+/, '');
  return supabase.storage.from(bucket).getPublicUrl(cleanPath).data.publicUrl;
}

function normalizeTipo(value: unknown): EspecialTipo {
  return String(value ?? '').trim().toLowerCase() === 'happyhour' ? 'happyhour' : 'almuerzo';
}

function normalizeComercio(row: ComercioRow, fallbackId: number): EspecialComercio {
  const id = Number(row.id);
  return {
    id: Number.isFinite(id) && id > 0 ? id : fallbackId,
    nombre: String(row.nombre ?? row.nombreSucursal ?? '').trim() || 'Comercio',
    municipio: String(row.municipio ?? '').trim(),
    categoria: String(row.categoria ?? '').trim(),
    telefono: String(row.telefono ?? '').trim(),
    latitud: toFiniteNumber(row.latitud),
    longitud: toFiniteNumber(row.longitud),
    logoUrl: toPublicStorageUrl(row.logo),
  };
}

export async function fetchEspecialesDelDia(diaSemana = new Date().getDay()): Promise<EspecialGrupo[]> {
  const safeDay = Number(diaSemana);
  if (!Number.isFinite(safeDay) || safeDay < 0 || safeDay > 6) return [];

  const { data: especialesRaw, error: especialesError } = await supabase
    .from('especialesDia')
    .select('id,nombre,descripcion,precio,tipo,diasemana,imagen,activo,idcomercio')
    .eq('activo', true)
    .eq('diasemana', safeDay);

  if (especialesError) throw especialesError;

  const especialesRows = (Array.isArray(especialesRaw) ? especialesRaw : []) as EspecialDiaRow[];
  if (especialesRows.length === 0) return [];

  const comercioIds = Array.from(
    new Set(
      especialesRows
        .map((row) => Number(row.idcomercio))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  if (comercioIds.length === 0) return [];

  const [comerciosRes, logosRes, imagenesEspecialRes] = await Promise.all([
    supabase
      .from('Comercios')
      .select('id,nombre,nombreSucursal,municipio,categoria,telefono,latitud,longitud,logo')
      .in('id', comercioIds),
    supabase.from('imagenesComercios').select('idComercio,imagen').eq('logo', true).in('idComercio', comercioIds),
    supabase
      .from('imgEspeciales')
      .select('idEspecial,imagen')
      .in(
        'idEspecial',
        especialesRows
          .map((row) => Number(row.id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
  ]);

  if (comerciosRes.error) throw comerciosRes.error;
  if (logosRes.error) throw logosRes.error;

  const comerciosMap = new Map<number, EspecialComercio>();
  ((Array.isArray(comerciosRes.data) ? comerciosRes.data : []) as ComercioRow[]).forEach((row) => {
    const id = Number(row.id);
    if (!Number.isFinite(id) || id <= 0) return;
    comerciosMap.set(id, normalizeComercio(row, id));
  });

  const fallbackLogos = new Map<number, string | null>();
  ((Array.isArray(logosRes.data) ? logosRes.data : []) as ImagenComercioRow[]).forEach((row) => {
    const idComercio = Number(row.idComercio);
    if (!Number.isFinite(idComercio) || idComercio <= 0) return;
    if (fallbackLogos.has(idComercio)) return;
    fallbackLogos.set(idComercio, toPublicStorageUrl(row.imagen));
  });

  const especialImagenMap = new Map<number, string | null>();
  if (!imagenesEspecialRes.error) {
    ((Array.isArray(imagenesEspecialRes.data) ? imagenesEspecialRes.data : []) as ImagenEspecialRow[]).forEach((row) => {
      const idEspecial = Number(row.idEspecial);
      if (!Number.isFinite(idEspecial) || idEspecial <= 0) return;
      if (especialImagenMap.has(idEspecial)) return;
      especialImagenMap.set(idEspecial, toPublicStorageUrl(row.imagen));
    });
  }

  const groupedMap = new Map<number, EspecialGrupo>();

  especialesRows.forEach((row) => {
    const comercioId = Number(row.idcomercio);
    const id = Number(row.id);
    if (!Number.isFinite(comercioId) || comercioId <= 0) return;
    if (!Number.isFinite(id) || id <= 0) return;

    if (!groupedMap.has(comercioId)) {
      const base = comerciosMap.get(comercioId) ?? {
        id: comercioId,
        nombre: 'Comercio',
        municipio: '',
        categoria: '',
        telefono: '',
        latitud: null,
        longitud: null,
        logoUrl: null,
      };
      groupedMap.set(comercioId, {
        comercio: {
          ...base,
          logoUrl: base.logoUrl || fallbackLogos.get(comercioId) || null,
        },
        especiales: [],
      });
    }

    const precio = toFiniteNumber(row.precio);
    const especial: EspecialItem = {
      id,
      idComercio: comercioId,
      tipo: normalizeTipo(row.tipo),
      nombre: String(row.nombre ?? '').trim() || 'Especial',
      descripcion: String(row.descripcion ?? '').trim(),
      precio,
      imagenUrl: toPublicStorageUrl(row.imagen) || especialImagenMap.get(id) || null,
    };

    groupedMap.get(comercioId)?.especiales.push(especial);
  });

  return Array.from(groupedMap.values()).sort((a, b) => a.comercio.nombre.localeCompare(b.comercio.nombre, 'es'));
}
