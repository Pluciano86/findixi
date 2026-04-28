function buildPayload(reason = '') {
  return {
    source: 'public_app',
    reason: String(reason || '').trim() || 'manual_trigger',
    triggered_at: new Date().toISOString(),
  };
}

function getEndpoints() {
  const list = ['/.netlify/functions/dispatch_notifications'];
  const host = String(window?.location?.hostname || '').toLowerCase();
  if (host === '127.0.0.1' || host === 'localhost') {
    list.push('https://test.enpe-erre.com/.netlify/functions/dispatch_notifications');
  }
  return list;
}

export async function triggerDispatchNotifications({ reason = '', timeoutMs = 2500 } = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : 2500;
  const timer = controller
    ? setTimeout(() => {
      controller.abort();
    }, timeout)
    : null;

  try {
    for (const endpoint of getEndpoints()) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(reason)),
        keepalive: true,
        signal: controller?.signal,
      });
      if (response.ok) return true;
      console.warn('[dispatch_notifications] trigger response not ok:', response.status, endpoint);
    }
    return false;
  } catch (error) {
    console.warn('[dispatch_notifications] trigger failed:', error?.message || error);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
