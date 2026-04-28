import crypto from 'node:crypto';
import {
  buildHeaders,
  createSupabaseAdmin,
  extractRequesterIp,
  jsonResponse,
  maskPhone,
  normalizePhone,
  parseBody,
  requireAuthUser,
  sanitizeChannelPreference,
} from './otpShared.js';
import { createOtpProvider } from './otpProvider.js';

const OTP_EXPIRY_MINUTES = 10;
const OTP_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_LIMIT_USER_HOUR = 12;
const OTP_LIMIT_PHONE_HOUR = 8;

function nowIso() {
  return new Date().toISOString();
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000).toISOString();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000).toISOString();
}

function generateOtpCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

function hashOtpCode(challengeId, code) {
  const secret = String(process.env.OTP_HASH_SECRET || 'findixi-user-phone-otp-secret-change-me').trim();
  return crypto
    .createHash('sha256')
    .update(`${challengeId}:${code}:${secret}`)
    .digest('hex');
}

function maybePhoneE164(phoneRaw) {
  const phone = normalizePhone(phoneRaw);
  return phone || '';
}

async function countRecentChallenges(supabaseAdmin, filters, sinceIso) {
  let query = supabaseAdmin
    .from('user_phone_otp_challenges')
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

async function findLatestPendingChallenge(supabaseAdmin, { userId }) {
  const { data, error } = await supabaseAdmin
    .from('user_phone_otp_challenges')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function expirePendingChallenges(supabaseAdmin, { userId }) {
  const { error } = await supabaseAdmin
    .from('user_phone_otp_challenges')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) throw error;
}

function otpMessage(code) {
  return `Tu codigo de verificacion Findixi es ${code}.`; 
}

async function sendOtpByPreference({ provider, channelPreference, destinationPhone, otpCode, message }) {
  let channelUsed = channelPreference;
  let providerResult = null;

  if (channelPreference === 'auto') {
    if (provider.name === 'twilio' && typeof provider.sendWhatsApp === 'function') {
      const waResult = await provider.sendWhatsApp({
        phone: destinationPhone,
        message,
        code: otpCode,
      });
      channelUsed = 'whatsapp';
      providerResult = waResult;

      if (!waResult?.ok) {
        const smsResult = await provider.sendSMS({
          phone: destinationPhone,
          message,
          code: otpCode,
        });
        channelUsed = 'sms';
        providerResult = smsResult?.ok
          ? smsResult
          : {
              ...(smsResult || {}),
              fallback_error: waResult?.error || null,
              fallback_provider_response: waResult?.provider_response || null,
            };
      }
    } else {
      providerResult = await provider.sendSMS({
        phone: destinationPhone,
        message,
        code: otpCode,
      });
      channelUsed = 'sms';
    }
  } else if (channelPreference === 'sms') {
    providerResult = await provider.sendSMS({
      phone: destinationPhone,
      message,
      code: otpCode,
    });
    channelUsed = 'sms';
  } else if (channelPreference === 'whatsapp') {
    if (provider.name !== 'twilio' || typeof provider.sendWhatsApp !== 'function') {
      return {
        ok: false,
        channelUsed: 'whatsapp',
        providerResult: { ok: false, error: 'Canal WhatsApp no disponible para este proveedor.' },
      };
    }

    providerResult = await provider.sendWhatsApp({
      phone: destinationPhone,
      message,
      code: otpCode,
    });
    channelUsed = 'whatsapp';
  } else {
    providerResult = await provider.sendVoiceOTP({
      phone: destinationPhone,
      code: otpCode,
    });
    channelUsed = 'voice';
  }

  return { ok: !!providerResult?.ok, channelUsed, providerResult };
}

export async function issueUserPhoneOtp({
  supabaseAdmin,
  user,
  requesterIp,
  phone,
  channelPreference,
  resend = false,
}) {
  const now = new Date();
  const userId = user?.id || null;
  if (!userId) {
    return { ok: false, statusCode: 401, error: 'No autorizado.' };
  }

  const destinationPhone = maybePhoneE164(phone);
  if (!destinationPhone) {
    return { ok: false, statusCode: 400, error: 'Telefono invalido.' };
  }

  const provider = createOtpProvider();

  const latestPending = await findLatestPendingChallenge(supabaseAdmin, { userId });
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
  const userCount = await countRecentChallenges(supabaseAdmin, { user_id: userId }, oneHourAgo);
  if (userCount >= OTP_LIMIT_USER_HOUR) {
    return {
      ok: false,
      statusCode: 429,
      error: 'Límite de OTP por usuario alcanzado. Intenta más tarde.',
      code: 'rate_limit_user',
      retry_after_seconds: 3600,
    };
  }

  const phoneCount = await countRecentChallenges(
    supabaseAdmin,
    { destination_phone: destinationPhone },
    oneHourAgo
  );
  if (phoneCount >= OTP_LIMIT_PHONE_HOUR) {
    return {
      ok: false,
      statusCode: 429,
      error: 'Límite de OTP para este teléfono alcanzado. Intenta más tarde.',
      code: 'rate_limit_phone',
      retry_after_seconds: 3600,
    };
  }

  if (resend) {
    await expirePendingChallenges(supabaseAdmin, { userId });
  }

  const challengeId = crypto.randomUUID();
  const otpCode = generateOtpCode();
  const hashedCode = hashOtpCode(challengeId, otpCode);
  const expiresAt = addMinutes(now, OTP_EXPIRY_MINUTES);
  const cooldownUntil = addSeconds(now, OTP_COOLDOWN_SECONDS);

  const { error: insertError } = await supabaseAdmin.from('user_phone_otp_challenges').insert({
    id: challengeId,
    user_id: userId,
    destination_phone: destinationPhone,
    hashed_code: hashedCode,
    expires_at: expiresAt,
    attempts_left: OTP_ATTEMPTS,
    cooldown_until: cooldownUntil,
    status: 'pending',
    requester_ip: requesterIp,
    provider: provider.name,
    metadata: {
      channel_preference: channelPreference,
      created_by: userId,
      created_at: nowIso(),
    },
    created_at: nowIso(),
  });

  if (insertError) throw insertError;

  const smsMessage = otpMessage(otpCode);
  const sendResult = await sendOtpByPreference({
    provider,
    channelPreference,
    destinationPhone,
    otpCode,
    message: smsMessage,
  });

  if (!sendResult.ok) {
    await supabaseAdmin
      .from('user_phone_otp_challenges')
      .update({
        status: 'blocked',
        attempts_left: 0,
        channel_used: sendResult.channelUsed,
        last_error: sendResult.providerResult?.error || 'No se pudo enviar OTP.',
        metadata: {
          send_error: sendResult.providerResult?.provider_response || sendResult.providerResult?.error || null,
          failed_at: nowIso(),
        },
      })
      .eq('id', challengeId);

    return {
      ok: false,
      statusCode: 502,
      error: sendResult.providerResult?.error || 'No se pudo enviar OTP.',
      code: 'provider_send_failed',
    };
  }

  await supabaseAdmin
    .from('user_phone_otp_challenges')
    .update({
      channel_used: sendResult.channelUsed,
      provider: provider.name,
      metadata: {
        sent_at: nowIso(),
        provider_result: sendResult.providerResult?.provider_response || null,
      },
    })
    .eq('id', challengeId);

  return {
    ok: true,
    statusCode: 200,
    data: {
      challenge_id: challengeId,
      expires_in: OTP_EXPIRY_MINUTES * 60,
      cooldown_seconds: OTP_COOLDOWN_SECONDS,
      channel_used: sendResult.channelUsed,
      destination_masked: maskPhone(destinationPhone),
      ...(provider.name === 'mock' && String(process.env.OTP_EXPOSE_CODE || '').trim() === 'true'
        ? { dev_code: otpCode }
        : {}),
    },
  };
}

export async function verifyUserPhoneOtp({ supabaseAdmin, user, challengeId, code }) {
  const normalizedCode = String(code || '').replace(/\D/g, '').slice(0, 6);
  if (!challengeId || normalizedCode.length !== 6) {
    return { ok: false, statusCode: 400, error: 'challenge_id y code (6 dígitos) son requeridos.' };
  }

  const { data: challenge, error: challengeError } = await supabaseAdmin
    .from('user_phone_otp_challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();

  if (challengeError) throw challengeError;
  if (!challenge) return { ok: false, statusCode: 404, error: 'Challenge no encontrado.' };
  if (challenge.user_id !== user.id) return { ok: false, statusCode: 403, error: 'Este OTP pertenece a otro usuario.' };

  if (challenge.status !== 'pending') {
    return { ok: false, statusCode: 409, error: `El challenge está en estado ${challenge.status}.` };
  }

  const now = new Date();
  const expiresAt = challenge.expires_at ? new Date(challenge.expires_at) : null;
  if (expiresAt && expiresAt < now) {
    await supabaseAdmin.from('user_phone_otp_challenges').update({ status: 'expired' }).eq('id', challengeId);
    return { ok: false, statusCode: 410, error: 'Código expirado.' };
  }

  const attemptsLeft = Number(challenge.attempts_left || 0);
  if (attemptsLeft <= 0) {
    await supabaseAdmin.from('user_phone_otp_challenges').update({ status: 'blocked' }).eq('id', challengeId);
    return { ok: false, statusCode: 429, error: 'Demasiados intentos. Challenge bloqueado.' };
  }

  const expectedHash = hashOtpCode(challengeId, normalizedCode);
  if (expectedHash !== challenge.hashed_code) {
    const newAttempts = Math.max(0, attemptsLeft - 1);
    const newStatus = newAttempts === 0 ? 'blocked' : 'pending';

    await supabaseAdmin
      .from('user_phone_otp_challenges')
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
  const verifiedPhone = String(challenge.destination_phone || '').trim() || null;

  const { error: userProfileError } = await supabaseAdmin
    .from('usuarios')
    .update({
      telefono: verifiedPhone,
      telefono_verificado: true,
      telefono_verificado_at: verifiedAt,
    })
    .eq('id', user.id);

  if (userProfileError) throw userProfileError;

  await supabaseAdmin
    .from('user_phone_otp_challenges')
    .update({
      status: 'verified',
      verified_at: verifiedAt,
      attempts_left: attemptsLeft,
    })
    .eq('id', challengeId);

  return {
    ok: true,
    statusCode: 200,
    data: {
      verified: true,
      telefono: verifiedPhone,
      metodo_verificacion: challenge.channel_used || 'sms',
      verified_at: verifiedAt,
    },
  };
}

export async function withUserPhoneOtpRequest(event, processor) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: buildHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido. Usa POST.' });
  }

  const body = parseBody(event);
  if (body === null) {
    return jsonResponse(400, { error: 'Body inválido. Debe ser JSON.' });
  }

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const user = await requireAuthUser(event, supabaseAdmin);
    if (!user) return jsonResponse(401, { error: 'No autorizado.' });

    return await processor({ supabaseAdmin, user, body });
  } catch (error) {
    console.error('[user-phone-otp] error', error);
    return jsonResponse(500, {
      error: 'Error interno en OTP de teléfono.',
      detalle: error?.message || String(error),
    });
  }
}

export function buildIssuePayload(body) {
  return {
    phone: body.phone || body.telefono || body.destination_phone || null,
    channelPreference: sanitizeChannelPreference(body.channel_preference),
    resend: !!body.resend,
  };
}

export function buildIssueContext(event) {
  return { requesterIp: extractRequesterIp(event) };
}
