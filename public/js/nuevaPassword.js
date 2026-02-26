import { supabase } from '../shared/supabaseClient.js';
import { togglePassword } from './togglePassword.js';

const formNuevaPassword = document.getElementById('formNuevaPassword');
const passwordInput = document.getElementById('nuevaPassword');
const confirmarInput = document.getElementById('confirmarPasswordNueva');
const mensaje = document.getElementById('mensajeNuevaPassword');
const buttonSubmit = formNuevaPassword?.querySelector('button[type="submit"]');
const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const basePath = isLocal ? '/public' : '';

togglePassword('nuevaPassword', 'toggleNuevaPassword');
togglePassword('confirmarPasswordNueva', 'toggleConfirmarPasswordNueva');

function mostrarMensaje(texto, tipo) {
  if (!mensaje) return;
  mensaje.textContent = texto;
  mensaje.classList.remove('hidden', 'text-red-500', 'text-green-500');
  mensaje.classList.add(tipo === 'error' ? 'text-red-500' : 'text-green-500');
}

function deshabilitarFormulario() {
  if (!formNuevaPassword) return;
  formNuevaPassword.querySelectorAll('input').forEach(input => {
    input.disabled = true;
    input.classList.add('opacity-70');
  });
  if (buttonSubmit) {
    buttonSubmit.disabled = true;
    buttonSubmit.classList.add('opacity-70');
  }
}

function habilitarFormulario() {
  if (!formNuevaPassword) return;
  formNuevaPassword.querySelectorAll('input').forEach(input => {
    input.disabled = false;
    input.classList.remove('opacity-70');
  });
  if (buttonSubmit) {
    buttonSubmit.disabled = false;
    buttonSubmit.classList.remove('opacity-70');
  }
}

async function inicializarSesionRecuperacion() {
  const hash = window.location.hash;

  if (hash?.includes('access_token') && hash?.includes('refresh_token')) {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (type === 'recovery' && accessToken && refreshToken) {
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (setSessionError) {
        console.error('Error setSession recovery:', setSessionError.message);
      } else {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('Error getSession recovery:', sessionError.message);
  }

  if (!sessionData?.session) {
    mostrarMensaje('Debes usar el enlace enviado a tu correo para restablecer tu contraseña.', 'error');
    deshabilitarFormulario();
    return false;
  }

  habilitarFormulario();
  return true;
}

deshabilitarFormulario();
const sesionLista = inicializarSesionRecuperacion();

formNuevaPassword?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const sesionValida = await sesionLista;
  if (!sesionValida) {
    mostrarMensaje('Debes usar el enlace enviado a tu correo para restablecer tu contraseña.', 'error');
    return;
  }

  const nuevaPassword = passwordInput?.value.trim();
  const confirmarPassword = confirmarInput?.value.trim();

  if (!nuevaPassword || !confirmarPassword) {
    mostrarMensaje('Completa ambos campos para continuar.', 'error');
    return;
  }

  if (nuevaPassword !== confirmarPassword) {
    mostrarMensaje('Las contraseñas no coinciden.', 'error');
    return;
  }

  if (buttonSubmit) {
    buttonSubmit.disabled = true;
    buttonSubmit.classList.add('opacity-70');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    mostrarMensaje('Debes usar el enlace enviado a tu correo para restablecer tu contraseña.', 'error');
    if (buttonSubmit) {
      buttonSubmit.disabled = false;
      buttonSubmit.classList.remove('opacity-70');
    }
    return;
  }

  const { error } = await supabase.auth.updateUser({ password: nuevaPassword });

  if (buttonSubmit) {
    buttonSubmit.disabled = false;
    buttonSubmit.classList.remove('opacity-70');
  }

  if (error) {
    mostrarMensaje('No pudimos actualizar tu contraseña. Intenta nuevamente.', 'error');
    console.error('Error updateUser password:', error.message);
    return;
  }

  mostrarMensaje('¡Contraseña actualizada! Serás redirigido al login.', 'success');

  setTimeout(() => {
    window.location.href = `${basePath}/logearse.html`;
  }, 2000);
});
