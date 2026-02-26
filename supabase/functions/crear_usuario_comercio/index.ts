// Edge Function: crear_usuario_comercio
// Crea un usuario en Auth, lo registra en public.usuarios y asigna comercios en public."UsuarioComercios".
// Incluye CORS con whitelist y maneja preflight OPTIONS.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Payload = {
  nombre?: string;
  email?: string;
  password?: string;
  comercios?: number[];
  forzarCambio?: boolean;
  force_password_change?: boolean;
};

const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://admin.enpe-erre.com',
  'https://comercio.enpe-erre.com'
]);

function buildCors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
    'Access-Control-Allow-Credentials': 'true'
  };
}

function jsonResponse(body: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...buildCors(req)
    }
  });
}

function authFail(req: Request, message = 'No autorizado') {
  return jsonResponse({ ok: false, message }, 401, req);
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: buildCors(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Método no permitido' }, 405, req);
  }

  // Auth simple: se acepta cualquier Authorization presente (anon o service),
  // o x-admin-key configurado en variable de entorno.
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7)
    : authHeader;
  const adminHeader = req.headers.get('x-admin-key') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const internalKey = Deno.env.get('ADMIN_INTERNAL_KEY') || '';

  const hasAnyAuth = authHeader.trim().length > 0;

  if (!hasAnyAuth && !(token && token === serviceKey) && !(adminHeader && adminHeader === internalKey)) {
    return authFail(req);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = serviceKey;
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ ok: false, message: 'Faltan variables de entorno' }, 500, req);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch (_e) {
    return jsonResponse({ ok: false, message: 'JSON inválido' }, 400, req);
  }

  const nombre = (payload.nombre || '').trim();
  const email = (payload.email || '').trim();
  const password = payload.password || '';
  const comercios = Array.isArray(payload.comercios) ? payload.comercios : [];
  const forceChange = payload.forzarCambio ?? payload.force_password_change ?? false;

  if (!nombre) return jsonResponse({ ok: false, message: 'Nombre requerido' }, 400, req);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return jsonResponse({ ok: false, message: 'Email inválido' }, 400, req);
  if (password.length < 6) return jsonResponse({ ok: false, message: 'Password demasiado corto' }, 400, req);

  // Crear usuario en Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nombre,
      force_password_change: forceChange === true
    }
  });

  if (authError || !authData?.user) {
    return jsonResponse({ ok: false, message: authError?.message || 'Error creando usuario' }, 400, req);
  }

  const userId = authData.user.id;

  // Upsert en public.usuarios
  const { error: perfilError } = await supabase
    .from('usuarios')
    .upsert({
      id: userId,
      nombre,
      email,
      creado_en: new Date().toISOString()
    }, { onConflict: 'id' });

  if (perfilError) {
    return jsonResponse({ ok: false, message: perfilError.message || 'Error guardando perfil' }, 400, req);
  }

  // Asignar comercios si vienen
  if (comercios.length) {
    const registros = comercios.map((idComercio) => ({
      idUsuario: userId,
      idComercio,
      rol: 'dueno'
    }));

    const { error: asignacionError } = await supabase
      .from('UsuarioComercios')
      .upsert(registros, { onConflict: 'idUsuario,idComercio' });

    if (asignacionError) {
      return jsonResponse({ ok: false, message: asignacionError.message || 'Error asignando comercios' }, 400, req);
    }
  }

  return jsonResponse({ ok: true, user_id: userId }, 200, req);
});
