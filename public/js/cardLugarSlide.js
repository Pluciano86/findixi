// ✅ cardLugarSlide.js
import { t } from "./i18n.js";

const PLACEHOLDER_LUGAR =
  "https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/imgagenLugarNoDisponible.jpg";

function buildNoImageOverlay() {
  return `
    <div class="playa-no-image-overlay absolute inset-0 flex flex-col items-center justify-center text-center text-white font-bold text-base leading-snug px-2 pointer-events-none">
      <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.85);">${t('playa.noImageTitle')}</span>
      <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.85);">${t('playa.noImageSubtitle')}</span>
    </div>
  `;
}

export function cardLugarSlide(lugar, opciones = {}) {
  const {
    id,
    nombre,
    municipio,
    imagen,
    tiempoTexto = t('area.tiempoDefault'), // valor por defecto si no hay distancia calculada
  } = lugar;
  console.log("Renderizando corazón lugar:", nombre, lugar?.favorito);

  // Nueva opción controlada desde listadoArea
  const { ocultarDistancia = false } = opciones;
  const hasImagenValida = typeof imagen === 'string' && imagen.trim() !== '';
  const imagenURL = hasImagenValida ? imagen.trim() : PLACEHOLDER_LUGAR;

  const card = document.createElement("a");
  card.href = `perfilLugar.html?id=${id}`;
  card.className = `
    block w-80 sm:w-96 shrink-0 rounded-lg overflow-hidden bg-white relative my-[1px]
    shadow-[0_2px_5px_rgba(15,23,42,0.13)]
    hover:scale-[1.02] transition-transform
  `.trim();

  card.innerHTML = `
<div class="w-full relative bg-gray-200 overflow-hidden" data-lugar-image-wrap style="height:10.5rem;">
  ${lugar.favorito ? `
    <div class="absolute top-2 right-2 z-50">
      <div class="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
        <div class="w-6 h-6 rounded-full border-2 border-red-600 flex items-center justify-center">
          <i class="fas fa-heart text-red-600 text-xs"></i>
        </div>
      </div>
    </div>` : ''
  }
  <img 
    src="${imagenURL}" 
    alt="${nombre}" 
    class="w-full h-full object-cover" 
    data-lugar-image
  />
  ${!hasImagenValida ? buildNoImageOverlay() : ''}
</div>

    <div class="pt-2 pb-2 text-center">
      <h3 class="text-lg font-medium text-gray-800 truncate px-2 leading-tight">
        ${nombre}
      </h3>

      <div class="flex justify-center items-center gap-4 text-sm mt-1 text-gray-500">
        <span class="flex items-center gap-1 text-[#3ea6c4] font-normal">
          <i class="fas fa-map-pin"></i> ${municipio ?? ""}
        </span>

        ${
          !ocultarDistancia && tiempoTexto
            ? `
          <span class="flex items-center gap-1 text-gray-400 font-normal">
            <i class="fa-solid fa-car text-gray-400"></i> ${tiempoTexto}
          </span>`
            : ""
        }
      </div>
    </div>
  `;

  const imageWrap = card.querySelector('[data-lugar-image-wrap]');
  const imageEl = card.querySelector('[data-lugar-image]');

  const ensureNoImageOverlay = () => {
    if (!imageWrap) return;
    let overlay = imageWrap.querySelector('.playa-no-image-overlay');
    if (!overlay) {
      imageWrap.insertAdjacentHTML('beforeend', buildNoImageOverlay());
      overlay = imageWrap.querySelector('.playa-no-image-overlay');
    } else {
      const spans = overlay.querySelectorAll('span');
      if (spans[0]) spans[0].textContent = t('playa.noImageTitle');
      if (spans[1]) spans[1].textContent = t('playa.noImageSubtitle');
    }
  };

  if (!hasImagenValida) {
    ensureNoImageOverlay();
  }

  if (imageEl) {
    imageEl.addEventListener('error', () => {
      if (imageEl.src !== PLACEHOLDER_LUGAR) {
        imageEl.src = PLACEHOLDER_LUGAR;
      }
      ensureNoImageOverlay();
    });
  }

  return card;
}
