import {
  buildHeaders,
  createSupabaseAdmin,
  extractRequesterIp,
  issueOtpChallenge,
  jsonResponse,
  parseBody,
  requireAuthUser,
  sanitizeChannelPreference,
  sanitizePurpose,
} from './otpShared.js';

export const handler = async (event) => {
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

  const idComercio = Number(body.idComercio);
  const purpose = sanitizePurpose(body.purpose);
  const channelPreference = sanitizeChannelPreference(body.channel_preference);
  const explicitPhone = body.destination_phone || null;

  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    return jsonResponse(400, { error: 'idComercio inválido.' });
  }

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const user = await requireAuthUser(event, supabaseAdmin);
    if (!user) return jsonResponse(401, { error: 'No autorizado.' });

    const result = await issueOtpChallenge({
      supabaseAdmin,
      user,
      idComercio,
      purpose,
      channelPreference,
      requesterIp: extractRequesterIp(event),
      explicitPhone,
      resend: false,
    });

    if (!result.ok) {
      return jsonResponse(result.statusCode || 400, {
        error: result.error || 'No se pudo enviar OTP.',
        code: result.code || null,
        cooldown_seconds: result.cooldown_seconds || null,
        retry_after_seconds: result.retry_after_seconds || null,
      });
    }

    return jsonResponse(200, {
      ok: true,
      ...result.data,
    });
  } catch (error) {
    console.error('[otp-send] error', error);
    return jsonResponse(500, {
      error: 'Error interno enviando OTP.',
      detalle: error?.message || String(error),
    });
  }
};
