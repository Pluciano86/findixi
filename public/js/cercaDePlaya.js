// public/js/cercaDePlaya.js
import { supabase } from '../shared/supabaseClient.js';
import { cardComercio } from './CardComercio.js';
import { cardComercioNoActivo } from './CardComercioNoActivo.js';
import { cardPlayaSlide } from './cardPlayaSlide.js';
import { calcularDistancia } from './distanciaLugar.js';
import { calcularTiempoEnVehiculo } from '../shared/utils.js';
import { fetchCercanosParaCoordenadas } from './buscarComerciosListado.js';

const renderCardComercio = (item) =>
  item.activo === true ? cardComercio(item) : cardComercioNoActivo(item);

export async function mostrarCercanosPlaya(PLAYA_ID) {
  // 🔹 1. Obtener la playa base
  const { data: playa, error: errPlaya } = await supabase
    .from('playas')
    .select('id, nombre, latitud, longitud, municipio')
    .eq('id', PLAYA_ID)
    .maybeSingle();

  if (errPlaya || !playa) {
    console.error('❌ No se encontró la playa:', errPlaya);
    return;
  }

  const origen = { lat: playa.latitud, lon: playa.longitud };
  if (!origen.lat || !origen.lon) {
    console.warn('⚠️ Playa sin coordenadas válidas.');
    return;
  }

  // 🟢 2. Comercios Cercanos
  let comerciosCercanos = [];
  try {
    comerciosCercanos = await fetchCercanosParaCoordenadas({
      latitud: origen.lat,
      longitud: origen.lon,
      radioKm: 15,
      categoriaOpcional: null,
      abiertoAhora: null,
    });
  } catch (error) {
    console.error('❌ Error cargando comercios cercanos a la playa:', error);
  }

  const comidaCercana = comerciosCercanos
    .filter((c) => c.minutosCrudos == null || c.minutosCrudos <= 15);
  renderizarSlider('cercanosComidaContainer', 'sliderCercanosComida', comidaCercana, renderCardComercio);

  // 🟢 3. Playas Cercanas
  const { data: playas } = await supabase
    .from('playas')
    .select('id, nombre, municipio, imagen, latitud, longitud')
    .neq('id', PLAYA_ID);

  const playasCercanas = await procesarCercanos(origen, playas, 20);
  renderizarSlider('cercanosPlayasContainer', 'sliderPlayasCercanas', playasCercanas, cardPlayaSlide);

  // 🟢 4. Lugares de Interés Cercanos (categoría 15)
  const lugaresCercanos = comerciosCercanos
    .filter((c) => Array.isArray(c.categoriaIds) && c.categoriaIds.includes(15))
    .filter((c) => c.minutosCrudos == null || c.minutosCrudos <= 20);
  renderizarSlider('cercanosLugaresContainer', 'sliderCercanosLugares', lugaresCercanos, renderCardComercio);
}

// 🧮 Función para calcular distancias y tiempos
async function procesarCercanos(origen, lista, limiteMinutos = 15) {
  const listaConCoords = lista.filter(
    (l) => typeof l.latitud === 'number' && typeof l.longitud === 'number'
  );

  const resultados = await Promise.all(
    listaConCoords.map(async (item) => {
      const distanciaKm = calcularDistancia(origen.lat, origen.lon, item.latitud, item.longitud);
      const { minutos } = calcularTiempoEnVehiculo(distanciaKm);

      if (minutos <= limiteMinutos) {
        return {
          ...item,
          tiempoTexto: `${minutos} min`,
          distanciaTexto: `${distanciaKm.toFixed(1)} km`,
        };
      }
      return null;
    })
  );

  return resultados.filter(Boolean);
}

// 🧱 Renderizar Slider
function renderizarSlider(containerId, sliderId, lista, cardFn) {
  const container = document.getElementById(containerId);
  const slider = document.querySelector(`#${sliderId} .swiper-wrapper`);

  if (!container || !slider) return;

  if (!lista?.length) {
    container.classList.add('hidden');
    return;
  }

  slider.innerHTML = '';
  lista.forEach((item) => slider.appendChild(cardFn(item)));
  container.classList.remove('hidden');
}
