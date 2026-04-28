import { createClient } from '@supabase/supabase-js';
import { createOtpProvider } from './otpProvider.js';

const MAX_BATCH = Number(process.env.NOTIFICATIONS_BATCH_SIZE || 50);
const TEST_DESTINATION_PHONE = String(process.env.NOTIFICATIONS_TEST_PHONE || '').trim();

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-secret',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(payload),
  };
}

function getHeader(event, key) {
  const headers = event?.headers || {};
  return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()] || '';
}

function isAuthorized(event) {
  const secret = String(process.env.NOTIFICATIONS_CRON_SECRET || '').trim();
  const isNetlifyScheduled = String(getHeader(event, 'x-nf-event') || '').toLowerCase() === 'schedule';
  if (isNetlifyScheduled) return true;
  if (!secret) return true;
  const incoming = String(getHeader(event, 'x-cron-secret') || '').trim();
  return incoming && incoming === secret;
}

function safeText(value) {
  return String(value || '').trim();
}

function resolveDestination(phoneRaw) {
  if (TEST_DESTINATION_PHONE) return TEST_DESTINATION_PHONE;
  return safeText(phoneRaw);
}

async function sendWithFallback({ provider, channel, phone, message }) {
  const normalizedChannel = safeText(channel).toLowerCase();

  if (normalizedChannel === 'whatsapp') {
    if (provider.name === 'twilio' && typeof provider.sendWhatsApp === 'function') {
      const waResult = await provider.sendWhatsApp({ phone, message });
      if (waResult?.ok) return { ok: true, channelUsed: 'whatsapp', result: waResult };

      const smsResult = await provider.sendSMS({ phone, message });
      if (smsResult?.ok) return { ok: true, channelUsed: 'sms', result: smsResult };

      return {
        ok: false,
        channelUsed: 'sms',
        result: {
          ...(smsResult || {}),
          fallback_error: waResult?.error || null,
          fallback_provider_response: waResult?.provider_response || null,
        },
      };
    }

    const smsResult = await provider.sendSMS({ phone, message });
    if (smsResult?.ok) return { ok: true, channelUsed: 'sms', result: smsResult };
    return { ok: false, channelUsed: 'sms', result: smsResult };
  }

  if (normalizedChannel === 'sms') {
    if (provider.name === 'twilio' && typeof provider.sendWhatsApp === 'function') {
      const waResult = await provider.sendWhatsApp({ phone, message });
      if (waResult?.ok) return { ok: true, channelUsed: 'whatsapp', result: waResult };

      const smsResult = await provider.sendSMS({ phone, message });
      if (smsResult?.ok) return { ok: true, channelUsed: 'sms', result: smsResult };

      return {
        ok: false,
        channelUsed: 'sms',
        result: {
          ...(smsResult || {}),
          fallback_error: waResult?.error || null,
          fallback_provider_response: waResult?.provider_response || null,
        },
      };
    }

    const smsResult = await provider.sendSMS({ phone, message });
    return { ok: !!smsResult?.ok, channelUsed: 'sms', result: smsResult };
  }

  if (normalizedChannel === 'voice') {
    const voiceResult = await provider.sendVoiceOTP({ phone, code: message });
    return {
      ok: !!voiceResult?.ok,
      channelUsed: 'voice',
      result: voiceResult,
    };
  }

  return {
    ok: false,
    channelUsed: normalizedChannel || 'sms',
    result: { ok: false, error: `Canal no soportado: ${normalizedChannel || '(vacio)'}` },
  };
}

async function processCitaNotifications({ supabase, provider, nowIso }) {
  const { data, error } = await supabase
    .from('ComercioCitasNotificaciones')
    .select('id,canal,destino,payload')
    .eq('estado', 'pendiente')
    .lte('scheduled_at', nowIso)
    .in('canal', ['sms', 'whatsapp'])
    .order('scheduled_at', { ascending: true })
    .limit(MAX_BATCH);

  if (error) throw error;

  let sent = 0;
  let failed = 0;

  for (const row of data || []) {
    const destination = resolveDestination(row?.destino);
    const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
    const message = safeText(payload?.message || payload?.subject || '');

    if (!destination || !message) {
      const { error: updateErr } = await supabase
        .from('ComercioCitasNotificaciones')
        .update({
          estado: 'error',
          error_text: 'Destino o mensaje inválido para enviar notificación.',
        })
        .eq('id', row.id);

      if (updateErr) throw updateErr;
      failed += 1;
      continue;
    }

    const delivery = await sendWithFallback({
      provider,
      channel: row.canal,
      phone: destination,
      message,
    });

    if (delivery.ok) {
      const { error: updateErr } = await supabase
        .from('ComercioCitasNotificaciones')
        .update({
          estado: 'enviada',
          sent_at: new Date().toISOString(),
          payload: {
            ...payload,
            delivered_channel: delivery.channelUsed,
            provider: provider.name,
            provider_result: delivery.result?.provider_response || null,
          },
        })
        .eq('id', row.id);

      if (updateErr) throw updateErr;
      sent += 1;
      continue;
    }

    const { error: updateErr } = await supabase
      .from('ComercioCitasNotificaciones')
      .update({
        estado: 'error',
        error_text: delivery.result?.error || 'No se pudo enviar notificación.',
        payload: {
          ...payload,
          provider: provider.name,
          provider_result: delivery.result?.provider_response || null,
        },
      })
      .eq('id', row.id);

    if (updateErr) throw updateErr;
    failed += 1;
  }

  return { scanned: (data || []).length, sent, failed };
}

async function processOrderNotifications({ supabase, provider, nowIso }) {
  const { data, error } = await supabase
    .from('ordenes_notificaciones')
    .select('id,canal,destino,message,payload')
    .eq('estado', 'pendiente')
    .lte('scheduled_at', nowIso)
    .in('canal', ['sms', 'whatsapp'])
    .order('scheduled_at', { ascending: true })
    .limit(MAX_BATCH);

  if (error) throw error;

  let sent = 0;
  let failed = 0;

  for (const row of data || []) {
    const destination = resolveDestination(row?.destino);
    const message = safeText(row?.message);
    const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};

    if (!destination || !message) {
      const { error: updateErr } = await supabase
        .from('ordenes_notificaciones')
        .update({
          estado: 'error',
          error_text: 'Destino o mensaje inválido para enviar notificación de orden.',
        })
        .eq('id', row.id);

      if (updateErr) throw updateErr;
      failed += 1;
      continue;
    }

    const delivery = await sendWithFallback({
      provider,
      channel: row.canal,
      phone: destination,
      message,
    });

    if (delivery.ok) {
      const { error: updateErr } = await supabase
        .from('ordenes_notificaciones')
        .update({
          estado: 'enviada',
          sent_at: new Date().toISOString(),
          provider: provider.name,
          payload: {
            ...payload,
            delivered_channel: delivery.channelUsed,
            provider_result: delivery.result?.provider_response || null,
          },
        })
        .eq('id', row.id);

      if (updateErr) throw updateErr;
      sent += 1;
      continue;
    }

    const { error: updateErr } = await supabase
      .from('ordenes_notificaciones')
      .update({
        estado: 'error',
        provider: provider.name,
        error_text: delivery.result?.error || 'No se pudo enviar notificación de orden.',
        payload: {
          ...payload,
          provider_result: delivery.result?.provider_response || null,
        },
      })
      .eq('id', row.id);

    if (updateErr) throw updateErr;
    failed += 1;
  }

  return { scanned: (data || []).length, sent, failed };
}

export const config = {
  schedule: '*/3 * * * *',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Método no permitido. Usa POST.' });
  }

  if (!isAuthorized(event)) {
    return json(401, { error: 'No autorizado para ejecutar dispatcher.' });
  }

  const supabaseUrl = safeText(process.env.SUPABASE_URL);
  const serviceRole = safeText(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceRole) {
    return json(500, { error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.' });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const provider = createOtpProvider();
  const now = new Date().toISOString();

  try {
    const citas = await processCitaNotifications({ supabase, provider, nowIso: now });
    const ordenes = await processOrderNotifications({ supabase, provider, nowIso: now });

    return json(200, {
      ok: true,
      provider: provider.name,
      processed_at: now,
      citas,
      ordenes,
    });
  } catch (error) {
    console.error('[dispatch_notifications] error', error);
    return json(500, {
      ok: false,
      error: error?.message || String(error),
    });
  }
};
