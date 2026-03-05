// public/js/comidaCarousel.js
import { supabase } from "../shared/supabaseClient.js";
import { resolverPlanComercio } from "../shared/planes.js";
import { pickRandomItems } from "../shared/utils.js";

/**
 * 🔹 Carrusel de "Aquí en Pe Erre se come bien"
 * Solo muestra comercios con categoría Restaurantes.
 */
export async function renderComidaCarousel(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // ✅ ID de la categoría “Restaurantes”
  const idRestaurantes = 1; // asegúrate de que coincide con tu tabla Categorias
  const maxSlides = 24;

  try {
    // 🔸 Buscar comercios activos con categorías embebidas
    let { data: comercios, error: comerciosError } = await supabase
      .from("Comercios")
      .select(`
        id,
        nombre,
        municipio,
        activo,
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
      .limit(200);

    if (comerciosError) {
      const msg = String(comerciosError?.message || '').toLowerCase();
      const missingRelation =
        msg.includes('relationship') ||
        msg.includes('comerciocategorias') ||
        msg.includes('does not exist');

      if (!missingRelation) throw comerciosError;

      // Fallback: leer Comercios y ComercioCategorias por separado.
      const base = await supabase
        .from("Comercios")
        .select(`
          id,
          nombre,
          municipio,
          activo,
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
          propietario_verificado
        `)
        .eq("activo", true)
        .limit(200);

      if (base.error) throw base.error;
      comercios = base.data || [];

      const ids = (comercios || []).map((c) => c.id).filter(Boolean);
      if (ids.length) {
        let relRows = [];
        let relError = null;
        const attempts = [
          { idCom: "idComercio", idCat: "idCategoria" },
          { idCom: "idcomercio", idCat: "idcategoria" },
          { idCom: "idComercio", idCat: "idcategoria" },
          { idCom: "idcomercio", idCat: "idCategoria" },
        ];
        for (const attempt of attempts) {
          const rel = await supabase
            .from("ComercioCategorias")
            .select(`${attempt.idCom}, ${attempt.idCat}`)
            .in(attempt.idCom, ids);
          if (!rel.error) {
            relRows = rel.data || [];
            relError = null;
            break;
          }
          relError = rel.error;
        }
        if (relError) throw relError;

        const byComercio = new Map();
        relRows.forEach((row) => {
          const idComercio = Number(row.idComercio ?? row.idcomercio);
          const idCategoria = Number(row.idCategoria ?? row.idcategoria);
          if (!Number.isFinite(idComercio) || !Number.isFinite(idCategoria)) return;
          const current = byComercio.get(idComercio) || [];
          current.push({ idCategoria });
          byComercio.set(idComercio, current);
        });

        comercios = (comercios || []).map((c) => ({
          ...c,
          ComercioCategorias: byComercio.get(Number(c.id)) || [],
        }));
      }
    }

    // 🔹 Filtrar solo los de la categoría Restaurantes
    const comerciosFiltrados = comercios
      .filter((c) => c.ComercioCategorias?.some((cc) => Number(cc.idCategoria) === idRestaurantes))
      .filter((c) => resolverPlanComercio(c).aparece_en_cercanos);
    const comerciosAleatorios = pickRandomItems(comerciosFiltrados, maxSlides);

    if (comerciosAleatorios.length === 0) {
      container.innerHTML = `<p class="text-gray-500 text-center">No hay restaurantes disponibles</p>`;
      return;
    }

    // 🔸 Obtener imágenes (no logos)
    const idsComercios = comerciosAleatorios.map((c) => c.id).filter(Boolean);
    if (idsComercios.length === 0) {
      console.warn("⚠️ Comercios sin IDs válidos.");
      container.innerHTML = `<p class="text-gray-500 text-center">No hay imágenes disponibles.</p>`;
      return;
    }

    const { data: imagenes, error: imgError } = await supabase
      .from("imagenesComercios")
      .select("imagen, idComercio, logo, portada")
      .in("idComercio", idsComercios)
      .neq("logo", true);

    if (imgError) throw imgError;

    if (!imagenes || imagenes.length === 0) {
      container.innerHTML = `<p class="text-gray-500 text-center">No hay imágenes de restaurantes.</p>`;
      return;
    }

    // 🔸 Tomar una imagen por comercio (priorizar portada)
    const imagenesPorComercio = idsComercios.map((id) => {
      const imgs = imagenes.filter((img) => img.idComercio === id);
      return imgs.find((img) => img.portada) || imgs[0];
    }).filter(Boolean);

    // 🔸 Base URL del bucket
    const baseURL =
      "https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/";

    // 🔸 Crear estructura del carrusel
    container.innerHTML = `
      <div class="swiper comida-swiper">
        <div class="swiper-wrapper">
          ${await Promise.all(
            imagenesPorComercio.map(async (img) => {
              const comercio = comerciosAleatorios.find((c) => c.id === img.idComercio);
              if (!comercio) return "";

              // 🔹 Buscar logo del comercio
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
                  <a href="perfilComercio.html?id=${comercio.id}" class="block relative w-full aspect-[3/2] overflow-hidden rounded-lg bg-gray-100 shadow">
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

    // 🔸 Inicializar Swiper (loop suave, sin salto brusco en reinicio)
    const totalSlides = imagenesPorComercio.length;
    const canLoop = totalSlides > 1;
    new Swiper(container.querySelector(".comida-swiper"), {
      loop: canLoop,
      loopedSlides: canLoop ? totalSlides : 0,
      loopAdditionalSlides: canLoop ? totalSlides : 0,
      autoplay: canLoop
        ? { delay: 3000, disableOnInteraction: false, waitForTransition: false }
        : false,
      speed: 900,
      slidesPerView: 1.4,
      slidesPerGroup: 1,
      spaceBetween: 8, // pequeño espacio entre tarjetas
      direction: "horizontal",
      centeredSlides: false,
      watchSlidesProgress: true,
    });
  } catch (err) {
    console.error("❌ Error cargando carrusel de Restaurantes:", err);
    container.innerHTML = `<p class="text-red-500 text-center">Error al cargar los restaurantes.</p>`;
  }
}
