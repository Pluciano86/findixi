import { supabase } from '../shared/supabaseClient.js';
import { togglePassword } from './togglePassword.js';
import { t } from './i18n.js';

const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const basePath = isLocal ? '/public' : '';
const origin = window.location.origin;
const resetRedirectTo = `${origin}${basePath}/nuevaPassword.html`;
const urlParams = new URLSearchParams(window.location.search);
const rawRedirect = urlParams.get('redirect') || '';

function buildRedirectPath(raw) {
  if (!raw) return `${basePath}/usuarios/cuentaUsuario.html`;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//')) {
    return `${basePath}/usuarios/cuentaUsuario.html`;
  }
  if (raw.startsWith('/')) return raw;
  const cleaned = raw.replace(/^\.?\//, '');
  return `${basePath}/${cleaned}`;
}

const redirectPath = buildRedirectPath(rawRedirect);
const socialRedirectUrl = `${origin}${redirectPath}`;

window.__supabaseResetRedirect = resetRedirectTo;

async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: socialRedirectUrl }
  });

  if (error) {
    console.error('Error loginWithGoogle:', error.message);
  }

  return { error };
}

async function actualizarPerfilUsuario(usuarioId, data) {
  let reintentos = 3;
  let errorFinal = null;

  for (let i = 0; i < reintentos; i++) {
    const { error } = await supabase
      .from('usuarios')
      .update(data)
      .eq('id', usuarioId);

    if (!error) {
      console.log('Perfil actualizado correctamente en intento', i + 1);
      return true;
    }

    console.warn('Reintento de update falló:', error.message);
    errorFinal = error;
    await new Promise(res => setTimeout(res, 1000));
  }

  console.error('No se pudo actualizar perfil después de reintentos:', errorFinal);
  return false;
}

async function init() {
  const btnMostrarLogin = document.getElementById('btnMostrarLogin');
  const formLogin = document.getElementById('formLogin');
  const errorMensaje = document.getElementById('errorMensaje');

  const btnMostrarRegistro = document.getElementById('btnMostrarRegistro');
  const formRegistro = document.getElementById('formRegistro');
  const errorRegistro = document.getElementById('errorRegistro');
  const linksRecuperacion = document.getElementById('linksRecuperacion');
  const linkMostrarRegistro = document.getElementById('linkMostrarRegistro');
  const linkMostrarLogin = document.getElementById('linkMostrarLogin');
  const btnGoogleTop = document.getElementById('btnGoogleTop');

  const fotoInput = document.getElementById('fotoRegistro');
  const avatarPreview = document.getElementById('avatarPreview');
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');
  const avatarText = document.getElementById('avatarText');
  const previewFoto = document.getElementById('previewFoto');
  const consentimientoSms = document.getElementById('consentimientoSms');
  const telefonoInput = document.getElementById('telefonoRegistro');
  const telefonoLabel = document.getElementById('telefonoLabel');
  const telefonoError = document.getElementById('telefonoError');
  const passwordRegistroInput = document.getElementById('passwordRegistro');
  const passwordRegistroMensaje = document.getElementById('passwordRegistroMensaje');
  const tipoCuentaButtons = document.querySelectorAll('.tipo-cuenta-btn');
  const tipoCuentaInput = document.getElementById('tipoCuentaSeleccion');
  const membresiaUpInfo = document.getElementById('membresiaUpInfo');
  const avatarSection = document.getElementById('avatarSection');
  const tipoCuentaMensaje = document.getElementById('tipoCuentaMensaje');
  const terminosWrapper = document.getElementById('terminosWrapper');
  const terminosCheckbox = document.getElementById('terminosCheckbox');
  const terminosError = document.getElementById('terminosError');
  const abrirTerminos = document.getElementById('abrirTerminos');
  const modalTerminos = document.getElementById('modalTerminos');
  const modalContenido = document.getElementById('modalContenido');
  const aceptarTerminosBtn = document.getElementById('aceptarTerminosBtn');
  const cancelarModalTerminos = document.getElementById('cancelarModalTerminos');
  const cerrarModalTerminos = document.getElementById('cerrarModalTerminos');
  const globalLoader = document.getElementById('globalLoader');

  // Redirigir si ya hay sesión activa
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    window.location.href = redirectPath;
    return;
  }

  // Mostrar Login
  const mostrarLogin = () => {
    formLogin.classList.remove('hidden');
    btnMostrarLogin.classList.add('hidden');
    formRegistro.classList.add('hidden');
    btnMostrarRegistro.classList.remove('hidden');
    linksRecuperacion?.classList.remove('hidden');
    btnGoogleTop?.classList.add('hidden');
  };

  // Mostrar Registro
  const mostrarRegistro = () => {
    formRegistro.classList.remove('hidden');
    btnMostrarRegistro.classList.add('hidden');
    formLogin.classList.add('hidden');
    linksRecuperacion?.classList.add('hidden');
    btnGoogleTop?.classList.remove('hidden');
    btnMostrarLogin?.classList.add('hidden');
  };

  btnMostrarLogin?.addEventListener('click', mostrarLogin);
  btnMostrarRegistro?.addEventListener('click', mostrarRegistro);
  linkMostrarRegistro?.addEventListener('click', mostrarRegistro);
  linkMostrarLogin?.addEventListener('click', mostrarLogin);

  const formatearTelefono = (digits = '') => {
    if (!digits) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  telefonoInput?.addEventListener('input', () => {
    const soloDigitos = telefonoInput.value.replace(/\D/g, '').slice(0, 10);
    telefonoInput.dataset.digits = soloDigitos;
    telefonoInput.value = formatearTelefono(soloDigitos);
  });

  passwordRegistroInput?.addEventListener('input', () => {
    const valida = passwordRegistroInput.value.length >= 6;
    if (!valida) {
      passwordRegistroInput.classList.add('border-red-500');
      passwordRegistroInput.classList.remove('border-transparent');
      passwordRegistroMensaje?.classList.remove('hidden');
    } else {
      passwordRegistroInput.classList.remove('border-red-500');
      passwordRegistroInput.classList.add('border-transparent');
      passwordRegistroMensaje?.classList.add('hidden');
    }
  });

  togglePassword('passwordLogin', 'togglePasswordLogin');
  togglePassword('passwordRegistro', 'togglePasswordRegistro');
  togglePassword('confirmarPassword', 'toggleConfirmarPassword');

  // 🔹 Login con Google
  const socialButtons = document.querySelectorAll('[data-login-provider="google"]');
  socialButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const { error } = await loginWithGoogle();
      if (error) console.error(error);
    });
  });

  // 🔹 Avatar Picker
  const triggerAvatarPicker = () => fotoInput?.click();
  avatarPreview?.addEventListener('click', triggerAvatarPicker);
  avatarText?.addEventListener('click', triggerAvatarPicker);

  const setTelefonoErrorState = (visible) => {
    if (!telefonoInput) return;
    if (visible) {
      telefonoInput.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-500');
      telefonoError?.classList.remove('hidden');
    } else {
      telefonoInput.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-500');
      telefonoInput.classList.add('border-transparent');
      telefonoError?.classList.add('hidden');
    }
  };

  const setTerminosErrorState = (visible) => {
    if (terminosError) {
      terminosError.classList.toggle('hidden', !visible);
    }
  };

  const resetTerminosAceptados = () => {
    if (!terminosCheckbox) return;
    terminosCheckbox.checked = false;
    terminosCheckbox.dataset.accepted = 'false';
    setTerminosErrorState(false);
  };

  const cerrarModal = () => {
    if (!modalTerminos) return;
    modalTerminos.classList.add('hidden');
    modalTerminos.classList.remove('flex');
  };

  const abrirModal = () => {
    if (!modalTerminos) return;
    modalTerminos.classList.remove('hidden');
    modalTerminos.classList.add('flex');
    if (modalContenido) {
      modalContenido.scrollTop = 0;
    }
    if (aceptarTerminosBtn) {
      aceptarTerminosBtn.disabled = true;
    }
  };

  modalContenido?.addEventListener('scroll', () => {
    if (!modalContenido || !aceptarTerminosBtn) return;
    const atBottom = modalContenido.scrollTop + modalContenido.clientHeight >= modalContenido.scrollHeight - 10;
    if (atBottom) {
      aceptarTerminosBtn.disabled = false;
    }
  });

  abrirTerminos?.addEventListener('click', (e) => {
    e.preventDefault();
    abrirModal();
  });

  aceptarTerminosBtn?.addEventListener('click', () => {
    if (!terminosCheckbox) return;
    terminosCheckbox.checked = true;
    terminosCheckbox.dataset.accepted = 'true';
    setTerminosErrorState(false);
    cerrarModal();
  });

  cancelarModalTerminos?.addEventListener('click', cerrarModal);
  cerrarModalTerminos?.addEventListener('click', cerrarModal);

  const actualizarUIporTipoCuenta = (tipo) => {
    if (!tipoCuentaInput) return;
    const tipoNormalizado = tipo === 'up' ? 'up' : 'regular';
    tipoCuentaInput.value = tipoNormalizado;
    const esMembresiaUp = tipoNormalizado === 'up';

    tipoCuentaButtons.forEach((btn) => {
      const activo = btn.dataset.tipo === tipoNormalizado;
      const esBtnUp = btn.dataset.tipo === 'up';
      btn.classList.toggle('bg-white/10', activo && !esBtnUp);
      btn.classList.toggle('border-celeste/60', activo);
      btn.classList.toggle('shadow-[0_15px_40px_rgba(35,180,233,0.25)]', activo && esMembresiaUp);
      btn.classList.toggle('ring-2', activo);
      btn.classList.toggle('ring-celeste', activo);
      if (esBtnUp) {
        btn.classList.toggle('membresia-up-btn-active', activo);
      }
    });

    if (tipoCuentaMensaje) {
      tipoCuentaMensaje.textContent =
        tipoNormalizado === 'up'
          ? t('login.registeringUp')
          : t('login.registeringRegular');
    }

    if (telefonoInput) {
      telefonoInput.required = esMembresiaUp;
      if (telefonoLabel) {
        telefonoLabel.textContent = esMembresiaUp ? t('login.phoneLabel') : t('login.phoneOptionalLabel');
      }
      if (!esMembresiaUp) {
        setTelefonoErrorState(false);
      }
    }

    if (membresiaUpInfo) {
      if (esMembresiaUp) {
        membresiaUpInfo.classList.remove('hidden');
        membresiaUpInfo.classList.add('fade-up-enter');
      } else {
        membresiaUpInfo.classList.add('hidden');
        membresiaUpInfo.classList.remove('fade-up-enter');
      }
    }

    if (avatarSection) {
      if (esMembresiaUp) {
        avatarSection.classList.remove('hidden');
        avatarSection.classList.add('fade-up-enter');
      } else {
        avatarSection.classList.add('hidden');
        avatarSection.classList.remove('fade-up-enter');
      }
    }

    if (!esMembresiaUp && fotoInput) {
      fotoInput.value = '';
      previewFoto?.classList.add('hidden');
      avatarPlaceholder?.classList.remove('hidden');
    }

    if (terminosWrapper) {
      if (esMembresiaUp) {
        terminosWrapper.classList.remove('hidden');
      } else {
        terminosWrapper.classList.add('hidden');
        resetTerminosAceptados();
      }
    }
  };

  if (tipoCuentaButtons.length) {
    actualizarUIporTipoCuenta(tipoCuentaInput?.value || 'regular');
    tipoCuentaButtons.forEach((btn) => {
      btn.addEventListener('click', () => actualizarUIporTipoCuenta(btn.dataset.tipo));
    });
  }

  // 🔹 Preview de imagen
  fotoInput?.addEventListener('change', () => {
    const file = fotoInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        previewFoto.src = reader.result;
        previewFoto.classList.remove('hidden');
        avatarPlaceholder?.classList.add('hidden');
      };
      reader.readAsDataURL(file);
    } else {
      previewFoto?.classList.add('hidden');
      avatarPlaceholder?.classList.remove('hidden');
    }
  });

  // 🔹 Login
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMensaje.classList.add('hidden');

    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('passwordLogin').value;

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        errorMensaje.textContent = t('login.loginErrorInvalid');
        errorMensaje.classList.remove('hidden');
      } else {
        window.location.href = redirectPath;
      }
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      errorMensaje.textContent = t('login.loginErrorGeneric');
      errorMensaje.classList.remove('hidden');
    }
  });

  // 🔹 Registro
  formRegistro?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorRegistro.classList.add('hidden');

    const deshabilitarFormulario = (state) => {
      const elementos = formRegistro.querySelectorAll('input, select, button, textarea');
      elementos.forEach((el) => {
        el.disabled = state;
      });
    };

    const mostrarLoader = () => {
      if (!globalLoader) return;
      globalLoader.classList.remove('hidden');
      requestAnimationFrame(() => {
        globalLoader.classList.add('flex');
        globalLoader.classList.remove('opacity-0');
        globalLoader.classList.add('opacity-100');
      });
    };

    const ocultarLoader = () => {
      if (!globalLoader) return;
      globalLoader.classList.remove('opacity-100');
      globalLoader.classList.add('opacity-0');
      setTimeout(() => {
        globalLoader.classList.remove('flex');
        globalLoader.classList.add('hidden');
      }, 500);
    };

    const finalizarConError = (mensaje) => {
      errorRegistro.textContent = mensaje;
      errorRegistro.classList.remove('hidden');
      ocultarLoader();
      deshabilitarFormulario(false);
    };

    const nombre = document.getElementById('nombreRegistro').value.trim();
    const apellido = document.getElementById('apellidoRegistro').value.trim();
    const email = document.getElementById('emailRegistro').value.trim();
    const password = document.getElementById('passwordRegistro').value;
    const confirmar = document.getElementById('confirmarPassword').value;
    const foto = document.getElementById('fotoRegistro').files[0];
    const telefonoDigits = telefonoInput?.dataset.digits || telefonoInput?.value.replace(/\D/g, '') || '';
    const municipio = document.getElementById('municipio').value;
    const notificarText = consentimientoSms?.checked ?? true;
    const tipoCuentaSeleccion = tipoCuentaInput?.value || 'regular';
    const esMembresiaUp = tipoCuentaSeleccion === 'up';

    if (password.length < 6) {
      passwordRegistroMensaje?.classList.remove('hidden');
      passwordRegistroInput?.classList.add('border-red-500');
      passwordRegistroInput?.classList.remove('border-transparent');
      errorRegistro.textContent = t('login.passwordMin');
      errorRegistro.classList.remove('hidden');
      return;
    }

    if (password !== confirmar) {
      errorRegistro.textContent = t('login.registerErrorPasswordMismatch');
      errorRegistro.classList.remove('hidden');
      return;
    }

    if (esMembresiaUp && !telefonoDigits) {
      errorRegistro.textContent = t('login.phoneRequiredError');
      errorRegistro.classList.remove('hidden');
      setTelefonoErrorState(true);
      telefonoInput?.focus();
      return;
    } else {
      setTelefonoErrorState(false);
    }

    if (telefonoDigits && telefonoDigits.length !== 10) {
      errorRegistro.textContent = t('login.registerErrorPhoneInvalid');
      errorRegistro.classList.remove('hidden');
      setTelefonoErrorState(true);
      return;
    }
    setTelefonoErrorState(false);

    if (esMembresiaUp && !terminosCheckbox?.checked) {
      errorRegistro.textContent = t('login.termsError');
      errorRegistro.classList.remove('hidden');
      setTerminosErrorState(true);
      terminosWrapper?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    } else {
      setTerminosErrorState(false);
    }

    if (esMembresiaUp && !foto) {
      errorRegistro.textContent = t('login.registerErrorPhotoRequired');
      errorRegistro.classList.remove('hidden');
      avatarSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    try {
      mostrarLoader();
      deshabilitarFormulario(true);
      const { data: signup, error: errorSignup } = await supabase.auth.signUp({
        email,
        password
      });

      if (errorSignup || !signup?.user?.id) {
        const mensaje = errorSignup?.message || t('login.registerErrorCreateAccount');
        errorRegistro.textContent = mensaje;
        errorRegistro.classList.remove('hidden');
        return;
      }

      const userId = signup.user.id;
      let imagen = '';

      // 📸 Subir imagen si existe
      if (foto) {
        const extension = foto.name.split('.').pop();
        const nombreArchivo = `usuarios/${userId}_${Date.now()}.${extension}`;

        const { error: errorUpload } = await supabase.storage
          .from('imagenesusuarios')
          .upload(nombreArchivo, foto, {
            cacheControl: '3600',
            upsert: true,
            contentType: foto.type
          });

        if (!errorUpload) {
          const { data } = supabase.storage
            .from('imagenesusuarios')
            .getPublicUrl(nombreArchivo);
          imagen = data.publicUrl;
        }
      }

      const payload = {
        nombre,
        apellido,
        telefono: telefonoDigits || null,
        municipio,
        imagen,
        notificartext: notificarText,
        membresiaUp: esMembresiaUp
      };
      const actualizado = await actualizarPerfilUsuario(userId, payload);

      if (!actualizado) {
        errorRegistro.textContent = t('login.registerErrorSave');
        errorRegistro.classList.remove('hidden');
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (!loginError) {
        ocultarLoader();
        setTimeout(() => {
          window.location.href = redirectPath;
        }, 200);
      } else {
        ocultarLoader();
        deshabilitarFormulario(false);
        const mensaje = loginError?.message || t('login.registerErrorCreatedButLogin');
        alert(mensaje);
        window.location.reload();
      }
    } catch (err) {
      console.error("Error en registro:", err);
      finalizarConError(err?.message || t('login.registerErrorGeneric'));
    }
  });
}

init();
