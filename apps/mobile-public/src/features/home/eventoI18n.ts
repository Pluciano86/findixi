import type { HomeEventoCard } from './types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../config/env';
import { supabase } from '../../lib/supabase';

type EventoTranslationRow = {
  idevento: number;
  lang: string;
  nombre?: string | null;
  descripcion?: string | null;
  lugar?: string | null;
  direccion?: string | null;
  costo?: string | null;
};

const SUPPORTED_LANGS = ['es', 'en', 'fr', 'de', 'pt', 'it', 'zh', 'ko', 'ja'] as const;
const translationCache = new Map<string, EventoTranslationRow>();
const pending = new Map<string, Promise<EventoTranslationRow | null>>();
const ENDPOINT = `${SUPABASE_URL}/functions/v1/translate-evento`;

function normalizeLang(lang: string): string {
  return (lang || 'es').toLowerCase().split('-')[0];
}

function cacheKey(id: number, lang: string): string {
  return `${id}:${lang}`;
}

function remember(translation: EventoTranslationRow | null | undefined): void {
  if (!translation?.idevento || !translation?.lang) return;
  translationCache.set(cacheKey(translation.idevento, translation.lang), translation);
}

function mergeEventoConTraduccion(evento: HomeEventoCard, translation: EventoTranslationRow | null): HomeEventoCard {
  if (!translation) return evento;
  return {
    ...evento,
    nombre: translation.nombre ?? evento.nombre,
    descripcion: translation.descripcion ?? evento.descripcion,
    lugar: translation.lugar ?? evento.lugar,
    direccion: translation.direccion ?? evento.direccion,
    costo: translation.costo ?? evento.costo,
  };
}

async function fetchFromFunction(idevento: number, lang: string): Promise<EventoTranslationRow | null> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ idEvento: idevento, lang }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = await response.json().catch(() => ({}));
  const data = (payload?.data || payload?.translation || null) as Record<string, unknown> | null;
  if (!data) return null;

  return {
    idevento,
    lang,
    nombre: typeof data.nombre === 'string' ? data.nombre : null,
    descripcion: typeof data.descripcion === 'string' ? data.descripcion : null,
    lugar: typeof data.lugar === 'string' ? data.lugar : null,
    direccion: typeof data.direccion === 'string' ? data.direccion : null,
    costo: typeof data.costo === 'string' ? data.costo : null,
  };
}

export async function preloadEventoTraducciones(eventIds: number[] = [], lang = 'es'): Promise<void> {
  const langNorm = normalizeLang(lang);
  if (langNorm === 'es' || !eventIds.length) return;

  const missingIds = eventIds.filter(
    (id) => !translationCache.has(cacheKey(id, langNorm)) && !pending.has(cacheKey(id, langNorm))
  );
  if (!missingIds.length) return;

  const { data, error } = await supabase
    .from('eventos_traducciones')
    .select('idevento, lang, nombre, descripcion, lugar, direccion, costo')
    .eq('lang', langNorm)
    .in('idevento', missingIds);

  if (error) {
    console.warn('[mobile-public] preloadEventoTraducciones error:', error.message);
    return;
  }

  (data || []).forEach((row) => remember(row as EventoTranslationRow));
}

export async function getEventoI18n(evento: HomeEventoCard, lang = 'es'): Promise<HomeEventoCard> {
  if (!evento?.id) return evento;

  const langNorm = normalizeLang(lang);
  if (langNorm === 'es' || !SUPPORTED_LANGS.includes(langNorm as (typeof SUPPORTED_LANGS)[number])) {
    return evento;
  }

  const key = cacheKey(evento.id, langNorm);
  if (translationCache.has(key)) {
    return mergeEventoConTraduccion(evento, translationCache.get(key) || null);
  }

  if (pending.has(key)) {
    const existing = await pending.get(key)?.catch(() => null);
    return mergeEventoConTraduccion(evento, existing || null);
  }

  const promise = (async () => {
    const { data, error } = await supabase
      .from('eventos_traducciones')
      .select('idevento, lang, nombre, descripcion, lugar, direccion, costo')
      .eq('idevento', evento.id)
      .eq('lang', langNorm)
      .maybeSingle();

    if (error) {
      console.warn('[mobile-public] getEventoI18n cache read error:', error.message);
    }

    if (data) {
      const typed = data as EventoTranslationRow;
      remember(typed);
      return typed;
    }

    const translated = await fetchFromFunction(evento.id, langNorm);
    remember(translated);
    return translated;
  })()
    .catch((err) => {
      console.warn('[mobile-public] getEventoI18n error:', err instanceof Error ? err.message : String(err));
      return null;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, promise);
  const translation = await promise;
  return mergeEventoConTraduccion(evento, translation);
}
