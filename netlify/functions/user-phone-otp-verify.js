import { jsonResponse } from './otpShared.js';
import { verifyUserPhoneOtp, withUserPhoneOtpRequest } from './userPhoneOtpShared.js';

export const handler = async (event) => {
  return withUserPhoneOtpRequest(event, async ({ supabaseAdmin, user, body }) => {
    const result = await verifyUserPhoneOtp({
      supabaseAdmin,
      user,
      challengeId: body.challenge_id,
      code: body.code,
    });

    if (!result.ok) {
      return jsonResponse(result.statusCode || 400, {
        error: result.error || 'No se pudo verificar OTP.',
        attempts_left: result.attempts_left || null,
        blocked: !!result.blocked,
      });
    }

    return jsonResponse(200, {
      ok: true,
      ...result.data,
    });
  });
};
