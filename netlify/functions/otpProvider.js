function sanitizeText(value) {
  return String(value || '').trim();
}

function readEnv(name) {
  try {
    const netlifyValue = globalThis.Netlify?.env?.get?.(name);
    if (netlifyValue) return sanitizeText(netlifyValue);
  } catch (_error) {
    // Local tests and non-Netlify runtimes do not expose the Netlify global.
  }
  return sanitizeText(process.env[name]);
}

function getProviderNameFromEnv() {
  return sanitizeText(readEnv('OTP_PROVIDER') || readEnv('FINDIXI_OTP_PROVIDER') || 'telnyx')
    .toLowerCase();
}

function isLocalMockAllowed() {
  return (
    readEnv('NODE_ENV') === 'test' ||
    readEnv('NETLIFY_DEV').toLowerCase() === 'true' ||
    readEnv('CONTEXT').toLowerCase() === 'dev'
  );
}

function unavailableProvider(error) {
  const result = async () => ({ ok: false, error });
  return {
    name: 'unavailable',
    sendSMS: result,
    sendVoiceOTP: result,
  };
}

async function sendTelnyxSMS({ phone, message }) {
  const apiKey = readEnv('TELNYX_API_KEY');
  const fromNumber = readEnv('TELNYX_FROM_NUMBER');
  const profileId = readEnv('TELNYX_MESSAGING_PROFILE_ID');
  if (!apiKey || (!fromNumber && !profileId)) {
    return { ok: false, error: 'Telnyx no está configurado para SMS.' };
  }

  const payload = { to: phone, text: message };
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
      error: json?.errors?.[0]?.detail || 'Telnyx rechazó el SMS.',
    };
  }

  return { ok: true, message_id: json?.data?.id || null };
}

async function sendTelnyxVoiceOTP() {
  return {
    ok: false,
    error: 'La verificación por llamada no está habilitada. Usa SMS.',
  };
}

async function sendMockSMS() {
  return { ok: true, message_id: `mock-sms-${Date.now()}` };
}

async function sendMockVoice() {
  return { ok: false, error: 'La verificación por llamada no está disponible en modo local.' };
}

export function createOtpProvider() {
  const provider = getProviderNameFromEnv();

  if (provider === 'telnyx') {
    return {
      name: 'telnyx',
      sendSMS: ({ phone, message }) => sendTelnyxSMS({ phone, message }),
      sendVoiceOTP: () => sendTelnyxVoiceOTP(),
    };
  }

  if (provider === 'mock' && isLocalMockAllowed()) {
    return {
      name: 'mock',
      sendSMS: () => sendMockSMS(),
      sendVoiceOTP: () => sendMockVoice(),
    };
  }

  return unavailableProvider(
    provider === 'mock'
      ? 'El proveedor mock solo está permitido en desarrollo local o pruebas.'
      : 'Proveedor de mensajería no permitido. Configura OTP_PROVIDER=telnyx.',
  );
}
