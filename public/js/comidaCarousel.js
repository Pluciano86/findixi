// public/js/comidaCarousel.js
import { supabase } from "../shared/supabaseClient.js";
import { resolverPlanComercio } from "../shared/planes.js";
import { pickRandomItems } from "../shared/utils.js";

const COMERCIOS_SELECT = `
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
`;

function readCategoriaId(relacion) {
  const raw = relacion?.idCategoria ?? relacion?.idcategoria ?? relacion?.id_categoria;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

function hasCategoria(comercio, categoriaId) {
  const relaciones = Array.isArray(comercio?.ComercioCategorias) ? comercio.ComercioCategorias : [];
  return relaciones.some((rel) => readCategoriaId(rel) === Number(categoriaId));
}

async function loadComerciosConCategorias() {
  const embeddedQuery = await supabase
    .from("Comercios")
    .select(`
      ${COMERCIOS_SELECT},
      ComercioCategorias ( idCategoria )
    `)
    .eq("activo", true)
    .limit(200);

  if (!embeddedQuery.error) {
    return (embeddedQuery.data || []).map((comercio) => ({
      ...comercio,
      ComercioCategorias: Array.isArray(comercio.ComercioCategorias) ? comercio.ComercioCategorias : [],
    }));
  }

  console.warn("⚠️ Fallback carrusel comida: relación ComercioCategorias no disponible.", embeddedQuery.error?.message || embeddedQuery.error);

  const baseQuery = await supabase
    .from("Comercios")
    .select(COMERCIOS_SELECT)
    .eq("activo", true)
    .limit(200);

  if (baseQuery.error) throw baseQuery.error;

  const comercios = baseQuery.data || [];
  const idsComercios = comercios.map((comercio) => Number(comercio.id)).filter(Number.isFinite);
  if (idsComercios.length === 0) return comercios;

  const relationAttempts = [
    { select: "idComercio,idCategoria", comercioCol: "idComercio", categoriaCol: "idCategoria" },
    { select: "idcomercio,idcategoria", comercioCol: "idcomercio", categoriaCol: "idcategoria" },
    { select: "idComercio,id_categoria", comercioCol: "idComercio", categoriaCol: "id_categoria" },
  ];

  const relacionesPorComercio = new Map();

  for (const attempt of relationAttempts) {
    const relQuery = await supabase
      .from("ComercioCategorias")
      .select(attempt.select)
      .in(attempt.comercioCol, idsComercios);

    if (relQuery.error) continue;

    for (const rel of relQuery.data || []) {
      const idComercio = Number(rel?.[attempt.comercioCol]);
      const idCategoria = Number(rel?.[attempt.categoriaCol]);
      if (!Number.isFinite(idComercio) || !Number.isFinite(idCategoria)) continue;
      if (!relacionesPorComercio.has(idComercio)) relacionesPorComercio.set(idComercio, []);
      relacionesPorComercio.get(idComercio).push({ idCategoria });
    }
    break;
  }

  return comercios.map((comercio) => ({
    ...comercio,
    ComercioCategorias: relacionesPorComercio.get(Number(comercio.id)) || [],
  }));
}

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
    const comercios = await loadComerciosConCategorias();

    // 🔹 Filtrar solo los de la categoría Restaurantes
    const comerciosFiltrados = comercios
      .filter((c) => hasCategoria(c, idRestaurantes))
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
      const imgs = imagenes.filter((img) => Number(img.idComercio) === Number(id));
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
