import { supabase } from '../shared/supabaseClient.js';

const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const basePath = isLocal ? '/public' : '';
const loginUrl = `${basePath}/logearse.html`;
const cuentaUrl = `${basePath}/usuarios/cuentaUsuario.html`;
const STORAGE_BUCKET = 'imagenesusuarios';

const form = document.getElementById('formUpgradeUp');
const nombreInput = document.getElementById('nombreUpgrade');
const apellidoInput = document.getElementById('apellidoUpgrade');
const emailInput = document.getElementById('emailUpgrade');
const telefonoInput = document.getElementById('telefonoUpgrade');
const municipioSelect = document.getElementById('municipioUpgrade');
const fotoInput = document.getElementById('fotoUpgrade');
const fotoPreview = document.getElementById('fotoPreviewUpgrade');
const fotoPlaceholder = document.getElementById('fotoPlaceholderUpgrade');
const btnSeleccionarFoto = document.getElementById('btnSeleccionarFoto');
const terminosCheckbox = document.getElementById('terminosCheckbox');
const abrirTerminos = document.getElementById('abrirTerminos');
const modalTerminos = document.getElementById('modalTerminos');
const modalContenido = document.getElementById('modalContenido');
const aceptarTerminosBtn = document.getElementById('aceptarTerminosBtn');
const cancelarModalTerminos = document.getElementById('cancelarModalTerminos');
const cerrarModalTerminos = document.getElementById('cerrarModalTerminos');
const btnActivar = document.getElementById('btnActivarUp');
const mensajeError = document.getElementById('upgradeError');
const mensajeExito = document.getElementById('upgradeSuccess');
const globalLoader = document.getElementById('globalLoader');

let usuarioActual = null;
let fotoArchivo = null;

const toggleLoader = (show) => {
  if (!globalLoader) return;
  if (show) {
    globalLoader.classList.remove('hidden');
    requestAnimationFrame(() => {
      globalLoader.classList.add('flex');
      globalLoader.classList.remove('opacity-0');
      globalLoader.classList.add('opacity-100');
    });
  } else {
    globalLoader.classList.remove('opacity-100');
    globalLoader.classList.add('opacity-0');
    setTimeout(() => {
      globalLoader.classList.remove('flex');
      globalLoader.classList.add('hidden');
    }, 500);
  }
};

const setFormDisabled = (disabled) => {
  const elementos = form?.querySelectorAll('input, select, button, textarea');
  elementos?.forEach((el) => {
    el.disabled = disabled;
  });
};

const formatearTelefono = (digits = '') => {
  if (!digits) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

telefonoInput?.addEventListener('input', () => {
  const digits = telefonoInput.value.replace(/\D/g, '').slice(0, 10);
  telefonoInput.dataset.digits = digits;
  telefonoInput.value = formatearTelefono(digits);
});

btnSeleccionarFoto?.addEventListener('click', () => fotoInput?.click());

fotoInput?.addEventListener('change', () => {
  const file = fotoInput.files[0];
  fotoArchivo = file || null;
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      if (fotoPreview) {
        fotoPreview.src = reader.result;
        fotoPreview.classList.remove('hidden');
      }
      fotoPlaceholder?.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  } else {
    if (fotoPreview) fotoPreview.classList.add('hidden');
    if (fotoPlaceholder) fotoPlaceholder.classList.remove('hidden');
  }
});

const cerrarModalTerminosFn = () => {
  if (!modalTerminos) return;
  modalTerminos.classList.add('hidden');
  modalTerminos.classList.remove('flex');
};

const abrirModalTerminosFn = () => {
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
  abrirModalTerminosFn();
});

aceptarTerminosBtn?.addEventListener('click', () => {
  if (!terminosCheckbox) return;
  terminosCheckbox.checked = true;
  terminosCheckbox.dataset.accepted = 'true';
  cerrarModalTerminosFn();
});

cancelarModalTerminos?.addEventListener('click', cerrarModalTerminosFn);
cerrarModalTerminos?.addEventListener('click', cerrarModalTerminosFn);
modalTerminos?.addEventListener('click', (event) => {
  if (event.target === modalTerminos) {
    cerrarModalTerminosFn();
  }
});

const mostrarError = (mensaje) => {
  if (!mensajeError) return;
  mensajeError.textContent = mensaje;
  mensajeError.classList.remove('hidden');
};

const limpiarAlertas = () => {
  mensajeError?.classList.add('hidden');
  mensajeExito?.classList.add('hidden');
};

const subirImagenUsuario = async (file, userId) => {
  if (!file) return null;
  const extension = file.name.split('.').pop();
  const nombreArchivo = `usuarios/${userId}_${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(nombreArchivo, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(nombreArchivo);

  return data.publicUrl;
};

const cargarPerfil = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    window.location.href = loginUrl;
    return;
  }
  usuarioActual = data.user;

  const { data: perfil, error: perfilError } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, email, telefono, municipio, imagen')
    .eq('id', usuarioActual.id)
    .single();

  if (perfilError) {
    console.error('Error cargando perfil:', perfilError);
    mostrarError('No pudimos cargar tu información. Intenta nuevamente.');
    return;
  }

  nombreInput.value = perfil?.nombre ?? '';
  apellidoInput.value = perfil?.apellido ?? '';
  emailInput.value = perfil?.email ?? usuarioActual.email ?? '';

  const telefonoDigits = perfil?.telefono || '';
  if (telefonoDigits) {
    telefonoInput.value = formatearTelefono(telefonoDigits);
    telefonoInput.dataset.digits = telefonoDigits;
  } else {
    telefonoInput.dataset.digits = '';
  }

  if (perfil?.municipio) {
    municipioSelect.value = perfil.municipio;
  }

  if (perfil?.imagen) {
    fotoPreview.src = perfil.imagen;
    fotoPreview.classList.remove('hidden');
    fotoPlaceholder?.classList.add('hidden');
  }
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  limpiarAlertas();

  const nombre = nombreInput.value.trim();
  const apellido = apellidoInput.value.trim();
  const telefonoDigits = telefonoInput?.dataset.digits || '';
  const municipio = municipioSelect.value;
  const email = emailInput.value.trim();

  if (!nombre || !apellido || !email) {
    mostrarError('Por favor completa todos los campos requeridos.');
    return;
  }

  if (telefonoDigits.length !== 10) {
    mostrarError('Por favor ingresa un número de teléfono válido (10 dígitos).');
    return;
  }

  if (!terminosCheckbox?.checked) {
    mostrarError('Debes aceptar los términos y condiciones.');
    return;
  }

  setFormDisabled(true);
  toggleLoader(true);

  try {
    let imagenPublica = null;
    if (fotoArchivo) {
      imagenPublica = await subirImagenUsuario(fotoArchivo, usuarioActual.id);
    }

    const payload = {
      nombre,
      apellido,
      telefono: telefonoDigits,
      municipio,
      membresiaUp: true
    };

    if (imagenPublica) {
      payload.imagen = imagenPublica;
    }

    const { error: updateError } = await supabase
      .from('usuarios')
      .update(payload)
      .eq('id', usuarioActual.id);

    if (updateError) {
      console.error('Error actualizando usuario:', updateError);
      mostrarError('No se pudo actualizar tu cuenta. Intenta nuevamente.');
      toggleLoader(false);
      setFormDisabled(false);
      return;
    }

    mensajeExito?.classList.remove('hidden');
    toggleLoader(false);
    setTimeout(() => {
      window.location.href = cuentaUrl;
    }, 2000);
  } catch (error) {
    console.error('Error inesperado:', error);
    mostrarError('Ocurrió un error inesperado. Intenta nuevamente.');
    toggleLoader(false);
    setFormDisabled(false);
  }
});

cargarPerfil();
