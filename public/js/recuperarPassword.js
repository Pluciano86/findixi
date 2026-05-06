import { supabase } from '../shared/supabaseClient.js';
import { t } from './i18n.js';

const formRecuperarPassword = document.getElementById('formRecuperarPassword');
const emailInput = document.getElementById('emailRecuperar');
const mensaje = document.getElementById('mensajeRecuperarPassword');
const RECOVER_COOLDOWN_MS = 70_000;
const RECOVER_LAST_ATTEMPT_KEY = 'findixi_recover_last_attempt_ms';

function getBasePath() {
  const path = String(window.location.pathname || '');
  return path.startsWith('/public/') ? '/public' : '';
}

function buildRedirectCandidates() {
  const origin = window.location.origin;
  const basePath = getBasePath();
  const candidates = [`${origin}${basePath}/nuevaPassword.html`, `${origin}/nuevaPassword.html`];
  return [...new Set(candidates)];
}

function isLocalhost() {
  const host = String(window.location.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isRedirectConfigError(error) {
  const raw = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
  return raw.includes('redirect') || raw.includes('site url') || raw.includes('not allowed');
}

function isRetryableRecoverError(error) {
  const status = Number(error?.status || 0);
  const raw = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
  return status >= 500 || raw.includes('timeout') || raw.includes('network') || raw.includes('fetch');
}

function readLastRecoverAttemptMs() {
  try {
    const raw = localStorage.getItem(RECOVER_LAST_ATTEMPT_KEY);
    const value = Number(raw || 0);
    return Number.isFinite(value) ? value : 0;
  } catch (_error) {
    return 0;
  }
}

function saveLastRecoverAttemptMs(timestampMs) {
  try {
    localStorage.setItem(RECOVER_LAST_ATTEMPT_KEY, String(timestampMs));
  } catch (_error) {
    // Ignorar errores de storage.
  }
}

function getRemainingCooldownMs() {
  const last = readLastRecoverAttemptMs();
  if (!last) return 0;
  const elapsed = Date.now() - last;
  return Math.max(0, RECOVER_COOLDOWN_MS - elapsed);
}

function mostrarMensaje(texto, tipo) {
  if (!mensaje) return;
  mensaje.textContent = texto;
  mensaje.classList.remove('hidden', 'text-red-500', 'text-green-500');
  mensaje.classList.add(tipo === 'error' ? 'text-red-500' : 'text-green-500');
}

formRecuperarPassword?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput?.value.trim();
  if (!email) {
    mostrarMensaje(t('recoverPassword.errorEmailRequired'), 'error');
    return;
  }

  const cooldownLeftMs = getRemainingCooldownMs();
  if (cooldownLeftMs > 0) {
    const seconds = Math.ceil(cooldownLeftMs / 1000);
    mostrarMensaje(t('recoverPassword.errorCooldown', { seconds }), 'error');
    return;
  }

  const button = formRecuperarPassword.querySelector('button[type="submit"]');
  if (button) {
    button.disabled = true;
    button.classList.add('opacity-70');
  }

  let error = null;
  const redirectCandidates = buildRedirectCandidates();
  const shouldTryWithoutRedirectFirst = isLocalhost();

  if (shouldTryWithoutRedirectFirst) {
    const result = await supabase.auth.resetPasswordForEmail(email);
    error = result.error;
  } else {
    const redirectTo = redirectCandidates[0];
    const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    error = result.error;

    // Fallback mínimo si el redirect no está permitido/configurado.
    if (error && isRedirectConfigError(error)) {
      const fallbackResult = await supabase.auth.resetPasswordForEmail(email);
      error = fallbackResult.error;
    }
  }

  if (button) {
    button.disabled = false;
    button.classList.remove('opacity-70');
  }

  if (error) {
    if (isRetryableRecoverError(error)) {
      mostrarMensaje(t('recoverPassword.errorServiceSlow'), 'error');
    } else {
      mostrarMensaje(t('recoverPassword.errorSend'), 'error');
    }
    console.error('Error resetPasswordForEmail:', {
      message: error.message,
      code: error.code,
      status: error.status,
      name: error.name
    });
    return;
  }

  saveLastRecoverAttemptMs(Date.now());
  mostrarMensaje(t('recoverPassword.successSent'), 'success');
});
