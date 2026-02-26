// lugares.js
function getPublicBase() {
  const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  return isLocal ? '/public/' : '/';
}

import { supabase } from '../shared/supabaseClient.js';
import { mostrarMensajeVacio, mostrarError, mostrarCargando } from './mensajesUI.js';
import { calcularTiemposParaLugares } from './distanciaLugar.js';
import { createGlobalBannerElement, destroyCarousel } from './bannerCarousel.js';

// 📍 Calcula distancia entre dos coordenadas (Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number'
  ) return Infinity;

  const R = 6371; // radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distancia en km
}

const contenedor = document.getElementById('lugaresContainer');
const inputBuscar = document.getElementById('searchInput');
const selectCategoria = document.getElementById('selectCategoria');
const selectMunicipio = document.getElementById('selectMunicipio');
const btnAbierto = document.getElementById('btnAbierto');
const btnFavoritos = document.getElementById('btnFavoritos');
const btnGratis = document.getElementById('btnGratis');

let lugares = [];
let latUsuario = null;
let lonUsuario = null;
let renderVersion = 0;

const claseBaseContenedor = contenedor?.className || '';
function restaurarContenedor() {
  if (contenedor) {
    contenedor.className = claseBaseContenedor;
  }
}

const cleanupCarousels = (container) => {
  if (!container) return;
  container
    .querySelectorAll(`[data-banner-carousel="true"]`)
    .forEach(destroyCarousel);
};

async function renderTopBannerLugares() {
  const filtrosSection = document.querySelector('section.p-4');
  if (!filtrosSection) return;

  let topContainer = document.querySelector('[data-banner-slot="top-lugares"]');
  if (!topContainer) {
    topContainer = document.createElement('div');
    topContainer.dataset.bannerSlot = 'top-lugares';
    filtrosSection.parentNode?.insertBefore(topContainer, filtrosSection);
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

function crearCardLugar(lugar) {
  const div = document.createElement('div');
  div.className = "bg-white rounded-2xl shadow-md overflow-hidden text-center w-full max-w-[200px] mx-auto";

  let estadoTexto = '';
  let estadoColor = '';
  let estadoIcono = '';

  if (lugar.estado === 'cerrado temporal') {
    estadoTexto = 'Cerrado Temporalmente';
    estadoColor = 'text-orange-500';
    estadoIcono = 'fa-solid fa-triangle-exclamation';
  } else if (lugar.estado === 'siempre abierto') {
    estadoTexto = 'Abierto Siempre';
    estadoColor = 'text-blue-600';
    estadoIcono = 'fa-solid fa-infinity';
  } else if (lugar.abiertoAhora === true) {
    estadoTexto = 'Abierto Ahora';
    estadoColor = 'text-green-600';
    estadoIcono = 'fa-regular fa-clock';
  } else {
    estadoTexto = 'Cerrado Ahora';
    estadoColor = 'text-red-600';
    estadoIcono = 'fa-regular fa-clock';
  }

  div.innerHTML = `
    <div class="relative overflow-hidden">
      ${
        lugar.favorito
          ? `<div class="absolute top-2 right-2 z-50">
              <div class="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
                <div class="w-6 h-6 rounded-full border-2 border-red-600 flex items-center justify-center">
                  <i class="fas fa-heart text-red-600 text-xs"></i>
                </div>
              </div>
            </div>`
          : ''
      }
      <img src="${lugar.portada}" alt="Portada de ${lugar.nombre}" class="w-full h-40 object-cover" />
    <a href="${getPublicBase()}perfilLugar.html?id=${lugar.id}" class="relative w-full flex flex-col items-center no-underline">
        <div class="relative h-12 w-full">
          <div class="absolute inset-0 flex items-center justify-center px-2 text-center">
            <h3 class="${lugar.nombre.length > 25 ? 'text-lg' : 'text-xl'} font-medium text-[#424242] z-30 mt-2 leading-[0.9] text-center">
              ${lugar.nombre}
            </h3>
          </div>
        </div>
      </a>  
      <div class="flex flex-wrap h-12 justify-center items-center gap-1 leading-[0.9] -mt-3 text-[#6e6e6e] italic font-light text-base">
        ${lugar.categorias?.map(c => `<span>${c}</span>`).join(',') || ''}
      </div>
      <div class="flex justify-center items-center gap-1 ${estadoColor} -mt-2 font-medium mb-1 text-base">
        <i class="${estadoIcono}"></i> ${estadoTexto}
      </div>
      <div class="flex justify-center items-center gap-1 font-medium mb-1 text-sm text-orange-600">
        <i class="fa-solid fa-tag"></i> ${lugar.precioEntrada || 'Gratis'}
      </div>
      <div class="flex justify-center items-center gap-1 font-medium mb-1 text-sm text-[#3ea6c4]">
        <i class="fas fa-map-pin"></i> ${lugar.municipio}
      </div>
      <div class="flex justify-center items-center gap-1 text-sm text-[#9c9c9c] mt-1 mb-2 leading-tight">
        <i class="fas fa-car"></i> ${lugar.tiempoTexto || ''}
      </d iv>
    </div>
  `;
  return div;
}

async function cargarLugares() {
  const { data: { user } } = await supabase.auth.getUser();
  console.log('User:', user?.id);

  let favoritosSet = new Set();
  if (user) {
    const { data: favoritosData, error: favoritosError } = await supabase
      .from('favoritosLugares')
      .select('idlugar')
      .eq('idusuario', user.id);

    if (favoritosError) {
      console.error('❌ Error cargando favoritosLugares:', favoritosError);
    } else {
      favoritosSet = new Set((favoritosData || []).map((fav) => fav.idlugar));
      console.log('IDs favoritos (lugares):', Array.from(favoritosSet));
    }
  } else {
    console.log('Usuario no autenticado; marcando favoritos de lugares en false.');
  }

  let { data, error } = await supabase.from('LugaresTuristicos').select('*').eq('activo', true);
  if (error) {
    throw error;
  }

  const baseLugares = (data || []).map((lugar) => ({
    ...lugar,
    favorito: user ? favoritosSet.has(lugar.id) : false,
  }));
  console.log(
    'Primeros items con favorito (lugares):',
    baseLugares.slice(0, 5).map((l) => ({ id: l.id, favorito: l.favorito }))
  );

  lugares = baseLugares.filter(l => l.latitud && l.longitud);

  const { data: categoriasRel, error: errorCategoriasRel } = await supabase
    .from('lugarCategoria')
    .select('idLugar, categoria:categoriaLugares(nombre)');
  if (errorCategoriasRel) {
    console.error('❌ Error cargando categorías relacionadas:', errorCategoriasRel);
  }

  lugares.forEach(lugar => {
    lugar.categorias = categoriasRel?.filter(c => c.idLugar === lugar.id).map(c => c.categoria?.nombre).filter(Boolean);
    lugar.idCategorias = categoriasRel?.filter(c => c.idLugar === lugar.id).map(c => c.categoria?.idCategoria).filter(Boolean);
  });

  // 🖼️ Intentar obtener imagen directamente desde la columna 'imagen' del lugar
const imagenDefault = "https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/lugarnodisponible.jpg";

// 🔹 Buscar imágenes alternativas (solo si no hay imagen directa)
const { data: imagenes, error: errorImg } = await supabase
  .from('imagenesLugares')
  .select('imagen, idLugar, portada')
  .eq('portada', true);

if (errorImg) {
  console.error('Error cargando portadas:', errorImg);
}

// 🔹 Asignar imagen priorizando la columna 'imagen' del lugar
lugares.forEach(lugar => {
  if (lugar.imagen && lugar.imagen.trim() !== "") {
    // ✅ Usar la imagen directa de la tabla LugaresTuristicos
    lugar.portada = lugar.imagen;
  } else {
    // 🔄 Buscar en la tabla imagenesLugares (portada)
    const imgPortada = imagenes?.find(img => img.idLugar === lugar.id);
    lugar.portada = imgPortada?.imagen || imagenDefault;
  }
});

  if (latUsuario && lonUsuario) {
    lugares = await calcularTiemposParaLugares(lugares, { lat: latUsuario, lon: lonUsuario });
    lugares.sort((a, b) => (a.minutosCrudos ?? Infinity) - (b.minutosCrudos ?? Infinity));
  }

  const diaSemana = new Date().getDay();
  const { data: horarios, error: errorHorarios } = await supabase
    .from('horariosLugares')
    .select('idLugar, apertura, cierre, cerrado, abiertoSiempre, cerradoTemporalmente')
    .eq('diaSemana', diaSemana);
  if (errorHorarios) console.error('❌ Error cargando horarios:', errorHorarios);

  const ahora = new Date();
  const horaActual = ahora.getHours() + ahora.getMinutes() / 60;

  lugares.forEach(lugar => {
  const horario = horarios?.find(h => h.idLugar === lugar.id);
  if (horario) {
    if (horario.cerradoTemporal) {
      lugar.estado = 'cerrado temporal';
      lugar.abiertoAhora = false;
    } else if (horario.abiertoSiempre) {
      lugar.estado = 'siempre abierto';
      lugar.abiertoAhora = true;
    } else if (horario.cerrado) {
      lugar.abiertoAhora = false;
    } else if (horario.apertura && horario.cierre) {
      // ✅ Validar que apertura y cierre existan antes de usar split
      const [hA, mA] = horario.apertura.split(':').map(Number);
      const [hC, mC] = horario.cierre.split(':').map(Number);
      const horaApertura = hA + mA / 60;
      const horaCierre = hC + mC / 60;
      lugar.abiertoAhora = horaActual >= horaApertura && horaActual < horaCierre;
    } else {
      // Si no hay hora definida
      lugar.abiertoAhora = false;
    }
  } else {
    lugar.abiertoAhora = false;
  }
});

  await llenarSelects();
  await renderizarLugares();
}

async function renderizarLugares() {
  const currentRender = ++renderVersion;
  try {
    await renderTopBannerLugares();
    if (currentRender !== renderVersion) return;

    restaurarContenedor();
    cleanupCarousels(contenedor);
    contenedor.innerHTML = '';
    let filtrados = [...lugares];

    const texto = inputBuscar.value.toLowerCase();
    if (texto) filtrados = filtrados.filter(l => l.nombre.toLowerCase().includes(texto));

    const categoriaSeleccionada = selectCategoria.value;
    if (categoriaSeleccionada) {
      filtrados = filtrados.filter(l => l.categorias?.includes(categoriaSeleccionada));
    }

    const municipio = selectMunicipio.value;
    if (municipio) filtrados = filtrados.filter(l => l.municipio === municipio);

    if (btnAbierto.classList.contains('bg-blue-500')) filtrados = filtrados.filter(l => l.abiertoAhora);
    if (btnFavoritos.classList.contains('bg-blue-500')) filtrados = filtrados.filter(l => l.favorito);
    if (btnGratis.classList.contains('bg-blue-500')) filtrados = filtrados.filter(l => l.precioEntrada === 'Gratis');

    const orden = document.getElementById('filtro-orden')?.value;
    if (orden === 'az') {
      filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else if (orden === 'recientes') {
      filtrados.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else {
      filtrados.sort((a, b) => a.distanciaLugar - b.distanciaLugar);
    }

    if (filtrados.length === 0) {
  contenedor.innerHTML = '';
  document.querySelectorAll('.mensaje-no-resultados, .sugerencias-cercanas').forEach(el => el.remove());

  const municipioActivo = selectMunicipio.value;
  const categoriaNombre = "Lugares de interés";

  // ✅ Asegurar contenedor de mensajes fuera del grid
  let mensajesContainer = document.getElementById('mensajesContainer');
  if (!mensajesContainer) {
    mensajesContainer = document.createElement('div');
    mensajesContainer.id = 'mensajesContainer';
    mensajesContainer.className = 'text-center mb-6';
    contenedor.parentNode.insertBefore(mensajesContainer, contenedor);
  }
  mensajesContainer.innerHTML = ''; // 🔹 limpiar mensajes previos

  // 🔹 Mensaje principal (sin mencionar el municipio)
  const mensajePrincipal = `No se encontraron ${categoriaNombre.toLowerCase()} en el municipio seleccionado.`;

  const mensajeBase = document.createElement("div");
  mensajeBase.className = "mensaje-no-resultados text-center mt-6 mb-4 px-4";
  mensajeBase.innerHTML = `<p class="text-gray-700 font-medium mb-3">${mensajePrincipal}</p>`;
  mensajesContainer.appendChild(mensajeBase);

  // 🔹 Mostrar chip con botón para quitar filtro
  if (municipioActivo) {
    const btnMunicipio = document.createElement("button");
    btnMunicipio.innerHTML = `✕ ${municipioActivo}`;
    btnMunicipio.className =
      "ml-2 bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full hover:bg-blue-200 transition";
    btnMunicipio.addEventListener("click", () => {
      // ✅ Reiniciar filtro, limpiar mensajes y recargar lista completa
      selectMunicipio.value = "";
      const mensajesContainerExistente = document.getElementById('mensajesContainer');
      if (mensajesContainerExistente) mensajesContainerExistente.remove(); // 🚀 Elimina mensajes antes de recargar
      renderizarLugares();
    });
    mensajeBase.appendChild(btnMunicipio);
  }

  try {
    let referencia = null;

    // 🧭 Coordenadas del usuario
    const coordsUsuario = await new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null)
      );
    });

    // 🗺️ Coordenadas del municipio seleccionado
    if (municipioActivo) {
      const { data: muni } = await supabase
        .from("Municipios")
        .select("latitud, longitud")
        .eq("nombre", municipioActivo)
        .maybeSingle();

      if (muni?.latitud && muni?.longitud) {
        referencia = { lat: parseFloat(muni.latitud), lon: parseFloat(muni.longitud) };
      } else if (coordsUsuario) {
        referencia = coordsUsuario;
      }
    } else {
      referencia = coordsUsuario;
    }

    // 🔍 Buscar lugares cercanos dentro de 25 km
    if (referencia) {
      const cercanos = lugares
        .filter((l) => {
          const lat = parseFloat(l.latitud);
          const lon = parseFloat(l.longitud);
          return lat && lon && calcularDistancia(referencia.lat, referencia.lon, lat, lon) <= 25;
        })
        .map((l) => ({
          ...l,
          distanciaKm: calcularDistancia(
            referencia.lat,
            referencia.lon,
            parseFloat(l.latitud),
            parseFloat(l.longitud)
          ),
        }))
        .sort((a, b) => a.distanciaKm - b.distanciaKm);

      if (cercanos.length > 0) {
        const bloqueCercanos = document.createElement("div");
        bloqueCercanos.className = "text-center mt-8 mb-4";
        bloqueCercanos.innerHTML = `
          <h3 class="text-lg font-semibold text-gray-800 mb-1">
            Lugares de interés cerca de <span class="text-[#3ea6c4]">${municipioActivo}</span>:
          </h3>
          <p class="text-sm text-gray-600 italic mb-4">Mostrando resultados cercanos...</p>
        `;
        mensajesContainer.appendChild(bloqueCercanos);

        cercanos.slice(0, 10).forEach((lugar) => {
          const card = crearCardLugar(lugar);
          contenedor.appendChild(card);
        });
      } else {
        const sinCercanos = document.createElement("p");
        sinCercanos.className = "text-gray-600 mt-4 italic";
        sinCercanos.textContent = `Tampoco se encontraron lugares de interés cercanos a ${municipioActivo || 'tu ubicación'}.`;
        mensajesContainer.appendChild(sinCercanos);
      }
    }
  } catch (error) {
    console.error("❌ Error mostrando lugares cercanos:", error.message);
  }

  const bannerFinal = await crearBannerElemento("banner-bottom");
  if (bannerFinal) contenedor.appendChild(bannerFinal);
  return;
}

    const fragment = document.createDocumentFragment();
    let cartasEnFila = 0;
    let totalFilas = 0;

    for (let i = 0; i < filtrados.length; i++) {
      const lugar = filtrados[i];
      const card = crearCardLugar(lugar);
      if (card instanceof HTMLElement) {
        fragment.appendChild(card);
        cartasEnFila += 1;

        const esUltimaCarta = i === filtrados.length - 1;
        const filaCompleta = cartasEnFila === 2 || esUltimaCarta;

        if (filaCompleta) {
          totalFilas += 1;
          cartasEnFila = 0;

          const debeInsertarIntermedio = totalFilas % 4 === 0 && !esUltimaCarta;
          if (debeInsertarIntermedio) {
            const bannerIntermedio = await crearBannerElemento('banner-inline');
            if (currentRender !== renderVersion) return;
            if (bannerIntermedio) fragment.appendChild(bannerIntermedio);
          }
        }
      }
    }

    const debeAgregarFinal = totalFilas === 0 || totalFilas % 4 !== 0;
    if (debeAgregarFinal) {
      const bannerFinal = await crearBannerElemento('banner-bottom');
      if (currentRender !== renderVersion) return;
      if (bannerFinal) fragment.appendChild(bannerFinal);
    }

    contenedor.appendChild(fragment);
  } catch (error) {
    console.error('❌ Error al renderizar lugares:', error);
    mostrarError(contenedor, 'No pudimos mostrar los lugares.', '⚠️');
  }
}

async function llenarSelects() {
  const municipiosUnicos = [...new Set(lugares.map(l => l.municipio).filter(Boolean))].sort();
  municipiosUnicos.forEach(muni => {
    const opt = document.createElement('option');
    opt.value = muni;
    opt.textContent = muni;
    selectMunicipio.appendChild(opt);
  });

  const todasCategorias = lugares.flatMap(l => l.categorias || []);
  const categoriasUnicas = [...new Set(todasCategorias)].sort();
  categoriasUnicas.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selectCategoria.appendChild(opt);
  });
}

inputBuscar.addEventListener('input', renderizarLugares);
selectCategoria.addEventListener('change', renderizarLugares);
selectMunicipio.addEventListener('change', renderizarLugares);
[btnAbierto, btnFavoritos, btnGratis].forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('bg-blue-500');
    btn.classList.toggle('text-white');
    renderizarLugares();
  });
});

async function inicializarLugares({ lat, lon } = {}) {
  if (contenedor) {
    mostrarCargando(contenedor, 'Cargando lugares...', '📍');
  }

  try {
    if (typeof lat === 'number' && typeof lon === 'number') {
      latUsuario = lat;
      lonUsuario = lon;
    }

    await Promise.all([
      cargarMunicipios(),
      cargarLugares()
    ]);
  } catch (error) {
    console.error('❌ Error inicializando lugares:', error);
    if (contenedor) {
      mostrarError(contenedor, 'No pudimos cargar los lugares.', '⚠️');
    }
  }
}

if ('geolocation' in navigator) {
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      await inicializarLugares({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude
      });
    },
    async () => {
      console.warn('❗ Usuario no permitió ubicación.');
      await inicializarLugares();
    }
  );
} else {
  inicializarLugares();
}

async function cargarMunicipios() {
  const { data: municipios, error } = await supabase
    .from('Municipios')
    .select('nombre');

  if (error) {
    console.error('❌ Error cargando municipios:', error);
    return;
  }

  // Limpiar opciones existentes
  selectMunicipio.innerHTML = '<option value="">Todos</option>';

  // Añadir cada municipio
  municipios.forEach(m => {
    const option = document.createElement('option');
    option.value = m.nombre;
    option.textContent = m.nombre;
    selectMunicipio.appendChild(option);
  });
}
