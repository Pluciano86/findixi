import { supabase } from "../shared/supabaseClient.js";

const PLACEHOLDER_PORTADA =
  "https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/imgComercioNoDisponible.jpg";

const PLACEHOLDER_LOGO =
  "https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/imgLogoNoDisponible.jpg";

/**
 * Devuelve una imagen aleatoria desde la tabla imagenesComercios
 */
async function obtenerImagenAleatoria(idComercio) {
  try {
    const { data, error } = await supabase
      .from("imagenesComercios")
      .select("imagen")
      .eq("idComercio", idComercio)
      .eq("logo", false);

    if (error) {
      console.warn("⚠️ Error cargando imágenes del comercio:", error.message);
      return PLACEHOLDER_PORTADA;
    }

    if (data && data.length > 0) {
      const randomImg = data[Math.floor(Math.random() * data.length)];
      return randomImg.imagen || PLACEHOLDER_PORTADA;
    }

    return PLACEHOLDER_PORTADA;
  } catch (err) {
    console.error("Error al obtener imagen aleatoria:", err.message);
    return PLACEHOLDER_PORTADA;
  }
}

/**
 * Devuelve los nombres de las categorías desde la tabla Categorias
 */
async function obtenerNombresCategorias(idsCategorias) {
  try {
    if (!Array.isArray(idsCategorias) || idsCategorias.length === 0) return [];

    const { data, error } = await supabase
      .from("Categorias")
      .select("nombre")
      .in("id", idsCategorias);

    if (error) {
      console.warn("⚠️ Error obteniendo categorías:", error.message);
      return [];
    }

    return data.map((cat) => cat.nombre);
  } catch (err) {
    console.error("Error al obtener nombres de categorías:", err.message);
    return [];
  }
}

/**
 * Genera la tarjeta visual de un comercio activo
 */
export async function cardComida(comercio) {
  if (!comercio.activo) return null;

  // 🖼️ Imagen principal
  const imagenUrl =
    comercio.imagenPortada?.trim() ||
    (await obtenerImagenAleatoria(comercio.id)) ||
    PLACEHOLDER_PORTADA;

  // 🔵 Logo del comercio
  const logoUrl = comercio.logo?.trim() || PLACEHOLDER_LOGO;

  // 📂 Categorías (desde relación)
  const nombresCategorias = await obtenerNombresCategorias(comercio.idCategoria);
  const categoriasTexto = nombresCategorias.length
    ? nombresCategorias.join(", ")
    : "Sin categoría";

  // ✨ Crear tarjeta
  const card = document.createElement("a");
  card.href = `perfilComercio.html?id=${comercio.id}`;
  card.className = `
    bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg
    transition-transform hover:scale-[1.03] w-[180px] shrink-0
  `;

  // 🧩 Estructura interna
  card.innerHTML = `
    <div class="relative">
      <img 
        src="${imagenUrl}" 
        alt="Imagen de ${comercio.nombre}" 
        class="w-full h-24 object-cover" 
        onerror="this.src='${PLACEHOLDER_PORTADA}'"
      />

      <div class="absolute left-1/2 -bottom-6 transform -translate-x-1/2">
        <img 
          src="${logoUrl}" 
          alt="Logo ${comercio.nombre}" 
          class="w-14 h-14 rounded-full border-4 border-white object-cover shadow-md bg-white" 
          onerror="this.src='${PLACEHOLDER_LOGO}'"
        />
      </div>
    </div>

    <div class="pt-8 pb-3 text-center px-2">
      <h3 class="font-semibold text-gray-800 leading-tight text-[15px] line-clamp-2">
        ${comercio.nombre}
      </h3>
      <p class="text-blue-500 text-sm mt-1">${comercio.municipio || "Sin municipio"}</p>
      <p class="text-gray-500 text-xs mt-1">${categoriasTexto}</p>
    </div>
  `;

  return card;
}
