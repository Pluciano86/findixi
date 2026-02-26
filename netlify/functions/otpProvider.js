function sanitizeText(value) {
  return String(value || '').trim();
}

function getProviderNameFromEnv() {
  return sanitizeText(
    process.env.OTP_PROVIDER ||
      process.env.FINDIXI_OTP_PROVIDER ||
      process.env.TWILIO_OR_TELNYX ||
      'mock'
  ).toLowerCase();
}

async function sendTwilioSMS({ phone, message }) {
  const accountSid = sanitizeText(process.env.TWILIO_ACCOUNT_SID);
  const authToken = sanitizeText(process.env.TWILIO_AUTH_TOKEN);
  const fromNumber = sanitizeText(process.env.TWILIO_PHONE_NUMBER);
  if (!accountSid || !authToken || !fromNumber) {
    return { ok: false, error: 'Twilio no configurado para SMS.', fallbackToVoice: true };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    From: fromNumber,
    To: phone,
    Body: message,
  });
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: json?.message || 'Twilio rechazó SMS.',
      provider_response: json,
      fallbackToVoice: true,
    };
  }

  return { ok: true, message_id: json?.sid || null, provider_response: json };
}

async function sendTwilioVoiceOTP({ phone, code }) {
  const accountSid = sanitizeText(process.env.TWILIO_ACCOUNT_SID);
  const authToken = sanitizeText(process.env.TWILIO_AUTH_TOKEN);
  const fromNumber = sanitizeText(process.env.TWILIO_PHONE_NUMBER);
  if (!accountSid || !authToken || !fromNumber) {
    return { ok: false, error: 'Twilio no configurado para Voice.' };
  }

  const twiml = `<Response><Say language="es-US">Tu código de verificación Findixi es ${code
    .split('')
    .join(' ')}. Repito, ${code.split('').join(' ')}.</Say></Response>`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
  const body = new URLSearchParams({
    From: fromNumber,
    To: phone,
    Twiml: twiml,
  });
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: json?.message || 'Twilio rechazó Voice call.',
      provider_response: json,
    };
  }

  return { ok: true, message_id: json?.sid || null, provider_response: json };
}

async function sendTelnyxSMS({ phone, message }) {
  const apiKey = sanitizeText(process.env.TELNYX_API_KEY);
  const fromNumber = sanitizeText(process.env.TELNYX_FROM_NUMBER);
  const profileId = sanitizeText(process.env.TELNYX_MESSAGING_PROFILE_ID);
  if (!apiKey || (!fromNumber && !profileId)) {
    return { ok: false, error: 'Telnyx no configurado para SMS.', fallbackToVoice: true };
  }

  const payload = {
    to: phone,
    text: message,
  };
  if (fromNumber) payload.from = fromNumber;
  if (profileId) payload.messaging_profile_id = profileId;

  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: json?.errors?.[0]?.detail || 'Telnyx rechazó SMS.',
      provider_response: json,
      fallbackToVoice: true,
    };
  }

  return { ok: true, message_id: json?.data?.id || null, provider_response: json };
}

async function sendTelnyxVoiceOTP() {
  return {
    ok: false,
    error:
      'Voice OTP con Telnyx requiere Call Control config. Define adapter específico al habilitar proveedor.',
  };
}

async function sendMockSMS({ phone, message, code }) {
  console.log('[OTP][MOCK][SMS]', { phone, message, code });
  return { ok: true, message_id: `mock-sms-${Date.now()}` };
}

async function sendMockVoice({ phone, code }) {
  console.log('[OTP][MOCK][VOICE]', { phone, code });
  return { ok: true, message_id: `mock-voice-${Date.now()}` };
}

export function createOtpProvider() {
  const provider = getProviderNameFromEnv();

  if (provider === 'twilio') {
    return {
      name: 'twilio',
      sendSMS: ({ phone, message, code }) => sendTwilioSMS({ phone, message, code }),
      sendVoiceOTP: ({ phone, code }) => sendTwilioVoiceOTP({ phone, code }),
    };
  }

  if (provider === 'telnyx') {
    return {
      name: 'telnyx',
      sendSMS: ({ phone, message, code }) => sendTelnyxSMS({ phone, message, code }),
      sendVoiceOTP: ({ phone, code }) => sendTelnyxVoiceOTP({ phone, code }),
    };
  }

  return {
    name: 'mock',
    sendSMS: ({ phone, message, code }) => sendMockSMS({ phone, message, code }),
    sendVoiceOTP: ({ phone, code }) => sendMockVoice({ phone, code }),
  };
}
