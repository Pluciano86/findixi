function readRequiredEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error('[mobile-public] Missing Supabase env variables');
  }
  return value;
}

function readOptionalEnv(name: string): string {
  const value = process.env[name]?.trim();
  return value || '';
}

export const SUPABASE_URL: string = readRequiredEnv('EXPO_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY: string = readRequiredEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
export const OPENWEATHER_API_KEY: string = readOptionalEnv('EXPO_PUBLIC_OPENWEATHER_API_KEY');
