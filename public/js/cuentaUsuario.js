import { supabase } from '../shared/supabaseClient.js';
import { obtenerMapaCategorias } from './obtenerMapaCategorias.js';
import { calcularDistancia } from './distanciaLugar.js';
import { t } from './i18n.js';

const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const basePath = isLocal ? '/public' : '';


// Verificar sesión activa antes de permitir updates
async function verificarSesion() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    console.error('⚠️ No hay sesión activa. El usuario no está autenticado.', error);
    alert('Debes iniciar sesión para actualizar tu perfil.');
    throw new Error('No hay sesión activa');
  }

  console.log('✅ Usuario autenticado:', user.id);
  return user;
}

const nombreUsuario = document.getElementById('nombreUsuario');
const emailUsuario = document.getElementById('emailUsuario');
const municipioUsuario = document.getElementById('municipioUsuario');
const fechaRegistro = document.getElementById('fechaRegistro');
const fotoPerfil = document.getElementById('fotoPerfil');
const membresiaBadge = document.getElementById('membresiaUpBadge');
const upgradeBox = document.getElementById('upgradeMembresiaBox');
const btnUpgradeUp = document.getElementById('btnUpgradeUp');
const upgradeDetails = document.getElementById('upgradeDetails');
const toggleUpgradeDetailsBtn = document.getElementById('toggleUpgradeDetails');
const modalMembresiaOverlay = document.getElementById('modalMembresiaUp');
const modalMembresiaCard = document.getElementById('modalMembresiaUpCard');
const modalUpSubmit = document.getElementById('modalUpSubmit');
const modalUpClose = document.getElementById('modalUpClose');
const modalUpCloseIcon = document.getElementById('modalUpCloseIcon');
const upgradeUrl = `${basePath}/upgradeUp.html`;

const modal = document.getElementById('modalEditar');
const btnEditar = document.getElementById('btnEditarPerfil');
const btnCancelar = document.getElementById('btnCancelar');
const formEditar = document.getElementById('formEditarPerfil');

const inputNombre = document.getElementById('inputNombre');
const inputApellido = document.getElementById('inputApellido');
const inputFoto = document.getElementById('inputFoto');
const previewFoto = document.getElementById('previewFoto');
const imagenActual = document.getElementById('imagenActual');
const inputTelefono = document.getElementById('inputTelefono');
const inputMunicipio = document.getElementById('inputMunicipio');

const btnPedidos = document.getElementById('btnPedidos');
const btnFavoritos = document.getElementById('btnFavoritos');
const btnCerrarFavoritos = document.getElementById('btnCerrarFavoritos');
const modalFavoritos = document.getElementById('modalFavoritos');
const listaFavoritos = document.getElementById('favoritos-list');
const inputBuscar = document.getElementById('buscadorFavoritos');
const filtroMunicipio = document.getElementById('filtroMunicipio');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroOrden = document.getElementById('filtroOrden');
const btnFavoritosLugares = document.getElementById('btnFavoritosLugares');
const modalFavoritosLugares = document.getElementById('modalFavoritosLugares');
const btnCerrarFavoritosLugares = document.getElementById('btnCerrarFavoritosLugares');
const listaFavoritosLugares = document.getElementById('favoritos-lugares-list');
const inputBuscarFavoritosLugares = document.getElementById('buscadorFavoritosLugares');
const filtroMunicipioLugares = document.getElementById('filtroMunicipioLugares');
const filtroCategoriaLugares = document.getElementById('filtroCategoriaLugares');
const filtroOrdenLugares = document.getElementById('filtroOrdenLugares');
const btnFavoritosPlayas = document.getElementById('btnFavoritosPlayas');
const modalFavoritosPlayas = document.getElementById('modalFavoritosPlayas');
const btnCerrarFavoritosPlayas = document.getElementById('btnCerrarFavoritosPlayas');
const listaFavoritosPlayas = document.getElementById('favoritos-playas-list');
const inputBuscarFavoritosPlayas = document.getElementById('buscadorFavoritosPlayas');
const filtroMunicipioPlayas = document.getElementById('filtroMunicipioPlayas');
const filtroCategoriaPlayas = document.getElementById('filtroCategoriaPlayas');
const filtroOrdenPlayas = document.getElementById('filtroOrdenPlayas');
const btnCupones = document.getElementById('btnCupones');
const modalCupones = document.getElementById('modalCupones');
const btnCerrarCupones = document.getElementById('btnCerrarCupones');
const cuponFiltroComercio = document.getElementById('cuponFiltroComercio');
const cuponFiltroMunicipio = document.getElementById('cuponFiltroMunicipio');
const cuponFiltroCategoria = document.getElementById('cuponFiltroCategoria');
const btnLimpiarFiltrosCupones = document.getElementById('btnLimpiarFiltrosCupones');
const cuponesGuardadosLista = document.getElementById('cuponesGuardadosLista');
const cuponesRedimidosLista = document.getElementById('cuponesRedimidosLista');
const cuponesGuardadosMensaje = document.getElementById('cuponesGuardadosMensaje');
const cuponesRedimidosMensaje = document.getElementById('cuponesRedimidosMensaje');
const cuponesGuardadosBadge = document.getElementById('cuponesGuardadosBadge');
const cuponesRedimidosBadge = document.getElementById('cuponesRedimidosBadge');
const cuponesPanels = document.querySelectorAll('[data-cupon-panel]');
const cuponesTabs = document.querySelectorAll('[data-cupon-tab]');
const btnCargarMasGuardados = document.getElementById('btnCargarMasGuardados');
const btnCargarMasRedimidos = document.getElementById('btnCargarMasRedimidos');
const cuponesModalMensaje = document.getElementById('cuponesModalMensaje');
const modalCuponQr = document.getElementById('modalCuponQr');
const btnCerrarCuponQr = document.getElementById('btnCerrarCuponQr');
const modalCuponQrImg = document.getElementById('modalCuponQrImg');
const modalCuponQrLogo = document.getElementById('modalCuponQrLogo');
const modalCuponQrComercio = document.getElementById('modalCuponQrComercio');
const modalCuponQrNombre = document.getElementById('modalCuponQrNombre');
const modalCuponQrDescripcion = document.getElementById('modalCuponQrDescripcion');

const btnLogout = document.getElementById('btnLogout');
const btnMensajes = document.getElementById('btnMensajes');
const modalMensajes = document.getElementById('modalMensajes');
const modalMensajesCerrar = document.getElementById('modalMensajesCerrar');
const mensajesLista = document.getElementById('mensajesLista');
const mensajesVacio = document.getElementById('mensajesVacio');
let mensajesUsuario = [];
let mapaUsuariosMsg = {};
let mapaComerciosMsg = {};

const mapRolLegible = (rol) => {
  const r = (rol || '').toLowerCase();
  if (r === 'comercio_admin') return 'Administrador';
  if (r === 'comercio_editor') return 'Editor';
  return 'Colaborador';
};

const PLACEHOLDER_FOTO = 'https://placehold.co/100x100?text=User';
const PLACEHOLDER_LUGAR = 'https://placehold.co/120x80?text=Lugar';
const PLACEHOLDER_PLAYA = 'https://placehold.co/120x80?text=Playa';
const PLACEHOLDER_COMERCIO_LOGO = 'https://placehold.co/80x80?text=Logo';
const PLACEHOLDER_CUPON_IMAGEN = 'https://placehold.co/160x160?text=Cup%C3%B3n';

let perfilOriginal = null;
let usuarioId = null;
let favoritos = [];
let mapaCategorias = null;
let mapaSubcategorias = null;
let searchQuery = '';
let userCoords = null;
let huboErrorCargandoFavoritos = false;
let favoritosLugares = [];
let searchQueryLugares = '';
let favoritosPlayas = [];
let searchQueryPlayas = '';
let cuponesUsuario = [];
const QR_REDIMIR_URL = 'https://test.enpe-erre.com/redimir-cupon.html';
const CUPONES_POR_PAGINA = 6;
let cuponesGuardadosPagina = 1;
let cuponesRedimidosPagina = 1;
let cuponesTabActiva = 'guardados';
const filtrosCupones = {
  guardados: { comercio: '', municipio: '', categoria: '' },
  redimidos: { comercio: '', municipio: '', categoria: '' }
};
const opcionesFiltrosCupones = {
  guardados: { comercios: [], municipios: [], categorias: [] },
  redimidos: { comercios: [], municipios: [], categorias: [] }
};

const ocultarModalMembresia = () => {
  if (!modalMembresiaOverlay || !modalMembresiaCard) return;
  modalMembresiaCard.classList.remove('opacity-100', 'scale-100');
  modalMembresiaCard.classList.add('opacity-0', 'scale-95');
  setTimeout(() => {
    modalMembresiaOverlay.classList.add('hidden');
    modalMembresiaOverlay.classList.remove('flex');
  }, 200);
};

const mostrarModalMembresia = () => {
  if (!modalMembresiaOverlay || !modalMembresiaCard) return;
  modalMembresiaOverlay.classList.remove('hidden');
  modalMembresiaCard.classList.add('opacity-0', 'scale-95');
  modalMembresiaCard.classList.remove('opacity-100', 'scale-100');
  requestAnimationFrame(() => {
    modalMembresiaOverlay.classList.add('flex');
    modalMembresiaCard.classList.remove('opacity-0', 'scale-95');
    modalMembresiaCard.classList.add('opacity-100', 'scale-100');
  });
};

btnUpgradeUp?.addEventListener('click', mostrarModalMembresia);
modalUpClose?.addEventListener('click', ocultarModalMembresia);
modalUpCloseIcon?.addEventListener('click', ocultarModalMembresia);
modalMembresiaOverlay?.addEventListener('click', (event) => {
  if (event.target === modalMembresiaOverlay) {
    ocultarModalMembresia();
  }
});
modalUpSubmit?.addEventListener('click', () => {
  window.location.href = upgradeUrl;
});

const toggleUpgradeDetails = () => {
  if (!upgradeDetails || !toggleUpgradeDetailsBtn) return;
  const expanded = upgradeDetails.classList.toggle('open');
  if (expanded) {
    upgradeDetails.style.maxHeight = `${upgradeDetails.scrollHeight}px`;
    upgradeDetails.style.opacity = '1';
    toggleUpgradeDetailsBtn.textContent = 'Ver menos';
  } else {
    upgradeDetails.style.maxHeight = '0px';
    upgradeDetails.style.opacity = '0';
    toggleUpgradeDetailsBtn.textContent = 'Ver más';
  }
};

toggleUpgradeDetailsBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleUpgradeDetails();
});

upgradeBox?.addEventListener('click', (e) => {
  if (e.target === btnUpgradeUp || e.target.closest('#btnUpgradeUp')) return;
  toggleUpgradeDetails();
});

async function restaurarSesionDesdeHash() {
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) return;

  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) return;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error) {
    console.error('🛑 Error restaurando sesión OAuth:', error);
    return;
  }

  history.replaceState(null, '', window.location.pathname + window.location.search);
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return '--';
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '--';
  return fecha.toLocaleDateString('es-PR', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function mostrarMensajeFavoritos(texto, clase = 'text-gray-500') {
  if (!listaFavoritos) return;
  listaFavoritos.innerHTML = `<p class="text-center ${clase}">${texto}</p>`;
}

function mostrarFavoritos(lista) {
  if (!listaFavoritos) return;

  if (!lista?.length) {
    mostrarMensajeFavoritos(t('cuenta.sinFavs'));
    return;
  }

  listaFavoritos.innerHTML = '';

  lista.forEach(item => {
    const categoriasTexto = item.categorias?.filter(Boolean).join(', ') || '';

    const card = document.createElement('div');
    card.className = 'flex items-center justify-between gap-3 bg-white rounded-lg shadow p-3 cursor-pointer hover:bg-gray-50 transition';
    card.addEventListener('click', () => {
      window.location.href = `${basePath}/perfilComercio.html?id=${item.id}`;
    });

    const infoWrapper = document.createElement('div');
    infoWrapper.className = 'flex items-center gap-3 flex-1';

    const logoImg = document.createElement('img');
    logoImg.className = 'w-14 h-14 rounded-full object-cover border border-gray-200';
    logoImg.src = item.logo || 'https://placehold.co/60x60?text=Logo';
    logoImg.alt = item.nombre || 'Logo';

    const textos = document.createElement('div');
    textos.className = 'flex-1 text-left';
    textos.innerHTML = `
      <p class="text-base font-semibold text-gray-800">${item.nombre || 'Comercio sin nombre'}</p>
      ${item.municipioNombre ? `<p class="text-xs text-gray-500 mt-1">${item.municipioNombre}</p>` : ''}
      ${categoriasTexto ? `<p class="text-xs text-gray-400 mt-1">${categoriasTexto}</p>` : ''}
    `;

    infoWrapper.appendChild(logoImg);
    infoWrapper.appendChild(textos);

    const btnEliminar = document.createElement('button');
    btnEliminar.className = 'text-red-500 hover:text-red-600 transition p-2';
    btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    btnEliminar.setAttribute('aria-label', 'Eliminar de favoritos');
    btnEliminar.addEventListener('click', async (event) => {
      event.stopPropagation();
      const confirmado = confirm(`¿Estás seguro de eliminar ${item.nombre || 'este comercio'} de tus favoritos?`);
      if (!confirmado) return;

      try {
        console.log('Ejecutando operación delete en tabla favoritosusuarios', { idusuario: usuarioId, idcomercio: item.id });
        const { error } = await supabase
          .from('favoritosusuarios')
          .delete()
          .eq('idusuario', usuarioId)
          .eq('idcomercio', item.id);

        if (error) throw error;
        await cargarYMostrarFavoritos();
      } catch (err) {
        console.error('🛑 Error eliminando favorito:', err);
        alert('No se pudo eliminar el favorito. Intenta nuevamente.');
      }
    });

    card.appendChild(infoWrapper);
    card.appendChild(btnEliminar);

    listaFavoritos.appendChild(card);
  });
}

function poblarFiltros(lista) {
  const resetSelect = (select, placeholder) => {
    if (!select) return;
    select.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.appendChild(option);
  };

  resetSelect(filtroMunicipio, 'Municipio');
  resetSelect(filtroCategoria, 'Categoría');

  if (filtroMunicipio) {
    const municipios = [...new Set(lista.map(item => item.municipioNombre).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    municipios.forEach(nombre => {
      const option = document.createElement('option');
      option.value = nombre;
      option.textContent = nombre;
      filtroMunicipio.appendChild(option);
    });
  }

  if (filtroCategoria) {
    const categoriasMap = new Map();
    lista.forEach(item => {
      const ids = item.categoriaIds || [];
      const nombres = item.categorias || [];
      ids.forEach((id, index) => {
        if (id === null || id === undefined) return;
        const key = String(id);
        if (!categoriasMap.has(key)) {
          const nombre = nombres?.[index] || `Categoría ${id}`;
          categoriasMap.set(key, nombre);
        }
      });
    });

    const categoriasOrdenadas = [...categoriasMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es', { sensitivity: 'base' }));

    categoriasOrdenadas.forEach(([id, nombre]) => {
      const option = document.createElement('option');
      option.value = String(id);
      option.textContent = nombre;
      filtroCategoria.appendChild(option);
    });
  }
}

function mostrarMensajeFavoritosLugares(texto, clase = 'text-gray-500') {
  if (!listaFavoritosLugares) return;
  listaFavoritosLugares.innerHTML = `<p class="text-center ${clase}">${texto}</p>`;
}

function renderFavoritosLugares(lista) {
  if (!listaFavoritosLugares) return;

  if (!lista?.length) {
    mostrarMensajeFavoritosLugares(t('cuenta.sinFavs'));
    return;
  }

  listaFavoritosLugares.innerHTML = '';

  lista.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'flex items-center justify-between gap-3 bg-white rounded-lg shadow p-3 cursor-pointer hover:bg-gray-50 transition transition-opacity';
    card.addEventListener('click', () => {
      window.location.href = `${basePath}/perfilLugar.html?id=${item.id}`;
    });

    const contenido = document.createElement('div');
    contenido.className = 'flex items-center gap-3 flex-1';

    const imagen = document.createElement('img');
    imagen.className = 'w-20 h-20 rounded-lg object-cover border border-gray-200 flex-shrink-0';
    imagen.src = item.imagen || PLACEHOLDER_LUGAR;
    imagen.alt = item.nombre || 'Lugar';

    const textos = document.createElement('div');
    textos.className = 'flex-1 text-left';
    textos.innerHTML = `
      <p class="text-base font-semibold text-gray-800">${item.nombre || 'Lugar sin nombre'}</p>
      ${item.municipioNombre ? `<p class="text-xs text-gray-500 mt-1">${item.municipioNombre}</p>` : ''}
      ${item.categorias?.length ? `<p class="text-xs text-gray-400 mt-1">${item.categorias.join(', ')}</p>` : ''}
    `;

    contenido.appendChild(imagen);
    contenido.appendChild(textos);

    const eliminarIcono = document.createElement('i');
    eliminarIcono.className = 'fa-solid fa-trash text-red-500 text-xl cursor-pointer hover:text-red-700 transition px-2';
    eliminarIcono.dataset.idlugar = String(item.id);
    eliminarIcono.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (!usuarioId) {
        window.location.href = `${basePath}/logearse.html`;
        return;
      }
      const confirmar = confirm(`¿Eliminar ${item.nombre || 'este lugar'} de tus favoritos?`);
      if (!confirmar) return;
      console.log("Ícono eliminar clicado:", item.id);
      await eliminarFavoritoLugar(item.id, card);
    });

    card.appendChild(contenido);
    card.appendChild(eliminarIcono);

    listaFavoritosLugares.appendChild(card);
  });
}

function poblarFiltrosLugares(lista) {
  const resetSelect = (select, placeholder) => {
    if (!select) return;
    select.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.appendChild(option);
  };

  resetSelect(filtroMunicipioLugares, 'Municipio');
  resetSelect(filtroCategoriaLugares, 'Categoría');

  if (filtroMunicipioLugares) {
    const municipios = [...new Set(lista.map(item => item.municipioNombre).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    municipios.forEach(nombre => {
      const option = document.createElement('option');
      option.value = nombre;
      option.textContent = nombre;
      filtroMunicipioLugares.appendChild(option);
    });
  }

  if (filtroCategoriaLugares) {
    const categoriasMap = new Map();
    lista.forEach(item => {
      const ids = item.categoriaIds || [];
      const nombres = item.categorias || [];
      ids.forEach((id, index) => {
        if (id === null || id === undefined) return;
        const key = String(id);
        if (!categoriasMap.has(key)) {
          categoriasMap.set(key, nombres?.[index] || `Categoría ${id}`);
        }
      });
    });

    [...categoriasMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es', { sensitivity: 'base' }))
      .forEach(([id, nombre]) => {
        const option = document.createElement('option');
        option.value = String(id);
        option.textContent = nombre;
        filtroCategoriaLugares.appendChild(option);
      });
  }
}

function obtenerFavoritosLugaresFiltrados() {
  const municipioSeleccionado = filtroMunicipioLugares?.value || '';
  const categoriaSeleccionada = filtroCategoriaLugares?.value || '';

  return favoritosLugares.filter(item => {
    const coincideNombre = !searchQueryLugares || item.nombre?.toLowerCase().includes(searchQueryLugares);
    const coincideMunicipio = !municipioSeleccionado || item.municipioNombre === municipioSeleccionado;
    const coincideCategoria = !categoriaSeleccionada || item.categoriaIds?.map(String).includes(categoriaSeleccionada);
    return coincideNombre && coincideMunicipio && coincideCategoria;
  });
}

function ordenarFavoritosLugares(lista) {
  const orden = filtroOrdenLugares?.value || 'alfabetico';
  const listaOrdenada = [...lista];

  if (orden === 'alfabetico') {
    listaOrdenada.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  } else if (orden === 'recientes') {
    listaOrdenada.sort((a, b) => new Date(b.creadoEn || 0) - new Date(a.creadoEn || 0));
  } else if (orden === 'cercania' && userCoords) {
    listaOrdenada.sort((a, b) => {
      const distA = (a.latitud != null && a.longitud != null)
        ? calcularDistancia(userCoords.lat, userCoords.lon, a.latitud, a.longitud)
        : Infinity;
      const distB = (b.latitud != null && b.longitud != null)
        ? calcularDistancia(userCoords.lat, userCoords.lon, b.latitud, b.longitud)
        : Infinity;
      return distA - distB;
    });
  }

  return listaOrdenada;
}

function actualizarListadoFavoritosLugares() {
  if (!listaFavoritosLugares) return;
  const filtrados = obtenerFavoritosLugaresFiltrados();
  const ordenados = ordenarFavoritosLugares(filtrados);
  renderFavoritosLugares(ordenados);
}

function mostrarMensajeFavoritosPlayas(texto, clase = 'text-gray-500') {
  if (!listaFavoritosPlayas) return;
  listaFavoritosPlayas.innerHTML = `<p class="text-center ${clase}">${texto}</p>`;
}

function renderFavoritosPlayas(lista) {
  if (!listaFavoritosPlayas) return;

  if (!lista?.length) {
    mostrarMensajeFavoritosPlayas(t('cuenta.sinFavs'));
    return;
  }

  listaFavoritosPlayas.innerHTML = '';

  lista.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'flex items-center justify-between gap-3 bg-white rounded-lg shadow p-3 cursor-pointer hover:bg-gray-50 transition transition-opacity';
    card.addEventListener('click', () => {
      window.location.href = `${basePath}/perfilPlaya.html?id=${item.id}`;
    });

    const contenido = document.createElement('div');
    contenido.className = 'flex items-center gap-3 flex-1';

    const imagen = document.createElement('img');
    imagen.className = 'w-20 h-20 rounded-lg object-cover border border-gray-200 flex-shrink-0';
    imagen.src = item.imagen || PLACEHOLDER_PLAYA;
    imagen.alt = item.nombre || t('area.playaSinNombre');

    const textos = document.createElement('div');
    textos.className = 'flex-1 text-left';
    textos.innerHTML = `
      <p class="text-base font-semibold text-gray-800">${item.nombre || t('area.playaSinNombre')}</p>
      ${item.municipioNombre ? `<p class="text-xs text-gray-500 mt-1">${item.municipioNombre}</p>` : ''}
      ${item.categorias?.length ? `<p class="text-xs text-gray-400 mt-1">${item.categorias.join(', ')}</p>` : ''}
    `;

    contenido.appendChild(imagen);
    contenido.appendChild(textos);

    const eliminarIcono = document.createElement('i');
    eliminarIcono.className = 'fa-solid fa-trash text-red-500 text-xl cursor-pointer hover:text-red-700 transition px-2';
    eliminarIcono.dataset.idplaya = String(item.id);
    eliminarIcono.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (!usuarioId) {
        window.location.href = `${basePath}/logearse.html`;
        return;
      }
      const confirmar = confirm(`${t('cuenta.eliminarConfirm')} ${item.nombre || t('area.playaSinNombre')}?`);
      if (!confirmar) return;
      console.log('Ícono eliminar clicado:', item.id);
      await eliminarFavoritoPlaya(item.id, card);
    });

    card.appendChild(contenido);
    card.appendChild(eliminarIcono);

    listaFavoritosPlayas.appendChild(card);
  });
}

function poblarFiltrosPlayas(lista) {
  const resetSelect = (select, placeholder) => {
    if (!select) return;
    select.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.appendChild(option);
  };

  resetSelect(filtroMunicipioPlayas, 'Municipio');
  resetSelect(filtroCategoriaPlayas, 'Categoría');

  if (filtroMunicipioPlayas) {
    const municipios = [...new Set(lista.map(item => item.municipioNombre).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    municipios.forEach(nombre => {
      const option = document.createElement('option');
      option.value = nombre;
      option.textContent = nombre;
      filtroMunicipioPlayas.appendChild(option);
    });
  }

  if (filtroCategoriaPlayas) {
    const categoriasMap = new Map();
    lista.forEach(item => {
      const ids = item.categoriaIds || [];
      const nombres = item.categorias || [];
      ids.forEach((id, index) => {
        if (id === null || id === undefined || id === '') return;
        const key = String(id);
        if (!categoriasMap.has(key)) {
          categoriasMap.set(key, nombres?.[index] || `Categoría ${id}`);
        }
      });
    });

    [...categoriasMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es', { sensitivity: 'base' }))
      .forEach(([id, nombre]) => {
        const option = document.createElement('option');
        option.value = String(id);
        option.textContent = nombre;
        filtroCategoriaPlayas.appendChild(option);
      });
  }
}

function obtenerFavoritosPlayasFiltrados() {
  const municipioSeleccionado = filtroMunicipioPlayas?.value || '';
  const categoriaSeleccionada = filtroCategoriaPlayas?.value || '';

  return favoritosPlayas.filter(item => {
    const coincideNombre = !searchQueryPlayas || item.nombre?.toLowerCase().includes(searchQueryPlayas);
    const coincideMunicipio = !municipioSeleccionado || item.municipioNombre === municipioSeleccionado;
    const coincideCategoria = !categoriaSeleccionada || item.categoriaIds?.map(String).includes(categoriaSeleccionada);
    return coincideNombre && coincideMunicipio && coincideCategoria;
  });
}

function ordenarFavoritosPlayas(lista) {
  const orden = filtroOrdenPlayas?.value || 'alfabetico';
  const listaOrdenada = [...lista];

  if (orden === 'alfabetico') {
    listaOrdenada.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  } else if (orden === 'recientes') {
    listaOrdenada.sort((a, b) => new Date(b.creadoEn || 0) - new Date(a.creadoEn || 0));
  } else if (orden === 'cercania' && userCoords) {
    listaOrdenada.sort((a, b) => {
      const distA = (a.latitud != null && a.longitud != null)
        ? calcularDistancia(userCoords.lat, userCoords.lon, a.latitud, a.longitud)
        : Infinity;
      const distB = (b.latitud != null && b.longitud != null)
        ? calcularDistancia(userCoords.lat, userCoords.lon, b.latitud, b.longitud)
        : Infinity;
      return distA - distB;
    });
  }

  return listaOrdenada;
}

function actualizarListadoFavoritosPlayas() {
  if (!listaFavoritosPlayas) return;
  const filtrados = obtenerFavoritosPlayasFiltrados();
  const ordenados = ordenarFavoritosPlayas(filtrados);
  renderFavoritosPlayas(ordenados);
}

async function eliminarFavoritoPlaya(idPlaya, cardElement) {
  if (!usuarioId) {
    window.location.href = `${basePath}/logearse.html`;
    return;
  }

  console.log('Eliminando playa favorita:', idPlaya);
  const { data, error } = await supabase
    .from('favoritosPlayas')
    .delete()
    .eq('idusuario', usuarioId)
    .eq('idplaya', idPlaya)
    .select('id');

  if (error) {
    console.error('🛑 Error eliminando playa favorita:', error);
    alert('No se pudo eliminar esta playa. Intenta nuevamente.');
    return;
  }

  console.log('Eliminación completada');
  favoritosPlayas = favoritosPlayas.filter(playa => playa.id !== idPlaya);
  console.log('Lista actualizada de favoritos (playas):', favoritosPlayas);

  if (cardElement) {
    cardElement.classList.add('opacity-0');
    setTimeout(() => {
      actualizarListadoFavoritosPlayas();
    }, 200);
  } else {
    actualizarListadoFavoritosPlayas();
  }
}

async function cargarFavoritosPlayas() {
  if (!usuarioId) {
    alert('Debes iniciar sesión para ver tus playas favoritas.');
    window.location.href = `${basePath}/logearse.html`;
    return [];
  }

  mostrarMensajeFavoritosPlayas(t('cuenta.cargandoFavs'));

  const { data, error } = await supabase
    .from('favoritosPlayas')
    .select(`
      id,
      creado_en,
      idplaya,
      playa:playas (
        id,
        nombre,
        municipio,
        activo,
        imagen,
        latitud,
        longitud,
        costa,
        nadar,
        surfear,
        snorkeling
      )
    `)
    .eq('idusuario', usuarioId)
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('🛑 Error al cargar playas favoritas:', error);
    mostrarMensajeFavoritosPlayas(t('common.error') || 'Error', 'text-red-500');
    favoritosPlayas = [];
    return [];
  }

  console.log('Playas favoritas obtenidas:', data);

  const activos = (data || []).filter(item => item?.playa && item.playa.activo !== false);

  if (!activos.length) {
    favoritosPlayas = [];
    searchQueryPlayas = '';
    if (inputBuscarFavoritosPlayas) inputBuscarFavoritosPlayas.value = '';
    if (filtroMunicipioPlayas) filtroMunicipioPlayas.value = '';
    if (filtroCategoriaPlayas) filtroCategoriaPlayas.value = '';
    if (filtroOrdenPlayas) filtroOrdenPlayas.value = 'alfabetico';
    poblarFiltrosPlayas([]);
    renderFavoritosPlayas(favoritosPlayas);
    return [];
  }

  const playasBase = activos
    .map(item => {
      const playa = item.playa || {};
      const categorias = [];
      const categoriaIds = [];

      if (playa.costa) {
        categorias.push(`Costa ${playa.costa}`);
        categoriaIds.push(`costa-${playa.costa}`);
      }
      if (playa.nadar) {
        categorias.push('Nadar');
        categoriaIds.push('nadar');
      }
      if (playa.surfear) {
        categorias.push('Surfear');
        categoriaIds.push('surfear');
      }
      if (playa.snorkeling) {
        categorias.push('Snorkel');
        categoriaIds.push('snorkeling');
      }

      return {
        id: playa.id || item.idplaya,
        nombre: playa.nombre || 'Playa sin nombre',
        municipioRaw: playa.municipio,
        imagen: playa.imagen || '',
        latitud: playa.latitud != null ? Number(playa.latitud) : null,
        longitud: playa.longitud != null ? Number(playa.longitud) : null,
        categorias,
        categoriaIds,
        creadoEn: item.creado_en
      };
    })
    .filter(playa => playa.id != null);

  const municipiosUnicos = [...new Set(playasBase.map(p => p.municipioRaw).filter(valor => valor !== null && valor !== undefined))];
  const municipioNombreMap = new Map();

  for (const municipio of municipiosUnicos) {
    const nombre = await obtenerNombreMunicipio(municipio);
    municipioNombreMap.set(municipio, nombre || (typeof municipio === 'string' ? municipio : String(municipio)));
  }

  favoritosPlayas = playasBase.map(playa => ({
    ...playa,
    municipioNombre: municipioNombreMap.get(playa.municipioRaw) || '',
  }));

  searchQueryPlayas = '';
  if (inputBuscarFavoritosPlayas) inputBuscarFavoritosPlayas.value = '';
  if (filtroMunicipioPlayas) filtroMunicipioPlayas.value = '';
  if (filtroCategoriaPlayas) filtroCategoriaPlayas.value = '';
  if (filtroOrdenPlayas) filtroOrdenPlayas.value = 'alfabetico';

  poblarFiltrosPlayas(favoritosPlayas);
  actualizarListadoFavoritosPlayas();

  if (!userCoords && filtroOrdenPlayas?.value === 'cercania' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        userCoords = { lat: coords.latitude, lon: coords.longitude };
        actualizarListadoFavoritosPlayas();
      },
      (geoError) => {
        console.warn('⚠️ No se pudo obtener la ubicación del usuario (playas favoritas):', geoError.message);
        actualizarListadoFavoritosPlayas();
      }
    );
  }

  return favoritosPlayas;
}


function resetPaginacionCupones() {
  cuponesGuardadosPagina = 1;
  cuponesRedimidosPagina = 1;
}

function llenarSelectCupones(select, placeholder, items, getValue, getLabel, selectedValue = '') {
  if (!select) return;
  select.innerHTML = '';
  const option = document.createElement('option');
  option.value = '';
  option.textContent = placeholder;
  select.appendChild(option);

  let valueStillAvailable = selectedValue === '';

  (items || []).forEach((item) => {
    const value = String(getValue(item));
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = getLabel(item);
    if (value === String(selectedValue)) {
      valueStillAvailable = true;
    }
    select.appendChild(opt);
  });

  select.value = valueStillAvailable ? String(selectedValue) : '';
  if (!valueStillAvailable) {
    const filtros = filtrosCupones[cuponesTabActiva];
    if (select === cuponFiltroComercio) filtros.comercio = '';
    if (select === cuponFiltroMunicipio) filtros.municipio = '';
    if (select === cuponFiltroCategoria) filtros.categoria = '';
  }
}

function generarOpcionesDesdeCupones(lista) {
  const comerciosMap = new Map();
  const municipiosMap = new Map();
  const categoriasMap = new Map();

  lista.forEach((registro) => {
    if (registro.comercioId) {
      const key = String(registro.comercioId);
      if (!comerciosMap.has(key)) {
        comerciosMap.set(key, {
          value: key,
          label: registro.comercioNombre || `Comercio #${registro.comercioId}`
        });
      }
    }

    if (registro.comercioMunicipioId) {
      const key = String(registro.comercioMunicipioId);
      if (!municipiosMap.has(key)) {
        municipiosMap.set(key, {
          value: key,
          label: registro.comercioMunicipioNombre || `Municipio #${registro.comercioMunicipioId}`
        });
      }
    }

    (registro.categoriasIds || []).forEach((categoriaId, index) => {
      if (!categoriaId) return;
      const key = String(categoriaId);
      if (!categoriasMap.has(key)) {
        const nombre = registro.categorias?.[index] || `Categoría #${categoriaId}`;
        categoriasMap.set(key, { value: key, label: nombre });
      }
    });
  });

  return {
    comercios: Array.from(comerciosMap.values()),
    municipios: Array.from(municipiosMap.values()),
    categorias: Array.from(categoriasMap.values())
  };
}

function refrescarSelectsCupones() {
  const opciones = opcionesFiltrosCupones[cuponesTabActiva];
  const filtros = filtrosCupones[cuponesTabActiva];

  llenarSelectCupones(
    cuponFiltroComercio,
    'Todos los comercios',
    opciones?.comercios || [],
    (item) => item.value,
    (item) => item.label,
    filtros?.comercio || ''
  );
  llenarSelectCupones(
    cuponFiltroMunicipio,
    'Todos los municipios',
    opciones?.municipios || [],
    (item) => item.value,
    (item) => item.label,
    filtros?.municipio || ''
  );
  llenarSelectCupones(
    cuponFiltroCategoria,
    'Todas las categorías',
    opciones?.categorias || [],
    (item) => item.value,
    (item) => item.label,
    filtros?.categoria || ''
  );
}

function aplicarFiltrosACupones(lista, tab) {
  const filtros = filtrosCupones[tab] || {};
  return lista.filter((registro) => {
    if (filtros.comercio && String(registro.comercioId) !== filtros.comercio) return false;
    if (filtros.municipio && String(registro.comercioMunicipioId) !== filtros.municipio) return false;
    if (
      filtros.categoria &&
      !(registro.categoriasIds || []).map(String).includes(filtros.categoria)
    ) {
      return false;
    }
    return true;
  });
}

async function cargarCuponesUsuario() {
  if (!usuarioId) return;

  let query = supabase
    .from('cuponesUsuarios')
    .select(`
      id,
      idCupon,
      codigoqr,
      redimido,
      fechaGuardado,
      fechaRedimido,
      cupon:cupones (
        id,
        titulo,
        descripcion,
        descuento,
        imagen,
        fechafin,
        idComercio,
        Comercios:Comercios (
          id,
          nombre,
          municipio,
          idMunicipio,
          ComercioCategorias:ComercioCategorias (
            idCategoria,
            Categorias:Categorias (
              id,
              nombre
            )
          )
        )
      )
    `)
    .eq('idUsuario', usuarioId)
    .order('fechaGuardado', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('❌ Error cargando cupones del usuario:', error);
    cuponesUsuario = [];
    renderCuponesModal('No pudimos cargar tus cupones.');
    return;
  }

  const registros = data || [];
  console.log('Cupones del usuario:', registros);

  const comercioIds = [
    ...new Set(
      registros
        .map((registro) => registro.cupon?.idComercio)
        .filter((id) => id !== null && id !== undefined)
    )
  ];

  const comercioNombreMap = new Map();
  const comercioMunicipioMap = new Map();
  if (comercioIds.length) {
    const { data: comerciosData } = await supabase
      .from('Comercios')
      .select('id, nombre, municipio, idMunicipio')
      .in('id', comercioIds);

    if (comerciosData?.length) {
      await Promise.all(
        comerciosData.map(async (comercio) => {
          if (!comercio?.id) return;
          comercioNombreMap.set(comercio.id, comercio.nombre || 'Comercio');
          const municipioValor = comercio.municipio ?? comercio.idMunicipio ?? null;
          const municipioNombre = await obtenerNombreMunicipio(municipioValor);
          if (municipioNombre) {
            comercioMunicipioMap.set(comercio.id, municipioNombre);
          } else if (typeof comercio.municipio === 'string' && comercio.municipio.trim() !== '') {
            comercioMunicipioMap.set(comercio.id, comercio.municipio.trim());
          }
        })
      );
    }
  }

  const comercioLogoMap = new Map();
  if (comercioIds.length) {
    const { data: logosData } = await supabase
      .from('imagenesComercios')
      .select('idComercio, imagen')
      .in('idComercio', comercioIds)
      .eq('logo', true);

    (logosData || []).forEach((entry) => {
      const { data: publicData } = supabase.storage
        .from('galeriacomercios')
        .getPublicUrl(entry.imagen);
      comercioLogoMap.set(entry.idComercio, publicData?.publicUrl || null);
    });
  }

  cuponesUsuario = registros.map((registro) => {
    const cupon = registro.cupon || {};
    const comercioId = cupon.idComercio ?? cupon.Comercios?.id ?? null;
    const comercioNombre = comercioId
      ? comercioNombreMap.get(comercioId) || cupon.Comercios?.nombre || 'Comercio'
      : cupon.Comercios?.nombre || 'Comercio';
    const comercioLogo = comercioId ? comercioLogoMap.get(comercioId) || null : null;
    const comercioMunicipioId = cupon.Comercios?.idMunicipio ?? null;
    const comercioMunicipioNombre =
      comercioId
        ? comercioMunicipioMap.get(comercioId) ||
          cupon.Comercios?.municipio ||
          ''
        : cupon.Comercios?.municipio || '';
    const categoriasRaw = cupon.Comercios?.ComercioCategorias || [];
    const categorias = categoriasRaw.map((rel) => rel.Categorias?.nombre).filter(Boolean);
    const categoriasIds = categoriasRaw
      .map((rel) => rel.idCategoria ?? rel.Categorias?.id)
      .filter((id) => id !== null && id !== undefined);
    const qrUrl = `${QR_REDIMIR_URL}?qr=${registro.codigoqr}`;
    return {
      ...registro,
      cupon: {
        ...cupon,
        fechaFin: cupon.fechaFin ?? cupon.fechafin ?? null
      },
      comercioId,
      comercioNombre,
      comercioLogo,
      comercioMunicipioId,
      comercioMunicipioNombre,
      categorias,
      categoriasIds,
      qrUrl
    };
  });

  resetPaginacionCupones();
  renderCuponesModal();
}

function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return '--';
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '--';
  return fecha.toLocaleDateString('es-PR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function renderListaCupones(lista, contenedor, mensajeEl, { esRedimido }) {
  if (!contenedor) return;

  contenedor.innerHTML = '';

  if (!lista.length) {
    const mensaje = esRedimido
      ? 'Aún no has redimido cupones con estos criterios.'
      : 'No tienes cupones guardados con estos criterios.';
    if (mensajeEl) {
      mensajeEl.textContent = mensaje;
      mensajeEl.classList.remove('hidden');
    } else {
      contenedor.innerHTML = `<p class="text-sm font-medium text-gray-500 text-center">${mensaje}</p>`;
    }
    return;
  }

  if (mensajeEl) mensajeEl.classList.add('hidden');

  lista.forEach((registro) => {
    const card = document.createElement('div');
    card.className = `flex flex-col gap-3 bg-white rounded-2xl border shadow-sm p-4 transition ${
      esRedimido ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'
    }`;

    if (!esRedimido) {
      card.addEventListener('click', () => abrirModalCuponQr(registro));
    }

    const header = document.createElement('div');
    header.className = 'flex items-start gap-3';

    const logoWrapper = document.createElement('div');
    logoWrapper.className = 'w-14 h-14 rounded-full overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-50';
    const logo = document.createElement('img');
    logo.className = 'w-full h-full object-cover';
    if (registro.comercioLogo) {
      logo.src = registro.comercioLogo;
      logo.alt = registro.comercioNombre || 'Comercio';
    } else {
      logo.src = PLACEHOLDER_COMERCIO_LOGO;
      logo.alt = 'Logo';
    }
    logoWrapper.appendChild(logo);

    const textos = document.createElement('div');
    textos.className = 'flex-1 text-left';

    const municipioTexto = registro.comercioMunicipioNombre
      ? `<p class="text-sm font-medium text-gray-500">${registro.comercioMunicipioNombre}</p>`
      : '';
    const categoriasTexto = registro.categorias?.length
      ? `<p class="text-sm font-medium text-gray-400 mt-1">${registro.categorias.join(', ')}</p>`
      : '';

    textos.innerHTML = `
      <p class="text-base font-medium text-gray-800">${registro.comercioNombre || 'Comercio'}</p>
      ${municipioTexto}
      ${categoriasTexto}
    `;

    header.appendChild(logoWrapper);
    header.appendChild(textos);

    if (esRedimido) {
      const badge = document.createElement('span');
      badge.className =
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700';
      badge.innerHTML = `<i class="fa-solid fa-check-circle"></i> Redimido · ${formatearFechaCorta(registro.fechaRedimido)}`;
      header.appendChild(badge);
    }

    const cuerpo = document.createElement('div');
    cuerpo.className = 'flex flex-col md:flex-row md:items-center gap-3';

    const textosCupon = document.createElement('div');
    textosCupon.className = 'flex-1 text-left';
    const venceTexto = registro.cupon?.fechaFin
      ? new Date(registro.cupon.fechaFin).toLocaleDateString('es-PR')
      : '--';
    const descripcionTexto = registro.cupon?.descripcion
      ? `<p class="text-sm font-medium text-gray-600 mt-2 leading-snug">${registro.cupon.descripcion}</p>`
      : '';

    textosCupon.innerHTML = `
      <p class="text-lg font-extrabold text-red-600">${registro.cupon?.titulo || 'Cupón'}</p>
      ${descripcionTexto}
      <p class="text-sm font-medium text-gray-500 mt-2">Vence: ${venceTexto}</p>
    `;

    const imagenWrapper = document.createElement('div');
    imagenWrapper.className =
      'flex-shrink-0 w-full md:w-28 md:h-28 h-40 rounded-xl overflow-hidden border border-gray-100 bg-gray-100';
    const imagenCupon = document.createElement('img');
    imagenCupon.className = 'w-full h-full object-cover';
    if (registro.cupon?.imagen) {
      imagenCupon.src = registro.cupon.imagen;
      imagenCupon.alt = registro.cupon?.titulo || 'Cupón';
    } else {
      imagenCupon.src = PLACEHOLDER_CUPON_IMAGEN;
      imagenCupon.alt = 'Cupón';
    }
    imagenWrapper.appendChild(imagenCupon);

    cuerpo.appendChild(textosCupon);
    cuerpo.appendChild(imagenWrapper);

    card.appendChild(header);
    card.appendChild(cuerpo);

    contenedor.appendChild(card);
  });
}

function renderCuponesModal(mensaje = '') {
  if (
    !cuponesModalMensaje ||
    !cuponesGuardadosLista ||
    !cuponesRedimidosLista ||
    !cuponesGuardadosMensaje ||
    !cuponesRedimidosMensaje
  ) {
    return;
  }

  if (mensaje) {
    cuponesModalMensaje.textContent = mensaje;
    cuponesModalMensaje.classList.remove('hidden');
    cuponesGuardadosLista.innerHTML = '';
    cuponesRedimidosLista.innerHTML = '';
    cuponesGuardadosMensaje.classList.add('hidden');
    cuponesRedimidosMensaje.classList.add('hidden');
    btnCargarMasGuardados?.classList.add('hidden');
    btnCargarMasRedimidos?.classList.add('hidden');
    return;
  }

  const guardados = cuponesUsuario.filter((registro) => !registro.redimido);
  const redimidos = cuponesUsuario.filter((registro) => registro.redimido);

  opcionesFiltrosCupones.guardados = generarOpcionesDesdeCupones(guardados);
  opcionesFiltrosCupones.redimidos = generarOpcionesDesdeCupones(redimidos);
  refrescarSelectsCupones();

  const guardadosFiltrados = aplicarFiltrosACupones(guardados, 'guardados');
  const redimidosFiltrados = aplicarFiltrosACupones(redimidos, 'redimidos');

  const guardadosMostrados = guardadosFiltrados.slice(0, cuponesGuardadosPagina * CUPONES_POR_PAGINA);
  const redimidosMostrados = redimidosFiltrados.slice(0, cuponesRedimidosPagina * CUPONES_POR_PAGINA);

  if (!guardados.length && !redimidos.length) {
    cuponesModalMensaje.textContent = 'No has guardado cupones todavía.';
    cuponesModalMensaje.classList.remove('hidden');
  } else {
    cuponesModalMensaje.classList.add('hidden');
  }

  if (cuponesGuardadosBadge) cuponesGuardadosBadge.textContent = `${guardadosFiltrados.length}`;
  if (cuponesRedimidosBadge) cuponesRedimidosBadge.textContent = `${redimidosFiltrados.length}`;

  renderListaCupones(guardadosMostrados, cuponesGuardadosLista, cuponesGuardadosMensaje, {
    esRedimido: false
  });
  renderListaCupones(redimidosMostrados, cuponesRedimidosLista, cuponesRedimidosMensaje, {
    esRedimido: true
  });

  const puedeCargarMasGuardados = guardadosMostrados.length < guardadosFiltrados.length;
  const puedeCargarMasRedimidos = redimidosMostrados.length < redimidosFiltrados.length;

  if (btnCargarMasGuardados) {
    btnCargarMasGuardados.classList.toggle(
      'hidden',
      cuponesTabActiva !== 'guardados' || !puedeCargarMasGuardados
    );
  }
  if (btnCargarMasRedimidos) {
    btnCargarMasRedimidos.classList.toggle(
      'hidden',
      cuponesTabActiva !== 'redimidos' || !puedeCargarMasRedimidos
    );
  }
}

function actualizarTabsVisuales() {
  cuponesTabs?.forEach((btn) => {
    const esActivo = btn.dataset.cuponTab === cuponesTabActiva;
    btn.classList.toggle('bg-white', esActivo);
    btn.classList.toggle('shadow-sm', esActivo);
    btn.classList.toggle('border-gray-200', esActivo);
    btn.classList.toggle('text-slate-900', esActivo);
    btn.classList.toggle('bg-transparent', !esActivo);
    btn.classList.toggle('text-gray-500', !esActivo);
    btn.classList.toggle('border-transparent', !esActivo);

    const badge = btn.querySelector('span');
    if (badge) {
      badge.classList.toggle('bg-blue-100', esActivo);
      badge.classList.toggle('text-blue-700', esActivo);
      badge.classList.toggle('bg-gray-100', !esActivo);
      badge.classList.toggle('text-gray-600', !esActivo);
    }
  });

  cuponesPanels?.forEach((panel) => {
    const esActivo = panel.dataset.cuponPanel === cuponesTabActiva;
    panel.classList.toggle('hidden', !esActivo);
    panel.classList.toggle('opacity-0', !esActivo);
    panel.classList.toggle('pointer-events-none', !esActivo);
  });
}

function cambiarTabCupones(tab) {
  if (!tab || tab === cuponesTabActiva) return;
  cuponesTabActiva = tab;
  resetPaginacionCupones();
  actualizarTabsVisuales();
  refrescarSelectsCupones();
  renderCuponesModal();
}

function abrirModalCuponQr(registro) {
  if (registro?.redimido) return;
  if (!modalCuponQr || !modalCuponQrImg || !modalCuponQrComercio || !modalCuponQrNombre) return;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(registro.qrUrl)}`;
  modalCuponQrImg.src = qrImageUrl;
  modalCuponQrImg.alt = `QR de ${registro.cupon?.titulo || 'Cupón'}`;
  modalCuponQrNombre.textContent = registro.cupon?.titulo || '';
  modalCuponQrComercio.textContent = registro.comercioNombre || 'Comercio';
  if (modalCuponQrLogo) {
    if (registro.comercioLogo) {
      modalCuponQrLogo.src = registro.comercioLogo;
      modalCuponQrLogo.alt = registro.comercioNombre || 'Comercio';
      modalCuponQrLogo.classList.remove('hidden');
    } else {
      modalCuponQrLogo.classList.add('hidden');
    }
  }
  if (modalCuponQrDescripcion) {
    if (registro.cupon?.descripcion) {
      modalCuponQrDescripcion.textContent = registro.cupon.descripcion;
      modalCuponQrDescripcion.classList.remove('hidden');
    } else {
      modalCuponQrDescripcion.textContent = '';
      modalCuponQrDescripcion.classList.add('hidden');
    }
  }
  modalCuponQr.classList.remove('hidden');
}

function cerrarModalCuponQr() {
  modalCuponQr?.classList.add('hidden');
  if (modalCuponQrDescripcion) {
    modalCuponQrDescripcion.textContent = '';
    modalCuponQrDescripcion.classList.add('hidden');
  }
}

async function eliminarFavoritoLugar(idLugar, cardElement) {
  if (!usuarioId) {
    window.location.href = `${basePath}/logearse.html`;
    return;
  }

  console.log("Intentando eliminar lugar favorito:", idLugar);
  console.log("Eliminando lugar favorito en Supabase...");
  const { data, error } = await supabase
    .from('favoritosLugares')
    .delete()
    .eq('idusuario', usuarioId)
    .eq('idlugar', idLugar)
    .select('id');

  console.log("Resultado eliminación:", { data, error });

  if (error) {
    console.error('🛑 Error eliminando lugar favorito:', error);
    alert('No se pudo eliminar este lugar. Intenta nuevamente.');
    return;
  }

  console.log("Lugar eliminado correctamente");
  favoritosLugares = favoritosLugares.filter(lugar => lugar.id !== idLugar);
  console.log("Lista actualizada de favoritos:", favoritosLugares);

  if (cardElement) {
    cardElement.classList.add('opacity-0');
    setTimeout(() => {
      actualizarListadoFavoritosLugares();
    }, 200);
  } else {
    actualizarListadoFavoritosLugares();
  }
}

function obtenerFavoritosFiltrados() {
  const municipioSeleccionado = filtroMunicipio?.value || '';
  const categoriaSeleccionada = filtroCategoria?.value || '';

  return favoritos.filter(item => {
    const coincideNombre = !searchQuery || item.nombre?.toLowerCase().includes(searchQuery);
    const coincideMunicipio = !municipioSeleccionado || item.municipioNombre === municipioSeleccionado;
    const coincideCategoria = !categoriaSeleccionada || item.categoriaIds?.map(String).includes(categoriaSeleccionada);
    return coincideNombre && coincideMunicipio && coincideCategoria;
  });
}

function ordenarFavoritos(lista) {
  const orden = filtroOrden?.value || 'alfabetico';
  const listaOrdenada = [...lista];

  if (orden === 'alfabetico') {
    listaOrdenada.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  } else if (orden === 'recientes') {
    listaOrdenada.sort((a, b) => new Date(b.creadoEn || 0) - new Date(a.creadoEn || 0));
  } else if (orden === 'cercania' && userCoords) {
    listaOrdenada.sort((a, b) => {
      const distA = (a.latitud != null && a.longitud != null)
        ? calcularDistancia(userCoords.lat, userCoords.lon, a.latitud, a.longitud)
        : Infinity;
      const distB = (b.latitud != null && b.longitud != null)
        ? calcularDistancia(userCoords.lat, userCoords.lon, b.latitud, b.longitud)
        : Infinity;
      return distA - distB;
    });
  }

  return listaOrdenada;
}

function actualizarListadoFavoritos() {
  if (!listaFavoritos) return;

  const filtrados = obtenerFavoritosFiltrados();
  const ordenados = ordenarFavoritos(filtrados);
  mostrarFavoritos(ordenados); 
}

async function cargarPerfil(uid) {
  console.log('Ejecutando operación select en tabla usuarios', { filtro: { id: uid } });
  const { data, error } = await supabase
    .from('usuarios')
.select('id, nombre, apellido, telefono, email, imagen, creado_en, municipio, notificartext, membresiaUp')
    .eq('id', uid)
    .maybeSingle();

  if (error) {
    console.error('🛑 No se pudo cargar el perfil:', error);
    return null;
  }

  return data ?? null;
}

function mapMetadataToPerfil(user) {
  if (!user) return {};
  const metadata = user.user_metadata || {};

  const displayName = metadata.full_name || metadata.name || metadata.display_name || '';
  const posibleNombre = metadata.first_name || metadata.given_name || displayName;
  const posibleApellido = metadata.last_name || metadata.family_name || '';

  let nombre = posibleNombre;
  let apellido = posibleApellido;

  if (!apellido && displayName && displayName.includes(' ')) {
    const partes = displayName.trim().split(/\s+/);
    nombre = partes[0];
    apellido = partes.length > 1 ? partes.slice(1).join(' ') : '';
  }

  const telefono = metadata.phone_number || metadata.phone || '';
  const imagen = metadata.avatar_url || metadata.picture || '';

  return {
    nombre: nombre || '',
    apellido: apellido || '',
    telefono: telefono || '',
    imagen: imagen || ''
  };
}

async function subirAvatarDesdeUrl(url, userId) {
  if (!url || !userId) return null;

  try {
    const respuesta = await fetch(url, { mode: 'cors' });
    if (!respuesta.ok) {
      console.warn('⚠️ No se pudo descargar la imagen de perfil desde OAuth:', respuesta.status, url);
      return null;
    }

    const blob = await respuesta.blob();
    if (!blob.size) {
      console.warn('⚠️ La imagen descargada está vacía.');
      return null;
    }

    const extension = (blob.type?.split('/')?.[1] || 'jpg').split(';')[0];
    const nombreArchivo = `usuarios/${userId}_${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('imagenesusuarios')
      .upload(nombreArchivo, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: blob.type || 'image/jpeg'
      });

    if (uploadError) {
      console.error('🛑 Error subiendo avatar desde OAuth:', uploadError.message);
      return null;
    }

    const { data } = supabase.storage
      .from('imagenesusuarios')
      .getPublicUrl(nombreArchivo);

    return data?.publicUrl || null;
  } catch (error) {
    console.error('🛑 Excepción subiendo avatar desde OAuth:', error);
    return null;
  }
}

async function crearPerfilSiNoExiste(user) {
  if (!user?.id) return null;

  const metadataPerfil = mapMetadataToPerfil(user);
  const perfilExistente = await cargarPerfil(user.id);

  if (perfilExistente) {
    const updatePayload = {};

    if (!perfilExistente.nombre && metadataPerfil.nombre) {
      updatePayload.nombre = metadataPerfil.nombre;
    }

    if (!perfilExistente.apellido && metadataPerfil.apellido) {
      updatePayload.apellido = metadataPerfil.apellido;
    }

    if (!perfilExistente.telefono && metadataPerfil.telefono) {
      updatePayload.telefono = metadataPerfil.telefono;
    }

    if (!perfilExistente.imagen && metadataPerfil.imagen) {
      const subida = await subirAvatarDesdeUrl(metadataPerfil.imagen, user.id);
      if (subida) {
        updatePayload.imagen = subida;
      }
    }

    if (perfilExistente.notificartext === null || perfilExistente.notificartext === undefined) {
      updatePayload.notificartext = true;
    }

    if (Object.keys(updatePayload).length > 0) {
      console.log('Actualizando perfil existente con metadata OAuth', updatePayload);
      const { data, error } = await supabase
        .from('usuarios')
        .update(updatePayload)
        .eq('id', user.id)
        .select('id, nombre, apellido, telefono, email, imagen, creado_en, municipio, notificartext')
        .maybeSingle();

      if (error) {
        console.error('🛑 No se pudo actualizar el perfil existente:', error);
        return perfilExistente;
      }

      return data ?? perfilExistente;
    }

    return perfilExistente;
  }

  let imagenFinal = metadataPerfil.imagen || '';

  if (imagenFinal) {
    const subida = await subirAvatarDesdeUrl(imagenFinal, user.id);
    if (subida) {
      imagenFinal = subida;
    }
  }

  const payload = {
    id: user.id,
    email: user.email,
    nombre: metadataPerfil.nombre,
    apellido: metadataPerfil.apellido,
    telefono: metadataPerfil.telefono,
    imagen: imagenFinal,
    notificartext: true
  };

  console.log('Ejecutando operación insert en tabla usuarios', payload);
  const { data, error } = await supabase
    .from('usuarios')
    .insert([payload])
    .select('id, nombre, apellido, telefono, email, imagen, creado_en, municipio, notificartext')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      console.warn('⚠️ Perfil ya existía, reintentando carga.');
      return await cargarPerfil(user.id);
    }
    console.error('🛑 No se pudo crear el perfil del usuario:', error);
    return null;
  }

  return data ?? null;
}

async function asegurarMapasCategoriaSubcategoria() {
  if (!mapaCategorias) {
    mapaCategorias = await obtenerMapaCategorias();
  }

  if (!mapaSubcategorias) {
    console.log('Ejecutando operación select en tabla Subcategorias', {});
    const { data, error } = await supabase
      .from('Subcategorias')
      .select('id, nombre');

    if (error) {
      console.warn('⚠️ No se pudo obtener el mapa de subcategorías:', error.message);
      mapaSubcategorias = {};
    } else {
      mapaSubcategorias = (data || []).reduce((acc, item) => {
        if (item?.id) acc[item.id] = item.nombre;
        return acc;
      }, {});
    }
  }
}

async function obtenerNombreMunicipio(valorMunicipio) {
  if (!valorMunicipio && valorMunicipio !== 0) return null;

  const stringValor = String(valorMunicipio).trim();
  const esNumero = stringValor !== '' && !Number.isNaN(Number(stringValor));

  if (!esNumero) return stringValor;

  console.log('Ejecutando operación select en tabla Municipios', { filtro: { id: Number(stringValor) } });
  const { data, error } = await supabase
    .from('Municipios')
    .select('nombre')
    .eq('id', Number(stringValor))
    .maybeSingle();

  if (error) {
    console.warn('⚠️ No se pudo obtener el municipio:', error.message);
    return null;
  }

  return data?.nombre || null;
}

const normalizarAArray = (valor) => {
  if (Array.isArray(valor)) return valor.filter(v => v !== null && v !== undefined);
  if (valor === null || valor === undefined) return [];
  return [valor];
};

async function cargarFavoritos(uid) {
  console.log("Ejecutando consulta favoritosusuarios");
  const { data, error } = await supabase
    .from('favoritosusuarios')
    .select(`
      idcomercio,
      creado_en,
      Comercios (
        id,
        nombre,
        municipio,
        idMunicipio,
        idSubcategoria,
        latitud,
        longitud
      )
    `)
    .eq('idusuario', uid);

  if (error) {
    console.error('🛑 Error al cargar favoritos:', error);
    mostrarMensajeFavoritos(t('common.error'), 'text-red-500');
    huboErrorCargandoFavoritos = true;
    return [];
  }

  huboErrorCargandoFavoritos = false;

  console.log("Favoritos raw:", data);

  if (!data?.length) return [];

  const comerciosIds = [...new Set(data.map(item => item.idcomercio).filter(Boolean))];
  console.log("IDs de comercios:", comerciosIds);

  await asegurarMapasCategoriaSubcategoria();

  let categoriasPorComercio = new Map();
  let relaciones = [];
  if (comerciosIds.length) {
    const { data: relacionesData, error: relacionesError } = await supabase
      .from('ComercioCategorias')
      .select(`
        idComercio,
        idCategoria,
        Categorias (
          id,
          nombre
        )
      `)
      .in('idComercio', comerciosIds);

    if (relacionesError) {
      console.warn('⚠️ No se pudieron obtener categorías de favoritos:', relacionesError.message);
    } else if (relacionesData) {
      relaciones = relacionesData;
      categoriasPorComercio = relacionesData.reduce((map, relacion) => {
        if (!relacion?.idComercio) return map;
        if (!map.has(relacion.idComercio)) {
          map.set(relacion.idComercio, { ids: [], nombres: [] });
        }
        const entry = map.get(relacion.idComercio);

        if (relacion.idCategoria !== null && relacion.idCategoria !== undefined) {
          entry.ids.push(relacion.idCategoria);
          const nombreCategoria = relacion.Categorias?.nombre || mapaCategorias?.[relacion.idCategoria] || null;
          if (nombreCategoria) {
            entry.nombres.push(nombreCategoria);
          }
        }

        return map;
      }, new Map());
    }
  }
  console.log("Relaciones cargadas:", relaciones);

  let logosMap = new Map();
  if (comerciosIds.length) {
    console.log('Ejecutando operación select en tabla imagenesComercios', { filtro: { idComercio: comerciosIds, logo: true } });
    const { data: logosData, error: errorLogos } = await supabase
      .from('imagenesComercios')
      .select('idComercio, imagen')
      .in('idComercio', comerciosIds)
      .eq('logo', true);

    if (errorLogos) {
      console.warn('⚠️ No se pudieron obtener logos de favoritos:', errorLogos.message);
    } else if (logosData) {
      logosMap = new Map(
        logosData.map(entry => {
          const { data: publicData } = supabase.storage
            .from('galeriacomercios')
            .getPublicUrl(entry.imagen);
          return [entry.idComercio, publicData?.publicUrl || null];
        })
      );
    }
  }

  return data
    .map(item => {
      const comercio = item.Comercios;
      if (!comercio) return null;

      const categoriasInfo = categoriasPorComercio.get(comercio.id || item.idcomercio) || { ids: [], nombres: [] };
      const categoriaIds = categoriasInfo.ids;
      const categoriasNombre = categoriasInfo.nombres;
      const subcategoriaIds = normalizarAArray(comercio.idSubcategoria);
      const logoUrl = logosMap.get(comercio.id || item.idcomercio) || null;

      return {
        id: comercio.id || item.idcomercio,
        nombre: comercio.nombre || 'Comercio sin nombre',
        municipio: comercio.municipio || '',
        municipioNombre: comercio.municipio || '',
        municipioId: comercio.idMunicipio ?? null,
        categoriaIds,
        categorias: categoriasNombre,
        subcategorias: subcategoriaIds,
        subcategoriasNombre: subcategoriaIds.map(id => mapaSubcategorias?.[id] || `Subcategoría ${id}`),
        latitud: comercio.latitud != null ? Number(comercio.latitud) : null,
        longitud: comercio.longitud != null ? Number(comercio.longitud) : null,
        logo: logoUrl,
        creadoEn: item.creado_en,
        creado_en: item.creado_en
      };
    })
    .filter(Boolean);
}

async function cargarFavoritosLugares() {
  if (!usuarioId) {
    alert('Debes iniciar sesión para ver tus lugares favoritos.');
    window.location.href = `${basePath}/logearse.html`;
    return [];
  }

  mostrarMensajeFavoritosLugares(t('cuenta.cargandoFavs'));
  console.log("Cargando lugares favoritos...");

  const { data, error } = await supabase
    .from('favoritosLugares')
    .select(`
      id,
      creado_en,
      idlugar,
      LugaresTuristicos (
        id,
        nombre,
        municipio,
        activo,
        imagen,
        latitud,
        longitud
      )
    `)
    .eq('idusuario', usuarioId)
    .order('creado_en', { ascending: false });

  if (error) {
    console.log("Error al cargar favoritosLugares:", error);
    mostrarMensajeFavoritosLugares(t('common.error'), 'text-red-500');
    favoritosLugares = [];
    return [];
  }

  console.log("Lugares favoritos obtenidos:", data);

  const activos = (data || []).filter(item => item?.LugaresTuristicos?.activo);
  if (!activos.length) {
    favoritosLugares = [];
    searchQueryLugares = '';
    if (inputBuscarFavoritosLugares) inputBuscarFavoritosLugares.value = '';
    if (filtroMunicipioLugares) filtroMunicipioLugares.value = '';
    if (filtroCategoriaLugares) filtroCategoriaLugares.value = '';
    if (filtroOrdenLugares) filtroOrdenLugares.value = 'alfabetico';
    poblarFiltrosLugares([]);
    renderFavoritosLugares(favoritosLugares);
    return [];
  }

  const lugaresBase = activos.map(item => {
    const lugar = item.LugaresTuristicos || {};
    return {
      id: lugar.id || item.idlugar,
      nombre: lugar.nombre || 'Lugar sin nombre',
      municipioRaw: lugar.municipio,
      activo: lugar.activo,
      imagen: lugar.imagen || '',
      latitud: lugar.latitud != null ? Number(lugar.latitud) : null,
      longitud: lugar.longitud != null ? Number(lugar.longitud) : null,
      creadoEn: item.creado_en
    };
  }).filter(lugar => lugar.id != null);

  const municipiosUnicos = [...new Set(lugaresBase.map(l => l.municipioRaw).filter(valor => valor !== null && valor !== undefined))];
  const municipioNombreMap = new Map();
  for (const municipio of municipiosUnicos) {
    const nombre = await obtenerNombreMunicipio(municipio);
    municipioNombreMap.set(municipio, nombre || (typeof municipio === 'string' ? municipio : String(municipio)));
  }

  let categoriasPorLugar = new Map();
  const lugarIds = lugaresBase.map(l => l.id);

  if (lugarIds.length) {
    const { data: categoriasData, error: categoriasError } = await supabase
      .from('lugarCategoria')
      .select(`
        idLugar,
        categoria:categoriaLugares (
          id,
          nombre
        )
      `)
      .in('idLugar', lugarIds);

    if (categoriasError) {
      console.warn('⚠️ No se pudieron obtener las categorías de lugares favoritos:', categoriasError.message);
    } else if (categoriasData) {
      categoriasPorLugar = categoriasData.reduce((acc, entry) => {
        const lugarId = entry?.idLugar ?? entry?.idlugar;
        if (!lugarId) return acc;
        const existente = acc.get(lugarId) || { ids: [], nombres: [] };
        const categoriaCampo = entry.categoria || entry.categoriaLugares;
        const categoriasArray = Array.isArray(categoriaCampo) ? categoriaCampo : [categoriaCampo];
        categoriasArray.forEach((categoria) => {
          if (!categoria || categoria.id == null) return;
          existente.ids.push(categoria.id);
          existente.nombres.push(categoria.nombre || `Categoría ${categoria.id}`);
        });
        acc.set(lugarId, existente);
        return acc;
      }, new Map());
    }
  }

  favoritosLugares = lugaresBase.map(lugar => {
    const infoCategoria = categoriasPorLugar.get(lugar.id) || { ids: [], nombres: [] };
    return {
      id: lugar.id,
      nombre: lugar.nombre,
      municipioNombre: municipioNombreMap.get(lugar.municipioRaw) || '',
      categoriaIds: infoCategoria.ids,
      categorias: infoCategoria.nombres,
      imagen: lugar.imagen,
      latitud: lugar.latitud,
      longitud: lugar.longitud,
      creadoEn: lugar.creadoEn
    };
  });

  searchQueryLugares = '';
  if (inputBuscarFavoritosLugares) inputBuscarFavoritosLugares.value = '';
  if (filtroMunicipioLugares) filtroMunicipioLugares.value = '';
  if (filtroCategoriaLugares) filtroCategoriaLugares.value = '';
  if (filtroOrdenLugares) filtroOrdenLugares.value = 'alfabetico';

  poblarFiltrosLugares(favoritosLugares);
  actualizarListadoFavoritosLugares();

  if (!userCoords && filtroOrdenLugares?.value === 'cercania' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        userCoords = { lat: coords.latitude, lon: coords.longitude };
        actualizarListadoFavoritosLugares();
      },
      (geoError) => {
        console.warn('⚠️ No se pudo obtener la ubicación del usuario (lugares favoritos):', geoError.message);
        actualizarListadoFavoritosLugares();
      }
    );
  }

  return favoritosLugares;
}

async function cargarYMostrarFavoritos() {
  if (!usuarioId) return;

  mostrarMensajeFavoritos(t('cuenta.cargandoFavs'));

  favoritos = await cargarFavoritos(usuarioId);
  console.log("Favoritos:", favoritos);

  if (huboErrorCargandoFavoritos) {
    return;
  }

  searchQuery = '';
  if (inputBuscar) inputBuscar.value = '';
  if (filtroMunicipio) filtroMunicipio.value = '';
  if (filtroCategoria) filtroCategoria.value = '';
  if (filtroOrden) filtroOrden.value = 'alfabetico';

  poblarFiltros(favoritos);
  actualizarListadoFavoritos();

  if (!userCoords && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        userCoords = { lat: coords.latitude, lon: coords.longitude };
        if (filtroOrden?.value === 'cercania') {
          actualizarListadoFavoritos();
        }
      },
      (error) => {
        console.warn('⚠️ No se pudo obtener la ubicación del usuario:', error.message);
      }
    );
  }
}

async function init() {
  await restaurarSesionDesdeHash();

  const { data: session, error } = await supabase.auth.getUser();
  if (session?.user) {
    console.log('UID autenticado:', session.user.id);
  }
  if (error || !session?.user) {
    console.error('🛑 No se pudo obtener el usuario:', error);
    window.location.href = `${basePath}/logearse.html`;
    return;
  }

  const authUser = session.user;
  usuarioId = authUser.id;

  perfilOriginal = await crearPerfilSiNoExiste(authUser);
  if (!perfilOriginal) {
    alert('No se pudo cargar tu perfil. Intenta iniciar sesión nuevamente.');
    window.location.href = `${basePath}/logearse.html`;
    return;
  }

  const nombreCompleto = `${perfilOriginal.nombre || ''} ${perfilOriginal.apellido || ''}`.trim();
  nombreUsuario.textContent = nombreCompleto || authUser.email;
  if (perfilOriginal.membresiaUp) {
    membresiaBadge?.classList.remove('hidden');
    upgradeBox?.classList.add('hidden');
  } else {
    membresiaBadge?.classList.add('hidden');
    upgradeBox?.classList.remove('hidden');
    if (upgradeDetails) {
      upgradeDetails.style.maxHeight = '0px';
      upgradeDetails.style.opacity = '0';
      toggleUpgradeDetailsBtn.textContent = 'Ver más';
    }
  }

  inputNombre.value = perfilOriginal.nombre || '';
  inputApellido.value = perfilOriginal.apellido || '';
  if (inputTelefono) {
    inputTelefono.value = perfilOriginal.telefono || '';
  }

  const imagenURL = perfilOriginal.imagen || PLACEHOLDER_FOTO;
  fotoPerfil.src = imagenURL;
  imagenActual.src = imagenURL;

  const fecha = perfilOriginal.creado_en || authUser.created_at;
  fechaRegistro.textContent = `Activo desde ${formatearFecha(fecha)}`;

  if (emailUsuario) {
    emailUsuario.textContent = perfilOriginal.email || authUser.email || 'Sin correo';
  }

  if (municipioUsuario) {
    const municipioNombre = await obtenerNombreMunicipio(perfilOriginal.municipio);
    municipioUsuario.textContent = municipioNombre || 'Municipio no disponible';
  }

  if (inputMunicipio) {
    console.log('Ejecutando operación select en tabla Municipios', { orden: 'nombre asc' });
    const { data: municipios, error: errorMunicipios } = await supabase
      .from('Municipios')
      .select('id, nombre')
      .order('nombre', { ascending: true });

    if (!errorMunicipios && municipios) {
      inputMunicipio.innerHTML = '<option value="">Selecciona un municipio</option>';
      municipios.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.nombre;
        inputMunicipio.appendChild(opt);
      });

      if (perfilOriginal.municipio) {
        inputMunicipio.value = perfilOriginal.municipio;
      }
    }
  }

  await cargarCuponesUsuario();
}

btnFavoritos?.addEventListener('click', async () => {
  modalFavoritos?.classList.remove('hidden');
  await cargarYMostrarFavoritos();
});

btnPedidos?.addEventListener('click', () => {
  window.location.href = `${basePath}/pedidos.html`;
});

btnCerrarFavoritos?.addEventListener('click', () => modalFavoritos?.classList.add('hidden'));

btnFavoritosLugares?.addEventListener('click', async () => {
  if (!usuarioId) {
    window.location.href = `${basePath}/logearse.html`;
    return;
  }
  modalFavoritosLugares?.classList.remove('hidden');
  await cargarFavoritosLugares();
});

btnCerrarFavoritosLugares?.addEventListener('click', () => modalFavoritosLugares?.classList.add('hidden'));

btnFavoritosPlayas?.addEventListener('click', async () => {
  if (!usuarioId) {
    window.location.href = `${basePath}/logearse.html`;
    return;
  }
  modalFavoritosPlayas?.classList.remove('hidden');
  await cargarFavoritosPlayas();
});

btnCerrarFavoritosPlayas?.addEventListener('click', () => modalFavoritosPlayas?.classList.add('hidden'));

btnCupones?.addEventListener('click', async () => {
  if (!usuarioId) {
    window.location.href = `${basePath}/logearse.html`;
    return;
  }
  cuponesTabActiva = 'guardados';
  actualizarTabsVisuales();
  refrescarSelectsCupones();
  renderCuponesModal(t('cuenta.cargandoFavs'));
  modalCupones?.classList.remove('hidden');
  await cargarCuponesUsuario();
});

btnCerrarCupones?.addEventListener('click', () => modalCupones?.classList.add('hidden'));
modalCupones?.addEventListener('click', (event) => {
  if (event.target === modalCupones) {
    modalCupones.classList.add('hidden');
  }
});

btnCerrarCuponQr?.addEventListener('click', cerrarModalCuponQr);
modalCuponQr?.addEventListener('click', (event) => {
  if (event.target === modalCuponQr) {
    cerrarModalCuponQr();
  }
});

cuponFiltroComercio?.addEventListener('change', (event) => {
  filtrosCupones[cuponesTabActiva].comercio = event.target.value || '';
  resetPaginacionCupones();
  renderCuponesModal();
});

cuponFiltroMunicipio?.addEventListener('change', (event) => {
  filtrosCupones[cuponesTabActiva].municipio = event.target.value || '';
  resetPaginacionCupones();
  renderCuponesModal();
});

cuponFiltroCategoria?.addEventListener('change', (event) => {
  filtrosCupones[cuponesTabActiva].categoria = event.target.value || '';
  resetPaginacionCupones();
  renderCuponesModal();
});

btnLimpiarFiltrosCupones?.addEventListener('click', () => {
  const filtros = filtrosCupones[cuponesTabActiva];
  filtros.comercio = '';
  filtros.municipio = '';
  filtros.categoria = '';
  if (cuponFiltroComercio) cuponFiltroComercio.value = '';
  if (cuponFiltroMunicipio) cuponFiltroMunicipio.value = '';
  if (cuponFiltroCategoria) cuponFiltroCategoria.value = '';
  resetPaginacionCupones();
  renderCuponesModal();
});

btnCargarMasGuardados?.addEventListener('click', () => {
  cuponesGuardadosPagina += 1;
  renderCuponesModal();
});

btnCargarMasRedimidos?.addEventListener('click', () => {
  cuponesRedimidosPagina += 1;
  renderCuponesModal();
});

cuponesTabs?.forEach((btn) => {
  btn.addEventListener('click', () => cambiarTabCupones(btn.dataset.cuponTab));
});

actualizarTabsVisuales();
refrescarSelectsCupones();

inputBuscar?.addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase();
  actualizarListadoFavoritos();
});

inputBuscarFavoritosLugares?.addEventListener('input', (e) => {
  searchQueryLugares = e.target.value.toLowerCase();
  actualizarListadoFavoritosLugares();
});

inputBuscarFavoritosPlayas?.addEventListener('input', (e) => {
  searchQueryPlayas = e.target.value.toLowerCase();
  actualizarListadoFavoritosPlayas();
});

[filtroMunicipio, filtroCategoria].forEach(filtro => {
  filtro?.addEventListener('change', actualizarListadoFavoritos);
});

[
  filtroMunicipioLugares,
  filtroCategoriaLugares
].forEach(filtro => {
  filtro?.addEventListener('change', actualizarListadoFavoritosLugares);
});

[
  filtroMunicipioPlayas,
  filtroCategoriaPlayas
].forEach(filtro => {
  filtro?.addEventListener('change', actualizarListadoFavoritosPlayas);
});

filtroOrden?.addEventListener('change', () => {
  if (filtroOrden.value === 'cercania' && !userCoords && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        userCoords = { lat: coords.latitude, lon: coords.longitude };
        actualizarListadoFavoritos();
      },
      (error) => {
        console.warn('⚠️ No se pudo obtener la ubicación del usuario:', error.message);
        actualizarListadoFavoritos();
      }
    );
  } else {
    actualizarListadoFavoritos();
  }
});

filtroOrdenLugares?.addEventListener('change', () => {
  if (filtroOrdenLugares.value === 'cercania' && !userCoords && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        userCoords = { lat: coords.latitude, lon: coords.longitude };
        actualizarListadoFavoritosLugares();
      },
      (error) => {
        console.warn('⚠️ No se pudo obtener la ubicación del usuario:', error.message);
        actualizarListadoFavoritosLugares();
      }
    );
  } else {
    actualizarListadoFavoritosLugares();
  }
});

filtroOrdenPlayas?.addEventListener('change', () => {
  if (filtroOrdenPlayas.value === 'cercania' && !userCoords && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        userCoords = { lat: coords.latitude, lon: coords.longitude };
        actualizarListadoFavoritosPlayas();
      },
      (error) => {
        console.warn('⚠️ No se pudo obtener la ubicación del usuario:', error.message);
        actualizarListadoFavoritosPlayas();
      }
    );
  } else {
    actualizarListadoFavoritosPlayas();
  }
});

btnEditar?.addEventListener('click', () => modal.classList.remove('hidden'));
btnCancelar?.addEventListener('click', () => modal.classList.add('hidden'));

formEditar?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nuevoNombre = inputNombre.value.trim();
  const nuevoApellido = inputApellido.value.trim();
  const nuevaFoto = inputFoto.files[0];
  const nuevoTelefono = inputTelefono?.value.trim() || null;
  const nuevoMunicipio = inputMunicipio?.value || null;
  const uid = usuarioId;
  let nuevaImagen = perfilOriginal.imagen;

  if (nuevaFoto) {
    const extension = nuevaFoto.name.split('.').pop();
    const nuevoNombreArchivo = `usuarios/${uid}_${Date.now()}.${extension}`;

    if (perfilOriginal.imagen && perfilOriginal.imagen.includes('imagenesusuarios')) {
      try {
        const url = new URL(perfilOriginal.imagen);
        const key = decodeURIComponent(url.pathname.split('/storage/v1/object/public/imagenesusuarios/')[1]);
        await supabase.storage.from('imagenesusuarios').remove([key]);
      } catch (err) {
        console.warn('⚠️ Error al borrar imagen anterior:', err);
      }
    }

    const { error: errorSubida } = await supabase.storage
      .from('imagenesusuarios')
      .upload(nuevoNombreArchivo, nuevaFoto, {
        cacheControl: '3600',
        upsert: true,
        contentType: nuevaFoto.type
      });

    if (!errorSubida) {
      const { data } = supabase.storage
        .from('imagenesusuarios')
        .getPublicUrl(nuevoNombreArchivo);
      nuevaImagen = data.publicUrl;
    }
  }

  const updatePayload = {
    nombre: nuevoNombre,
    apellido: nuevoApellido,
    imagen: nuevaImagen,
    telefono: nuevoTelefono,
    municipio: nuevoMunicipio
  };

  try {
    const user = await verificarSesion();
    console.log('🔎 UID auth:', uid, ' | ID perfilOriginal:', perfilOriginal.id);

    console.log('Actualizando en tabla usuarios...', updatePayload, user.id);

    const { error } = await supabase
      .from('usuarios')
      .update(updatePayload)
      .eq('id', user.id);

    if (error) {
      console.error('Error al actualizar perfil:', error);
      alert('Error al actualizar tu perfil.');
      return;
    }

    alert('Perfil actualizado correctamente.');
    modal.classList.add('hidden');
    await init();
  } catch (err) {
    console.error(err);
  }
});

btnLogout?.addEventListener('click', async () => {
  if (!confirm('¿Deseas cerrar sesión?')) return;
  await supabase.auth.signOut();
  window.location.href = `${basePath}/index.html`;
});

btnMensajes?.addEventListener('click', async () => {
  await cargarMensajes();
  modalMensajes?.classList.remove('hidden');
  modalMensajes?.classList.add('flex');
});

modalMensajesCerrar?.addEventListener('click', () => {
  modalMensajes?.classList.add('hidden');
  modalMensajes?.classList.remove('flex');
});

modalMensajes?.addEventListener('click', (e) => {
  if (e.target === modalMensajes) {
    modalMensajes.classList.add('hidden');
    modalMensajes.classList.remove('flex');
  }
});

async function cargarMensajes() {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    const uid = user?.id;
    const email = user?.email;
    if (!uid && !email) return;

    const orParts = [];
    if (uid) orParts.push(`destino_usuario.eq.${uid}`);
    if (email) orParts.push(`destino_email.eq.${email}`);

    const { data, error } = await supabase
      .from('Mensajes')
      .select('*')
      .or(orParts.join(','))
      .order('created_at', { ascending: false })
      .limit(30);

    console.log('AUTH UID:', uid, 'AUTH EMAIL:', email);
    console.log('MENSAJES QUERY RESULT data:', data, 'error:', error);
    if (error) throw error;
    console.log('MENSAJES SIN FILTRO:', data);
    mensajesUsuario = data || [];
    if (!mensajesUsuario.length && Array.isArray(data) && data.length) {
      mensajesUsuario = data; // fallback por si algún filtro vacía resultados
    }
    console.log('MENSAJES FILTRADOS:', mensajesUsuario);
    await enriquecerMensajes(mensajesUsuario);
    renderMensajes();
  } catch (err) {
    console.error('Error cargando mensajes', err);
  }
}

async function enriquecerMensajes(mensajes) {
  mapaUsuariosMsg = {};
  mapaComerciosMsg = {};
  const idsUsuarios = [...new Set(mensajes.map((m) => m.creado_por).filter(Boolean))];
  const idsComercios = [...new Set(mensajes.map((m) => m.id_comercio).filter(Boolean))];

  if (idsUsuarios.length) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .in('id', idsUsuarios);
    if (!error && Array.isArray(data)) {
      data.forEach((u) => {
        const nombre = `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.id;
        mapaUsuariosMsg[u.id] = nombre;
      });
    }
  }

  if (idsComercios.length) {
    const { data, error } = await supabase
      .from('Comercios')
      .select('id, nombre')
      .in('id', idsComercios);
    if (!error && Array.isArray(data)) {
      data.forEach((c) => {
        mapaComerciosMsg[c.id] = c.nombre || `Comercio ${c.id}`;
      });
    }
  }
}

function renderMensajes() {
  if (!mensajesLista) return;
  mensajesLista.innerHTML = '';
  if (!mensajesUsuario.length) {
    mensajesVacio?.classList.remove('hidden');
    mensajesLista.appendChild(mensajesVacio);
    return;
  }
  mensajesVacio?.classList.add('hidden');

  mensajesUsuario.forEach((m) => {
    const payload = typeof m.payload === 'string' ? (() => { try { return JSON.parse(m.payload); } catch (_) { return {}; } })() : (m.payload || {});
    const rolRaw = payload?.rol || m.rol;
    const payloadComercio = payload?.comercio_id ?? payload?.comercioId ?? m.id_comercio;
    const invitador =
      (m.creado_por && mapaUsuariosMsg[m.creado_por]) ||
      'Un usuario';
    const rolLegible = mapRolLegible(rolRaw);
    const comercioNombre =
      (payloadComercio && mapaComerciosMsg[payloadComercio]) ||
      (payloadComercio ? `Comercio ${payloadComercio}` : 'tu comercio');
    const fechaEnvio = m.created_at || m.creado_en;
    const fechaTexto = fechaEnvio
      ? new Date(fechaEnvio).toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      : '';

    const item = document.createElement('div');
    item.className = 'border border-gray-200 rounded-lg p-3 flex flex-col gap-2';
    const title = document.createElement('p');
    title.className = 'font-semibold text-gray-900 text-sm';
    title.textContent = m.tipo?.startsWith('invitacion') ? 'Invitación a colaborar' : (m.tipo || 'Mensaje');
    const body = document.createElement('p');
    body.className = 'text-sm text-gray-700 leading-snug';
    const comercioTxt = payloadComercio ? `Comercio ID: ${payloadComercio}` : '';
    body.textContent = m.tipo?.startsWith('invitacion')
      ? `${invitador} te invitó a colaborar como ${rolLegible} en ${comercioNombre}.`
      : `${payload?.mensaje || ''} ${payloadRol ? `Rol: ${payloadRol}.` : ''} ${comercioTxt}`;

    if (fechaTexto) {
      const fechaEl = document.createElement('span');
      fechaEl.className = 'text-xs text-gray-500';
      fechaEl.textContent = `Fecha: ${fechaTexto}`;
      item.appendChild(fechaEl);
    }
    item.appendChild(title);
    item.appendChild(body);

    if (m.tipo?.startsWith('invitacion') && m.estado === 'pendiente') {
      const actions = document.createElement('div');
      actions.className = 'flex gap-2';
      const btnAceptar = document.createElement('button');
      btnAceptar.className = 'px-3 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700';
      btnAceptar.textContent = 'Aceptar';
      btnAceptar.addEventListener('click', () => responderMensaje(m, 'aceptada'));
      const btnRechazar = document.createElement('button');
      btnRechazar.className = 'px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700';
      btnRechazar.textContent = 'Rechazar';
      btnRechazar.addEventListener('click', () => responderMensaje(m, 'rechazada'));
      actions.appendChild(btnAceptar);
      actions.appendChild(btnRechazar);
      item.appendChild(actions);
    } else {
      const estado = document.createElement('span');
      estado.className = 'text-xs text-gray-500';
      estado.textContent = `Estado: ${m.estado || '—'}`;
      item.appendChild(estado);
    }
    mensajesLista.appendChild(item);
  });
}

async function responderMensaje(mensaje, estado) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      alert('Debes iniciar sesión.');
      return;
    }

    const estadoValido = estado === 'aceptada' || estado === 'rechazada'
      ? estado
      : estado === 'aceptado'
        ? 'aceptada'
        : 'rechazada';

    if (mensaje.destino_usuario && mensaje.destino_usuario !== user.id) {
      alert('No puedes responder esta invitación.');
      return;
    }
    if (mensaje.estado !== 'pendiente') {
      alert('Esta invitación ya fue gestionada.');
      return;
    }

    if (estadoValido === 'aceptada') {
      if (!mensaje.id_comercio || !mensaje.rol) {
        alert('Datos incompletos para aceptar la invitación.');
        return;
      }
      const { error: upsertErr } = await supabase
        .from('UsuarioComercios')
        .upsert(
          {
            idUsuario: user.id,
            idComercio: mensaje.id_comercio,
            rol: mensaje.rol
          },
          { onConflict: 'idUsuario,idComercio' }
        );
      if (upsertErr) throw upsertErr;
    }

    const { error } = await supabase
      .from('Mensajes')
      .update({ estado: estadoValido })
      .eq('id', mensaje.id);
    if (error) throw error;

    await cargarMensajes();
    alert(`Invitación ${estadoValido}`);
  } catch (err) {
    console.error('Error actualizando mensaje', err);
    alert('No se pudo actualizar el mensaje.');
  }
}

init();
