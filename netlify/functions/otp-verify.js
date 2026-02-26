import {
  buildHeaders,
  createSupabaseAdmin,
  jsonResponse,
  parseBody,
  requireAuthUser,
  verifyOtpCode,
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

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const user = await requireAuthUser(event, supabaseAdmin);
    if (!user) return jsonResponse(401, { error: 'No autorizado.' });

    const result = await verifyOtpCode({
      supabaseAdmin,
      user,
      challengeId: body.challenge_id,
      code: body.code,
    });

    if (!result.ok) {
      return jsonResponse(result.statusCode || 400, {
        error: result.error || 'No se pudo verificar OTP.',
        attempts_left: result.attempts_left ?? null,
        blocked: Boolean(result.blocked),
      });
    }

    return jsonResponse(200, {
      ok: true,
      ...result.data,
    });
  } catch (error) {
    console.error('[otp-verify] error', error);
    return jsonResponse(500, {
      error: 'Error interno verificando OTP.',
      detalle: error?.message || String(error),
    });
  }
};
