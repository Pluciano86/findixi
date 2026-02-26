// ✅ lugaresCarousel.js
import { supabase } from "../shared/supabaseClient.js";
import { cardLugarSlide } from "./cardLugarSlide.js";
import { t } from "./i18n.js";

export async function renderLugaresCarousel(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    container.innerHTML = `<p class="text-gray-400 text-center">${t('area.cargandoLugares')}</p>`;

    const filtros = window.filtrosArea || {};
    const { idArea, idMunicipio } = filtros;
    console.log("📍 Filtros activos (Lugares):", filtros);

    // 🔹 Obtener nombre del área y municipio para mostrar en mensaje
    let nombreMunicipio = "";
    let nombreArea = "";

    if (idMunicipio) {
      const { data: muni } = await supabase
        .from("Municipios")
        .select("nombre")
        .eq("id", idMunicipio)
        .maybeSingle();
      nombreMunicipio = muni?.nombre || "";
    }

    if (idArea) {
      const { data: area } = await supabase
        .from("Area")
        .select("nombre")
        .eq("idArea", idArea)
        .maybeSingle();
      nombreArea = area?.nombre || "";
    }

    // 🔹 Construir consulta principal
    let query = supabase
      .from("LugaresTuristicos")
      .select(`
        id,
        nombre,
        municipio,
        imagen,
        latitud,
        longitud,
        idArea,
        idMunicipio,
        activo
      `)
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .limit(20);

    // 🔸 Aplicar filtro principal
    if (idMunicipio && !isNaN(idMunicipio)) {
      query = query.eq("idMunicipio", idMunicipio);
    } else if (idArea && !isNaN(idArea)) {
      query = query.eq("idArea", idArea);
    }

    let { data: lugares, error } = await query;
    if (error) throw error;

    console.log("🗺️ Lugares obtenidos (municipio/área):", lugares);

    let mensajeFallback = "";

    // 🔹 Si no hay resultados en el municipio, buscar los del área como fallback
    if ((!lugares || lugares.length === 0) && idArea) {
      console.warn("⚠️ Sin lugares en el municipio, cargando por área...");
      const { data: lugaresArea, error: areaError } = await supabase
        .from("LugaresTuristicos")
        .select(`
          id,
          nombre,
          municipio,
          imagen,
          latitud,
          longitud,
          idArea,
          idMunicipio,
          activo
        `)
        .eq("activo", true)
        .eq("idArea", idArea)
        .order("nombre", { ascending: true })
        .limit(20);

      if (areaError) throw areaError;
      lugares = lugaresArea || [];

      if (nombreMunicipio && nombreArea) {
        mensajeFallback = `${t('area.noLugaresMunicipio')} <b>${nombreMunicipio}</b>. 
        ${t('area.mostrarArea')} <b>${nombreArea}</b>.`;
      }
    }

    // 🔸 Si no hay lugares ni siquiera por área
    if (!lugares || lugares.length === 0) {
      const mensaje =
        nombreMunicipio
          ? `${t('area.noLugaresMunicipio')} <b>${nombreMunicipio}</b>.`
          : nombreArea
          ? `${t('area.noLugaresArea')} <b>${nombreArea}</b>.`
          : t('area.sinLugares');
      container.innerHTML = `<p class="text-center text-gray-500 my-6">${mensaje}</p>`;
      return;
    }

    // 🔹 Mostrar mensaje de fallback si aplica
    container.innerHTML = mensajeFallback
      ? `<p class="text-center text-gray-600 my-4">${mensajeFallback}</p>`
      : "";

    // 🔹 Crear carrusel
    container.innerHTML += `
      <div class="swiper lugaresSwiper w-full overflow-hidden px-1">
        <div class="swiper-wrapper">
          ${lugares
            .map(
              (lugar) => `
                <div class="swiper-slide">
                  ${cardLugarSlide(lugar, { ocultarDistancia: true }).outerHTML}
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `;

    // 🔹 Inicializar Swiper
    new Swiper(container.querySelector(".lugaresSwiper"), {
      loop: true,
      autoplay: { delay: 3000, disableOnInteraction: false, reverseDirection: true },
      speed: 900,
      slidesPerView: 1.2,
      spaceBetween: 8,
      centeredSlides: false,
    });

    // 🔹 Botón “Ver más Lugares”
    const btnContainer = document.createElement("div");
    btnContainer.className = "flex justify-center mt-6 w-full";

    const btnVerMas = document.createElement("a");
    btnVerMas.href = "listadoLugares.html";
    btnVerMas.textContent = t('area.verMasLugares');
    btnVerMas.className =
      "bg-[#023047] hover:bg-[#023047] text-white font-light py-2 px-8 rounded-lg shadow transition";

    btnContainer.appendChild(btnVerMas);
    container.appendChild(btnContainer);

  } catch (err) {
    console.error("❌ Error al cargar lugares:", err);
    container.innerHTML = `<p class="text-red-500 text-center mt-6">${t('area.errorLugares')}</p>`;
  }
}

/* -------------------------------------------------------
   🔄 ACTUALIZACIÓN AUTOMÁTICA POR EVENTO lugaresSwiper
-------------------------------------------------------- */
window.addEventListener("areaCargada", async (e) => {
  const { idArea, idMunicipio } = e.detail || {};
  window.filtrosArea = { idArea, idMunicipio };
  console.log("🎯 Recargando lugares con filtros:", window.filtrosArea);
  await renderLugaresCarousel("lugaresCarousel");
});

// Re-render al cambiar idioma
window.addEventListener('lang:changed', async () => {
  await renderLugaresCarousel("lugaresCarousel");
});
