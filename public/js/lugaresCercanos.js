// public/js/lugaresCercanos.js
import { cardLugarSlide } from './cardLugarSlide.js';
import { supabase } from '../shared/supabaseClient.js';
import { getDrivingDistance, formatTiempo } from '../shared/osrmClient.js';
import { calcularTiempoEnVehiculo } from '../shared/utils.js';
import { calcularDistancia } from './distanciaLugar.js';

let ultimoCercanos = null;

function renderizarLugaresCercanos(cercanos, comercioOrigen) {
  const container = document.getElementById('cercanosLugaresContainer');
  const slider = document.getElementById('sliderCercanosLugares');
  const nombreSpan = document.getElementById('nombreCercanosLugares');

  if (!container || !slider) {
    console.warn('⚠️ No se encontraron los contenedores para lugares cercanos.');
    return;
  }

  if (nombreSpan && comercioOrigen?.nombre) nombreSpan.textContent = comercioOrigen.nombre;

  const traducidos = cercanos.map((l) => ({
    ...l,
    tiempoTexto: l.minutosCrudos != null ? formatTiempo(l.minutosCrudos * 60) : l.tiempoTexto,
    tiempoVehiculo: l.minutosCrudos != null ? formatTiempo(l.minutosCrudos * 60) : l.tiempoVehiculo,
  }));

  if (traducidos.length > 0) {
    slider.innerHTML = `
      <div class="swiper lugaresSwiper w-full overflow-hidden px-1">
        <div class="swiper-wrapper"></div>
      </div>
    `;

    const wrapper = slider.querySelector('.swiper-wrapper');

    traducidos.forEach(l => {
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
      slide.appendChild(cardLugarSlide(l));
      wrapper.appendChild(slide);
    });

    container.classList.remove('hidden');

    const swiperEl = slider.querySelector('.lugaresSwiper');
    const numSlides = swiperEl.querySelectorAll('.swiper-slide').length;

    if (swiperEl.__swiper) swiperEl.__swiper.destroy(true, true);

    const swiper = new Swiper(swiperEl, {
      centeredSlides: false,
      slidesPerView: 1.25,
      spaceBetween: 1,
      loop: true,
      speed: 900,
      grabCursor: true,
      autoplay: {
        delay: 3200,
        disableOnInteraction: false,
      },
    });
    swiperEl.__swiper = swiper;
  } else {
    container.classList.add('hidden');
  }
}

export async function mostrarLugaresCercanos(comercioOrigen) {
  const origenCoords = {
    lat: comercioOrigen.latitud,
    lon: comercioOrigen.longitud
  };

  if (!origenCoords.lat || !origenCoords.lon) {
    console.warn('⚠️ Comercio origen sin coordenadas válidas.');
    return;
  }

  try {
    // 🔹 Obtener lugares activos con coordenadas válidas
    const { data: lugares, error } = await supabase
      .from('LugaresTuristicos')
      .select('*')
      .eq('activo', true);

    if (error) throw error;
    if (!lugares?.length) return;

    const lugaresConCoords = lugares.filter(l =>
      typeof l.latitud === 'number' &&
      typeof l.longitud === 'number' &&
      !isNaN(l.latitud) &&
      !isNaN(l.longitud)
    );

    // 🔹 Obtener portadas
    const { data: imagenes, error: errorImg } = await supabase
      .from('imagenesLugares')
      .select('imagen, idLugar')
      .eq('portada', true);

    if (errorImg) throw errorImg;

    const lugaresConImagen = lugaresConCoords.map(l => {
      const portada = imagenes?.find(img => img.idLugar === l.id);
      return {
        ...l,
        imagen: portada?.imagen || null
      };
    });

    // 🔹 Calcular distancia y tiempo
    const lugaresConTiempos = await Promise.all(
      lugaresConImagen.map(async (lugar) => {
        const resultado = await getDrivingDistance(
          { lat: origenCoords.lat, lng: origenCoords.lon },
          { lat: lugar.latitud, lng: lugar.longitud }
        );

        let minutos = null;
        let texto = null;
        let distanciaKm = typeof resultado?.distancia === 'number'
          ? resultado.distancia / 1000
          : null;

        if (resultado?.duracion != null) {
          minutos = Math.round(resultado.duracion / 60);
          texto = formatTiempo(resultado.duracion);
        }

        if (texto == null) {
          const distanciaFallback = distanciaKm ?? calcularDistancia(
            origenCoords.lat,
            origenCoords.lon,
            lugar.latitud,
            lugar.longitud
          );

          if (Number.isFinite(distanciaFallback) && distanciaFallback > 0) {
            distanciaKm = distanciaFallback;
            const fallbackTiempo = calcularTiempoEnVehiculo(distanciaFallback);
            minutos = fallbackTiempo.minutos;
            texto = formatTiempo(fallbackTiempo.minutos * 60);
          } else {
            texto = 'N/D';
          }
        }

        return {
          ...lugar,
          minutosCrudos: minutos,
          tiempoVehiculo: texto,
          tiempoTexto: texto,
          distanciaKm,
          distanciaTexto: Number.isFinite(distanciaKm)
            ? `${distanciaKm.toFixed(1)} km`
            : null,
        };
      })
    );

    // 🔹 Filtrar lugares dentro de 20 min (ajustable)
    const cercanos = lugaresConTiempos
      .filter(l => l.minutosCrudos !== null && l.minutosCrudos <= 20)
      .sort((a, b) => a.minutosCrudos - b.minutosCrudos);

    ultimoCercanos = { cercanos, comercioOrigen };
    renderizarLugaresCercanos(cercanos, comercioOrigen);
  } catch (err) {
    console.error('❌ Error mostrando lugares cercanos:', err);
  }
}

window.addEventListener('lang:changed', () => {
  if (ultimoCercanos) {
    renderizarLugaresCercanos(ultimoCercanos.cercanos, ultimoCercanos.comercioOrigen);
  }
});
