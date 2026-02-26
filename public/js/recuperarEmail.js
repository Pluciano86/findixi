import { supabase } from '../shared/supabaseClient.js';
import { t } from './i18n.js';

const formRecuperarEmail = document.getElementById('formRecuperarEmail');
const emailActualInput = document.getElementById('emailActual');
const nuevoEmailInput = document.getElementById('nuevoEmail');
const mensaje = document.getElementById('mensajeRecuperarEmail');
const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const basePath = isLocal ? '/public' : '';

function mostrarMensaje(texto, tipo) {
  if (!mensaje) return;
  mensaje.textContent = texto;
  mensaje.classList.remove('hidden', 'text-red-500', 'text-green-500');
  mensaje.classList.add(tipo === 'error' ? 'text-red-500' : 'text-green-500');
}

formRecuperarEmail?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const emailActual = emailActualInput?.value.trim();
  const nuevoEmail = nuevoEmailInput?.value.trim();

  if (!emailActual || !nuevoEmail) {
    mostrarMensaje(t('recoverEmail.errorBothRequired'), 'error');
    return;
  }

  const button = formRecuperarEmail.querySelector('button[type="submit"]');
  if (button) {
    button.disabled = true;
    button.classList.add('opacity-70');
  }

  const { data: userData, error: errorUsuario } = await supabase.auth.getUser();
  if (errorUsuario || !userData?.user) {
    if (button) {
      button.disabled = false;
      button.classList.remove('opacity-70');
    }
    mostrarMensaje(t('recoverEmail.errorNotLoggedIn'), 'error');
    console.error('Error getUser:', errorUsuario?.message);
    return;
  }

  const correoActualSesion = userData.user.email ?? '';
  if (correoActualSesion && correoActualSesion.toLowerCase() !== emailActual.toLowerCase()) {
    if (button) {
      button.disabled = false;
      button.classList.remove('opacity-70');
    }
    mostrarMensaje(t('recoverEmail.errorEmailMismatch'), 'error');
    return;
  }

  const { error } = await supabase.auth.updateUser({ email: nuevoEmail });

  if (button) {
    button.disabled = false;
    button.classList.remove('opacity-70');
  }

  if (error) {
    mostrarMensaje(t('recoverEmail.errorUpdate'), 'error');
    console.error('Error updateUser email:', error.message);
    return;
  }

  mostrarMensaje(t('recoverEmail.successUpdated'), 'success');

  setTimeout(() => {
    window.location.href = `${basePath}/logearse.html`;
  }, 2000);
});
