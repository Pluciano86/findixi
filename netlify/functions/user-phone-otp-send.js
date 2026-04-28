import { jsonResponse } from './otpShared.js';
import {
  buildIssueContext,
  buildIssuePayload,
  issueUserPhoneOtp,
  withUserPhoneOtpRequest,
} from './userPhoneOtpShared.js';

export const handler = async (event) => {
  return withUserPhoneOtpRequest(event, async ({ supabaseAdmin, user, body }) => {
    const payload = buildIssuePayload(body);
    const context = buildIssueContext(event);

    if (!payload.phone) {
      return jsonResponse(400, { error: 'Debes enviar phone para verificar.' });
    }

    const result = await issueUserPhoneOtp({
      supabaseAdmin,
      user,
      requesterIp: context.requesterIp,
      phone: payload.phone,
      channelPreference: payload.channelPreference,
      resend: payload.resend,
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
  });
};
