// public/js/especialesBanner.js
// Renderiza el banner de especiales con imagen a la izquierda y texto a la derecha.
import { t } from './i18n.js';

const URL_LUNCH = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/EspecialLunch.png';
const URL_HH = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/EspecialHH.png';

const ESPECIAL_HORA_INICIO = 120; // 2:00am
const ESPECIAL_HORA_FIN = 930; // 3:30pm

function esHorarioAlmuerzo(fecha = new Date()) {
  const totalMin = fecha.getHours() * 60 + fecha.getMinutes();
  return totalMin >= ESPECIAL_HORA_INICIO && totalMin < ESPECIAL_HORA_FIN;
}

function renderBanner(contenedor) {
  contenedor.innerHTML = `
    <div class="flex flex-row items-center gap-3 rounded-2xl bg-white shadow-md border border-slate-100 px-3 py-3 min-h-[150px]">
      <div class="w-5/12 flex items-center justify-center">
        <img id="imgEspeciales" class="w-[95%] h-full max-h-24 object-contain" alt="Banner Especiales" />
      </div>
      <div class="w-7/12 text-slate-900 flex flex-col justify-center gap-2 text-left">
        <div id="txtEspecialesTitulo" class="text-3xl font-semibold leading-tight text-red-600"></div>
        <div id="txtEspecialesCta" class="text-base font-medium text-slate-600"></div>
      </div>
    </div>
  `;

  const img = contenedor.querySelector('#imgEspeciales');
  const txtTitulo = contenedor.querySelector('#txtEspecialesTitulo');
  const txtCta = contenedor.querySelector('#txtEspecialesCta');

  const actualizarImagen = () => {
    img.src = esHorarioAlmuerzo() ? URL_LUNCH : URL_HH;
  };

  const actualizarTextos = () => {
    const esAlmuerzo = esHorarioAlmuerzo();
    txtTitulo.textContent = t(esAlmuerzo ? 'home.especialesLunch' : 'home.especialesHH');
    txtCta.textContent = t('home.especialesCta');
  };

  actualizarImagen();
  actualizarTextos();
  window.addEventListener('lang:changed', actualizarTextos);
}

document.addEventListener('DOMContentLoaded', () => {
  const contenedor = document.getElementById('bannerContenido');
  if (!contenedor) return;
  renderBanner(contenedor);
});
