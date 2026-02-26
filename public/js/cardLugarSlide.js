// ✅ cardLugarSlide.js
import { t } from "./i18n.js";

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

  const card = document.createElement("a");
  card.href = `perfilLugar.html?id=${id}`;
  card.className = `
    block w-80 sm:w-96 shrink-0 rounded-lg overflow-hidden bg-white relative
    hover:scale-[1.02] transition-transform
  `.trim();

  card.innerHTML = `
<div class="w-full h-42 relative bg-gray-200 overflow-hidden">
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
    src="${imagen && imagen.trim() !== '' 
      ? imagen 
      : 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/nodisponiblepeq.jpg'}" 
    alt="${nombre}" 
    class="w-full h-full object-cover" 
    onerror="this.src='https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/nodisponiblepeq.jpg'" 
  />
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

  return card;
}
