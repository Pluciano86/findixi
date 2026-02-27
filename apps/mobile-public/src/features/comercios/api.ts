import { supabase } from '../../lib/supabase';

import type { ComercioListItem, ComercioRow } from './types';

const COMERCIOS_SELECT =
  'id,nombre,municipio,direccion,telefono,latitud,longitud,logo,portada,descripcion,plan_id,plan_nivel,plan_nombre,plan_status,permite_perfil,aparece_en_cercanos,permite_menu,permite_especiales,permite_ordenes,estado_propiedad,estado_verificacion,propietario_verificado,activo';

function normalizeComercio(row: Partial<ComercioRow>): ComercioRow {
  return {
    id: Number(row.id ?? 0),
    nombre: String(row.nombre ?? '').trim(),
    municipio: row.municipio ?? null,
    direccion: row.direccion ?? null,
    telefono: row.telefono ?? null,
    latitud: typeof row.latitud === 'number' ? row.latitud : row.latitud ? Number(row.latitud) : null,
    longitud: typeof row.longitud === 'number' ? row.longitud : row.longitud ? Number(row.longitud) : null,
    logo: row.logo ?? null,
    portada: row.portada ?? null,
    descripcion: row.descripcion ?? null,
    plan_id: row.plan_id ?? null,
    plan_nivel: row.plan_nivel ?? null,
    plan_nombre: row.plan_nombre ?? null,
    plan_status: row.plan_status ?? null,
    permite_perfil: row.permite_perfil ?? null,
    aparece_en_cercanos: row.aparece_en_cercanos ?? null,
    permite_menu: row.permite_menu ?? null,
    permite_especiales: row.permite_especiales ?? null,
    permite_ordenes: row.permite_ordenes ?? null,
    estado_propiedad: row.estado_propiedad ?? null,
    estado_verificacion: row.estado_verificacion ?? null,
    propietario_verificado: row.propietario_verificado ?? null,
    activo: row.activo ?? null,
  };
}

export async function fetchComercios(limit = 100): Promise<ComercioListItem[]> {
  const probe = await supabase.from('Comercios').select('id').limit(1);

  console.log('[mobile-public][fetchComercios][probe]', {
    dataLen: Array.isArray(probe.data) ? probe.data.length : null,
    error: probe.error
      ? {
          message: probe.error.message,
          details: probe.error.details,
          hint: probe.error.hint,
          code: probe.error.code,
        }
      : null,
  });

  if (probe.error) throw probe.error;

  const { data, error } = await supabase
    .from('Comercios')
    .select(COMERCIOS_SELECT)
    .order('nombre', { ascending: true })
    .limit(limit);

  console.log('[mobile-public][fetchComercios][full]', {
    dataLen: Array.isArray(data) ? data.length : null,
    error: error
      ? {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        }
      : null,
  });

  if (error) throw error;

  return (data ?? [])
    .map((row) => normalizeComercio(row as Partial<ComercioRow>))
    .filter((row) => row.id > 0 && row.nombre.length > 0);
}

export async function fetchComercioById(id: number): Promise<ComercioRow | null> {
  const { data, error } = await supabase
    .from('Comercios')
    .select(COMERCIOS_SELECT)
    .eq('id', id)
    .maybeSingle();

  console.log('[mobile-public][fetchComercioById]', {
    id,
    hasData: Boolean(data),
    error: error
      ? {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        }
      : null,
  });

  if (error) throw error;
  if (!data) return null;

  return normalizeComercio(data as Partial<ComercioRow>);
}
