import { obtenerClima } from './obtenerClima.js';
import { calcularTiempoEnVehiculo } from '../shared/utils.js';
import { t } from './i18n.js';

const PLACEHOLDER_IMG =
  'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/imgPlayaNoDisponible.jpg';

function resolveImagen(playa) {
  const fuentes = [playa?.imagen, playa?.imagenPortada, playa?.portada];
  const src = fuentes.find((url) => typeof url === 'string' && url.trim() !== '');
  return (src || PLACEHOLDER_IMG).trim();
}

function formatearTiempo(playa) {
  if (typeof playa?.tiempoTexto === 'string' && playa.tiempoTexto.trim() !== '') {
    return playa.tiempoTexto.trim();
  }
  const distanciaKm = Number(playa?.distanciaKm);
  if (!Number.isFinite(distanciaKm) || distanciaKm <= 0) return '';
  const { minutos, texto } = calcularTiempoEnVehiculo(distanciaKm);
  return minutos < 60 ? `a ${minutos} minutos` : texto;
}

function setClimaAsync(card, playa) {
  const estadoNode = card.querySelector('.estado-clima');
  const iconoNode = card.querySelector('.icon-clima');
  const vientoNode = card.querySelector('.viento');
  const lat = Number(playa?.latitud);
  const lon = Number(playa?.longitud);
  if (!estadoNode || !iconoNode || !vientoNode) return;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  obtenerClima(lat, lon)
    .then((clima) => {
      if (!clima) return;
      estadoNode.textContent = clima.estado;
      vientoNode.innerHTML = `<i class="fas fa-wind text-gray-400"></i> ${clima.viento}`;

      if (clima.iconoURL) {
        const img = document.createElement('img');
        img.src = clima.iconoURL;
        img.alt = clima.estado;
        img.loading = 'lazy';
        img.className = 'w-6 h-6 inline mr-1';
        iconoNode.innerHTML = '';
        iconoNode.appendChild(img);
      }
    })
    .catch(() => {});
}

export function buildPlayaCard(playa) {
  const card = document.createElement('div');
  card.className = 'text-center bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden';

  const imagen = resolveImagen(playa);
  const tiempoTexto = formatearTiempo(playa);

  card.innerHTML = `
    <img class="imagen w-full h-40 object-cover" src="${imagen}" alt="Imagen de ${playa?.nombre || 'playa'}" loading="lazy" />
    <div class="p-4">
      <h2 class="nombre text-lg font-medium text-[#424242] leading-[0.9] h-12 overflow-hidden text-ellipsis text-center px-2 mb-0">
        ${playa?.nombre || 'Playa'}
      </h2>
      <div class="text-sm text-gray-500 -mt-2 mb-1">Apta para:</div>
      <div class="text-center flex justify-center gap-4 text-blue-600">
        <div class="icon-nadar ${playa?.nadar ? '' : 'hidden'} flex flex-col items-center text-4xl">
          <span>🏊‍♂️</span>
          <span class="text-xs text-[#3ea6c4]">Nadar</span>
        </div>
        <div class="icon-surfear ${playa?.surfear ? '' : 'hidden'} flex flex-col items-center text-4xl">
          <span>🏄‍♂️</span>
          <span class="text-xs text-[#3ea6c4]">Surfear</span>
        </div>
        <div class="icon-snorkel ${playa?.snorkel || playa?.snorkeling ? '' : 'hidden'} flex flex-col items-center text-4xl">
          <span>🤿</span>
          <span class="text-xs text-[#3ea6c4]">Snorkel</span>
        </div>
      </div>
      <div class="flex justify-center items-center gap-1 text-sm text-gray-600 mt-2">
        <span class="icon-clima">
          <i class="fas fa-sun text-yellow-400"></i>
        </span>
        <span class="estado-clima">Soleado</span>
      </div>
      <div class="flex justify-center items-center gap-2 text-sm text-gray-400 mt-1">
        <span class="viento">Viento: -- km/h</span>
      </div>
      <div class="flex justify-center items-center gap-2 text-sm text-gray-600 mt-1">
        <span><i class="fas fa-map-pin text-[#3ea6c4]"></i></span>
        <span class="municipio text-[#3ea6c4]">${playa?.municipio || ''}</span>
      </div>
      <div class="icon-transporte mt-2 text-sm text-[#9c9c9c]"></div>
    </div>
  `;

  const imagenEl = card.querySelector('.imagen');
  if (imagenEl) {
    imagenEl.onerror = () => {
      imagenEl.src = PLACEHOLDER_IMG;
    };
  }

  const transporteNode = card.querySelector('.icon-transporte');
  if (transporteNode) {
    if (playa?.bote) {
      transporteNode.innerHTML = `
        <div class="flex justify-center items-center gap-1">
          <i class="fas fa-ship"></i>
          <span>${t('playas.accesoBote')}</span>
        </div>
      `;
    } else if (tiempoTexto) {
      transporteNode.innerHTML = `
        <div class="flex justify-center items-center gap-1">
          <i class="fas fa-car"></i>
          <span>${tiempoTexto}</span>
        </div>
      `;
    } else {
      transporteNode.innerHTML = '';
    }
  }

  setClimaAsync(card, playa);
  return card;
}

export function cardPlaya(playa) {
  const card = buildPlayaCard(playa);
  card.addEventListener('click', () => {
    if (!playa?.id) return;
    window.location.href = `perfilPlaya.html?id=${playa.id}`;
  });
  return card;
}
