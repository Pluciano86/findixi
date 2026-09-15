import assert from 'node:assert/strict';
import test from 'node:test';

import { handler as dispatchNotifications } from './dispatch_notifications.js';
import { createOtpProvider } from './otpProvider.js';
import { resolveDestinationPhone } from './otpShared.js';

const ENV_KEYS = [
  'CONTEXT',
  'FINDIXI_OTP_PROVIDER',
  'NETLIFY_DEV',
  'NODE_ENV',
  'NOTIFICATIONS_CRON_SECRET',
  'OTP_PROVIDER',
  'TELNYX_API_KEY',
  'TELNYX_FROM_NUMBER',
  'TELNYX_MESSAGING_PROFILE_ID',
];

function withCleanEnvironment(callback) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const key of ENV_KEYS) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    });
}

test('defaults to Telnyx and fails closed when credentials are absent', async () => {
  await withCleanEnvironment(async () => {
    const provider = createOtpProvider();
    assert.equal(provider.name, 'telnyx');
    assert.deepEqual(await provider.sendSMS({ phone: '+17875550123', message: 'test' }), {
      ok: false,
      error: 'Telnyx no está configurado para SMS.',
    });
  });
});

test('rejects a retired provider instead of falling back to it', async () => {
  await withCleanEnvironment(async () => {
    process.env.OTP_PROVIDER = 'retired-provider';
    const provider = createOtpProvider();
    assert.equal(provider.name, 'unavailable');
    const result = await provider.sendSMS({ phone: '+17875550123', message: 'test' });
    assert.equal(result.ok, false);
    assert.match(result.error, /no permitido/i);
  });
});

test('allows mock only during automated tests', async () => {
  await withCleanEnvironment(async () => {
    process.env.OTP_PROVIDER = 'mock';
    let provider = createOtpProvider();
    assert.equal(provider.name, 'unavailable');

    process.env.NODE_ENV = 'test';
    provider = createOtpProvider();
    assert.equal(provider.name, 'mock');
    assert.equal((await provider.sendSMS({ phone: '+17875550123', message: 'test' })).ok, true);
  });
});

test('Telnyx result exposes only the provider message id', async () => {
  await withCleanEnvironment(async () => {
    process.env.OTP_PROVIDER = 'telnyx';
    process.env.TELNYX_API_KEY = 'test-key';
    process.env.TELNYX_FROM_NUMBER = '+17875550000';

    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.to, '+17875550123');
      assert.equal(payload.text, 'Código seguro');
      assert.equal(payload.from, '+17875550000');
      return new Response(JSON.stringify({ data: { id: 'telnyx-message-id', sensitive: 'hidden' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const result = await createOtpProvider().sendSMS({
        phone: '+17875550123',
        message: 'Código seguro',
      });
      assert.deepEqual(result, { ok: true, message_id: 'telnyx-message-id' });
      assert.equal('provider_response' in result, false);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});

test('manual dispatcher invocation fails closed without a configured secret', async () => {
  await withCleanEnvironment(async () => {
    const response = await dispatchNotifications({
      httpMethod: 'POST',
      headers: {},
      body: '{}',
    });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      error: 'No autorizado para ejecutar dispatcher.',
    });
  });
});

test('manual dispatcher rejects an incorrect secret', async () => {
  await withCleanEnvironment(async () => {
    process.env.NOTIFICATIONS_CRON_SECRET = 'correct-secret';
    const response = await dispatchNotifications({
      httpMethod: 'POST',
      headers: { 'x-cron-secret': 'wrong-secret' },
      body: '{}',
    });
    assert.equal(response.statusCode, 401);
  });
});

test('business ownership OTP ignores a browser-supplied replacement phone', () => {
  const phone = resolveDestinationPhone({
    comercio: {
      telefono_referencia_google: '(787) 555-0100',
      telefono_publico: '(787) 555-0200',
      telefono: '(787) 555-0300',
    },
    purpose: 'owner_verification',
    explicitPhone: '+17875559999',
  });
  assert.equal(phone, '+17875550100');
});

test('business ownership OTP fails without a stored Google reference phone', () => {
  const phone = resolveDestinationPhone({
    comercio: { telefono_publico: '(787) 555-0200' },
    purpose: 'owner_verification',
    explicitPhone: '+17875559999',
  });
  assert.equal(phone, '');
});
