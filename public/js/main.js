import { getPublicBase, calcularTiempoEnVehiculo, formatearHorario } from '../shared/utils.js';
import { getDrivingDistance, formatTiempo } from '../shared/osrmClient.js';
import { mostrarMensajeVacio, mostrarError, mostrarCargando } from './mensajesUI.js';
import { mostrarPopupUbicacionDenegada } from './popups.js';

import { cardComercio } from './CardComercio.js';
import { cardComercioNoActivo } from './CardComercioNoActivo.js';
//import { calcularTiemposParaLista } from './calcularTiemposParaLista.js';
import { detectarMunicipioUsuario } from './detectarMunicipio.js';
import { createGlobalBannerElement, destroyCarousel } from './bannerCarousel.js';
import { supabase } from '../shared/supabaseClient.js';
import { requireAuthSilent, showAuthModal, ACTION_MESSAGES } from './authGuard.js';
import { showPopupFavoritosVacios } from './popups.js';
import { resolverPlanComercio } from '../shared/planes.js';

function obtenerIdCategoriaDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('idCategoria');
  if (!raw) return null;
  return parseInt(raw);
}

const baseImageUrl = getPublicBase('galeriacomercios');

const contenedorListado = document.getElementById('app');
const claseBaseListado = contenedorListado?.className || '';

function restaurarLayoutListado() {
  if (contenedorListado) {
    contenedorListado.className = claseBaseListado;
  }
}

const diaActual = new Date().getDay();
const idCategoriaDesdeURL = obtenerIdCategoriaDesdeURL();
cargarNombreCategoria();
cargarMunicipios();
if (idCategoriaDesdeURL) {
  cargarSubcategorias(idCategoriaDesdeURL);
}


let listaOriginal = [];
let latUsuario = null;
let lonUsuario = null;
let tieneFavoritosUsuario = false;

function desactivarSwitchFavoritos() {
  const el = document.getElementById('filtro-favoritos');
  if (el) {
    el.checked = false;
  }
  filtrosActivos.favoritos = false;
}

const filtrosActivos = {
  textoBusqueda: '',
  municipio: '',
  categoria: '',
  subcategoria: '',
  orden: 'ubicacion',
  abiertoAhora: false,
  favoritos: false,
  activos: false,
  destacadosPrimero: true,
  comerciosPorPlato: []
};

const UNKNOWN_CATEGORY_LABEL = 'Sin categoría';
const UNKNOWN_SUBCATEGORY_LABEL = 'Sin subcategoría';

function toNonEmptyString(value) {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseDelimitedList(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizarRelacionesComercio(comercio) {
  const categoriaIdSet = new Set();
  const categoriaNombreSet = new Set();
  const subcategoriaIdSet = new Set();
  const subcategoriaNombreSet = new Set();

  const categoriasRel = Array.isArray(comercio?.ComercioCategorias) ? comercio.ComercioCategorias : [];
  categoriasRel.forEach((rel) => {
    const relId = rel?.idCategoria ?? rel?.categoria?.id;
    if (relId !== null && relId !== undefined && relId !== '') {
      const numericId = Number(relId);
      if (!Number.isNaN(numericId)) categoriaIdSet.add(numericId);
    }
    const nombre = toNonEmptyString(rel?.categoria?.nombre);
    if (nombre) categoriaNombreSet.add(nombre);
  });

  const subcategoriasRel = Array.isArray(comercio?.ComercioSubcategorias)
    ? comercio.ComercioSubcategorias
    : [];
  subcategoriasRel.forEach((rel) => {
    const relId = rel?.idSubcategoria ?? rel?.subcategoria?.id;
    if (relId !== null && relId !== undefined && relId !== '') {
      const numericId = Number(relId);
      if (!Number.isNaN(numericId)) subcategoriaIdSet.add(numericId);
    }
    const nombre = toNonEmptyString(rel?.subcategoria?.nombre);
    if (nombre) subcategoriaNombreSet.add(nombre);
  });

  const legacyCategorias = Array.isArray(comercio?.idCategoria)
    ? comercio.idCategoria
    : comercio?.idCategoria !== null && comercio?.idCategoria !== undefined
    ? [comercio.idCategoria]
    : [];
  legacyCategorias.forEach((id) => {
    const numericId = Number(id);
    if (!Number.isNaN(numericId)) categoriaIdSet.add(numericId);
  });

  const legacySubcategorias = Array.isArray(comercio?.idSubcategoria)
    ? comercio.idSubcategoria
    : comercio?.idSubcategoria !== null && comercio?.idSubcategoria !== undefined
    ? [comercio.idSubcategoria]
    : [];
  legacySubcategorias.forEach((id) => {
    const numericId = Number(id);
    if (!Number.isNaN(numericId)) subcategoriaIdSet.add(numericId);
  });

  parseDelimitedList(comercio?.categoria).forEach((nombre) => categoriaNombreSet.add(nombre));
  parseDelimitedList(comercio?.subCategorias).forEach((nombre) => subcategoriaNombreSet.add(nombre));

  const categoriaDisplay =
    categoriaNombreSet.size > 0 ? Array.from(categoriaNombreSet).join(', ') : UNKNOWN_CATEGORY_LABEL;
  const subcategoriaDisplay =
    subcategoriaNombreSet.size > 0 ? Array.from(subcategoriaNombreSet).join(', ') : UNKNOWN_SUBCATEGORY_LABEL;

  return {
    categoriaIds: Array.from(categoriaIdSet),
    subcategoriaIds: Array.from(subcategoriaIdSet),
    categoriaNombres: Array.from(categoriaNombreSet),
    subcategoriaNombres: Array.from(subcategoriaNombreSet),
    categoriaDisplay,
    subcategoriaDisplay,
  };
}


function actualizarEtiquetaSubcategoria(nombreCategoria) {
  const label = document.querySelector('label[for="filtro-subcategoria"]');
  if (label) {
    switch (nombreCategoria.toLowerCase()) {
      case 'restaurantes':
        label.textContent = 'Tipo de Comida'; break;
      case 'servicios':
        label.textContent = 'Tipo de Servicio'; break;
      case 'tiendas':
        label.textContent = 'Tipo de Tienda'; break;
      default:
        label.textContent = 'Subcategoría';
    }
  }
}

async function cargarNombreCategoria() {
  if (!idCategoriaDesdeURL) return;

  const { data, error } = await supabase
    .from('Categorias')
    .select('nombre, icono') // 👈 aseguramos que viene el icono
    .eq('id', parseInt(idCategoriaDesdeURL))
    .single();

  if (error || !data) {
    console.error('Error cargando categoría:', error);
    return;
  }

  const titulo = document.getElementById('tituloCategoria');
  const icono = document.getElementById('iconoCategoria');
  const input = document.getElementById('filtro-nombre');

  if (titulo) {
    titulo.textContent = data.nombre;
    actualizarEtiquetaSubcategoria(data.nombre);
  }

  if (icono && data.icono) {
  if (data.icono.startsWith('<i')) {
    // Caso: ya guardaste el HTML completo
    icono.innerHTML = data.icono;
  } else {
    // Caso: guardaste solo la clase, ej. "fa-utensils"
    icono.innerHTML = `<i class="fas ${data.icono}"></i>`;
  }
}

  if (input) {
    input.placeholder = `Buscar en ${data.nombre}`;
  }
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function crearTextoFallback(distanciaKm) {
  if (!Number.isFinite(distanciaKm) || distanciaKm <= 0) {
    return { texto: 'N/D', minutos: null, distanciaKm: null, distanciaTexto: null };
  }

  const { minutos } = calcularTiempoEnVehiculo(distanciaKm);
  const texto = formatTiempo(minutos * 60);
  return {
    texto,
    minutos,
    distanciaKm,
    distanciaTexto: `${distanciaKm.toFixed(1)} km`
  };
}

async function resolverTiempoEnVehiculo(origen, destino, distanciaHaversine) {
  const origenValido = origen && Number.isFinite(origen.lon) && Number.isFinite(origen.lat);
  const destinoValido = destino && Number.isFinite(destino.lon) && Number.isFinite(destino.lat);

  if (origenValido && destinoValido) {
    const resultado = await getDrivingDistance(
      { lat: origen.lat, lng: origen.lon },
      { lat: destino.lat, lng: destino.lon }
    );
    if (resultado?.duracion != null) {
      const distanciaKm = typeof resultado.distancia === 'number'
        ? resultado.distancia / 1000
        : distanciaHaversine ?? null;

      return {
        texto: formatTiempo(resultado.duracion),
        minutos: Math.round(resultado.duracion / 60),
        distanciaKm,
        distanciaTexto: typeof distanciaKm === 'number' ? `${distanciaKm.toFixed(1)} km` : null
      };
    }
  }

  if (Number.isFinite(distanciaHaversine)) {
    return crearTextoFallback(distanciaHaversine);
  }

  return {
    texto: 'N/D',
    minutos: null,
    distanciaKm: distanciaHaversine ?? null,
    distanciaTexto: Number.isFinite(distanciaHaversine) ? `${distanciaHaversine.toFixed(1)} km` : null
  };
}

async function cargarComercios() {
  
  let query = supabase
    .from('Comercios')
    .select(
      `
        *,
        ComercioCategorias (
          idCategoria,
          categoria:Categorias (
            id,
            nombre
          )
        ),
        ComercioSubcategorias (
          idSubcategoria,
          subcategoria:subCategoria (
            id,
            nombre
          )
        )
      `
    );
  if (idCategoriaDesdeURL) {
    query = query.eq('ComercioCategorias.idCategoria', idCategoriaDesdeURL);
  }

  const { data: comercios, error } = await query;
  if (error) {
    throw error;
  }

  const comerciosNormalizados = (comercios || []).map((comercio) => ({
    ...comercio,
    ...normalizarRelacionesComercio(comercio),
  }));

  const comerciosFiltrados =
    idCategoriaDesdeURL != null
      ? comerciosNormalizados.filter((comercio) =>
          Array.isArray(comercio.categoriaIds) && comercio.categoriaIds.includes(Number(idCategoriaDesdeURL))
        )
      : comerciosNormalizados;

  if (!comerciosFiltrados.length) {
    listaOriginal = [];
    return;
  }

  const { data: imagenesAll } = await supabase
    .from('imagenesComercios')
    .select('idComercio, imagen, portada, logo');

  const { data: horariosAll } = await supabase
    .from('Horarios')
    .select('idComercio, apertura, cierre, cerrado, diaSemana')
    .eq('diaSemana', diaActual);

  const { data: productosAll } = await supabase.from('productos').select('idMenu, nombre');

// Obtener usuario autenticado
const { data: { user } } = await supabase.auth.getUser();
let favoritosUsuario = [];

if (user) {
  const { data: favoritosData } = await supabase
    .from('favoritosusuarios')
    .select('idcomercio')
    .eq('idusuario', user.id);

  favoritosUsuario = favoritosData?.map(f => f.idcomercio) ?? [];
}
tieneFavoritosUsuario = favoritosUsuario.length > 0;


  const { data: menusAll } = await supabase.from('menus').select('id, idComercio');

  const productosPorComercio = {};
  for (const producto of productosAll) {
    const menu = menusAll.find(m => m.id === producto.idMenu);
    if (!menu) continue;
    if (!productosPorComercio[menu.idComercio]) productosPorComercio[menu.idComercio] = [];
    productosPorComercio[menu.idComercio].push(producto.nombre);
  }

  const origen = {
    lat: Number(latUsuario),
    lon: Number(lonUsuario)
  };

  listaOriginal = await Promise.all(comerciosFiltrados.map(async (comercio) => {
    const portada = imagenesAll.find(img => img.idComercio === comercio.id && img.portada);
    const logo = imagenesAll.find(img => img.idComercio === comercio.id && img.logo);
    const horario = horariosAll.find(h => h.idComercio === comercio.id);

    let abierto = false;
if (horario && !horario.cerrado && horario.apertura && horario.cierre) {
  const ahora = new Date();
  const [horaAct, minAct] = [ahora.getHours(), ahora.getMinutes()];
  const minutosActual = horaAct * 60 + minAct;

  const [hA, mA] = horario.apertura.slice(0, 5).split(':').map(Number);
  const [hC, mC] = horario.cierre.slice(0, 5).split(':').map(Number);
  const minutosApertura = hA * 60 + mA;
  const minutosCierre = hC * 60 + mC;

  if (minutosCierre > minutosApertura) {
    // Horario normal en el mismo día
    abierto = minutosActual >= minutosApertura && minutosActual <= minutosCierre;
  } else {
    // Horario que cruza medianoche (ej: 8pm–2am)
    abierto = minutosActual >= minutosApertura || minutosActual <= minutosCierre;
  }
}

    const destino = {
      lat: Number(comercio.latitud),
      lon: Number(comercio.longitud)
    };

    let distancia = null;
    const origenValido = Number.isFinite(origen.lat) && Number.isFinite(origen.lon);
    const destinoValido = Number.isFinite(destino.lat) && Number.isFinite(destino.lon);

    if (origenValido && destinoValido) {
      distancia = calcularDistancia(origen.lat, origen.lon, destino.lat, destino.lon);
    }

    const tiempo = await resolverTiempoEnVehiculo(origen, destino, distancia);

    const horarioTexto = horario
      ? formatearHorario(horario.apertura, horario.cierre, horario.cerrado)
      : 'Horario no disponible';

    return {
      id: comercio.id,
      nombre: comercio.nombre,
      telefono: comercio.telefono,
      googleMap: comercio.googleMap,
      pueblo: comercio.municipio,
      abierto,
      tiempoVehiculo: tiempo.texto,
      tiempoTexto: tiempo.texto,
      minutosCrudos: tiempo.minutos,
      horarioTexto,
      imagenPortada: portada ? `${baseImageUrl}/${portada.imagen}` : '',
      logo: logo ? `${baseImageUrl}/${logo.imagen}` : '',
      distanciaKm: tiempo.distanciaKm ?? distancia,
      distanciaTexto: tiempo.distanciaTexto,
      categoriaIds: Array.isArray(comercio.categoriaIds) ? comercio.categoriaIds : [],
      categoriaNombres: Array.isArray(comercio.categoriaNombres) ? comercio.categoriaNombres : [],
      categoriaDisplay: comercio.categoriaDisplay || UNKNOWN_CATEGORY_LABEL,
      subcategoriaIds: Array.isArray(comercio.subcategoriaIds) ? comercio.subcategoriaIds : [],
      subcategoriaNombres: Array.isArray(comercio.subcategoriaNombres)
        ? comercio.subcategoriaNombres
        : [],
      subcategoriaDisplay: comercio.subcategoriaDisplay || UNKNOWN_SUBCATEGORY_LABEL,
      activoEnPeErre: comercio.activo === true,
      favorito: favoritosUsuario.includes(comercio.id),
      platos: productosPorComercio[comercio.id] || [],
      latitud: comercio.latitud,
      longitud: comercio.longitud
    };
  }));
}

function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function cleanupCarousels(container) {
  if (!container) return;
  container
    .querySelectorAll(`[data-banner-carousel="true"]`)
    .forEach(destroyCarousel);
}


async function renderTopBanner() {
  const seccionFiltros = document.querySelector('section.p-4');
  if (!seccionFiltros) return;

  let topContainer = document.querySelector('[data-banner-slot="top-app"]');
  if (!topContainer) {
    topContainer = document.createElement('div');
    topContainer.dataset.bannerSlot = 'top-app';
    seccionFiltros.parentNode?.insertBefore(topContainer, seccionFiltros);
  } else {
    cleanupCarousels(topContainer);
    topContainer.innerHTML = '';
  }

  const banner = await createGlobalBannerElement({ intervalMs: 8000, slotName: 'banner-top' });
  if (banner) {
    topContainer.appendChild(banner);
    topContainer.classList.remove('hidden');
  } else {
    topContainer.classList.add('hidden');
  }
}

async function crearBannerElemento(slotName = 'banner-inline') {
  try {
    return await createGlobalBannerElement({ intervalMs: 8000, slotName });
  } catch (error) {
    console.error('Error creando banner global:', error);
    return null;
  }
}

// 📍 Obtener coordenadas del usuario
async function obtenerCoordenadasUsuario() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }),
      (error) => {
        if (error && error.code === error.PERMISSION_DENIED) {
          mostrarPopupUbicacionDenegada();
        }
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}


async function aplicarFiltrosYRedibujar() {
  try {
    console.log("🟡 Aplicando filtros con:", filtrosActivos);

    await renderTopBanner();

    const contenedor = document.getElementById("app");
    if (!contenedor) return;
    restaurarLayoutListado();
    cleanupCarousels(contenedor);
    contenedor.innerHTML = "";

    let filtrados = listaOriginal;

    const texto = normalizarTexto(filtrosActivos.textoBusqueda.trim());
    if (texto) {
      filtrados = filtrados.filter(
        (c) =>
          normalizarTexto(c.nombre).includes(texto) ||
          (c.platos && c.platos.some((p) => normalizarTexto(p).includes(texto)))
      );
    }

    if (filtrosActivos.comerciosPorPlato?.length > 0) {
      filtrados = filtrados.filter((c) =>
        filtrosActivos.comerciosPorPlato.includes(c.id)
      );
    }

    const hayBusquedaNombre = filtrosActivos.textoBusqueda?.trim().length >= 3;
    const hayBusquedaPlato = filtrosActivos.comerciosPorPlato?.length > 0;

    // ✅ Ocultar chip de municipio si hay búsqueda
    const chipMunicipio = document.getElementById("chipMunicipioActivo");
    if (chipMunicipio) {
      chipMunicipio.classList.toggle("hidden", hayBusquedaNombre || hayBusquedaPlato);
    }

    // ✅ Aplicar filtro por municipio solo si no hay búsqueda
    if (filtrosActivos.municipio && !hayBusquedaNombre && !hayBusquedaPlato) {
      filtrados = filtrados.filter((c) => c.pueblo === filtrosActivos.municipio);
    }

    if (filtrosActivos.subcategoria) {
      const subcategoriaFiltro = Number(filtrosActivos.subcategoria);
      filtrados = filtrados.filter(
        (c) =>
          Array.isArray(c.subcategoriaIds) &&
          c.subcategoriaIds.includes(subcategoriaFiltro)
      );
    }

    if (filtrosActivos.abiertoAhora) {
      filtrados = filtrados.filter((c) => c.abierto === true);
    }

    if (filtrosActivos.favoritos) {
      filtrados = filtrados.filter((c) => c.favorito === true);
    }

    // ✅ Mostrar filtros activos (sin duplicado)
    const filtrosDiv = document.getElementById("filtros-activos");
    filtrosDiv.innerHTML = "";
    filtrosDiv.className = "text-center mt-3";

    document.querySelectorAll("#filtros-activos .bg-gray-100").forEach((el) => el.remove());

    const categoriaCruda =
      document.getElementById("tituloCategoria")?.textContent || "Resultados";
    const categoriaNombre =
      categoriaCruda.charAt(0).toUpperCase() + categoriaCruda.slice(1).toLowerCase();

    const total = filtrados.length;
    const municipioActivo = filtrosActivos?.municipio || "";

    const labelTotal = document.createElement("div");
    labelTotal.className =
      "inline-block text-gray-800 text-[15px] font-medium text-center w-full";

// 🧩 Mostrar texto según resultados
if (total === 0) {
  // 🧹 Eliminar mensajes previos o sugerencias antiguas
  document.querySelectorAll('.mensaje-no-resultados, .sugerencias-cercanas').forEach(el => el.remove());

  const esBusquedaManual = !!municipioActivo && municipioActivo !== filtrosActivos?.municipioDetectado;
  const categoria = categoriaNombre || "Comercios";
  const municipio = municipioActivo || "tu ubicación actual";

  // ✅ Asegurar contenedor de mensajes fuera del grid
  let mensajesContainer = document.getElementById('mensajesContainer');
  if (!mensajesContainer) {
    mensajesContainer = document.createElement('div');
    mensajesContainer.id = 'mensajesContainer';
    mensajesContainer.className = 'text-center mb-6';
    contenedor.parentNode.insertBefore(mensajesContainer, contenedor);
  }
  mensajesContainer.innerHTML = '';

  // 🔹 Mensaje principal genérico (sin repetir municipio)
  const mensajePrincipal = esBusquedaManual
    ? `No se encontraron ${categoria.toLowerCase()} en el municipio seleccionado.`
    : `No se encontraron ${categoria.toLowerCase()} en tu ubicación actual.`;

  const mensajeBase = document.createElement("div");
  mensajeBase.className = "mensaje-no-resultados text-center mt-6 mb-4 px-4";
  mensajeBase.innerHTML = `<p class="text-gray-700 font-medium mb-3">${mensajePrincipal}</p>`;
  mensajesContainer.appendChild(mensajeBase);

  // 🔹 Botón azul con municipio activo
  if (municipioActivo) {
    const btnMunicipio = document.createElement("button");
    btnMunicipio.innerHTML = `✕ ${municipioActivo}`;
    btnMunicipio.className =
      "ml-2 bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full hover:bg-blue-200 transition";
    btnMunicipio.addEventListener("click", () => {
      // ✅ Reiniciar filtro, limpiar mensajes y recargar lista completa
      filtrosActivos.municipio = "";
      const selectMunicipio = document.getElementById("filtro-municipio");
      if (selectMunicipio) selectMunicipio.value = "";
      const mensajesContainerExistente = document.getElementById('mensajesContainer');
      if (mensajesContainerExistente) mensajesContainerExistente.remove();
      cargarComerciosConOrden();
    });
    mensajeBase.appendChild(btnMunicipio);
  }

  // ⚡ Mostrar comercios cercanos automáticamente
  try {
    let referencia = null;
    const coordsUsuario = await obtenerCoordenadasUsuario();

    // 🧭 Si es búsqueda manual, usar coordenadas del municipio seleccionado
    if (esBusquedaManual && municipioActivo) {
      const { data: muni } = await supabase
        .from("Municipios")
        .select("latitud, longitud")
        .eq("nombre", municipioActivo)
        .maybeSingle();

      if (muni?.latitud && muni?.longitud) {
        referencia = { lat: muni.latitud, lon: muni.longitud };
      } else if (coordsUsuario) {
        referencia = coordsUsuario;
      }
    } else {
      referencia = coordsUsuario;
    }

    // 🔍 Buscar comercios cercanos dentro de 25 km (igual que Lugares)
    if (referencia) {
      let cercanos = listaOriginal
        .filter((c) => resolverPlanComercio(c).aparece_en_cercanos)
        .filter((c) =>
          c.latitud &&
          c.longitud &&
          calcularDistancia(
            referencia.lat,
            referencia.lon,
            c.latitud,
            c.longitud
          ) <= 15
        )
        .map((c) => ({
          ...c,
          distanciaKm: calcularDistancia(
            referencia.lat,
            referencia.lon,
            c.latitud,
            c.longitud
          ),
        }))
        .sort((a, b) => a.distanciaKm - b.distanciaKm);

      if (cercanos.length > 0) {
        // ✅ Mostrar encabezado y mensaje igual que en Lugares
        const bloqueCercanos = document.createElement("div");
        bloqueCercanos.className = "text-center mt-8 mb-4";
        bloqueCercanos.innerHTML = `
          <h3 class="text-lg font-semibold text-gray-800 mb-1">
            ${categoria} cerca de <span class="text-[#3ea6c4]">${municipioActivo}</span>:
          </h3>
          <p class="text-sm text-gray-600 italic mb-4">Mostrando resultados cercanos...</p>
        `;
        mensajesContainer.appendChild(bloqueCercanos);

        cercanos.slice(0, 10).forEach((comercio) => {
          const card = comercio.activoEnPeErre
            ? cardComercio(comercio)
            : cardComercioNoActivo(comercio);
          contenedor.appendChild(card);
        });
      } else {
        // ❌ Sin comercios cercanos
        const sinCercanos = document.createElement("p");
        sinCercanos.className = "text-gray-600 mt-4 italic";
        sinCercanos.textContent = `Tampoco se encontraron ${categoria.toLowerCase()} cercanos a ${municipioActivo || 'tu ubicación'}.`;
        mensajesContainer.appendChild(sinCercanos);
      }
    }
  } catch (error) {
    console.error("❌ Error mostrando comercios cercanos:", error.message);
  }

  const bannerFinal = await crearBannerElemento("banner-bottom");
  if (bannerFinal) contenedor.appendChild(bannerFinal);
  return;
} else {
  // 🧹 Limpiar mensajes anteriores si existían
  const mensajesPrevios = document.getElementById("mensajesContainer");
  if (mensajesPrevios) mensajesPrevios.remove();

  // 🧭 Obtener municipio actual del usuario (si existe)
  let municipioUsuario = "";
  try {
    municipioUsuario = localStorage.getItem("municipioUsuario") || "";
  } catch {
    municipioUsuario = "";
  }

  // 🧭 Detectar si el municipio seleccionado es el mismo que el actual
  const esUbicacionActual =
    municipioActivo &&
    municipioUsuario &&
    municipioActivo.toLowerCase() === municipioUsuario.toLowerCase();

  labelTotal.textContent = `${total} ${categoriaNombre} ${
    municipioActivo
      ? esUbicacionActual
        ? `en tu ubicación actual en`
        : `en el municipio de`
      : ""
  }`;

  // 🔹 Botón azul
  if (municipioActivo) {
    const btnEliminar = document.createElement("button");
    btnEliminar.innerHTML = `✕ ${municipioActivo}`;
    btnEliminar.className =
      "ml-3 bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full hover:bg-blue-200 transition-all";
    btnEliminar.addEventListener("click", () => {
      filtrosActivos.municipio = "";
      const selectMunicipio = document.getElementById("filtro-municipio");
      if (selectMunicipio) selectMunicipio.value = "";
      cargarComerciosConOrden();
    });
    labelTotal.appendChild(btnEliminar);
  }

  filtrosDiv.appendChild(labelTotal);
}

    // 🧱 Redibujar resultados
    const fragment = document.createDocumentFragment();

    let cartasEnFila = 0;
    let totalFilas = 0;

    for (let i = 0; i < filtrados.length; i++) {
      const comercio = filtrados[i];
      const card = comercio.activoEnPeErre
        ? cardComercio(comercio)
        : cardComercioNoActivo(comercio);

      fragment.appendChild(card);
      cartasEnFila += 1;

      const esUltimaCarta = i === filtrados.length - 1;
      const filaCompleta = cartasEnFila === 2 || esUltimaCarta;

      if (filaCompleta) {
        totalFilas += 1;
        cartasEnFila = 0;

        const debeInsertarIntermedio = totalFilas % 4 === 0 && !esUltimaCarta;
        if (debeInsertarIntermedio) {
          const bannerIntermedio = await crearBannerElemento("banner-inline");
          if (bannerIntermedio) fragment.appendChild(bannerIntermedio);
        }
      }
    }

    const debeAgregarFinal = totalFilas === 0 || totalFilas % 4 !== 0;
    if (debeAgregarFinal) {
      const bannerFinal = await crearBannerElemento("banner-bottom");
      if (bannerFinal) fragment.appendChild(bannerFinal);
    }

    contenedor.appendChild(fragment);
  } catch (error) {
    console.error("Error al redibujar comercios:", error);
    if (contenedor) {
      mostrarError(contenedor, 'No pudimos mostrar los comercios.', '⚠️');
    }
  }
}


// Utilidad para tags de filtro
function crearTagFiltro(texto, onClick) {
  const span = document.createElement('span');
  span.className = 'bg-gray-100 text-gray-800 px-2 py-1 rounded flex items-center gap-1';
  span.innerHTML = `${texto} <button class="text-gray-500 hover:text-red-500 font-bold">×</button>`;
  span.querySelector('button').onclick = onClick;
  return span;
}

// 🧩 Listeners
['filtro-nombre', 'filtro-municipio', 'filtro-subcategoria', 'filtro-orden', 'filtro-abierto', 'filtro-destacados', 'filtro-favoritos']
  .forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    const evento = id === 'filtro-nombre' ? 'input' : 'change';
    el.addEventListener(evento, async (e) => {
      const v = e.target;
      console.log(`🛠 Cambió filtro ${id}:`, v.value ?? v.checked);

      if (id === 'filtro-nombre') {
        const texto = v.value.trim();
        filtrosActivos.textoBusqueda = texto;

        if (texto.length >= 3) {
          const { data: productos, error } = await supabase
            .from('productos')
            .select('idMenu, nombre')
            .ilike('nombre', `%${texto}%`);

          if (!error && productos?.length) {
            const idMenus = productos.map(p => p.idMenu);
            const { data: menus, error: errMenus } = await supabase
              .from('menus')
              .select('idComercio')
              .in('id', idMenus);
            if (!errMenus && menus?.length) {
              const idComercios = [...new Set(menus.map(m => m.idComercio))];
              filtrosActivos.comerciosPorPlato = idComercios;
            }
          } else {
            filtrosActivos.comerciosPorPlato = [];
          }
        } else {
          filtrosActivos.comerciosPorPlato = [];
        }
      }

      if (id === 'filtro-municipio') filtrosActivos.municipio = v.value;
      if (id === 'filtro-subcategoria') filtrosActivos.subcategoria = v.value;
      if (id === 'filtro-orden') filtrosActivos.orden = v.value;
      if (id === 'filtro-abierto') filtrosActivos.abiertoAhora = v.checked;
      if (id === 'filtro-favoritos') filtrosActivos.favoritos = v.checked;
      if (id === 'filtro-destacados') {
        filtrosActivos.destacadosPrimero = v.checked;
        console.log(`⭐ Cambió filtro destacadosPrimero: ${v.checked}`);
        await cargarComerciosConOrden(); // ✅ refresca con orden
        return;
      }

      // ✅ Nuevo console antes de aplicar
      console.log('🟡 Aplicando filtros con:', { ...filtrosActivos });

      if (id === 'filtro-favoritos' && v.checked) {
        const user = await requireAuthSilent('favoriteCommerce');
        if (!user) {
          desactivarSwitchFavoritos();
          showAuthModal(ACTION_MESSAGES.favoriteCommerce, 'favoriteCommerce');
          return;
        }
        if (!tieneFavoritosUsuario) {
          showPopupFavoritosVacios("comercio");
          desactivarSwitchFavoritos();
          return;
        }
      }

      if (id === 'filtro-orden') {
        await cargarComerciosConOrden();
      } else {
        aplicarFiltrosYRedibujar();
      }
    });
  });

  

navigator.geolocation.getCurrentPosition(async (pos) => {
  latUsuario = pos.coords.latitude;
  lonUsuario = pos.coords.longitude;

  // ✅ Esperar la promesa del detector
  const municipioDetectado = await detectarMunicipioUsuario({
    lat: latUsuario,
    lon: lonUsuario
  });

  console.log("📍 Municipio más cercano detectado:", municipioDetectado);

  // ✅ Activar filtro solo si se detectó correctamente
  if (municipioDetectado) {
    filtrosActivos.municipio = municipioDetectado;
    const selectMunicipio = document.getElementById('filtro-municipio');
    if (selectMunicipio) selectMunicipio.value = municipioDetectado;
  }

  await cargarComerciosConOrden();
}, async () => {
  await cargarComerciosConOrden();
});

async function cargarComerciosConOrden() {
  if (contenedorListado) {
    mostrarCargando(contenedorListado, 'Cargando comercios...', '🍽️');
  }

  try {
    console.log("🔄 Orden seleccionado:", filtrosActivos.orden);

    await cargarComercios();

    if (filtrosActivos.orden === 'ubicacion') {
      listaOriginal.sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
    } else if (filtrosActivos.orden === 'az') {
      listaOriginal.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else if (filtrosActivos.orden === 'recientes') {
      listaOriginal.sort((a, b) => b.id - a.id);
    }

    if (filtrosActivos.destacadosPrimero) {
      const activos = listaOriginal.filter(c => c.activoEnPeErre);
      const inactivos = listaOriginal.filter(c => !c.activoEnPeErre);

      activos.sort((a, b) => (a.minutosCrudos ?? Infinity) - (b.minutosCrudos ?? Infinity));
      inactivos.sort((a, b) => (a.minutosCrudos ?? Infinity) - (b.minutosCrudos ?? Infinity));

      listaOriginal = [...activos, ...inactivos];
    }

    if (filtrosActivos.comerciosPorPlato?.length > 0) {
      listaOriginal = listaOriginal.filter(c =>
        filtrosActivos.comerciosPorPlato.includes(c.id)
      );
    }

    await aplicarFiltrosYRedibujar();
  } catch (error) {
    console.error("❌ Error cargando comercios:", error);
    if (contenedorListado) {
      mostrarError(contenedorListado, 'No pudimos cargar los comercios.', '⚠️');
    }
  }
}

async function cargarMunicipios() {
  const { data, error } = await supabase.from('Municipios').select('id, nombre');
  const select = document.getElementById('filtro-municipio');
  if (!select) return;
  if (error) return console.error('Error cargando municipios:', error);

  data.forEach(m => {
    const option = document.createElement('option');
    option.value = m.nombre;
    option.textContent = m.nombre;
    select.appendChild(option);
  });
}

async function cargarSubcategorias(categoriaId) {
  const select = document.getElementById('filtro-subcategoria');
  if (!select || !categoriaId) return;

  select.innerHTML = '<option value="">Todas</option>';
  const { data, error } = await supabase
    .from('subCategoria')
    .select('id, nombre')
    .eq('idCategoria', parseInt(categoriaId));

  if (error) return console.error('Error cargando subcategorías:', error);

  data.forEach(s => {
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = s.nombre;
    select.appendChild(option);
  });
}

function actualizarResumenFiltros() {
  const contenedor = document.getElementById('resumen-filtros');
  if (!contenedor) return;

  let partes = [];
  const total = listaOriginal.filter(c => {
    // Aplicar los mismos filtros que en aplicarFiltrosYRedibujar
    if (filtrosActivos.textoBusqueda && !normalizarTexto(c.nombre).includes(normalizarTexto(filtrosActivos.textoBusqueda))) return false;
    if (filtrosActivos.municipio && c.pueblo !== filtrosActivos.municipio) return false;
    if (
      filtrosActivos.subcategoria &&
      !(
        Array.isArray(c.subcategoriaIds) &&
        c.subcategoriaIds.includes(Number(filtrosActivos.subcategoria))
      )
    )
      return false;
    if (filtrosActivos.abiertoAhora && !c.abierto) return false;
    return true;
  });

  partes.push(`<strong>${total.length}</strong> resultado${total.length !== 1 ? 's' : ''}`);

  if (filtrosActivos.categoria) partes.push(`de <span class="bg-gray-100 rounded px-2 py-1 inline-flex items-center gap-1">
    ${document.getElementById('tituloCategoria')?.textContent || 'categoría'} 
  </span>`);
  
  if (filtrosActivos.subcategoria) {
    const subcat = document.querySelector(`#filtro-subcategoria option[value="${filtrosActivos.subcategoria}"]`)?.textContent;
    if (subcat) partes.push(`<span class="bg-gray-100 rounded px-2 py-1 inline-flex items-center gap-1">
      ${subcat} 
      <button onclick="borrarFiltro('subcategoria')" class="text-gray-500 hover:text-red-500">&times;</button>
    </span>`);
  }

  if (filtrosActivos.municipio) {
    partes.push(`<span class="bg-gray-100 rounded px-2 py-1 inline-flex items-center gap-1">
      en ${filtrosActivos.municipio}
      <button onclick="borrarFiltro('municipio')" class="text-gray-500 hover:text-red-500">&times;</button>
    </span>`);
  }

  contenedor.innerHTML = partes.join(' ');
}
function borrarFiltro(tipo) {
  if (tipo === 'municipio') {
    filtrosActivos.municipio = '';
    document.getElementById('filtro-municipio').value = '';
  } else if (tipo === 'subcategoria') {
    filtrosActivos.subcategoria = '';
    document.getElementById('filtro-subcategoria').value = '';
  }
  aplicarFiltrosYRedibujar();
}

document.getElementById('filtro-plato')?.addEventListener('input', async (e) => {
  const termino = e.target.value.trim();
  if (!termino || termino.length < 3) {
    filtrosActivos.comerciosPorPlato = [];
    aplicarFiltrosYRedibujar();
    return;
  }

  const { data: productos, error } = await supabase
    .from('productos')
    .select('idMenu, nombre')
    .ilike('nombre', `%${termino}%`);

  if (error) {
    console.error('Error buscando productos:', error);
    return;
  }

  if (!productos.length) {
    filtrosActivos.comerciosPorPlato = [];
    aplicarFiltrosYRedibujar();
    return;
  }

  const idMenus = productos.map(p => p.idMenu);

  const { data: menus, error: errMenus } = await supabase
    .from('menus')
    .select('id, idComercio')
    .in('id', idMenus);

  if (errMenus) {
    console.error('Error buscando menús:', errMenus);
    return;
  }

  const idComercios = [...new Set(menus.map(m => m.idComercio))];
  filtrosActivos.comerciosPorPlato = idComercios;
  aplicarFiltrosYRedibujar();
});
