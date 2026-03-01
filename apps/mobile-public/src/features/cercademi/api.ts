import { supabase } from '../../lib/supabase';
import { getFavoriteComercioIds } from '../../lib/favorites';

import type { CercaCategoriaOption } from './types';

type CategoriaRow = {
  id?: number | string | null;
  nombre?: string | null;
  nombre_es?: string | null;
  nombre_en?: string | null;
  nombre_zh?: string | null;
  nombre_fr?: string | null;
  nombre_pt?: string | null;
  nombre_de?: string | null;
  nombre_it?: string | null;
  nombre_ko?: string | null;
  nombre_ja?: string | null;
};

function normalizeLang(lang: string): string {
  return String(lang || 'es').toLowerCase().split('-')[0];
}

function getLabelForLang(row: CategoriaRow, lang: string): string {
  const code = normalizeLang(lang);
  const key = `nombre_${code}` as keyof CategoriaRow;
  const translated = String(row[key] ?? '').trim();
  if (translated) return translated;
  const baseEs = String(row.nombre_es ?? '').trim();
  if (baseEs) return baseEs;
  return String(row.nombre ?? '').trim();
}

export async function fetchCercaCategorias(lang: string): Promise<CercaCategoriaOption[]> {
  const { data, error } = await supabase
    .from('Categorias')
    .select('id,nombre,nombre_es,nombre_en,nombre_zh,nombre_fr,nombre_pt,nombre_de,nombre_it,nombre_ko,nombre_ja')
    .order('nombre', { ascending: true });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => {
      const id = Number((row as CategoriaRow).id);
      if (!Number.isFinite(id) || id <= 0) return null;
      const label = getLabelForLang(row as CategoriaRow, lang);
      if (!label) return null;
      return { id, label };
    })
    .filter((row): row is CercaCategoriaOption => Boolean(row));
}

export async function fetchFavoritosRemotosOrLocal(): Promise<{ userId: string | null; ids: Set<number> }> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const userId = data?.session?.user?.id ?? null;
    if (!userId) {
      const localIds = await getFavoriteComercioIds();
      return {
        userId: null,
        ids: new Set(localIds.filter((id) => Number.isFinite(id)).map((id) => Math.trunc(id))),
      };
    }

    const { data: favoritosRows, error: favoritosError } = await supabase
      .from('favoritosusuarios')
      .select('idcomercio')
      .eq('idusuario', userId);

    if (favoritosError) throw favoritosError;

    const ids = new Set(
      (Array.isArray(favoritosRows) ? favoritosRows : [])
        .map((row) => Number((row as { idcomercio?: number | string | null }).idcomercio))
        .filter((id) => Number.isFinite(id) && id > 0)
    );

    return { userId, ids };
  } catch (error) {
    console.warn('[mobile-public] No se pudieron cargar favoritos remotos, se usa local:', error);
    const localIds = await getFavoriteComercioIds();
    return {
      userId: null,
      ids: new Set(localIds.filter((id) => Number.isFinite(id)).map((id) => Math.trunc(id))),
    };
  }
}
