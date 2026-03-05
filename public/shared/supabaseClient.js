import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/+esm';

const hasProcessEnv = typeof process !== 'undefined' && typeof process.env !== 'undefined';
const browserEnv = typeof window !== 'undefined' ? (window.__ENV__ || window.ENV || {}) : {};
const FALLBACK_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnamF4YW5xZmt3ZXNsa3h0YXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyNzk3NjgsImV4cCI6MjA2Mjg1NTc2OH0.Abif2Fu2uHyby--t_TAacEbjG8jCxmgsCbLx6AinT6c';

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).origin.replace(/\/+$/, '');
  } catch (_error) {
    return '';
  }
}

function readFirstEnv(keys = []) {
  for (const key of keys) {
    const browserValue = browserEnv[key];
    if (typeof browserValue === 'string' && browserValue.trim()) return browserValue.trim();
  }

  if (hasProcessEnv) {
    for (const key of keys) {
      const processValue = process.env[key];
      if (typeof processValue === 'string' && processValue.trim()) return processValue.trim();
    }
  }

  return '';
}

function readFirstLocalStorage(keys = []) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return '';
  for (const key of keys) {
    const storageValue = localStorage.getItem(key);
    if (typeof storageValue === 'string' && storageValue.trim()) return storageValue.trim();
  }
  return '';
}

function isLocalHostRuntime() {
  if (typeof window === 'undefined') return false;
  const host = String(window.location.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isLikelyNetlifyDevRuntime() {
  if (typeof window === 'undefined') return false;
  const port = String(window.location.port || '');
  return port === '8888' || port === '8889';
}

async function fetchRuntimeSupabaseConfig() {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return { url: '', key: '' };
  }

  if (isLocalHostRuntime() && !isLikelyNetlifyDevRuntime()) {
    const localUrl = normalizeBaseUrl(
      readFirstLocalStorage(['SUPABASE_URL', 'FINDIXI_SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'])
    );
    const localKey = readFirstLocalStorage([
      'SUPABASE_ANON_KEY',
      'SUPABASE_KEY',
      'FINDIXI_SUPABASE_ANON_KEY',
      'VITE_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]);
    return { url: localUrl, key: localKey };
  }

  const endpoints = ['/.netlify/functions/supabase-browser-config', '/api/supabase-browser-config'];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) continue;
      const payload = await response.json();
      const url = normalizeBaseUrl(payload?.supabaseUrl || payload?.url || '');
      const key = String(payload?.supabaseAnonKey || payload?.anonKey || '').trim();
      if (url && key) return { url, key };
    } catch (_error) {
      // Intentar siguiente endpoint.
    }
  }

  return { url: '', key: '' };
}

const envUrl = normalizeBaseUrl(
  readFirstEnv([
    'SUPABASE_URL',
    'FINDIXI_SUPABASE_URL',
    'VITE_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
  ])
);

const envKey = readFirstEnv([
  'SUPABASE_ANON_KEY',
  'SUPABASE_KEY',
  'FINDIXI_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]);

let runtimeConfig = { url: '', key: '' };
if (!envUrl || !envKey) {
  runtimeConfig = await fetchRuntimeSupabaseConfig();
}

export const SUPABASE_URL = envUrl || runtimeConfig.url || FALLBACK_URL;
export const SUPABASE_ANON_KEY = envKey || runtimeConfig.key || FALLBACK_KEY;
const hasRuntimeConfig = Boolean(runtimeConfig.url && runtimeConfig.key);

if ((!envUrl || !envKey) && !hasRuntimeConfig && typeof console !== 'undefined') {
  console.warn(
    '[Findixi] Usando fallback de Supabase. Para override: window.__ENV__ o /.netlify/functions/supabase-browser-config.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
