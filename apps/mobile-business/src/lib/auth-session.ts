import type { AuthError, Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

function isInvalidRefreshToken(error: AuthError | null): boolean {
  if (!error) return false;
  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('invalid grant')
  );
}

export async function getSessionOrReset(): Promise<Session | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (!error) return session;

  if (isInvalidRefreshToken(error)) {
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }

  throw error;
}
