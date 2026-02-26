import { supabase } from "../shared/supabaseClient.js";
import { resolverPlanComercio } from "../shared/planes.js";

/**
 * 🔹 Carrusel de "Aquí hay Jangueo 🔥"
 * Muestra comercios con categoría JANGUEO (idCategoria = 11)
 * Incluye fallback automático por área con mensaje visual.
 */
export async function renderJangueoCarouselArea(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const idJangueo = 11; // 🟠 Categoría JANGUEO
  let nombreMunicipio = "";
  let nombreArea = "";
  let municipiosIds = [];

  try {
    container.innerHTML = `<p class="text-gray-500 text-center">Cargando lugares de jangueo...</p>`;

    // 📍 Obtener filtros globales
    const { idArea, idMunicipio } = window.filtrosArea || {};

    // 🧭 Obtener nombres para mensaje
    if (idMunicipio) {
      const { data: muni } = await supabase
        .from("Municipios")
        .select("nombre, idArea")
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

    // 🔹 Obtener municipios del área (siempre)
    if (idArea) {
      const { data: municipios, error: muniError } = await supabase
        .from("Municipios")
        .select("id")
        .eq("idArea", idArea);
      if (muniError) throw muniError;
      municipiosIds = municipios?.map((m) => m.id) || [];
    }

    // 🔸 Buscar comercios activos con su relación de categorías
    let { data: comercios, error: comerciosError } = await supabase
      .from("Comercios")
      .select(`
        id,
        nombre,
        municipio,
        activo,
        idArea,
        idMunicipio,
        plan_id,
        plan_nivel,
        plan_nombre,
        permite_perfil,
        aparece_en_cercanos,
        permite_menu,
        permite_especiales,
        permite_ordenes,
        estado_propiedad,
        estado_verificacion,
        propietario_verificado,
        ComercioCategorias ( idCategoria )
      `)
      .eq("activo", true)
      .limit(100);

    if (comerciosError) throw comerciosError;

    // 🔹 Filtrar categoría JANGUEO
    let comerciosFiltrados = comercios
      .filter((c) => c.ComercioCategorias?.some((cc) => cc.idCategoria === idJangueo))
      .filter((c) => resolverPlanComercio(c).aparece_en_cercanos);

    // 🔸 Filtrar por municipio o área
    if (idMunicipio) {
      comerciosFiltrados = comerciosFiltrados.filter(
        (c) => c.idMunicipio === idMunicipio
      );
    } else if (idArea) {
      comerciosFiltrados = comerciosFiltrados.filter(
        (c) => c.idArea === idArea
      );
    }

    console.log("🍸 Comercios Jangueo filtrados:", comerciosFiltrados);

    let mensajeFallback = "";

    // 🔹 Fallback: si no hay en el municipio → cargar por área
    if ((!comerciosFiltrados || comerciosFiltrados.length === 0) && idArea) {
      console.warn("⚠️ Sin lugares de jangueo en el municipio, cargando por área...");

      comerciosFiltrados = comercios
        .filter(
          (c) =>
            municipiosIds.includes(c.idMunicipio) &&
            c.ComercioCategorias?.some((cc) => cc.idCategoria === idJangueo)
        )
        .filter((c) => resolverPlanComercio(c).aparece_en_cercanos);

      if (nombreMunicipio && nombreArea) {
        mensajeFallback = `
          <div class="text-center text-gray-600 my-4 leading-snug">
            <span class="inline-block text-[#e76f51] text-xl mr-1">🍸</span>
            No hay lugares de jangueo disponibles en <b>${nombreMunicipio}</b>.<br>
            Te mostramos los más cercanos en el Área <b>${nombreArea}</b>.
          </div>
        `;
      }
    }

    // 🔸 Si aún no hay resultados
    if (!comerciosFiltrados || comerciosFiltrados.length === 0) {
      container.innerHTML = `
        <p class="text-gray-500 text-center my-6">
          ${
            nombreMunicipio
              ? `No hay lugares de jangueo disponibles en <b>${nombreMunicipio}</b>.`
              : nombreArea
              ? `No hay lugares de jangueo disponibles en el Área <b>${nombreArea}</b>.`
              : "No hay lugares de jangueo disponibles."
          }
        </p>`;
      return;
    }

    // 🔸 Mostrar mensaje fallback si aplica
    container.innerHTML = mensajeFallback ? mensajeFallback : "";

    // 🔸 Obtener imágenes (no logos)
    const idsComercios = comerciosFiltrados.map((c) => c.id).filter(Boolean);
    const { data: imagenes, error: imgError } = await supabase
      .from("imagenesComercios")
      .select("imagen, idComercio, logo, portada")
      .in("idComercio", idsComercios)
      .neq("logo", true);

    if (imgError) throw imgError;
    if (!imagenes || imagenes.length === 0) {
      container.innerHTML += `<p class="text-gray-500 text-center">No hay imágenes de lugares de jangueo.</p>`;
      return;
    }

    // 🔸 Tomar portada o primera imagen
    const imagenesPorComercio = idsComercios
      .map((id) => {
        const imgs = imagenes.filter((img) => img.idComercio === id);
        return imgs.find((img) => img.portada) || imgs[0];
      })
      .filter(Boolean);

    const baseURL =
      "https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/";

    // 🔸 Crear estructura del carrusel
    container.innerHTML += `
      <div class="swiper jangueo-swiper">
        <div class="swiper-wrapper">
          ${await Promise.all(
            imagenesPorComercio.map(async (img) => {
              const comercio = comerciosFiltrados.find(
                (c) => c.id === img.idComercio
              );
              if (!comercio) return "";

              const { data: logoData } = await supabase
                .from("imagenesComercios")
                .select("imagen")
                .eq("idComercio", comercio.id)
                .eq("logo", true)
                .maybeSingle();

              const logoURL = logoData
                ? `${baseURL}${logoData.imagen}`
                : "https://placehold.co/40x40?text=Logo";

              return `
                <div class="swiper-slide cursor-pointer">
                  <a href="perfilComercio.html?id=${comercio.id}" 
                     class="block relative w-full aspect-[3/2] overflow-hidden rounded-lg bg-gray-100 shadow">
                    <img src="${baseURL + img.imagen}"
                         alt="${comercio.nombre}"
                         class="w-full h-full object-cover" />

                    <div class="absolute bottom-0 left-0 w-full p-2 flex items-end justify-start bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                      <img src="${logoURL}" alt="logo"
                           class="w-9 h-9 rounded-full border border-white mr-2 object-cover bg-white" />
                      <div class="leading-tight justify-items-start text-white text-[11px]">
                        <p class="text-sm text-white font-semibold">${comercio.nombre}</p>
                        <p class="text-xs text-gray-200">${comercio.municipio}</p>
                      </div>
                    </div>
                  </a>
                </div>
              `;
            })
          ).then((slides) => slides.join(""))}
        </div>
      </div>
    `;

    // 🔸 Inicializar Swiper
    new Swiper(container.querySelector(".jangueo-swiper"), {
      loop: true,
      autoplay: { delay: 3000, disableOnInteraction: false, reverseDirection: true },
      speed: 900,
      slidesPerView: 1.2,
      spaceBetween: 8,
      direction: "horizontal",
      centeredSlides: false,
    });
  } catch (err) {
    console.error("❌ Error cargando carrusel de Jangueo:", err);
    container.innerHTML = `<p class="text-red-500 text-center">Error al cargar los lugares de jangueo.</p>`;
  }
}
