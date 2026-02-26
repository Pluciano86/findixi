// listadoPlayas.js
import { obtenerClima } from "./obtenerClima.js";
import { supabase } from '../shared/supabaseClient.js';
import { calcularTiemposParaLugares, calcularDistancia } from './distanciaLugar.js';
import { mostrarMensajeVacio, mostrarError, mostrarCargando } from './mensajesUI.js';
import { createGlobalBannerElement, destroyCarousel } from './bannerCarousel.js';
import { t } from './i18n.js';

const inputBuscar = document.getElementById("inputBuscar");
const selectCosta = document.getElementById("selectCosta");
const selectMunicipio = document.getElementById("selectMunicipio");
const contenedor = document.getElementById("contenedorPlayas");
const template = document.getElementById("templateCard");

const checkNadar = document.getElementById("filtro-nadar");
const checkSurfear = document.getElementById("filtro-surfear");
const checkSnorkel = document.getElementById("filtro-snorkel");

let todasLasPlayas = [];
let usuarioLat = null;
let usuarioLon = null;
let renderID = 0;
const PAGE_SIZE = 20;
let visibleCount = PAGE_SIZE;
let verMasContainer = null;
const PLAYA_PLACEHOLDER =
  'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/imgPlayaNoDisponible.jpg';

const claseBaseContenedor = contenedor?.className || '';
function restaurarContenedor() {
  if (contenedor) {
    contenedor.className = claseBaseContenedor;
  }
}

function resetVisibleCount() {
  visibleCount = PAGE_SIZE;
}

function renderVerMasButton(debeMostrar) {
  if (!contenedor) return;
  if (!verMasContainer) {
    verMasContainer = document.createElement('div');
    verMasContainer.id = 'verMasResultados';
    verMasContainer.className = 'w-full flex justify-center my-6';
    contenedor.parentNode?.appendChild(verMasContainer);
  }
  verMasContainer.innerHTML = '';
  if (!debeMostrar) {
    verMasContainer.classList.add('hidden');
    return;
  }
  verMasContainer.classList.remove('hidden');
  const boton = document.createElement('button');
  boton.className =
    'px-4 py-2 rounded-full bg-[#023047] text-white text-sm font-semibold shadow hover:bg-[#023047] transition';
  boton.textContent = t('playas.verSiguientes');
  boton.addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    renderizarPlayas();
  });
  verMasContainer.appendChild(boton);
}

function ensureNoImageOverlay(wrapper, mostrar) {
  if (!wrapper) return;
  let overlay = wrapper.querySelector('.playa-no-image-overlay');
  if (!mostrar) {
    overlay?.remove();
    return;
  }
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className =
      'playa-no-image-overlay absolute inset-0 flex flex-col items-center justify-center text-center text-white font-semibold text-sm leading-tight';
    overlay.innerHTML = `
      <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.85);">${t('playa.noImageTitle')}</span>
      <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.85);">${t('playa.noImageSubtitle')}</span>
    `;
    wrapper.appendChild(overlay);
  } else {
    const spans = overlay.querySelectorAll('span');
    if (spans[0]) spans[0].textContent = t('playa.noImageTitle');
    if (spans[1]) spans[1].textContent = t('playa.noImageSubtitle');
  }
}

const cleanupCarousels = (container) => {
  if (!container) return;
  container
    .querySelectorAll(`[data-banner-carousel="true"]`)
    .forEach(destroyCarousel);
};

async function renderTopBannerPlayas() {
  const seccionFiltros = document.querySelector('section.p-4');
  if (!seccionFiltros) return;

  let topContainer = document.querySelector('[data-banner-slot="top-playas"]');
  if (!topContainer) {
    topContainer = document.createElement('div');
    topContainer.dataset.bannerSlot = 'top-playas';
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

async function inicializarPlayas({ lat, lon } = {}) {
  if (contenedor) {
    mostrarCargando(contenedor, 'Cargando playas...', '🏖️');
  }

  try {
    if (typeof lat === 'number' && typeof lon === 'number') {
      usuarioLat = lat;
      usuarioLon = lon;
    }

    await cargarPlayas();
    await renderizarPlayas();
  } catch (error) {
    console.error("❌ Error cargando playas:", error);
    if (contenedor) {
      mostrarError(contenedor, 'No pudimos cargar las playas.', '⚠️');
    }
  }
}

if ('geolocation' in navigator) {
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      await inicializarPlayas({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude
      });
    },
    async () => {
      await inicializarPlayas();
    }
  );
} else {
  inicializarPlayas();
}

async function cargarPlayas() {
  const { data: { user } } = await supabase.auth.getUser();
  console.log('User:', user?.id);

  let favoritosSet = new Set();
  if (user) {
    const { data: favoritosData, error: favoritosError } = await supabase
      .from('favoritosPlayas')
      .select('idplaya')
      .eq('idusuario', user.id);

    if (favoritosError) {
      console.error('❌ Error cargando favoritosPlayas:', favoritosError);
    } else {
      favoritosSet = new Set((favoritosData || []).map((fav) => fav.idplaya));
      console.log('IDs favoritos (playas):', Array.from(favoritosSet));
    }
  } else {
    console.log('Usuario no autenticado; marcando favoritos de playas en false.');
  }

  const { data, error } = await supabase.from("playas").select("*");
  if (error) throw error;
  todasLasPlayas = (data || []).map((playa) => ({
    ...playa,
    favorito: user ? favoritosSet.has(playa.id) : false,
  }));
  console.log(
    'Primeros items con favorito (playas):',
    todasLasPlayas.slice(0, 5).map((p) => ({ id: p.id, favorito: p.favorito }))
  );

  const { data: imagenes, error: errorImg } = await supabase
    .from("imagenesPlayas")
    .select("imagen, idPlaya, portada")
    .eq("portada", true);

  if (errorImg) {
    console.error("❌ Error cargando portadas de playas:", errorImg);
  } else {
    todasLasPlayas.forEach(playa => {
      const img = imagenes?.find(i => i.idPlaya === playa.id);
      playa.portada = img?.imagen || null;
    });
  }

  cargarFiltros();
}

async function calcularTiemposParaListado(playas) {
  if (!Array.isArray(playas) || playas.length === 0) return playas;
  if (typeof usuarioLat !== 'number' || typeof usuarioLon !== 'number') return playas;

  const conCoords = playas.filter((p) =>
    !p?.bote &&
    Number.isFinite(Number(p.latitud)) &&
    Number.isFinite(Number(p.longitud))
  );

  if (conCoords.length === 0) return playas;

  await calcularTiemposParaLugares(conCoords, {
    lat: usuarioLat,
    lon: usuarioLon
  });

  return playas;
}

function renderizarTiempoEnTarjeta(playa) {
  if (!playa?.id) return;
  const card = contenedor?.querySelector(`[data-playa-id="${playa.id}"]`);
  if (!card) return;

  const iconTransporte = card.querySelector(".icon-transporte");
  if (!iconTransporte) return;

  if (playa.bote) {
    iconTransporte.innerHTML = `
      <div class="flex justify-center items-center gap-1 text-sm text-[#9c9c9c] mt-1 leading-tight">
        <span><i class="fas fa-ship text-[#9c9c9c]"></i></span>
              <span class="text-center leading-snug">${t('playas.accesoBote')}</span>
      </div>`;
    return;
  }

  const tiempoTexto = playa.tiempoVehiculo || 'N/D';
  iconTransporte.innerHTML = `
    <div class="flex justify-center items-center gap-1 text-sm text-[#9c9c9c] mt-1 leading-tight">
      <span><i class="fas fa-car text-[#9c9c9c]"></i></span>
      <span class="text-center leading-snug">${tiempoTexto}</span>
    </div>`;
}

inputBuscar.addEventListener("input", () => {
  resetVisibleCount();
  renderizarPlayas();
});
selectCosta.addEventListener("change", () => {
  resetVisibleCount();
  renderizarPlayas();
  cargarMunicipios();
});
selectMunicipio.addEventListener("change", () => {
  resetVisibleCount();
  renderizarPlayas();
});
[checkNadar, checkSurfear, checkSnorkel].forEach(el =>
  el.addEventListener("change", () => {
    resetVisibleCount();
    renderizarPlayas();
  })
);


async function renderizarPlayas() {
  const currentID = ++renderID;
  try {
    await renderTopBannerPlayas();
    if (currentID !== renderID) return;

    restaurarContenedor();
    cleanupCarousels(contenedor);
    contenedor.innerHTML = "";

    const texto = inputBuscar.value.toLowerCase();
    const costa = selectCosta.value;
    const municipio = selectMunicipio.value;
    const filtrarNadar = checkNadar.checked;
    const filtrarSurfear = checkSurfear.checked;
    const filtrarSnorkel = checkSnorkel.checked;


    let filtradas = todasLasPlayas.filter((p) => {
      const coincideNombre = p.nombre.toLowerCase().includes(texto);
      const costaNormalizada = (costa || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
      const playaCostaNormalizada = (p.costa || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
      const coincideCosta = !costaNormalizada || playaCostaNormalizada === costaNormalizada;
      const coincideMunicipio = municipio ? p.municipio === municipio : true;
      const pasaFiltroNadar = !filtrarNadar || Boolean(p.nadar);
      const pasaFiltroSurfear = !filtrarSurfear || Boolean(p.surfear);
      const pasaFiltroSnorkel = !filtrarSnorkel || Boolean(p.snorkel);
      return (
        coincideNombre &&
        coincideCosta &&
        coincideMunicipio &&
        pasaFiltroNadar &&
        pasaFiltroSurfear &&
        pasaFiltroSnorkel
      );
    });

    const totalFiltradas = filtradas.length;
    if (totalFiltradas === 0) {
      const filtrosActivos = [];
      if (texto) filtrosActivos.push(t('playas.filtroNombre', { valor: texto }));
      if (costa) filtrosActivos.push(t('playas.filtroCosta', { valor: traducirCosta(costa) }));
      if (municipio) filtrosActivos.push(t('playas.filtroMunicipio', { valor: municipio }));
      if (filtrarNadar) filtrosActivos.push(t('playas.filtroNadar'));
      if (filtrarSurfear) filtrosActivos.push(t('playas.filtroSurfear'));
      if (filtrarSnorkel) filtrosActivos.push(t('playas.filtroSnorkel'));

      const mensaje =
        filtrosActivos.length > 0
          ? t('playas.sinResultadosConFiltros', { filtros: filtrosActivos.join(", ") })
          : t('playas.sinResultados');

      mostrarMensajeVacio(contenedor, mensaje, '🏖️');
      renderVerMasButton(false);
      return;
    }

    if (typeof usuarioLat === "number" && typeof usuarioLon === "number") {
      const conCoords = filtradas
        .filter((p) => Number.isFinite(Number(p.latitud)) && Number.isFinite(Number(p.longitud)))
        .map((p) => {
          const distanciaCampo = Number(p.distanciaLugar);
          const d = Number.isFinite(distanciaCampo)
            ? distanciaCampo
            : calcularDistancia(usuarioLat, usuarioLon, p.latitud, p.longitud);
          return { ...p, _distancia: d };
        })
        .sort((a, b) => a._distancia - b._distancia);

      const sinCoords = filtradas.filter(
        (p) => !Number.isFinite(Number(p.latitud)) || !Number.isFinite(Number(p.longitud))
      );

      filtradas = conCoords.slice(0, visibleCount);
      if (filtradas.length < visibleCount) {
        filtradas = filtradas.concat(sinCoords.slice(0, visibleCount - filtradas.length));
      }
    } else {
      filtradas = filtradas.slice(0, visibleCount);
    }

    const cards = [];

    for (const playa of filtradas) {
      if (currentID !== renderID) return;

      const clone = template.content.cloneNode(true);

     // === Imagen de la playa (desde la columna 'imagen') ===
const imagenEl = clone.querySelector(".imagen");
if (imagenEl) {
  const originalParent = imagenEl.parentElement;
  const wrapper = document.createElement('div');
  wrapper.className = 'relative w-full h-40 overflow-hidden';
  if (originalParent) {
    originalParent.replaceChild(wrapper, imagenEl);
    wrapper.appendChild(imagenEl);
  }
  if (playa.favorito) {
    const favWrapper = document.createElement('div');
    favWrapper.className = 'absolute top-2 right-2 z-50';
    favWrapper.innerHTML = `
      <div class="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
        <div class="w-6 h-6 rounded-full border-2 border-red-600 flex items-center justify-center">
          <i class="fas fa-heart text-red-600 text-xs"></i>
        </div>
      </div>
    `;
    wrapper.appendChild(favWrapper);
  }
  const tieneImagen = Boolean(playa.imagen && playa.imagen.trim() !== "");
  imagenEl.src = tieneImagen ? playa.imagen.trim() : PLAYA_PLACEHOLDER;

  imagenEl.alt = `Imagen de ${playa.nombre}`;
  imagenEl.loading = "lazy";
  ensureNoImageOverlay(wrapper, !tieneImagen);

  // Si la imagen falla al cargar → usar placeholder
  imagenEl.onerror = () => {
    imagenEl.src = PLAYA_PLACEHOLDER;
    ensureNoImageOverlay(wrapper, true);
  };
}

      // CLICK en la tarjeta (root del template)
      const root = clone.firstElementChild; // es el <div class="text-center bg-white ...">
      if (root) {
        root.classList.add("cursor-pointer", "hover:scale-[1.02]", "transition");
        root.dataset.playaId = String(playa.id);
        root.addEventListener("click", () => {
          window.location.href = `perfilPlaya.html?id=${playa.id}`;
        });
      }

      // Nombre / Municipio (sin ?. a la izquierda)
      const nombreEl = clone.querySelector(".nombre");
      if (nombreEl) nombreEl.textContent = playa.nombre;

      const municipioEl = clone.querySelector(".municipio");
      if (municipioEl) municipioEl.textContent = playa.municipio || "";

      const aptaParaEl = clone.querySelector('[data-i18n="playas.aptaPara"]');
      if (aptaParaEl) aptaParaEl.textContent = t('playas.aptaPara');
      const labelNadar = clone.querySelector('[data-i18n="playas.nadar"]');
      if (labelNadar) labelNadar.textContent = t('playas.nadar');
      const labelSurf = clone.querySelector('[data-i18n="playas.surfear"]');
      if (labelSurf) labelSurf.textContent = t('playas.surfear');
      const labelSnork = clone.querySelector('[data-i18n="playas.snorkel"]');
      if (labelSnork) labelSnork.textContent = t('playas.snorkel');

      // Aptitudes
      const snorkelFlagCard = (playa.snorkeling ?? playa.snorkel) === true;
      const iconNadar = clone.querySelector(".icon-nadar");
      const iconSurf = clone.querySelector(".icon-surfear");
      const iconSnork = clone.querySelector(".icon-snorkel");
      if (playa.nadar && iconNadar) iconNadar.classList.remove("hidden");
      if (playa.surfear && iconSurf) iconSurf.classList.remove("hidden");
      if (snorkelFlagCard && iconSnork) iconSnork.classList.remove("hidden");

      // Transporte / tiempo
      const iconTransporte = clone.querySelector(".icon-transporte");
      if (iconTransporte) {
        if (playa.bote) {
          iconTransporte.innerHTML = `
            <div class="flex justify-center items-center gap-1 text-sm text-[#9c9c9c] mt-1 leading-tight">
              <span><i class="fas fa-ship text-[#9c9c9c]"></i></span>
              <span class="text-center leading-snug">${t('playas.accesoBote')}</span>
            </div>`;
        } else {
          const puedeCalcular = typeof usuarioLat === "number"
            && typeof usuarioLon === "number"
            && Number.isFinite(Number(playa.latitud))
            && Number.isFinite(Number(playa.longitud));
          const textoTiempo = playa.tiempoVehiculo || (puedeCalcular ? t('playas.calculando') : "");
          iconTransporte.innerHTML = `
            <div class="flex justify-center items-center gap-1 text-sm text-[#9c9c9c] mt-1 leading-tight">
              <span><i class="fas fa-car text-[#9c9c9c]"></i></span>
              <span class="text-center leading-snug">${textoTiempo}</span>
            </div>`;
        }
      }

      // Clima
      const estadoClima = clone.querySelector(".estado-clima");
      const iconClima = clone.querySelector(".icon-clima");
      const viento = clone.querySelector(".viento");

      obtenerClima(playa.latitud, playa.longitud).then((clima) => {
        if (renderID !== currentID) return;
        if (!clima) return;

        if (estadoClima) estadoClima.textContent = clima.estado;
        if (iconClima) {
          const img = document.createElement("img");
          img.src = clima.iconoURL;
          img.alt = clima.estado;
          img.className = "w-6 h-6 inline mr-1";
          iconClima.innerHTML = "";
          iconClima.appendChild(img);
        }
        if (viento)
          viento.innerHTML = `<i class="fas fa-wind text-gray-400"></i> ${t('playas.vientoDe', { valor: clima.viento })}`;
      });

      cards.push(clone);
    }

    const fragment = document.createDocumentFragment();
    let cartasEnFila = 0;
    let totalFilas = 0;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      fragment.appendChild(card);
      cartasEnFila += 1;

      const esUltimaCarta = i === cards.length - 1;
      const filaCompleta = cartasEnFila === 2 || esUltimaCarta;

      if (filaCompleta) {
        totalFilas += 1;
        cartasEnFila = 0;

        const debeInsertarIntermedio = totalFilas % 4 === 0 && !esUltimaCarta;
        if (debeInsertarIntermedio) {
          const bannerIntermedio = await crearBannerElemento("banner-inline");
          if (currentID !== renderID) return;
          if (bannerIntermedio) fragment.appendChild(bannerIntermedio);
        }
      }
    }

    const debeAgregarFinal = totalFilas === 0 || totalFilas % 4 !== 0;
    if (debeAgregarFinal) {
      const bannerFinal = await crearBannerElemento("banner-bottom");
      if (currentID !== renderID) return;
      if (bannerFinal) fragment.appendChild(bannerFinal);
    }

    contenedor.appendChild(fragment);

    renderVerMasButton(totalFiltradas > visibleCount);

    if (typeof usuarioLat === "number" && typeof usuarioLon === "number") {
      const currentRenderId = renderID;
      calcularTiemposParaListado(filtradas).then((actualizadas) => {
        if (renderID !== currentRenderId) return;
        (actualizadas || []).forEach(renderizarTiempoEnTarjeta);
      });
    }
  } catch (error) {
    console.error("Error al renderizar playas:", error);
    mostrarError(contenedor, t('playas.errorCargar'), '⚠️');
  }
}

async function cargarFiltros() {
  const costasUnicas = [...new Set(todasLasPlayas.map(p => p.costa).filter(Boolean))].sort();
  selectCosta.innerHTML = `<option value="">${t('playas.todasCostas')}</option>`;
  costasUnicas.forEach(c => {
    const option = document.createElement("option");
    option.value = c;
    option.textContent = traducirCosta(c);
    selectCosta.appendChild(option);
  });

  cargarMunicipios();
}

function traducirCosta(costa) {
  const normalized = String(costa || '').trim().toLowerCase();
  const map = {
    'sur': t('playas.costaSur'),
    'este': t('playas.costaEste'),
    'metro': t('playas.costaMetro'),
    'norte': t('playas.costaNorte'),
    'oeste': t('playas.costaOeste'),
    'islas municipio': t('playas.costaIslas'),
    'islas': t('playas.costaIslas')
  };
  return map[normalized] || costa;
}

function cargarMunicipios() {
  const costaSeleccionada = selectCosta.value;
  const municipiosUnicos = [...new Set(
    todasLasPlayas
      .filter(p => !costaSeleccionada || p.costa?.trim().toLowerCase() === costaSeleccionada.trim().toLowerCase())
      .map(p => p.municipio)
  )].sort();

  selectMunicipio.innerHTML = `<option value="">${t('playas.todosMunicipios')}</option>`;
  municipiosUnicos.forEach(m => {
    const option = document.createElement("option");
    option.value = m;
    option.textContent = m;
    selectMunicipio.appendChild(option);
  });
}

window.addEventListener('lang:changed', () => {
  selectCosta.querySelectorAll('option').forEach((opt) => {
    if (opt.value) opt.textContent = traducirCosta(opt.value);
  });
  const todosCostas = selectCosta.querySelector('option[value=""]');
  if (todosCostas) todosCostas.textContent = t('playas.todasCostas');
  const todosMunicipios = selectMunicipio.querySelector('option[value=""]');
  if (todosMunicipios) todosMunicipios.textContent = t('playas.todosMunicipios');
  const verMasBtn = document.querySelector('#verMasResultados button');
  if (verMasBtn) verMasBtn.textContent = t('playas.verSiguientes');
  document.querySelectorAll('.playa-no-image-overlay').forEach((overlay) => {
    const spans = overlay.querySelectorAll('span');
    if (spans[0]) spans[0].textContent = t('playa.noImageTitle');
    if (spans[1]) spans[1].textContent = t('playa.noImageSubtitle');
  });
});
