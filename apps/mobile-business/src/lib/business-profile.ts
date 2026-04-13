import { resolverPlanComercio } from '@findixi/shared';

import { supabase } from './supabase';

export type BusinessProfile = {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  municipio: string;
  whatsapp: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  webpage: string;
  descripcion: string;
  categoria: string;
  plan_nivel: number | null;
  plan_nombre: string;
  updated_at: string;
};

export type BusinessHour = {
  id: number | null;
  diaSemana: number;
  apertura: string | null;
  cierre: string | null;
  cerrado: boolean;
};

export type BusinessAmenity = {
  id: number;
  nombre: string;
  icono: string | null;
};

export type BusinessInfoUpdate = {
  telefono: string | null;
  direccion: string | null;
  whatsapp: string | null;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  webpage: string | null;
  descripcion: string | null;
};

type BusinessAssignment = {
  idComercio: number;
  rol: string;
};

export type BusinessCommerceAccess = {
  idComercio: number;
  rol: string;
  profile: BusinessProfile;
};

export type BusinessAccess = {
  profile: BusinessProfile | null;
  assignmentCount: number;
  primaryComercioId: number | null;
  primaryRole: string;
  comercios: BusinessCommerceAccess[];
};

const RELATION_TABLES = ['UsuarioComercios', 'usuariocomercios'];
const RELATION_USER_COLUMNS = ['idUsuario', 'idusuario', 'id_usuario', 'user_id'];
const RELATION_COMMERCE_COLUMNS = ['idComercio', 'idcomercio', 'id_comercio', 'comercio_id'];
const OWNER_TABLES = ['Comercios', 'comercios'];
const OWNER_USER_COLUMNS = ['owner_user_id', 'ownerUserId', 'idUsuario', 'idusuario', 'id_usuario', 'user_id'];

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProfile(raw: Record<string, unknown>): BusinessProfile {
  const plan = resolverPlanComercio(raw);
  return {
    id: Number(raw.id ?? 0),
    nombre: toText(raw.nombre),
    telefono: toText(raw.telefono),
    direccion: toText(raw.direccion),
    municipio: toText(raw.municipio),
    whatsapp: toText(raw.whatsapp),
    facebook: toText(raw.facebook),
    instagram: toText(raw.instagram),
    tiktok: toText(raw.tiktok),
    webpage: toText(raw.webpage),
    descripcion: toText(raw.descripcion),
    categoria: toText(raw.categoria),
    plan_nivel: toNumber(raw.plan_nivel),
    plan_nombre: toText(raw.plan_nombre) || plan.nombre,
    updated_at: toText(raw.updated_at),
  };
}

function dedupeAssignments(assignments: BusinessAssignment[]): BusinessAssignment[] {
  const seen = new Set<number>();
  const result: BusinessAssignment[] = [];
  assignments.forEach((item) => {
    if (!Number.isFinite(item.idComercio)) return;
    if (seen.has(item.idComercio)) return;
    seen.add(item.idComercio);
    result.push(item);
  });
  return result;
}

function isMissingResourceError(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  const message = String((error as { message?: unknown } | null)?.message ?? '').toLowerCase();
  return code === '42P01' || code === '42703' || message.includes('does not exist') || message.includes('relation') || message.includes('column');
}

function readFirstNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

async function fetchAssignmentsByUser(userId: string): Promise<BusinessAssignment[]> {
  const assignments: BusinessAssignment[] = [];

  for (const relationTable of RELATION_TABLES) {
    for (const userColumn of RELATION_USER_COLUMNS) {
      for (const comercioColumn of RELATION_COMMERCE_COLUMNS) {
        const { data: relationRows, error: relationError } = await supabase
          .from(relationTable)
          .select('*')
          .eq(userColumn, userId);

        if (relationError) {
          if (isMissingResourceError(relationError)) continue;
          throw relationError;
        }

        ((relationRows || []) as unknown as Array<Record<string, unknown>>).forEach((row) => {
          const raw = row as Record<string, unknown>;
          const idComercio = Number(raw[comercioColumn]);
          if (!Number.isFinite(idComercio)) return;
          assignments.push({
            idComercio,
            rol: toText(raw.rol) || 'comercio_editor',
          });
        });
      }
    }
  }

  const ownerAssignments: BusinessAssignment[] = [];
  for (const ownerTable of OWNER_TABLES) {
    for (const ownerColumn of OWNER_USER_COLUMNS) {
      const { data: ownerRows, error: ownerError } = await supabase
        .from(ownerTable)
        .select('id')
        .eq(ownerColumn, userId);

      if (ownerError) {
        if (isMissingResourceError(ownerError)) continue;
        throw ownerError;
      }

      (ownerRows || []).forEach((row) => {
        const idComercio = readFirstNumber(row as Record<string, unknown>, ['id']);
        if (!idComercio) return;
        ownerAssignments.push({ idComercio, rol: 'comercio_admin' });
      });
    }
  }

  ownerAssignments.forEach((item) => assignments.push(item));

  const deduped = dedupeAssignments(assignments);

  if (ownerAssignments.length) {
    const payload = dedupeAssignments(ownerAssignments).map((item) => ({
      idUsuario: userId,
      idComercio: item.idComercio,
      rol: item.rol,
    }));
    for (const relationTable of RELATION_TABLES) {
      const { error: upsertError } = await supabase.from(relationTable).upsert(payload, {
        onConflict: 'idUsuario,idComercio',
      });
      if (!upsertError) break;
      if (!isMissingResourceError(upsertError)) {
        // Keep dashboard functional even if sync fails.
        console.warn('[mobile-business] No se pudo sincronizar owner -> UsuarioComercios:', upsertError.message);
      }
    }
  }

  return deduped;
}

async function fetchProfileByCommerceId(idComercio: number): Promise<BusinessProfile | null> {
  for (const ownerTable of OWNER_TABLES) {
    const { data, error } = await supabase.from(ownerTable).select('*').eq('id', idComercio).limit(1).maybeSingle();

    if (error) {
      if (isMissingResourceError(error)) continue;
      throw error;
    }

    if (data) return normalizeProfile(data as Record<string, unknown>);
  }

  return null;
}

export async function fetchBusinessAccessByUser(userId: string): Promise<BusinessAccess> {
  if (!userId) return { profile: null, assignmentCount: 0, primaryComercioId: null, primaryRole: '', comercios: [] };

  const assignments = await fetchAssignmentsByUser(userId);
  if (!assignments.length) {
    return { profile: null, assignmentCount: 0, primaryComercioId: null, primaryRole: '', comercios: [] };
  }

  const comercios: BusinessCommerceAccess[] = [];
  for (const assignment of assignments) {
    const profile = await fetchProfileByCommerceId(assignment.idComercio);
    if (profile) {
      comercios.push({
        idComercio: assignment.idComercio,
        rol: assignment.rol || '',
        profile,
      });
    }
  }

  if (comercios.length > 0) {
    return {
      profile: comercios[0].profile,
      assignmentCount: assignments.length,
      primaryComercioId: comercios[0].idComercio,
      primaryRole: comercios[0].rol || '',
      comercios,
    };
  }

  return {
    profile: null,
    assignmentCount: assignments.length,
    primaryComercioId: assignments[0]?.idComercio ?? null,
    primaryRole: assignments[0]?.rol || '',
    comercios: [],
  };
}

export async function fetchBusinessProfileByUser(userId: string): Promise<BusinessProfile | null> {
  const access = await fetchBusinessAccessByUser(userId);
  return access.profile;
}

export async function fetchBusinessLogoPath(idComercio: number): Promise<string> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) return '';

  const attempts = [
    { table: 'imagenesComercios', comercioColumn: 'idComercio' },
    { table: 'imagenesComercios', comercioColumn: 'idcomercio' },
    { table: 'imagenescomercios', comercioColumn: 'idComercio' },
    { table: 'imagenescomercios', comercioColumn: 'idcomercio' },
  ];

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from(attempt.table)
      .select('imagen')
      .eq(attempt.comercioColumn, idComercio)
      .eq('logo', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingResourceError(error)) continue;
      throw error;
    }

    const imagePath = toText((data as Record<string, unknown> | null)?.imagen);
    if (imagePath) return imagePath;
  }

  return '';
}

export async function fetchBusinessHours(idComercio: number): Promise<BusinessHour[]> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) return [];

  const attempts = [
    { table: 'Horarios', comercioColumn: 'idComercio' },
    { table: 'Horarios', comercioColumn: 'idcomercio' },
    { table: 'horarios', comercioColumn: 'idComercio' },
    { table: 'horarios', comercioColumn: 'idcomercio' },
  ];

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from(attempt.table)
      .select('id,diaSemana,apertura,cierre,cerrado')
      .eq(attempt.comercioColumn, idComercio)
      .order('diaSemana', { ascending: true });

    if (error) {
      if (isMissingResourceError(error)) continue;
      throw error;
    }

    const normalized = (Array.isArray(data) ? data : [])
      .map((row) => {
        const item = row as Record<string, unknown>;
        const diaSemana = Number(item.diaSemana);
        if (!Number.isFinite(diaSemana) || diaSemana < 0 || diaSemana > 6) return null;
        return {
          id: toNumber(item.id),
          diaSemana,
          apertura: toText(item.apertura) || null,
          cierre: toText(item.cierre) || null,
          cerrado: Boolean(item.cerrado),
        } as BusinessHour;
      })
      .filter((row): row is BusinessHour => Boolean(row))
      .sort((a, b) => a.diaSemana - b.diaSemana);

    return normalized;
  }

  return [];
}

export async function upsertBusinessHours(idComercio: number, hours: BusinessHour[]): Promise<void> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) throw new Error('Comercio inválido para guardar horario.');

  const normalizedRows = (Array.isArray(hours) ? hours : [])
    .filter((entry) => Number.isFinite(entry.diaSemana) && entry.diaSemana >= 0 && entry.diaSemana <= 6)
    .map((entry) => ({
      diaSemana: entry.diaSemana,
      apertura: entry.cerrado ? null : toText(entry.apertura) || null,
      cierre: entry.cerrado ? null : toText(entry.cierre) || null,
      cerrado: Boolean(entry.cerrado),
    }));

  const attempts = [
    { table: 'Horarios', comercioColumn: 'idComercio' },
    { table: 'Horarios', comercioColumn: 'idcomercio' },
    { table: 'horarios', comercioColumn: 'idComercio' },
    { table: 'horarios', comercioColumn: 'idcomercio' },
  ];

  for (const attempt of attempts) {
    const rows = normalizedRows.map((entry) => ({
      [attempt.comercioColumn]: idComercio,
      ...entry,
    }));
    const onConflict = `${attempt.comercioColumn},diaSemana`;
    const { error } = await supabase.from(attempt.table).upsert(rows, { onConflict });
    if (error) {
      if (isMissingResourceError(error)) continue;
      throw error;
    }
    return;
  }

  throw new Error('No se encontró la tabla de horarios para guardar cambios.');
}

export async function fetchBusinessAmenities(idComercio: number): Promise<BusinessAmenity[]> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) return [];

  const relationAttempts = [
    { table: 'comercioAmenidades', comercioColumn: 'idComercio', amenityColumn: 'idAmenidad' },
    { table: 'comercioAmenidades', comercioColumn: 'idcomercio', amenityColumn: 'idAmenidad' },
    { table: 'comercioAmenidades', comercioColumn: 'idComercio', amenityColumn: 'idamenidad' },
    { table: 'comercioAmenidades', comercioColumn: 'idcomercio', amenityColumn: 'idamenidad' },
  ];

  let ids: number[] = [];
  for (const attempt of relationAttempts) {
    const { data, error } = await supabase
      .from(attempt.table)
      .select('*')
      .eq(attempt.comercioColumn, idComercio);

    if (error) {
      if (isMissingResourceError(error)) continue;
      throw error;
    }

    ids = Array.from(
      new Set(
        (Array.isArray(data) ? data : [])
          .map((row) => Number((row as Record<string, unknown>)[attempt.amenityColumn]))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    );
    break;
  }

  if (!ids.length) return [];

  const amenityTableAttempts = ['Amenidades', 'amenidades'];
  for (const table of amenityTableAttempts) {
    const { data, error } = await supabase.from(table).select('id,nombre,icono').in('id', ids);
    if (error) {
      if (isMissingResourceError(error)) continue;
      throw error;
    }

    return (Array.isArray(data) ? data : [])
      .map((row) => {
        const item = row as Record<string, unknown>;
        const id = Number(item.id);
        if (!Number.isFinite(id) || id <= 0) return null;
        return {
          id,
          nombre: toText(item.nombre),
          icono: toText(item.icono) || null,
        } as BusinessAmenity;
      })
      .filter((entry): entry is BusinessAmenity => Boolean(entry))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  return [];
}

export async function fetchAmenitiesCatalog(): Promise<BusinessAmenity[]> {
  const amenityTableAttempts = ['Amenidades', 'amenidades'];

  for (const table of amenityTableAttempts) {
    const { data, error } = await supabase.from(table).select('id,nombre,icono').order('nombre', { ascending: true });
    if (error) {
      if (isMissingResourceError(error)) continue;
      throw error;
    }

    return (Array.isArray(data) ? data : [])
      .map((row) => {
        const item = row as Record<string, unknown>;
        const id = Number(item.id);
        if (!Number.isFinite(id) || id <= 0) return null;
        return {
          id,
          nombre: toText(item.nombre),
          icono: toText(item.icono) || null,
        } as BusinessAmenity;
      })
      .filter((entry): entry is BusinessAmenity => Boolean(entry));
  }

  return [];
}

export async function saveBusinessAmenities(idComercio: number, amenityIds: number[]): Promise<void> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) throw new Error('Comercio inválido para guardar amenidades.');

  const normalizedIds = Array.from(
    new Set((Array.isArray(amenityIds) ? amenityIds : []).filter((id) => Number.isFinite(id) && id > 0))
  );

  const relationAttempts = [
    { table: 'comercioAmenidades', comercioColumn: 'idComercio', amenityColumn: 'idAmenidad' },
    { table: 'comercioAmenidades', comercioColumn: 'idcomercio', amenityColumn: 'idAmenidad' },
    { table: 'comercioAmenidades', comercioColumn: 'idComercio', amenityColumn: 'idamenidad' },
    { table: 'comercioAmenidades', comercioColumn: 'idcomercio', amenityColumn: 'idamenidad' },
  ];

  for (const attempt of relationAttempts) {
    const { error: deleteError } = await supabase.from(attempt.table).delete().eq(attempt.comercioColumn, idComercio);
    if (deleteError) {
      if (isMissingResourceError(deleteError)) continue;
      throw deleteError;
    }

    if (!normalizedIds.length) return;

    const payload = normalizedIds.map((idAmenidad) => ({
      [attempt.comercioColumn]: idComercio,
      [attempt.amenityColumn]: idAmenidad,
    }));
    const { error: insertError } = await supabase.from(attempt.table).insert(payload);
    if (insertError) {
      if (isMissingResourceError(insertError)) continue;
      throw insertError;
    }
    return;
  }

  throw new Error('No se encontró la tabla de amenidades para guardar cambios.');
}

export async function updateBusinessInfo(idComercio: number, values: BusinessInfoUpdate): Promise<void> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) throw new Error('Comercio inválido para guardar perfil.');

  const payload: BusinessInfoUpdate = {
    telefono: toText(values.telefono) || null,
    direccion: toText(values.direccion) || null,
    whatsapp: toText(values.whatsapp) || null,
    facebook: toText(values.facebook) || null,
    instagram: toText(values.instagram) || null,
    tiktok: toText(values.tiktok) || null,
    webpage: toText(values.webpage) || null,
    descripcion: toText(values.descripcion) || null,
  };

  const tableAttempts = ['Comercios', 'comercios'];
  for (const table of tableAttempts) {
    const { error } = await supabase.from(table).update(payload).eq('id', idComercio);
    if (error) {
      if (isMissingResourceError(error)) continue;
      throw error;
    }
    return;
  }

  throw new Error('No se encontró la tabla de comercios para guardar cambios.');
}
