import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/supabaseClient.js';

// Elementos vista de validación
const vistaValidacionEl = document.getElementById('vistaValidacion');
const logoValidacionEl = document.getElementById('logoValidacion');
const logoPlaceholderEl = document.getElementById('logoPlaceholder');
const nombreValidacionEl = document.getElementById('nombreValidacion');
const inputCodigoEl = document.getElementById('inputCodigoSecreto');
const btnValidarEl = document.getElementById('btnValidarCodigo');
const mensajeValidacionEl = document.getElementById('mensajeValidacion');

// Elementos vista del cupón
const vistaCuponEl = document.getElementById('vistaCupon');
const cuponLogoEl = document.getElementById('cuponLogo');
const cuponComercioNombreEl = document.getElementById('cuponComercioNombre');
const cuponComercioMunicipioEl = document.getElementById('cuponComercioMunicipio');
const cuponTituloEl = document.getElementById('cuponTitulo');
const cuponDescripcionEl = document.getElementById('cuponDescripcion');
const cuponFechaEl = document.getElementById('cuponFecha');
const btnRedimirEl = document.getElementById('btnRedimirCupon');
const mensajeCuponEl = document.getElementById('mensajeCupon');
const usuarioCuponImagenEl = document.getElementById('usuarioCuponImagen');
const usuarioCuponInicialesEl = document.getElementById('usuarioCuponIniciales');
const usuarioCuponNombreEl = document.getElementById('usuarioCuponNombre');

const LOGO_PLACEHOLDER = 'https://placehold.co/160x160?text=Logo';
const MENSAJE_VALIDACION_BASE = 'text-sm text-center min-h-[1.25rem]';
const MENSAJE_CUPON_BASE = 'text-sm text-center mt-3 min-h-[1.25rem]';

const params = new URLSearchParams(window.location.search);
const qrParam = (params.get('qr') || '').trim();

let cuponActual = null;
let comercioActual = null;
let cuponUsuarioActual = null;
let codigoValidado = false;
let usuarioDelCupon = null;

const actualizarMensaje = (
  elemento,
  texto,
  color = 'text-red-600',
  baseClass = 'text-sm text-center'
) => {
  if (!elemento) return;
  elemento.textContent = texto || '';
  elemento.className = `${baseClass} ${color}`.trim();
};

const normalizarLogoUrl = (valor) => {
  if (!valor || typeof valor !== 'string') return null;
  if (/^https?:\/\//i.test(valor)) return valor;
  const { data } = supabase.storage.from('galeriacomercios').getPublicUrl(valor);
  return data?.publicUrl || valor;
};

const formatearFecha = (iso) => {
  if (!iso) return '--';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '--';
  return fecha.toLocaleDateString('es-PR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatearFechaHora = (iso) => {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es-PR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatearHora = (iso) => {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleTimeString('es-PR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const obtenerIniciales = (nombreCompleto, email) => {
  const limpio = (nombreCompleto || '').trim();
  if (limpio) {
    const partes = limpio.split(/\s+/);
    const primeras = partes.slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
    if (primeras) return primeras;
  }
  return (email || '??').slice(0, 2).toUpperCase();
};

const actualizarUsuarioCuponCard = () => {
  if (!usuarioCuponImagenEl || !usuarioCuponInicialesEl || !usuarioCuponNombreEl) return;

  const debeMostrar = codigoValidado && (usuarioDelCupon || cuponUsuarioActual);
  if (!debeMostrar) {
    usuarioCuponImagenEl.classList.add('hidden');
    usuarioCuponInicialesEl.classList.add('hidden');
    if (usuarioCuponNombreEl) usuarioCuponNombreEl.textContent = '—';
    return;
  }

  const nombre = usuarioDelCupon
    ? `${usuarioDelCupon.nombre || ''} ${usuarioDelCupon.apellido || ''}`.trim() || usuarioDelCupon.email || 'Usuario'
    : 'Usuario no disponible';
  const email = usuarioDelCupon?.email || 'Sin correo disponible';
  const imagen = usuarioDelCupon?.imagen;

  if (imagen) {
    usuarioCuponImagenEl.src = imagen;
    usuarioCuponImagenEl.classList.remove('hidden');
    usuarioCuponInicialesEl.classList.add('hidden');
  } else {
    usuarioCuponImagenEl.classList.add('hidden');
    usuarioCuponInicialesEl.textContent = obtenerIniciales(nombre, email);
    usuarioCuponInicialesEl.classList.remove('hidden');
  }

  usuarioCuponNombreEl.textContent = nombre.toUpperCase();
};

const mostrarVistaCupon = () => {
  if (!vistaCuponEl || !vistaValidacionEl) return;

  vistaValidacionEl.classList.add('opacity-0', 'translate-y-3', 'pointer-events-none');
  setTimeout(() => {
    vistaValidacionEl.classList.add('hidden');
    vistaCuponEl.classList.remove('hidden');
    requestAnimationFrame(() => {
      vistaCuponEl.classList.remove('opacity-0', '-translate-y-3');
    });
  }, 220);
};

const obtenerNombreMunicipio = async (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;

  if (typeof valor === 'string' && Number.isNaN(Number(valor))) {
    return valor;
  }

  const numero = Number(valor);
  if (Number.isNaN(numero)) return null;

  const { data, error } = await supabase
    .from('Municipios')
    .select('nombre')
    .eq('id', numero)
    .maybeSingle();

  if (error) {
    console.warn('No se pudo obtener el municipio:', error.message);
    return null;
  }

  return data?.nombre || null;
};

const obtenerLogoComercio = async (idComercio) => {
  if (!idComercio) return null;

  const { data, error } = await supabase
    .from('imagenesComercios')
    .select('imagen')
    .eq('idComercio', idComercio)
    .eq('logo', true)
    .maybeSingle();

  if (error) {
    console.warn('No se pudo obtener el logo del comercio:', error.message);
    return null;
  }

  if (!data?.imagen) return null;

  return normalizarLogoUrl(data.imagen);
};

const obtenerInfoComercio = async (idComercio, comercioBase = null) => {
  const baseLogo = comercioBase?.logoUrl ?? comercioBase?.logo ?? null;
  const baseInfo = {
    id: comercioBase?.id ?? idComercio ?? null,
    nombre: comercioBase?.nombre ?? 'Comercio',
    municipio: comercioBase?.municipio ?? null,
    logoUrl: normalizarLogoUrl(baseLogo) || baseLogo
  };

  if (!idComercio) {
    let municipioNombre = baseInfo.municipio;
    if (municipioNombre !== null && municipioNombre !== undefined && typeof municipioNombre !== 'string') {
      municipioNombre = await obtenerNombreMunicipio(municipioNombre);
    }
    if (!municipioNombre || (typeof municipioNombre === 'string' && !municipioNombre.trim())) {
      municipioNombre = '—';
    }
    return {
      id: baseInfo.id,
      nombre: baseInfo.nombre,
      municipio: municipioNombre,
      logoUrl: baseInfo.logoUrl || null
    };
  }

  const { data, error } = await supabase
    .from('Comercios')
    .select('id, nombre, municipio, idMunicipio, logo')
    .eq('id', idComercio)
    .maybeSingle();

  if (error) {
    console.warn('Error obteniendo comercio:', error);
  }

  const municipioValor =
    baseInfo.municipio ??
    data?.municipio ??
    data?.idMunicipio ??
    null;

  let municipioNombre;
  if (typeof municipioValor === 'string') {
    municipioNombre = municipioValor;
  } else if (municipioValor !== null && municipioValor !== undefined) {
    municipioNombre = await obtenerNombreMunicipio(municipioValor);
  }
  if (!municipioNombre || (typeof municipioNombre === 'string' && !municipioNombre.trim())) {
    municipioNombre = '—';
  }

  let logoUrl = baseInfo.logoUrl || null;
  if (!logoUrl && data?.logo) {
    logoUrl = normalizarLogoUrl(data.logo);
  }
  if (!logoUrl) {
    logoUrl = await obtenerLogoComercio(idComercio);
  }

  return {
    id: data?.id ?? baseInfo.id ?? idComercio,
    nombre: data?.nombre || baseInfo.nombre || 'Comercio',
    municipio: municipioNombre,
    logoUrl: logoUrl || null
  };
};

const actualizarEstadoRedencion = () => {
  if (!btnRedimirEl || !mensajeCuponEl) return;

  if (!cuponActual) {
    btnRedimirEl.classList.add('hidden');
    btnRedimirEl.disabled = true;
    actualizarMensaje(
      mensajeCuponEl,
      'Escanea un cupón o ingresa su código secreto para continuar.',
      'text-gray-500',
      MENSAJE_CUPON_BASE
    );
    return;
  }

  const estaRedimido = cuponUsuarioActual
    ? cuponUsuarioActual.redimido
    : cuponActual.activo === false;

  if (estaRedimido) {
    btnRedimirEl.classList.add('hidden');
    btnRedimirEl.disabled = true;
    const fechaTexto = cuponUsuarioActual?.fechaRedimido
      ? formatearFechaHora(cuponUsuarioActual.fechaRedimido)
      : '';
    const aviso = fechaTexto
      ? `Este cupón ya fue redimido el ${fechaTexto}.`
      : 'Este cupón ya fue redimido.';
    actualizarMensaje(mensajeCuponEl, aviso, 'text-orange-600', MENSAJE_CUPON_BASE);
    return;
  }

  if (!codigoValidado) {
    btnRedimirEl.classList.add('hidden');
    btnRedimirEl.disabled = true;
    actualizarMensaje(
      mensajeCuponEl,
      'Valida el código secreto para poder redimir este cupón.',
      'text-gray-600',
      MENSAJE_CUPON_BASE
    );
    return;
  }

  btnRedimirEl.classList.remove('hidden');
  btnRedimirEl.disabled = false;
  actualizarMensaje(mensajeCuponEl, '', 'text-gray-600', MENSAJE_CUPON_BASE);
};

const renderizarCupon = () => {
  if (!cuponActual) return;

  const infoComercio = comercioActual ?? {
    nombre: 'Comercio',
    municipio: '—',
    logoUrl: null,
  };

  if (cuponLogoEl) {
    cuponLogoEl.src = infoComercio.logoUrl ? infoComercio.logoUrl : LOGO_PLACEHOLDER;
    cuponLogoEl.classList.remove('hidden');
  }

  if (cuponComercioNombreEl) {
    cuponComercioNombreEl.textContent = infoComercio.nombre || 'Comercio';
  }

  if (cuponComercioMunicipioEl) {
    cuponComercioMunicipioEl.textContent = infoComercio.municipio || '—';
  }

  if (cuponTituloEl) {
    cuponTituloEl.textContent = cuponActual.titulo || 'Cupón';
  }

  if (cuponDescripcionEl) {
    cuponDescripcionEl.textContent = cuponActual.descripcion || '';
  }

  const fechaExpiracion = cuponActual.fechafin ?? cuponActual.fechaFin ?? null;
  if (cuponFechaEl) {
    cuponFechaEl.textContent = fechaExpiracion
      ? `Vence: ${formatearFecha(fechaExpiracion)}`
      : 'Vigencia indefinida';
  }

  mostrarVistaCupon();
  actualizarEstadoRedencion();
  actualizarUsuarioCuponCard();
};

const cargarUsuarioDelCupon = async (usuarioId) => {
  if (!usuarioId) return null;

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, email, imagen, telefono')
    .eq('id', usuarioId)
    .maybeSingle();

  if (error) {
    console.warn('No se pudo obtener el usuario del cupón:', error.message);
    return null;
  }

  return data || null;
};

const cargarDatosIniciales = async () => {
  if (!btnValidarEl) return;

  codigoValidado = false;
  cuponActual = null;
  comercioActual = null;
  cuponUsuarioActual = null;
  actualizarEstadoRedencion();

  if (inputCodigoEl) inputCodigoEl.disabled = false;

  if (!qrParam) {
    actualizarMensaje(
      mensajeValidacionEl,
      'Ingresa el código secreto para validar el cupón.',
      'text-gray-500',
      MENSAJE_VALIDACION_BASE
    );
    btnValidarEl.disabled = false;
    return;
  }

  actualizarMensaje(
    mensajeValidacionEl,
    'Cargando datos del cupón...',
    'text-gray-500',
    MENSAJE_VALIDACION_BASE
  );
  btnValidarEl.disabled = true;

  try {
    const { data: registroQR, error: qrError } = await supabase
      .from('cuponesUsuarios')
      .select('id, codigoqr, idCupon, idUsuario, redimido, fechaRedimido')
      .eq('codigoqr', qrParam)
      .maybeSingle();

    if (qrError) {
      console.error('Error consultando cuponesUsuarios por QR:', qrError);
      actualizarMensaje(
        mensajeValidacionEl,
        'No fue posible preparar el cupón. Inténtelo más tarde.',
        'text-red-600',
        MENSAJE_VALIDACION_BASE
      );
      btnValidarEl.disabled = true;
      return;
    }

    if (!registroQR) {
      actualizarMensaje(
        mensajeValidacionEl,
        'Cupón no encontrado para este QR.',
        'text-red-600',
        MENSAJE_VALIDACION_BASE
      );
      btnValidarEl.disabled = true;
      return;
    }

    cuponUsuarioActual = registroQR;
    usuarioDelCupon = await cargarUsuarioDelCupon(registroQR.idUsuario);

    const { data: cuponData, error: cuponError } = await supabase
      .from('cupones')
      .select(`
        id,
        titulo,
        descripcion,
        imagen,
        codigosecreto,
        fechainicio,
        fechafin,
        activo,
        idComercio,
        Comercios (
          id,
          nombre,
          logo,
          municipio,
          idMunicipio
        )
      `)
      .eq('id', registroQR.idCupon)
      .maybeSingle();

    if (cuponError) {
      console.error('Error consultando cupón:', cuponError);
      actualizarMensaje(
        mensajeValidacionEl,
        'No fue posible cargar la información del cupón.',
        'text-red-600',
        MENSAJE_VALIDACION_BASE
      );
      btnValidarEl.disabled = true;
      return;
    }

    if (!cuponData) {
      actualizarMensaje(
        mensajeValidacionEl,
        'El cupón asociado no existe o fue eliminado.',
        'text-red-600',
        MENSAJE_VALIDACION_BASE
      );
      btnValidarEl.disabled = true;
      return;
    }

    cuponActual = cuponData;

    const comercioRelacion = cuponActual?.Comercios || null;
    const comercioBase = comercioRelacion
      ? {
          id: comercioRelacion.id ?? cuponActual.idComercio,
          nombre: comercioRelacion.nombre ?? 'Comercio',
          logoUrl: comercioRelacion.logo ?? null,
          municipio: comercioRelacion.municipio ?? comercioRelacion.idMunicipio ?? null
        }
      : null;

    comercioActual = await obtenerInfoComercio(cuponActual?.idComercio, comercioBase);

    if (logoValidacionEl) {
      const logoUrl = comercioActual?.logoUrl || LOGO_PLACEHOLDER;
      logoValidacionEl.src = logoUrl;
      logoValidacionEl.classList.remove('hidden');
    }
    logoPlaceholderEl?.classList.add('hidden');

    if (nombreValidacionEl) {
      nombreValidacionEl.textContent = comercioActual?.nombre || 'Comercio';
    }

    actualizarMensaje(
      mensajeValidacionEl,
      'Ingresa el código secreto para validar este cupón.',
      'text-gray-600',
      MENSAJE_VALIDACION_BASE
    );
    const cupRedimido = cuponUsuarioActual?.redimido;
    btnValidarEl.disabled = !!cupRedimido;
    if (inputCodigoEl) inputCodigoEl.disabled = !!cupRedimido;
    if (cupRedimido) {
      actualizarMensaje(mensajeValidacionEl, 'Este cupón ya fue redimido.', 'text-orange-600', MENSAJE_VALIDACION_BASE);
    }
    actualizarEstadoRedencion();
    actualizarUsuarioCuponCard();
  } catch (error) {
    console.error('Error cargando datos iniciales del cupón:', error);
    actualizarMensaje(
      mensajeValidacionEl,
      'No fue posible preparar el cupón. Inténtelo más tarde.',
      'text-red-600',
      MENSAJE_VALIDACION_BASE
    );
    btnValidarEl.disabled = true;
  }
};

const validarCodigo = async () => {
  if (!inputCodigoEl || !btnValidarEl) return;

  const valorIngresado = (inputCodigoEl.value || '').trim();

  if (!valorIngresado) {
    actualizarMensaje(mensajeValidacionEl, 'Ingresa el código secreto.', 'text-red-600', MENSAJE_VALIDACION_BASE);
    return;
  }

  if (!cuponActual) {
    actualizarMensaje(
      mensajeValidacionEl,
      'Escanea el QR del cupón para continuar.',
      'text-red-600',
      MENSAJE_VALIDACION_BASE
    );
    return;
  }

  codigoValidado = false;
  actualizarMensaje(mensajeValidacionEl, 'Validando código...', 'text-gray-500', MENSAJE_VALIDACION_BASE);
  btnValidarEl.disabled = true;
  try {

    const codigoEsperado = String(cuponActual.codigosecreto || '').trim();
    const coincide = codigoEsperado && codigoEsperado === valorIngresado;

    if (!coincide) {
      codigoValidado = false;
      actualizarMensaje(
        mensajeValidacionEl,
        'Código incorrecto. Intente nuevamente.',
        'text-red-600',
        MENSAJE_VALIDACION_BASE
      );
      actualizarEstadoRedencion();
      return;
    }

    codigoValidado = true;
    actualizarMensaje(
      mensajeValidacionEl,
      'Código válido. Puedes proceder a redimir el cupón.',
      'text-emerald-600',
      MENSAJE_VALIDACION_BASE
    );
    renderizarCupon();
    actualizarUsuarioCuponCard();
  } catch (error) {
    console.error('Error general validando el código:', error);
    actualizarMensaje(mensajeValidacionEl, 'Error inesperado validando el código.', 'text-red-600', MENSAJE_VALIDACION_BASE);
  } finally {
    btnValidarEl.disabled = false;
  }
};

const redimirCupon = async () => {
  if (!btnRedimirEl) return;

  if (!cuponActual) {
    actualizarMensaje(mensajeCuponEl, 'Valida primero el código del cupón.', 'text-red-600', MENSAJE_CUPON_BASE);
    return;
  }

  if (!codigoValidado) {
    actualizarMensaje(
      mensajeCuponEl,
      'Debes validar el código secreto antes de redimir el cupón.',
      'text-red-600',
      MENSAJE_CUPON_BASE
    );
    return;
  }

  if (cuponUsuarioActual?.redimido || cuponActual.activo === false) {
    actualizarMensaje(mensajeCuponEl, 'Este cupón ya fue redimido.', 'text-orange-600', MENSAJE_CUPON_BASE);
    return;
  }

  if (!cuponUsuarioActual) {
    actualizarMensaje(
      mensajeCuponEl,
      'No se encontró el registro del cupón para redimir.',
      'text-red-600',
      MENSAJE_CUPON_BASE
    );
    return;
  }

  btnRedimirEl.disabled = true;

  const confirmar = window.confirm('¿Seguro que desea redimir el cupón?');
  if (!confirmar) {
    btnRedimirEl.disabled = false;
    actualizarMensaje(mensajeCuponEl, 'Redención cancelada.', 'text-gray-500', MENSAJE_CUPON_BASE);
    return;
  }

  actualizarMensaje(mensajeCuponEl, 'Redimiendo cupón...', 'text-gray-500', MENSAJE_CUPON_BASE);

  try {
    const fechaRedimido = new Date().toISOString();

    if (cuponUsuarioActual) {
      const { error } = await supabase
        .from('cuponesUsuarios')
        .update({
          redimido: true,
          fechaRedimido
        })
        .eq('id', cuponUsuarioActual.id);

      if (error) {
        throw error;
      }

      cuponUsuarioActual.redimido = true;
      cuponUsuarioActual.fechaRedimido = fechaRedimido;
      const telefonoUsuario = usuarioDelCupon?.telefono
        ? usuarioDelCupon.telefono.startsWith('+1')
          ? usuarioDelCupon.telefono
          : `+1${usuarioDelCupon.telefono}`
        : null;
      const nombreUsuario = usuarioDelCupon?.nombre || '';
      const nombreComercio = comercioActual?.nombre || '';
      const fechaFormateada = formatearFecha(fechaRedimido);
      const horaFormateada = formatearHora(fechaRedimido);

      if (
        telefonoUsuario &&
        nombreUsuario &&
        nombreComercio &&
        fechaFormateada &&
        fechaFormateada !== '--' &&
        horaFormateada
      ) {
        const funcionesUrl = `${SUPABASE_URL}/functions/v1/send-sms-cupon`;
        try {
          await fetch(funcionesUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telefono: telefonoUsuario,
              nombreUsuario,
              nombreComercio,
              fecha: fechaFormateada,
              hora: horaFormateada
            })
          });
        } catch (smsError) {
          console.warn('No se pudo enviar el SMS de cupón:', smsError);
        }
      }
    } else {
      const { error } = await supabase
        .from('cupones')
        .update({ activo: false })
        .eq('id', cuponActual.id);

      if (error) {
        throw error;
      }

      cuponActual.activo = false;
    }

    actualizarMensaje(mensajeCuponEl, 'Cupón redimido exitosamente.', 'text-emerald-600', MENSAJE_CUPON_BASE);
    actualizarEstadoRedencion();
    actualizarUsuarioCuponCard();
  } catch (error) {
    console.error('Error redimiendo cupón:', error);
    actualizarMensaje(mensajeCuponEl, 'Error al redimir el cupón. Inténtelo nuevamente.', 'text-red-600', MENSAJE_CUPON_BASE);
    btnRedimirEl.disabled = false;
  }
};

btnValidarEl?.addEventListener('click', validarCodigo);
inputCodigoEl?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    validarCodigo();
  }
});
btnRedimirEl?.addEventListener('click', redimirCupon);

cargarDatosIniciales();
