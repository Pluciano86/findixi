import { supabase } from '../shared/supabaseClient.js';
import { t } from './i18n.js';

const formRecuperarPassword = document.getElementById('formRecuperarPassword');
const emailInput = document.getElementById('emailRecuperar');
const mensaje = document.getElementById('mensajeRecuperarPassword');

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

function isRedirectConfigError(error) {
  const raw = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
  return raw.includes('redirect') || raw.includes('site url') || raw.includes('not allowed');
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

  const button = formRecuperarPassword.querySelector('button[type="submit"]');
  if (button) {
    button.disabled = true;
    button.classList.add('opacity-70');
  }

  let error = null;
  const redirectCandidates = buildRedirectCandidates();

  for (const redirectTo of redirectCandidates) {
    const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    error = result.error;
    if (!error) break;
    if (!isRedirectConfigError(error)) break;
  }

  if (button) {
    button.disabled = false;
    button.classList.remove('opacity-70');
  }

  if (error) {
    mostrarMensaje(t('recoverPassword.errorSend'), 'error');
    console.error('Error resetPasswordForEmail:', { message: error.message, code: error.code });
    return;
  }

  mostrarMensaje(t('recoverPassword.successSent'), 'success');
});
