import { supabase } from '../shared/supabaseClient.js';
import { t } from './i18n.js';
import { resolverPlanComercio } from '../shared/planes.js';

async function mostrarGridComida({ idArea, idMunicipio }) {
  const grid = document.getElementById("gridComida");
  if (!grid) return;

  grid.innerHTML = `<p class="text-gray-400 text-center col-span-full animate-pulse">${t('area.cargandoLugares')}</p>`;

  try {
    let nombreMunicipio = "";
    let nombreArea = "";
    let municipiosIds = [];

    // 🧭 Obtener nombres del municipio y área
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
      const { data: municipios } = await supabase
        .from("Municipios")
        .select("id")
        .eq("idArea", idArea);
      municipiosIds = municipios?.map((m) => m.id) || [];
    }

    // 🔹 Categorías que cuentan como "Lugares para Comer"
    const { data: categorias, error: errorCat } = await supabase
      .from("Categorias")
      .select("id, nombre")
      .in("nombre", ["Restaurantes", "Bares", "Food Trucks", "Coffee Shops", "Panaderías"]);

    if (errorCat) console.warn("⚠️ Error cargando categorías:", errorCat);

    const categoriasComida = categorias?.map(c => c.id) || [];

    // 🔹 Buscar comercios activos
    let { data: comercios, error } = await supabase
      .from("Comercios")
      .select(`
        id,
        nombre,
        municipio,
        idArea,
        idMunicipio,
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
      .limit(100);

    if (error) throw error;

    // 🔹 Filtrar comercios de comida
    let comerciosFiltrados = comercios
      .filter(c => c.ComercioCategorias?.some(cc => categoriasComida.includes(cc.idCategoria)))
      .filter(c => resolverPlanComercio(c).aparece_en_cercanos);

    // 🔹 Filtrar por municipio o área
    if (idMunicipio) {
      comerciosFiltrados = comerciosFiltrados.filter(c => c.idMunicipio === idMunicipio);
    } else if (idArea) {
      comerciosFiltrados = comerciosFiltrados.filter(c => c.idArea === idArea);
    }

    let mensajeFallback = "";

    // 🔹 Fallback: si no hay en el municipio, buscar por área
    if ((!comerciosFiltrados || comerciosFiltrados.length === 0) && idArea) {
      comerciosFiltrados = comercios
        .filter(c =>
          municipiosIds.includes(c.idMunicipio) &&
          c.ComercioCategorias?.some(cc => categoriasComida.includes(cc.idCategoria))
        )
        .filter(c => resolverPlanComercio(c).aparece_en_cercanos);

      if (nombreMunicipio && nombreArea) {
        mensajeFallback = `
          <div class="text-center text-gray-600 my-4 leading-snug col-span-full">
            <span class="inline-block text-[#3ea6c4] text-xl mr-1">🍽️</span>
            ${t('area.noLugaresMunicipio')} <b>${nombreMunicipio}</b>.<br>
            ${t('area.mostrarArea')} <b>${nombreArea}</b>.
          </div>
        `;
      }
    }

    // 🔸 Si no hay resultados ni en el área
    if (!comerciosFiltrados || comerciosFiltrados.length === 0) {
      grid.innerHTML = `
        <p class="text-center text-gray-500 col-span-full my-6">
          ${
            nombreMunicipio
              ? `${t('area.noLugaresMunicipio')} <b>${nombreMunicipio}</b>.`
              : nombreArea
              ? `${t('area.noLugaresArea')} <b>${nombreArea}</b>.`
              : t('area.sinLugares')
          }
        </p>`;
      return;
    }

    // 🔹 Mostrar mensaje fallback si aplica
    grid.innerHTML = mensajeFallback ? mensajeFallback : "";

    // 🔹 Obtener imágenes (no logos)
    const idsValidos = comerciosFiltrados.map(c => c.id).filter(Boolean);
    const { data: imagenes, error: errorImgs } = await supabase
      .from("imagenesComercios")
      .select("imagen, idComercio, logo")
      .in("idComercio", idsValidos)
      .or("logo.is.false,logo.is.null");

    if (errorImgs) throw errorImgs;
    if (!imagenes?.length) {
      grid.innerHTML += `<p class="text-gray-500 text-center col-span-full">${t('area.noImagenes')}</p>`;
      return;
    }

    // 🔹 Mezclar imágenes inteligentemente
    function mezclarInteligente(arr) {
      let intentos = 0, resultado = [];
      do {
        intentos++;
        resultado = [...arr].sort(() => Math.random() - 0.5);
      } while (
        intentos < 10 &&
        resultado.some((img, i) => i > 0 && img.idComercio === resultado[i - 1].idComercio)
      );
      return resultado;
    }

    const imagenesRandom = mezclarInteligente(imagenes);
    const baseURL = "https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/";
    const primeras = imagenesRandom.slice(0, 6);
    const restantes = imagenesRandom.slice(12);

    for (const img of primeras) {
      const comercio = comerciosFiltrados.find(c => c.id === img.idComercio);
      if (!comercio) continue;

      const { data: logoData } = await supabase
        .from("imagenesComercios")
        .select("imagen")
        .eq("idComercio", comercio.id)
        .eq("logo", true)
        .maybeSingle();

      const logoURL = logoData
        ? `${baseURL}${logoData.imagen}`
        : "https://placehold.co/40x40?text=Logo";

      const card = document.createElement("a");
      card.href = `perfilComercio.html?id=${comercio.id}`;
      card.className = "relative block overflow-hidden rounded-xl shadow hover:scale-[1.03] transition-transform bg-white";

      card.innerHTML = `
        <img src="${baseURL + img.imagen}" alt="${comercio.nombre}" class="w-full h-40 object-cover" />
        <div class="absolute bottom-0 left-0 w-full p-2 flex items-end justify-start bg-gradient-to-t from-black/80 via-black/30 to-transparent">
          <img src="${logoURL}" alt="logo" class="w-9 h-9 rounded-full border border-white mr-2 object-cover bg-white" />
          <div class="leading-tight justify-items-start text-white text-[11px]">
            <p class="font-medium truncate max-w-[140px]">${comercio.nombre}</p>
            <p class="text-[11px] text-white">${comercio.municipio}</p>
          </div>
        </div>
      `;

      grid.appendChild(card);
    }

    // 🔹 Botón “Ver más...”
    if (restantes.length > 0) {
      const btnContainer = document.createElement("div");
      btnContainer.className = "col-span-full flex justify-center items-center w-full mt-6";

      const btnVerMas = document.createElement("button");
      btnVerMas.textContent = t('area.verMas');
      btnVerMas.className = "bg-[#023047] hover:bg-[#023047] text-white font-light py-2 px-8 rounded-lg shadow transition";

      btnVerMas.addEventListener("click", () => {
        mostrarModalImagenes(restantes, comerciosFiltrados, baseURL);
      });

      btnContainer.appendChild(btnVerMas);
      grid.appendChild(btnContainer);
    }

  } catch (err) {
    console.error("❌ Error cargando imágenes:", err);
    grid.innerHTML = `<p class="text-red-500 text-center col-span-full">${t('area.errorComida')}</p>`;
  }
}

/* ===========================================================
   🔹 Modal - Versión funcional con blur, fade y cierre externo
   =========================================================== */
function mostrarModalImagenes(imagenes, comercios, baseURL) {
  const modal = document.getElementById("modalComida");
  const gridModal = document.getElementById("gridComidaModal");
  const cerrar = document.getElementById("cerrarModalComida");

  if (!modal || !gridModal) return;

  gridModal.innerHTML = "";
  modal.classList.remove("hidden");
  modal.classList.add("flex", "animate-fadeIn");

  imagenes.forEach(async (img) => {
    const comercio = comercios.find(c => c.id === img.idComercio);
    if (!comercio) return;

    const { data: logoData } = await supabase
      .from("imagenesComercios")
      .select("imagen")
      .eq("idComercio", comercio.id)
      .eq("logo", true)
      .maybeSingle();

    const logoURL = logoData ? `${baseURL}${logoData.imagen}` : "https://placehold.co/40x40?text=Logo";

    const card = document.createElement("a");
    card.href = `perfilComercio.html?id=${comercio.id}`;
    card.className = "relative block overflow-hidden rounded-xl shadow hover:scale-[1.02] transition-transform bg-white";

    card.innerHTML = `
      <img src="${baseURL + img.imagen}" alt="${comercio.nombre}" class="w-full h-40 object-cover" />
      <div class="absolute bottom-0 left-0 w-full p-2 flex items-end justify-start bg-gradient-to-t from-black/80 via-black/30 to-transparent">
        <img src="${logoURL}" alt="logo" class="w-9 h-9 rounded-full border border-white mr-2 object-cover bg-white" />
        <div class="leading-tight justify-items-start text-white text-[11px]">
          <p class="font-medium truncate max-w-[140px]">${comercio.nombre}</p>
          <p class="text-[11px] text-white">${comercio.municipio}</p>
        </div>
      </div>
    `;

    gridModal.appendChild(card);
  });

  if (cerrar) cerrar.onclick = () => cerrarModalAnimado(modal);
  modal.onclick = (e) => { if (e.target === modal) cerrarModalAnimado(modal); };
}

function cerrarModalAnimado(modal) {
  modal.classList.remove("animate-fadeIn");
  modal.classList.add("animate-fadeOut");
  setTimeout(() => {
    modal.classList.add("hidden");
    modal.classList.remove("flex", "animate-fadeOut");
  }, 200);
}

const style = document.createElement("style");
style.textContent = `
@keyframes fadeIn { from { opacity: 0; transform: scale(0.97);} to { opacity: 1; transform: scale(1);} }
@keyframes fadeOut { from { opacity: 1; transform: scale(1);} to { opacity: 0; transform: scale(0.97);} }
.animate-fadeIn { animation: fadeIn 0.25s ease forwards; }
.animate-fadeOut { animation: fadeOut 0.2s ease forwards; }
`;
document.head.appendChild(style);

window.addEventListener("areaCargada", (e) => mostrarGridComida(e.detail));

// Re-render al cambiar idioma
window.addEventListener('lang:changed', () => {
  mostrarGridComida(window.filtrosArea || {});
});
