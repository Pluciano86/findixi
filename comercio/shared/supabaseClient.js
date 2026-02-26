// supabaseClient.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/+esm';

const hasProcessEnv = typeof process !== 'undefined' && typeof process.env !== 'undefined';
const browserEnv = typeof window !== 'undefined' ? (window.__ENV__ || window.ENV || {}) : {};

const FALLBACK_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnamF4YW5xZmt3ZXNsa3h0YXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyNzk3NjgsImV4cCI6MjA2Mjg1NTc2OH0.Abif2Fu2uHyby--t_TAacEbjG8jCxmgsCbLx6AinT6c';

const envUrl =
  (hasProcessEnv && (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) ||
  browserEnv.SUPABASE_URL ||
  browserEnv.VITE_SUPABASE_URL ||
  browserEnv.NEXT_PUBLIC_SUPABASE_URL;

const envKey =
  (hasProcessEnv &&
    (process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) ||
  browserEnv.SUPABASE_ANON_KEY ||
  browserEnv.VITE_SUPABASE_ANON_KEY ||
  browserEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_URL = envUrl || FALLBACK_URL;
export const SUPABASE_ANON_KEY = envKey || FALLBACK_KEY;

if (!envUrl || !envKey) {
  console.warn('ℹ️ Usando credenciales Supabase embebidas (sin variables de entorno).');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('✅ Supabase client initialized');

async function runSupabaseHealthCheck() {
  try {
    const { error } = await supabase.from('Municipios').select('id').limit(1);
    if (error) {
      console.warn('⚠️ Supabase health-check falló:', error.message);
    }
  } catch (err) {
    console.warn('⚠️ Supabase health-check no se pudo completar:', err?.message || err);
  }
}

if (typeof window !== 'undefined') {
  runSupabaseHealthCheck();
}
