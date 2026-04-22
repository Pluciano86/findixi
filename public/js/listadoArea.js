import { supabase } from '../shared/supabaseClient.js';
import { cardLugarSlide } from './cardLugarSlide.js';
import { cardPlayaSlide } from './cardPlayaSlide.js';
import { cardEventoSlide } from './cardEventoSlide.js';
import { renderEventosCarousel } from "./eventosCarousel.js";
import { renderJangueoCarouselArea } from "./jangueoCarouselArea.js";
import { t } from "./i18n.js";

let municipioSeleccionado = null;
let nombreAreaActual = '';
let idAreaGlobal = null;

async function mostrarNombreArea(idArea, idMunicipio = null) {
  const { data: area } = await supabase.from('Area').select('nombre').eq('idArea', idArea).single();
  if (!area) return;
  nombreAreaActual = area.nombre;

  const h1 = document.querySelector('header h1');
  if (idMunicipio) {
    const { data: muni } = await supabase.from('Municipios').select('nombre, imagen').eq('id', idMunicipio).single();
    if (muni) {
      h1.innerHTML = `<img src="${muni.imagen}" class="w-28 h-16 object-cover rounded-lg inline-block mr-3 align-middle shadow"/>${t('area.descubreMunicipio')} ${muni.nombre}`;
    }
  } else {
    h1.textContent = `${t('area.descubreArea')} ${area.nombre}`;
  }
}

async function cargarDropdownMunicipios(idArea, idMunicipioSeleccionado) {
  const dropdown = document.getElementById('dropdownMunicipios');
  dropdown.innerHTML = "";
  dropdown.onchange = null;

  const loadingOpt = document.createElement('option');
  loadingOpt.value = "";
  loadingOpt.dataset.i18n = "area.cargandoMunicipios";
  loadingOpt.textContent = t('area.cargandoMunicipios');
  dropdown.appendChild(loadingOpt);

  const { data: municipios } = await supabase
    .from('Municipios')
    .select('id, nombre')
    .eq('idArea', idArea)
    .order('nombre');

  dropdown.innerHTML = "";
  const defaultOpt = document.createElement('option');
  defaultOpt.value = "";
  defaultOpt.dataset.i18n = "area.selectMunicipio";
  defaultOpt.textContent = t('area.selectMunicipio');
  dropdown.appendChild(defaultOpt);
  municipios.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.nombre;
    if (parseInt(m.id) === parseInt(idMunicipioSeleccionado)) opt.selected = true;
    dropdown.appendChild(opt);
  });

  const volverContainer = document.getElementById('volverAreaContainer');
  if (idMunicipioSeleccionado) {
    volverContainer.innerHTML = `<button id="btnVolverArea" class="text-[#3ea6c4] font-medium underline text-lg hover:text-blue-700">${t('area.volverArea')} ${nombreAreaActual}</button>`;
    document.getElementById('btnVolverArea').onclick = () => window.location.href = `listadoArea.html?idArea=${idArea}`;
    dropdown.parentElement.classList.add('hidden');
  } else {
    volverContainer.innerHTML = '';
    dropdown.parentElement.classList.remove('hidden');
  }

  // 🔹 Nuevo comportamiento dinámico sin recargar
  dropdown.onchange = async (e) => {
    const idMunicipio = e.target.value ? parseInt(e.target.value) : null;

    // 🔸 Actualizar filtros globales
    window.filtrosArea = { idArea, idMunicipio, layout: "index" };

    // 🔸 Actualizar el nombre del header
    await mostrarNombreArea(idArea, idMunicipio);

    // 🔸 Recargar carruseles
    await renderJangueoCarouselArea("jangueoCarousel");
    await renderEventosCarousel("eventosCarousel", { idArea, idMunicipio, layout: "index" });

    // 🔸 🔥 Notificar al módulo de lugares para que actualice las tarjetas
    window.dispatchEvent(new CustomEvent("areaCargada", {
      detail: { idArea, idMunicipio, ocultarDistancia: true },
    }));
  }; // 👈 cierre correcto
}

export async function obtenerParametros() {
  const params = new URLSearchParams(window.location.search);
  return {
    idArea: parseInt(params.get('idArea')),
    idMunicipio: parseInt(params.get('idMunicipio')),
  };
}

async function cargarTodo() {
  const { idArea, idMunicipio } = await obtenerParametros();
  idAreaGlobal = idArea;
  municipioSeleccionado = isNaN(idMunicipio) ? null : idMunicipio;

  window.filtrosArea = { idArea, idMunicipio, layout: "index" };

  await mostrarNombreArea(idArea, municipioSeleccionado);
  await cargarDropdownMunicipios(idArea, municipioSeleccionado);
  await renderEventosCarousel("eventosCarousel", { idArea, idMunicipio, layout: "index" });
  await renderJangueoCarouselArea("jangueoCarousel");

  // 🔹 Disparar evento inicial al cargar la página
  window.dispatchEvent(new CustomEvent('areaCargada', {
    detail: { idArea, idMunicipio, ocultarDistancia: true },
  }));
}

cargarTodo();

// 🔁 Re-traducir dinámicamente al cambiar idioma
window.addEventListener('lang:changed', () => {
  cargarDropdownMunicipios(idAreaGlobal, municipioSeleccionado);
  mostrarNombreArea(idAreaGlobal, municipioSeleccionado);
  renderEventosCarousel("eventosCarousel", { ...(window.filtrosArea || {}), layout: "index" });
  renderJangueoCarouselArea("jangueoCarousel");
  window.dispatchEvent(new CustomEvent('areaCargada', {
    detail: { ...(window.filtrosArea || {}), ocultarDistancia: true },
  }));
});
