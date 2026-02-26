import { supabase } from '../shared/supabaseClient.js';
import { cardPlayaSlide } from './cardPlayaSlide.js';
import { obtenerClima } from './obtenerClima.js';
import { getDrivingDistance, formatTiempo } from '../shared/osrmClient.js';
import { calcularTiempoEnVehiculo } from '../shared/utils.js';
import { calcularDistancia } from './distanciaLugar.js';
import { t } from './i18n.js';

let ultimoComercio = null;
let renderizando = false;

export async function mostrarPlayasCercanas(comercio) {
  if (renderizando) return;
  renderizando = true;
  ultimoComercio = comercio;
  const contenedor = document.getElementById('sliderPlayasCercanas');
  const seccion = document.getElementById('cercanosPlayasContainer');
  const nombreSpan = document.getElementById('nombreCercanosPlayas');

  if (!contenedor || !seccion) {
    renderizando = false;
    return;
  }

  // 🔹 Verificar si el municipio tiene costa
  const { data: municipioData } = await supabase
    .from('Municipios')
    .select('costa')
    .eq('nombre', comercio.municipio)
    .single();

  if (!municipioData?.costa) {
    renderizando = false;
    return;
  }

  // 🔹 Buscar playas con coordenadas válidas
  const { data: playas, error } = await supabase
    .from('playas')
    .select('*')
    .not('latitud', 'is', null)
    .not('longitud', 'is', null);

  if (error || !playas?.length) {
    renderizando = false;
    return;
  }

  // 🔹 Calcular tiempo y distancia
  const conTiempo = await Promise.all(
    playas.map(async (playa) => {
      const resultado = await getDrivingDistance(
        { lat: comercio.latitud, lng: comercio.longitud },
        { lat: playa.latitud, lng: playa.longitud }
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

      // Fallback si no hay datos del API
      if (texto == null) {
        const distanciaFallback = distanciaKm ?? calcularDistancia(
          comercio.latitud,
          comercio.longitud,
          playa.latitud,
          playa.longitud
        );

        if (Number.isFinite(distanciaFallback) && distanciaFallback > 0) {
          distanciaKm = distanciaFallback;
          const fallbackTiempo = calcularTiempoEnVehiculo(distanciaFallback);
          minutos = fallbackTiempo.minutos;
          texto = formatTiempo(fallbackTiempo.minutos * 60);
        } else {
          texto = t('area.noDisponible');
        }
      }

      return {
        ...playa,
        minutosCrudos: minutos,
        tiempoTexto: texto,
        distanciaKm,
        distanciaTexto: Number.isFinite(distanciaKm)
          ? `${distanciaKm.toFixed(1)} km`
          : null,
      };
    })
  );

  // 🔹 Filtrar playas cercanas (<=45 min)
  const filtradas = conTiempo
    .filter((p) => p.minutosCrudos !== null && p.minutosCrudos <= 45)
    .sort((a, b) => a.minutosCrudos - b.minutosCrudos);

  if (filtradas.length === 0) {
    renderizando = false;
    return;
  }

  if (nombreSpan) nombreSpan.textContent = comercio.nombre;
  seccion.classList.remove('hidden');

  // 🔹 Estructura Swiper
  contenedor.innerHTML = `
    <div class="swiper playasSwiper w-full overflow-hidden px-1">
      <div class="swiper-wrapper"></div>
    </div>
  `;

  const wrapper = contenedor.querySelector('.swiper-wrapper');

  for (const playa of filtradas) {
      const imagenURL =
      playa.imagen && playa.imagen.trim() !== ''
        ? playa.imagen.trim()
        : "https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/imgPlayaNoDisponible.jpg";

    const clima = await obtenerClima(playa.latitud, playa.longitud);

    const card = cardPlayaSlide({
      id: playa.id,
      nombre: playa.nombre,
      imagen: imagenURL,
      municipio: playa.municipio,
      clima: {
        estado: clima?.estado || t('playas.climaDesconocido'),
        iconoURL: clima?.iconoURL || ''
      },
      tiempoTexto: playa.tiempoTexto || t('area.noDisponible')
    });

    const slide = document.createElement('div');
    slide.className = 'swiper-slide';
    slide.appendChild(card);
    wrapper.appendChild(slide);
  }

// 🔹 Inicializar Swiper ajustado al ancho móvil
const swiperEl = contenedor.querySelector('.playasSwiper');

  new Swiper(swiperEl, {
    slidesPerView: 2.3,
    spaceBetween: 1,
    loop: true,
    autoplay: { delay: 3000, disableOnInteraction: false },
    speed: 900,
  });

  renderizando = false;
}

window.addEventListener('lang:changed', () => {
  if (ultimoComercio) mostrarPlayasCercanas(ultimoComercio);
});
