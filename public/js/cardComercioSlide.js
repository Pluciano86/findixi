// public/js/cardComercioSlide.js
import { supabase } from "../shared/supabaseClient.js";
import { t } from "./i18n.js";
import { resolverPlanComercio } from "../shared/planes.js";
import { registrarBasicClickIntent } from "../shared/basicClickIntentTracker.js";

const CATEGORIA_KEY_BY_ES = {
  "Restaurantes": "categoria.restaurantes",
  "Coffee Shops": "categoria.coffeeShops",
  "Panaderías": "categoria.panaderias",
  "Panaderias": "categoria.panaderias",
  "Pubs": "categoria.pubs",
  "Food Trucks": "categoria.foodTrucks",
  "Postres": "categoria.postres",
  "Playgrounds": "categoria.playgrounds",
  "Discotecas": "categoria.discotecas",
  "Barras": "categoria.barras",
};

function traducirCategoria(nombre) {
  const key = CATEGORIA_KEY_BY_ES[nombre];
  return key ? t(key) : nombre;
}

/**
 * 🔹 Tarjeta compacta para mostrar comercios en sliders tipo “Cercanos para Comer”
 * Muestra portada (desde Comercios.portada), logo, nombre, categoría, municipio y tiempo en vehículo.
 */
export function cardComercioSlide(comercio) {
  const {
    id,
    nombre,
    municipio,
    portada,
    logo,
    categorias,
    tiempoTexto,
  } = comercio;

  const categoriaTexto =
    categorias?.length > 0
      ? categorias.map(traducirCategoria).join(", ")
      : t("categoria.sin");

  // 🔹 Crear tarjeta
  const planInfo = resolverPlanComercio(comercio || {});
  const permitePerfil = planInfo.permite_perfil !== false;

  const card = document.createElement("a");
  card.href = permitePerfil ? `perfilComercio.html?id=${id}` : "#";
  card.dataset.planBloqueado = permitePerfil ? "false" : "true";
  card.className =
    `block bg-white rounded-xl mb-1 overflow-hidden shadow w-[160px] sm:w-[180px] relative ${permitePerfil ? '' : 'cursor-default'}`;

  // 🔹 Estructura visual idéntica al estilo de Playas
  card.innerHTML = `
    <div class="w-full h-24 relative bg-gray-200">
      <img src="${
        portada || "https://placehold.co/200x120?text=Portada"
      }" alt="Portada"
           class="w-full h-full object-cover" />

      <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-14 h-14 bg-white rounded-full shadow-[0px_-17px_11px_-5px_rgba(0,_0,_0,_0.5)] overflow-hidden">
        <img src="${
          logo || "https://placehold.co/40x40?text=Logo"
        }" alt="Logo" class="w-full h-full object-cover" />
      </div>
    </div>

    <div class="pt-8 px-2 pb-2 text-center">
      <h3 class="text-[12px] font-semibold leading-tight h-10 overflow-hidden line-clamp-2">
        ${nombre}
      </h3>

      <p class="text-[11px] text-gray-500 truncate">${categoriaTexto}</p>
      <p class="text-[11px] text-gray-600 mt-1 truncate">
        <i class="fas fa-map-pin text-sky-600 mr-1"></i>${municipio || "—"}
      </p>
      <p class="text-[11px] text-gray-600 mt-1">
        <i class="fas fa-car text-red-500 mr-1"></i>${tiempoTexto || "N/A"}
      </p>
    </div>
  `;

  if (!permitePerfil) {
    card.setAttribute('aria-disabled', 'true');
    card.setAttribute('tabindex', '-1');

    let bubbleState = null;

    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const ensureBubble = () => {
      let bubble = card.querySelector('.basic-plan-bubble');
      if (bubble) return bubble;

      bubble = document.createElement('div');
      bubble.className =
        'basic-plan-bubble absolute left-1/2 -translate-x-1/2 top-1 z-20 w-[92%] max-w-[200px] opacity-0 translate-y-2 pointer-events-none transition-all duration-200 ease-out';
      bubble.setAttribute('role', 'status');
      bubble.setAttribute('aria-live', 'polite');

      const box = document.createElement('div');
      box.className =
        'relative bg-white text-gray-800 border border-gray-200 rounded-2xl shadow-lg px-3 py-2 text-center';

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className =
        'absolute top-1 right-1 w-5 h-5 text-gray-400 hover:text-gray-600 rounded-full flex items-center justify-center';
      closeBtn.setAttribute('aria-label', 'Cerrar');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideBubble();
      });

      const iconWrap = document.createElement('div');
      iconWrap.className = 'mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-600';
      iconWrap.innerHTML = '<i class="fa-solid fa-circle-info text-[10px]"></i>';

      const title = document.createElement('div');
      title.className = 'font-semibold text-[11px] text-gray-900 leading-tight';
      title.textContent = 'Perfil aún no disponible';

      const msg = document.createElement('div');
      msg.className = 'text-[10px] text-gray-600 leading-snug mt-1';
      const nombreComercio = comercio?.nombre || 'este comercio';
      msg.innerHTML =
        `Este comercio todavía no ha activado su perfil completo en ` +
        `<span class="text-[#f57c00] font-semibold">Findixi</span>.<br>` +
        `Le notificaremos que hay personas interesadas en conocer más sobre` +
        `<br><span class="text-sky-600 font-semibold">${escapeHtml(nombreComercio)}</span>.`;

      const caret = document.createElement('span');
      caret.className =
        'absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white border-b border-r border-gray-200 rotate-45';

      box.appendChild(closeBtn);
      box.appendChild(iconWrap);
      box.appendChild(title);
      box.appendChild(msg);
      box.appendChild(caret);
      bubble.appendChild(box);

      bubble.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      card.appendChild(bubble);
      return bubble;
    };

    const hideBubble = () => {
      const bubble = card.querySelector('.basic-plan-bubble');
      if (!bubble || !bubbleState?.visible) return;
      bubbleState.visible = false;
      bubble.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
      bubble.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
      if (bubbleState.timer) {
        clearTimeout(bubbleState.timer);
        bubbleState.timer = null;
      }
      if (bubbleState.outsideHandler) {
        document.removeEventListener('click', bubbleState.outsideHandler);
        bubbleState.outsideHandler = null;
      }
    };

    const showBubble = () => {
      const bubble = ensureBubble();
      if (!bubbleState) bubbleState = {};

      bubbleState.visible = true;
      bubble.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');
      bubble.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');

      if (bubbleState.timer) clearTimeout(bubbleState.timer);
      bubbleState.timer = setTimeout(() => {
        hideBubble();
      }, 10000);

      if (!bubbleState.outsideHandler) {
        bubbleState.outsideHandler = (evt) => {
          if (!bubble.contains(evt.target)) {
            hideBubble();
          }
        };
        document.addEventListener('click', bubbleState.outsideHandler);
      }
    };

    card.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (bubbleState?.visible) {
        hideBubble();
        return;
      }

      registrarBasicClickIntent({
        idComercio: comercio?.id,
        metadata: {
          componente: "card_comercio_slide",
        },
      }).catch(() => {});

      showBubble();
    });
  }

  return card;
}

/**
 * 🔸 Cargar las categorías reales del comercio desde la relación ComercioCategorias → Categorias
 */
export async function cargarCategoriasComercio(idComercio) {
  try {
    const { data, error } = await supabase
      .from("ComercioCategorias")
      .select("Categorias (nombre)")
      .eq("idComercio", idComercio);

    if (error) throw error;

    return data?.map((c) => c.Categorias?.nombre).filter(Boolean) || [];
  } catch (err) {
    console.error("❌ Error cargando categorías del comercio:", err);
    return [];
  }
}
