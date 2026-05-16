import { supabase } from '../shared/supabaseClient.js';
import { requireAuth } from './authGuard.js';
import { calcularTiemposParaLista } from './calcularTiemposParaLista.js';
import { mostrarCercanosComida } from './cercanosComida.js';
import { mostrarPlayasCercanas } from './playasCercanas.js';
import { mostrarLugaresCercanos } from './lugaresCercanos.js';
import { cargarGaleriaLugar } from './galeriaLugar.js';
import { renderHorariosLugar } from './horariosLugar.js';

const params = new URLSearchParams(window.location.search);
const idLugar = params.get('id');

const loader = document.getElementById('loader');
const nombreEl = document.getElementById('nombreLugar');
const categoriasEl = document.getElementById('categoriaLugar');
const precioEl = document.getElementById('precioEntrada');
const direccionEl = document.getElementById('textoDireccionLugar');
const tiempoEl = document.getElementById('tiempoVehiculo');
const btnFavorito = document.getElementById('btnFavorito');
const estadoHorarioIcono = document.querySelector('#estadoHorarioContainer i');
const estadoHorarioTexto = document.querySelector('#estadoHorarioContainer p');
const fuenteDatosLugarEl = document.getElementById('fuenteDatosLugar');
const btnSugerirCambioLugar = document.getElementById('btnSugerirCambioLugar');
const modalSugerenciaLugar = document.getElementById('modalSugerenciaLugar');
const formSugerenciaLugar = document.getElementById('formSugerenciaLugar');
const btnCerrarSugerenciaLugar = document.getElementById('btnCerrarSugerenciaLugar');
const btnCancelarSugerenciaLugar = document.getElementById('btnCancelarSugerenciaLugar');
const btnEnviarSugerenciaLugar = document.getElementById('btnEnviarSugerenciaLugar');
const sugerenciaLugarEstado = document.getElementById('sugerenciaLugarEstado');

const sugerenciaCategoriaEl = document.getElementById('sugerenciaCategoria');
const sugerenciaValorActualEl = document.getElementById('sugerenciaValorActual');
const sugerenciaValorSugeridoEl = document.getElementById('sugerenciaValorSugerido');
const sugerenciaComentarioEl = document.getElementById('sugerenciaComentario');
const sugerenciaNombreContactoEl = document.getElementById('sugerenciaNombreContacto');
const sugerenciaEmailContactoEl = document.getElementById('sugerenciaEmailContacto');
const sugerenciaTelefonoContactoEl = document.getElementById('sugerenciaTelefonoContacto');

let usuarioId = null;
let lugarFavorito = false;
let lugarActual = null;
let sugerenciaEnviando = false;

function mostrarLoader() {
  loader?.classList.remove('hidden');
  loader?.classList.add('flex');
}

function ocultarLoader() {
  loader?.classList.add('hidden');
  loader?.classList.remove('flex');
}

function mostrarEstadoSugerencia(texto, tipo = 'info') {
  if (!sugerenciaLugarEstado) return;
  const colors = {
    info: 'text-gray-700',
    error: 'text-red-600',
    success: 'text-emerald-600',
  };
  sugerenciaLugarEstado.className = `text-sm ${colors[tipo] || colors.info}`;
  sugerenciaLugarEstado.textContent = texto;
  sugerenciaLugarEstado.classList.remove('hidden');
}

function limpiarEstadoSugerencia() {
  if (!sugerenciaLugarEstado) return;
  sugerenciaLugarEstado.textContent = '';
  sugerenciaLugarEstado.classList.add('hidden');
}

function abrirModalSugerencia() {
  if (!modalSugerenciaLugar || !lugarActual?.id) return;
  limpiarEstadoSugerencia();
  modalSugerenciaLugar.classList.remove('hidden');
  modalSugerenciaLugar.classList.add('flex');
  document.getElementById('bodyLugar')?.classList.add('overflow-hidden');
}

function cerrarModalSugerencia() {
  if (!modalSugerenciaLugar) return;
  modalSugerenciaLugar.classList.add('hidden');
  modalSugerenciaLugar.classList.remove('flex');
  document.getElementById('bodyLugar')?.classList.remove('overflow-hidden');
}

function validarEmailOpcional(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function enviarSugerenciaLugar(event) {
  event.preventDefault();
  if (sugerenciaEnviando) return;
  if (!lugarActual?.id) {
    mostrarEstadoSugerencia('No pudimos identificar este lugar para guardar la sugerencia.', 'error');
    return;
  }

  const categoria = String(sugerenciaCategoriaEl?.value || 'otro').trim() || 'otro';
  const valorActual = String(sugerenciaValorActualEl?.value || '').trim();
  const valorSugerido = String(sugerenciaValorSugeridoEl?.value || '').trim();
  const comentario = String(sugerenciaComentarioEl?.value || '').trim();
  const nombreContacto = String(sugerenciaNombreContactoEl?.value || '').trim();
  const emailContacto = String(sugerenciaEmailContactoEl?.value || '').trim().toLowerCase();
  const telefonoContacto = String(sugerenciaTelefonoContactoEl?.value || '').trim();

  if (comentario.length < 8) {
    mostrarEstadoSugerencia('Escribe más detalle en el comentario (mínimo 8 caracteres).', 'error');
    return;
  }
  if (!validarEmailOpcional(emailContacto)) {
    mostrarEstadoSugerencia('El email no parece válido.', 'error');
    return;
  }

  sugerenciaEnviando = true;
  if (btnEnviarSugerenciaLugar) {
    btnEnviarSugerenciaLugar.disabled = true;
    btnEnviarSugerenciaLugar.classList.add('opacity-60', 'cursor-not-allowed');
  }
  mostrarEstadoSugerencia('Enviando sugerencia...', 'info');

  let authUserId = null;
  try {
    const { data } = await supabase.auth.getUser();
    authUserId = data?.user?.id || null;
  } catch {
    authUserId = null;
  }

  const payload = {
    id_lugar: lugarActual.id,
    nombre_lugar: lugarActual.nombre || null,
    categoria_sugerencia: categoria,
    campo: categoria,
    valor_actual: valorActual || null,
    valor_sugerido: valorSugerido || null,
    comentario,
    nombre_contacto: nombreContacto || null,
    email_contacto: emailContacto || null,
    telefono_contacto: telefonoContacto || null,
    fuente: 'perfilLugar',
    user_id: authUserId,
    metadata: {
      perfil_url: window.location.href,
      municipio: lugarActual.municipio || null,
    },
  };

  const { error } = await supabase
    .from('sugerencias_cambios_lugares')
    .insert([payload]);

  sugerenciaEnviando = false;
  if (btnEnviarSugerenciaLugar) {
    btnEnviarSugerenciaLugar.disabled = false;
    btnEnviarSugerenciaLugar.classList.remove('opacity-60', 'cursor-not-allowed');
  }

  if (error) {
    console.error('Error enviando sugerencia de lugar:', error);
    mostrarEstadoSugerencia('No pudimos guardar la sugerencia. Inténtalo de nuevo.', 'error');
    return;
  }

  mostrarEstadoSugerencia('Gracias. Tu sugerencia fue enviada correctamente.', 'success');
  formSugerenciaLugar?.reset();
  setTimeout(() => {
    cerrarModalSugerencia();
    limpiarEstadoSugerencia();
  }, 1200);
}

function inicializarSugerenciasLugar() {
  if (!btnSugerirCambioLugar || !modalSugerenciaLugar || !formSugerenciaLugar) return;

  btnSugerirCambioLugar.addEventListener('click', abrirModalSugerencia);
  btnCerrarSugerenciaLugar?.addEventListener('click', cerrarModalSugerencia);
  btnCancelarSugerenciaLugar?.addEventListener('click', cerrarModalSugerencia);
  formSugerenciaLugar.addEventListener('submit', enviarSugerenciaLugar);

  modalSugerenciaLugar.addEventListener('click', (event) => {
    if (event.target === modalSugerenciaLugar) cerrarModalSugerencia();
  });
}

function actualizarDescripcion(nombre, descripcion) {
  const descripcionEl = document.getElementById('descripcionTexto');
  const toggleBtn = document.getElementById('toggleDescripcion');
  if (!descripcionEl || !toggleBtn) return;

  const texto = (descripcion || '').trim() || 'Descripción no disponible.';
  descripcionEl.innerHTML = `
    <span class="text-base leading-relaxed">
      <span class="font-semibold">${nombre}</span>
      <span class="font-light"> ${texto.replace(/\n/g, '<br>')}</span>
    </span>
  `;

  let expandido = false;
  toggleBtn.addEventListener('click', () => {
    expandido = !expandido;
    descripcionEl.classList.toggle('line-clamp-5', !expandido);
    toggleBtn.textContent = expandido ? 'Ocultar información' : 'Ver toda la información';
  });
}

function pareceTextoEnIngles(texto = '') {
  const normalized = String(texto || '').toLowerCase();
  if (!normalized) return false;
  const pistas = [
    ' this ',
    ' and ',
    ' with ',
    ' open ',
    ' closed ',
    ' place ',
    ' located ',
    ' rating ',
    ' reviews ',
  ];
  const hits = pistas.reduce((acc, token) => acc + (normalized.includes(token) ? 1 : 0), 0);
  return hits >= 2;
}

async function traducirTextoAlEspanol(texto = '') {
  const content = String(texto || '').trim();
  if (!content) return '';
  if (!pareceTextoEnIngles(content)) return content;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(content)}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return content;
    const data = await response.json();
    const traducido = Array.isArray(data?.[0]) ? data[0].map((chunk) => chunk?.[0] || '').join('') : '';
    return traducido?.trim() || content;
  } catch (error) {
    console.warn('⚠️ No se pudo traducir la descripción automáticamente:', error?.message || error);
    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function obtenerCoordenadasUsuario() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function aplicarColoresLugar(colorPrimario, colorSecundario) {
  if (!colorPrimario && !colorSecundario) return;
  const root = document.documentElement;
  if (colorPrimario) root.style.setProperty('--lugar-color-primario', colorPrimario);
  if (colorSecundario) root.style.setProperty('--lugar-color-secundario', colorSecundario);
}

async function sincronizarFavoritoLugar(lugarId) {
  if (!usuarioId) {
    lugarFavorito = false;
    return;
  }
  const { data, error } = await supabase
    .from('favoritosLugares')
    .select('id')
    .eq('idusuario', usuarioId)
    .eq('idlugar', lugarId)
    .maybeSingle();
  if (error) {
    console.error('Error verificando favorito:', error);
    return;
  }
  lugarFavorito = !!data;
}

async function inicializarFavorito(lugarId) {
  if (!btnFavorito || !lugarId) return;
  const icono = btnFavorito.querySelector('i');
  const texto = btnFavorito.querySelector('span');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      usuarioId = user.id;
      await sincronizarFavoritoLugar(lugarId);
    }
  } catch (error) {
    console.warn('⚠️ No se pudo obtener el usuario actual:', error?.message);
  }
  actualizarFavoritoUI(icono, texto);

  btnFavorito.addEventListener('click', async () => {
    if (!usuarioId) {
      try {
        const authUser = await requireAuth('favoritePlace');
        if (!authUser?.id) return;
        usuarioId = authUser.id;
        await sincronizarFavoritoLugar(lugarId);
        actualizarFavoritoUI(icono, texto);
      } catch {
        return;
      }
    }

    if (lugarFavorito) {
      console.log('Eliminando de favoritosLugares');
      const { error } = await supabase
        .from('favoritosLugares')
        .delete()
        .eq('idusuario', usuarioId)
        .eq('idlugar', lugarId);
      if (!error) {
        lugarFavorito = false;
        actualizarFavoritoUI(icono, texto);
      } else {
        console.error('❌ Error eliminando favorito:', error);
      }
    } else {
      console.log('Insertando en favoritosLugares');
      const { error } = await supabase
        .from('favoritosLugares')
        .insert([{ idusuario: usuarioId, idlugar: lugarId }]);
      if (!error) {
        lugarFavorito = true;
        actualizarFavoritoUI(icono, texto);
      } else {
        console.error('❌ Error añadiendo favorito:', error);
        alert('Hubo un problema al añadir este lugar a favoritos.');
      }
    }
  });
}

function actualizarFavoritoUI(icono, texto) {
  if (!icono || !texto) return;
  if (lugarFavorito) {
    console.log('Animando ícono de favoritos en lugar...');
    icono.className = 'fas fa-heart text-xl text-red-500 animate-bounce transition-all duration-300 ease-in-out';
    texto.textContent = 'En favoritos';
  } else {
    icono.className = 'far fa-heart text-xl transition-all duration-300 ease-in-out';
    texto.textContent = 'Añadir a favoritos';
  }
}

async function cargarCategoriasLugar(idLugar) {
  const { data, error } = await supabase
    .from('lugarCategoria')
    .select(`
      categoria:categoriaLugares (
        nombre
      )
    `)
    .eq('idLugar', idLugar);

  if (error) {
    console.error('Error cargando categorías del lugar:', error);
    return [];
  }

  return (data || [])
    .map((item) => item.categoria?.nombre)
    .filter(Boolean);
}

function renderCategorias(categorias = []) {
  if (!categoriasEl) return;
  categoriasEl.classList.remove('hidden');

  if (!categorias.length) {
    categoriasEl.textContent = '';
    categoriasEl.classList.add('hidden');
    return;
  }

  categoriasEl.textContent = categorias.join(', ');
}

async function cargarPerfilLugar() {
  if (!idLugar) {
    console.error('No se recibió un ID de lugar.');
    return;
  }

  mostrarLoader();

  try {
    const { data: lugar, error } = await supabase
  .from('LugaresTuristicos')
  .select(`
  id,
  nombre,
  municipio,
  direccion,
  descripcion,
  telefono,
  facebook,
  instagram,
  tiktok,
  web,
  imagen,
  latitud,
  longitud,
  abiertoSiempre,
  gratis,
  precioEntrada,
  activo
`)
  .eq('id', idLugar)
  .single();

    if (error || !lugar) {
      console.error('Error cargando lugar:', error);
      const descripcionEl = document.getElementById('descripcionTexto');
      if (descripcionEl) {
        descripcionEl.textContent = 'No se pudo cargar la información de este lugar.';
      }
      return;
    }

    aplicarColoresLugar(lugar.colorPrimario, lugar.colorSecundario);
    if (lugar.nombre) {
      document.title = `${lugar.nombre} | Findixi`;
    }
    lugarActual = lugar;

    nombreEl.textContent = lugar.nombre || 'Lugar sin nombre';
    if (fuenteDatosLugarEl) {
      fuenteDatosLugarEl.textContent = 'Fuente principal: Google Places. Si ves errores, envía una sugerencia.';
    }

    const categorias = await cargarCategoriasLugar(lugar.id);
    renderCategorias(categorias);

    if (precioEl) {
      precioEl.innerHTML = '';
      precioEl.className = 'hidden';

      const esGratis = lugar.gratis === true ||
        lugar.gratis === 'true' ||
        lugar.gratis === 1 ||
        lugar.gratis === '1';

      if (esGratis) {
        precioEl.className = 'flex items-center justify-center gap-2 text-base text-green-500';
        precioEl.innerHTML = `<i class="fas fa-ticket text-green-500"></i><span>Entrada Gratis</span>`;
      } else if (lugar.precioEntrada !== null && lugar.precioEntrada !== undefined && `${lugar.precioEntrada}`.trim() !== '') {
        const monto = Number(lugar.precioEntrada);
        const precioFormat = Number.isFinite(monto)
          ? monto.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
          : `$${String(lugar.precioEntrada).replace(/^[^0-9]+/, '')}`;
        precioEl.className = 'flex items-center justify-center gap-2 text-2xl text-green-500';
        precioEl.innerHTML = `<i class="fas fa-ticket text-green-500"></i><span>Entrada: ${precioFormat}</span>`;
      } else {
        precioEl.className = 'flex items-center justify-center gap-2 text-base text-gray-500';
        precioEl.innerHTML = `<i class="fas fa-ticket text-gray-400"></i><span>Precio no disponible</span>`;
      }
    }

    const direccion = lugar.direccion?.trim();
    direccionEl.textContent = direccion || 'Dirección no disponible';

    const coordsUsuario = await obtenerCoordenadasUsuario();
    const tieneCoordenadas =
      Number.isFinite(Number(lugar.latitud)) && Number.isFinite(Number(lugar.longitud));

    if (coordsUsuario && tieneCoordenadas) {
      const [conTiempo] = await calcularTiemposParaLista(
        [{
          id: lugar.id,
          latitud: Number(lugar.latitud),
          longitud: Number(lugar.longitud)
        }],
        coordsUsuario
      );

      if (conTiempo?.tiempoTexto) {
        tiempoEl.innerHTML = `<i class="fas fa-car"></i> ${conTiempo.tiempoTexto}`;
      } else {
        tiempoEl.innerHTML = '<i class="fas fa-car"></i> Distancia no disponible';
      }
    } else {
      tiempoEl.innerHTML = '<i class="fas fa-car"></i> Distancia no disponible';
    }

    if (tieneCoordenadas) {
      const lat = Number(lugar.latitud);
      const lon = Number(lugar.longitud);
      document.getElementById('btnGoogleMaps').href = `https://www.google.com/maps?q=${lat},${lon}`;
      document.getElementById('btnWaze').href = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
    } else {
      document.getElementById('btnGoogleMaps').href = '#';
      document.getElementById('btnWaze').href = '#';
    }

    const descripcionTraducida = await traducirTextoAlEspanol(lugar.descripcion);
    actualizarDescripcion(lugar.nombre || 'Lugar', descripcionTraducida);

    await cargarGaleriaLugar(lugar.id, lugar.imagen);
    await renderHorariosLugar(lugar.id, lugar.nombre || 'Lugar');

    if (!lugar.activo) {
      if (estadoHorarioIcono) {
        estadoHorarioIcono.className = 'fa-regular fa-clock text-red-500 text-2xl';
      }
      if (estadoHorarioTexto) {
        estadoHorarioTexto.className = 'text-sm text-red-600 font-medium';
        estadoHorarioTexto.textContent = 'No disponible temporalmente';
      }
    }

    await inicializarFavorito(lugar.id);

    document.getElementById('nombreCercanosComida').textContent = lugar.nombre || '';
    document.getElementById('nombreCercanosLugares').textContent = lugar.nombre || '';
    document.getElementById('nombreCercanosPlayas').textContent = lugar.nombre || '';

    const origen = {
      id: lugar.id,
      nombre: lugar.nombre,
      municipio: lugar.municipio,
      latitud: Number(lugar.latitud),
      longitud: Number(lugar.longitud),
    };

    mostrarCercanosComida(origen);
    mostrarPlayasCercanas(origen);
    mostrarLugaresCercanos(origen);
  } catch (error) {
    console.error('Error general cargando el perfil del lugar:', error);
    const descripcionEl = document.getElementById('descripcionTexto');
    if (descripcionEl) {
      descripcionEl.textContent = 'Tuvimos un inconveniente obteniendo la información del lugar.';
    }
  } finally {
    ocultarLoader();
  }
}

document.addEventListener('DOMContentLoaded', cargarPerfilLugar);
document.addEventListener('DOMContentLoaded', inicializarSugerenciasLugar);
