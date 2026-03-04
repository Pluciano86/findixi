import { resolverPlanComercio } from '@findixi/shared';

import { supabase } from './supabase';

export type BusinessProfile = {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  municipio: string;
  plan_nivel: number | null;
  plan_nombre: string;
  updated_at: string;
};

const PROFILE_COLUMNS = 'id,nombre,telefono,direccion,municipio,plan_nivel,plan_nombre,updated_at';
const USER_LINK_COLUMNS = ['idUsuario', 'idusuario', 'id_usuario', 'user_id'];

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
    plan_nivel: toNumber(raw.plan_nivel),
    plan_nombre: toText(raw.plan_nombre) || plan.nombre,
    updated_at: toText(raw.updated_at),
  };
}

function isMissingColumnError(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  const message = String((error as { message?: unknown } | null)?.message ?? '').toLowerCase();
  return code === '42703' || message.includes('column') || message.includes('does not exist');
}

export async function fetchBusinessProfileByUser(userId: string): Promise<BusinessProfile | null> {
  if (!userId) return null;

  for (const userColumn of USER_LINK_COLUMNS) {
    const { data, error } = await supabase
      .from('comercios')
      .select(PROFILE_COLUMNS)
      .eq(userColumn, userId)
      .limit(1)
      .maybeSingle();

    if (error && !isMissingColumnError(error)) {
      throw error;
    }

    if (data) {
      return normalizeProfile(data as Record<string, unknown>);
    }
  }

  return null;
}
