import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createOtpProvider } from './otpProvider.js';

const OTP_EXPIRY_MINUTES = 10;
const OTP_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_LIMIT_COMERCIO_HOUR = 5;
const OTP_LIMIT_IP_HOUR = 10;
const OTP_LIMIT_USER_HOUR = 10;

const VALID_PURPOSES = new Set(['owner_verification', 'phone_change', 'user_login']);
const VALID_CHANNEL_PREFS = new Set(['auto', 'sms', 'voice']);

export function buildHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    ...extra,
  };
}

export function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  };
}

export function parseBody(event) {
  if (!event?.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (_error) {
    return null;
  }
}

function envText(key, fallback = '') {
  const runtimeValue = String(process.env[key] || '').trim();
  if (runtimeValue) return runtimeValue;

  const localValue = readLocalEnvValue(key);
  if (localValue) {
    process.env[key] = localValue;
    return localValue;
  }

  return String(fallback).trim();
}

function readLocalEnvValue(targetKey) {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env.local'),
    path.resolve(process.cwd(), '..', '.env'),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    let fileContent = '';
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } catch (_error) {
      continue;
    }

    const lines = fileContent.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;

      const idx = line.indexOf('=');
      const key = line.slice(0, idx).trim();
      if (key !== targetKey) continue;

      let value = line.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value) return value;
    }
  }

  return '';
}

export function createSupabaseAdmin() {
  const supabaseUrl = envText('SUPABASE_URL');
  const serviceRole = envText('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para OTP backend.');
  }
  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function extractRequesterIp(event) {
  const candidates = [
    event?.headers?.['x-nf-client-connection-ip'],
    event?.headers?.['x-forwarded-for'],
    event?.headers?.['client-ip'],
    event?.headers?.['x-real-ip'],
  ].filter(Boolean);
  const raw = String(candidates[0] || '').split(',')[0].trim();
  if (!raw) return null;
  const isIPv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(raw);
  const isIPv6 = /^[a-fA-F0-9:]+$/.test(raw) && raw.includes(':');
  return isIPv4 || isIPv6 ? raw : null;
}

export function parseBearerToken(event) {
  const header = event?.headers?.authorization || event?.headers?.Authorization || '';
  if (!header || !header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

export async function requireAuthUser(event, supabaseAdmin) {
  const token = parseBearerToken(event);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export function normalizePhone(phoneRaw) {
  const raw = String(phoneRaw || '').trim();
  if (!raw) return '';
  const plusPrefixed = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (plusPrefixed) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.startsWith('00') && digits.length > 4) return `+${digits.slice(2)}`;
  return `+${digits}`;
}

export function maskPhone(phoneRaw) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return '***';
  const tail = phone.slice(-4);
  return `***${tail}`;
}

export function generateOtpCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

export function hashOtpCode(challengeId, code) {
  const secret = envText('OTP_HASH_SECRET', 'findixi-otp-secret-change-me');
  return crypto
    .createHash('sha256')
    .update(`${challengeId}:${code}:${secret}`)
    .digest('hex');
}

export function sanitizePurpose(raw) {
  const value = String(raw || 'owner_verification').trim().toLowerCase();
  return VALID_PURPOSES.has(value) ? value : 'owner_verification';
}

export function sanitizeChannelPreference(raw) {
  const value = String(raw || 'auto').trim().toLowerCase();
  return VALID_CHANNEL_PREFS.has(value) ? value : 'auto';
}

function nowIso() {
  return new Date().toISOString();
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000).toISOString();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000).toISOString();
}

function parseMissingColumn(error) {
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  const source = `${message} ${details}`;
  const match =
    source.match(/column\s+"([a-zA-Z0-9_]+)"\s+does not exist/i) ||
    source.match(/Could not find the '([a-zA-Z0-9_]+)' column/i);
  return match?.[1] || null;
}

async function countRecentChallenges(supabaseAdmin, filters, sinceIso) {
  let query = supabaseAdmin
    .from('otp_challenges')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso);

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    query = query.eq(key, value);
  });

  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

async function findLatestPendingChallenge(supabaseAdmin, { idComercio, purpose, requesterUserId }) {
  const { data, error } = await supabaseAdmin
    .from('otp_challenges')
    .select('*')
    .eq('idComercio', idComercio)
    .eq('purpose', purpose)
    .eq('status', 'pending')
    .eq('requester_user_id', requesterUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function expirePendingChallenges(supabaseAdmin, { idComercio, purpose, requesterUserId }) {
  const { error } = await supabaseAdmin
    .from('otp_challenges')
    .update({
      status: 'expired',
      last_error: 'Replaced by resend',
    })
    .eq('idComercio', idComercio)
    .eq('purpose', purpose)
    .eq('status', 'pending')
    .eq('requester_user_id', requesterUserId);
  if (error) throw error;
}

async function fetchComercioForOtp(supabaseAdmin, idComercio) {
  let columns = [
    'id',
    'owner_user_id',
    'estado_verificacion',
    'estado_propiedad',
    'telefono_referencia_google',
    'telefono_publico',
    'telefono',
  ];

  for (let i = 0; i < 12; i += 1) {
    const selectClause = columns.join(', ');
    const { data, error } = await supabaseAdmin
      .from('Comercios')
      .select(selectClause)
      .eq('id', idComercio)
      .maybeSingle();

    if (!error) return data || null;

    const missing = parseMissingColumn(error);
    if (missing && columns.includes(missing)) {
      columns = columns.filter((col) => col !== missing);
      if (!columns.length) return null;
      continue;
    }

    throw error;
  }

  return null;
}

function resolveDestinationPhone({ comercio, purpose, explicitPhone }) {
  if (purpose === 'phone_change') {
    return normalizePhone(explicitPhone || comercio?.telefono_publico);
  }
  if (purpose === 'user_login') {
    return normalizePhone(explicitPhone);
  }
  return normalizePhone(
    comercio?.telefono_referencia_google || explicitPhone || comercio?.telefono_publico || comercio?.telefono
  );
}

function otpMessage(code) {
  return `Tu código de verificación Findixi es ${code}. Expira en ${OTP_EXPIRY_MINUTES} minutos.`;
}

async function safeUpdateComercio(supabaseAdmin, idComercio, payload) {
  let body = { ...payload };
  for (let i = 0; i < 12; i += 1) {
    const { error } = await supabaseAdmin.from('Comercios').update(body).eq('id', idComercio);
    if (!error) return { payload: body };

    const missing = parseMissingColumn(error);
    if (missing && Object.prototype.hasOwnProperty.call(body, missing)) {
      delete body[missing];
      continue;
    }
    throw error;
  }
  return { payload: body };
}

async function ensureUsuarioComercioLink(supabaseAdmin, { userId, idComercio, rol = 'comercio_admin' }) {
  const comercioId = Number(idComercio || 0);
  if (!userId || !Number.isFinite(comercioId) || comercioId <= 0) return;

  const payload = {
    idUsuario: userId,
    idComercio: comercioId,
    rol,
  };

  const { error: upsertError } = await supabaseAdmin
    .from('UsuarioComercios')
    .upsert(payload, { onConflict: 'idUsuario,idComercio' });

  if (!upsertError) return;

  const msg = String(upsertError?.message || '');
  const maybeConflict =
    upsertError?.code === '23505' ||
    msg.toLowerCase().includes('duplicate key') ||
    msg.toLowerCase().includes('already exists');
  if (maybeConflict) return;

  const conflictTargetMissing =
    upsertError?.code === '42P10' ||
    msg.toLowerCase().includes('there is no unique') ||
    msg.toLowerCase().includes('on conflict specification');
  if (conflictTargetMissing) {
    const { error: insertError } = await supabaseAdmin.from('UsuarioComercios').insert(payload);
    if (!insertError) return;
    const insertMsg = String(insertError?.message || '');
    const duplicateInsert =
      insertError?.code === '23505' ||
      insertMsg.toLowerCase().includes('duplicate key') ||
      insertMsg.toLowerCase().includes('already exists');
    if (duplicateInsert) return;
    throw insertError;
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('UsuarioComercios')
    .select('idUsuario, idComercio')
    .eq('idUsuario', userId)
    .eq('idComercio', comercioId)
    .maybeSingle();

  if (!existingError && existing) return;
  if (existingError) throw existingError;

  throw upsertError;
}

export async function issueOtpChallenge({
  supabaseAdmin,
  user,
  idComercio,
  purpose,
  channelPreference,
  requesterIp,
  explicitPhone,
  resend = false,
}) {
  const now = new Date();
  const nowIsoValue = nowIso();
  const requesterUserId = user?.id || null;
  const provider = createOtpProvider();

  const comercio = await fetchComercioForOtp(supabaseAdmin, idComercio);
  if (!comercio) {
    return { ok: false, statusCode: 404, error: 'Comercio no encontrado.' };
  }

  if (purpose === 'owner_verification') {
    if (String(comercio.estado_verificacion || '') !== 'otp_pendiente') {
      return { ok: false, statusCode: 409, error: 'El comercio no está en estado otp_pendiente.' };
    }
    if (comercio.owner_user_id && comercio.owner_user_id !== requesterUserId) {
      return { ok: false, statusCode: 403, error: 'Este comercio pertenece a otro usuario.' };
    }
  }

  const destinationPhone = resolveDestinationPhone({ comercio, purpose, explicitPhone });
  if (!destinationPhone) {
    return { ok: false, statusCode: 400, error: 'No se pudo determinar el teléfono de destino para OTP.' };
  }

  const latestPending = await findLatestPendingChallenge(supabaseAdmin, {
    idComercio,
    purpose,
    requesterUserId,
  });

  if (latestPending) {
    const cooldownUntil = latestPending.cooldown_until ? new Date(latestPending.cooldown_until) : null;
    const expired = latestPending.expires_at ? new Date(latestPending.expires_at) < now : false;

    if (!expired && cooldownUntil && cooldownUntil > now) {
      const remaining = Math.max(1, Math.ceil((cooldownUntil.getTime() - now.getTime()) / 1000));
      return {
        ok: false,
        statusCode: 429,
        error: `Debes esperar ${remaining}s antes de reenviar.`,
        code: 'cooldown_active',
        cooldown_seconds: remaining,
      };
    }
  }

  const oneHourAgo = new Date(now.getTime() - 3600 * 1000).toISOString();
  const comercioCount = await countRecentChallenges(supabaseAdmin, { idComercio }, oneHourAgo);
  if (comercioCount >= OTP_LIMIT_COMERCIO_HOUR) {
    return {
      ok: false,
      statusCode: 429,
      error: 'Límite de OTP por comercio alcanzado. Intenta más tarde.',
      code: 'rate_limit_comercio',
      retry_after_seconds: 3600,
    };
  }

  if (requesterIp) {
    const ipCount = await countRecentChallenges(supabaseAdmin, { requester_ip: requesterIp }, oneHourAgo);
    if (ipCount >= OTP_LIMIT_IP_HOUR) {
      return {
        ok: false,
        statusCode: 429,
        error: 'Límite de OTP por IP alcanzado. Intenta más tarde.',
        code: 'rate_limit_ip',
        retry_after_seconds: 3600,
      };
    }
  }

  if (requesterUserId) {
    const userCount = await countRecentChallenges(supabaseAdmin, { requester_user_id: requesterUserId }, oneHourAgo);
    if (userCount >= OTP_LIMIT_USER_HOUR) {
      return {
        ok: false,
        statusCode: 429,
        error: 'Límite de OTP por usuario alcanzado. Intenta más tarde.',
        code: 'rate_limit_user',
        retry_after_seconds: 3600,
      };
    }
  }

  if (resend) {
    await expirePendingChallenges(supabaseAdmin, {
      idComercio,
      purpose,
      requesterUserId,
    });
  }

  const challengeId = crypto.randomUUID();
  const otpCode = generateOtpCode();
  const hashedCode = hashOtpCode(challengeId, otpCode);
  const expiresAt = addMinutes(now, OTP_EXPIRY_MINUTES);
  const cooldownUntil = addSeconds(now, OTP_COOLDOWN_SECONDS);

  const { error: insertError } = await supabaseAdmin.from('otp_challenges').insert({
    id: challengeId,
    idComercio,
    purpose,
    destination_phone: destinationPhone,
    hashed_code: hashedCode,
    expires_at: expiresAt,
    attempts_left: OTP_ATTEMPTS,
    cooldown_until: cooldownUntil,
    channel_used: null,
    status: 'pending',
    requester_ip: requesterIp,
    requester_user_id: requesterUserId,
    provider: provider.name,
    metadata: {
      channel_preference: channelPreference,
      created_by: requesterUserId,
      created_at: nowIsoValue,
    },
    created_at: nowIsoValue,
  });
  if (insertError) throw insertError;

  const smsMessage = otpMessage(otpCode);
  let channelUsed = channelPreference;
  let providerResult = null;

  if (channelPreference === 'auto') {
    const smsResult = await provider.sendSMS({
      phone: destinationPhone,
      message: smsMessage,
      code: otpCode,
    });
    channelUsed = 'sms';
    providerResult = smsResult;

    if (!smsResult?.ok) {
      const voiceResult = await provider.sendVoiceOTP({
        phone: destinationPhone,
        code: otpCode,
      });
      channelUsed = 'voice';
      if (voiceResult?.ok) {
        providerResult = voiceResult;
      } else {
        providerResult = {
          ...(voiceResult || {}),
          fallback_error: smsResult?.error || null,
          fallback_provider_response: smsResult?.provider_response || null,
        };
      }
    }
  } else if (channelPreference === 'sms') {
    providerResult = await provider.sendSMS({
      phone: destinationPhone,
      message: smsMessage,
      code: otpCode,
    });
    channelUsed = 'sms';
  } else {
    providerResult = await provider.sendVoiceOTP({
      phone: destinationPhone,
      code: otpCode,
    });
    channelUsed = 'voice';
  }

  if (!providerResult?.ok) {
    await supabaseAdmin
      .from('otp_challenges')
      .update({
        status: 'blocked',
        attempts_left: 0,
        channel_used: channelUsed,
        last_error: providerResult?.error || 'No se pudo enviar OTP',
        metadata: {
          send_error: providerResult?.provider_response || providerResult?.error || null,
          failed_at: nowIso(),
        },
      })
      .eq('id', challengeId);

    return {
      ok: false,
      statusCode: 502,
      error: providerResult?.error || 'No se pudo enviar OTP.',
      code: 'provider_send_failed',
    };
  }

  await supabaseAdmin
    .from('otp_challenges')
    .update({
      channel_used: channelUsed,
      provider: provider.name,
      metadata: {
        sent_at: nowIso(),
        provider_result: providerResult?.provider_response || null,
      },
    })
    .eq('id', challengeId);

  console.log('[OTP][SEND]', {
    idComercio,
    purpose,
    channelUsed,
    provider: provider.name,
    requesterUserId,
    requesterIp,
  });

  return {
    ok: true,
    statusCode: 200,
    data: {
      challenge_id: challengeId,
      expires_in: OTP_EXPIRY_MINUTES * 60,
      cooldown_seconds: OTP_COOLDOWN_SECONDS,
      channel_used: channelUsed,
      destination_masked: maskPhone(destinationPhone),
      ...(provider.name === 'mock' && envText('OTP_EXPOSE_CODE') === 'true' ? { dev_code: otpCode } : {}),
    },
  };
}

export async function verifyOtpCode({ supabaseAdmin, user, challengeId, code }) {
  const normalizedCode = String(code || '').replace(/\D/g, '').slice(0, 6);
  if (!challengeId || normalizedCode.length !== 6) {
    return { ok: false, statusCode: 400, error: 'challenge_id y code (6 dígitos) son requeridos.' };
  }

  const { data: challenge, error: challengeError } = await supabaseAdmin
    .from('otp_challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();
  if (challengeError) throw challengeError;
  if (!challenge) return { ok: false, statusCode: 404, error: 'Challenge no encontrado.' };

  if (challenge.requester_user_id && challenge.requester_user_id !== user.id) {
    return { ok: false, statusCode: 403, error: 'Este OTP pertenece a otro usuario.' };
  }

  if (challenge.status !== 'pending') {
    return { ok: false, statusCode: 409, error: `El challenge está en estado ${challenge.status}.` };
  }

  const now = new Date();
  const expiresAt = challenge.expires_at ? new Date(challenge.expires_at) : null;
  if (expiresAt && expiresAt < now) {
    await supabaseAdmin.from('otp_challenges').update({ status: 'expired' }).eq('id', challengeId);
    return { ok: false, statusCode: 410, error: 'Código expirado.' };
  }

  const attemptsLeft = Number(challenge.attempts_left || 0);
  if (attemptsLeft <= 0) {
    await supabaseAdmin.from('otp_challenges').update({ status: 'blocked' }).eq('id', challengeId);
    return { ok: false, statusCode: 429, error: 'Demasiados intentos. Challenge bloqueado.' };
  }

  const expectedHash = hashOtpCode(challengeId, normalizedCode);
  if (expectedHash !== challenge.hashed_code) {
    const newAttempts = Math.max(0, attemptsLeft - 1);
    const newStatus = newAttempts === 0 ? 'blocked' : 'pending';
    await supabaseAdmin
      .from('otp_challenges')
      .update({
        attempts_left: newAttempts,
        status: newStatus,
        last_error: 'Código incorrecto',
      })
      .eq('id', challengeId);

    return {
      ok: false,
      statusCode: 400,
      error: 'Código incorrecto.',
      attempts_left: newAttempts,
      blocked: newStatus === 'blocked',
    };
  }

  const verifiedAt = nowIso();

  const { data: comercio } = await supabaseAdmin
    .from('Comercios')
    .select('id, telefono_publico')
    .eq('id', challenge.idComercio)
    .maybeSingle();

  let comercioUpdatePayload = {
    estado_verificacion: 'otp_verificado',
    estado_propiedad: 'verificado',
    owner_user_id: user.id,
    metodo_verificacion: challenge.channel_used || 'sms',
    verificado_en: verifiedAt,
    telefono_publico_verificado: true,
    propietario_verificado: true,
    telefono_verificado: true,
    bloqueo_datos_criticos: false,
  };

  if (!comercio?.telefono_publico) {
    comercioUpdatePayload.telefono_publico = challenge.destination_phone || null;
  }

  try {
    await safeUpdateComercio(supabaseAdmin, challenge.idComercio, comercioUpdatePayload);
  } catch (error) {
    const message = String(error?.message || '');
    const isEstadoConstraint =
      message.includes('comercios_estado_verificacion_chk') ||
      message.includes('violates check constraint');

    // Compatibilidad con esquemas legacy que todavía usan sms_verificado.
    if (!isEstadoConstraint) throw error;

    comercioUpdatePayload = {
      ...comercioUpdatePayload,
      estado_verificacion: 'sms_verificado',
    };
    await safeUpdateComercio(supabaseAdmin, challenge.idComercio, comercioUpdatePayload);
  }

  await ensureUsuarioComercioLink(supabaseAdmin, {
    userId: user.id,
    idComercio: challenge.idComercio,
    rol: 'comercio_admin',
  });

  await supabaseAdmin
    .from('otp_challenges')
    .update({
      status: 'verified',
      verified_at: verifiedAt,
      attempts_left: attemptsLeft,
    })
    .eq('id', challengeId);

  console.log('[OTP][VERIFY_OK]', {
    challengeId,
    idComercio: challenge.idComercio,
    userId: user.id,
    channel: challenge.channel_used,
  });

  return {
    ok: true,
    statusCode: 200,
    data: {
      verified: true,
      idComercio: challenge.idComercio,
      metodo_verificacion: challenge.channel_used || 'sms',
      verified_at: verifiedAt,
    },
  };
}
