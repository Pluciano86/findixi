import { supabase } from "../shared/supabaseClient.js";
import { abrirModal } from "./modalEventos.js";
import { t } from "./i18n.js";

const normalizarEventos = (lista = [], municipioNombreById = new Map()) => {
  const hoyISO = new Date().toISOString().slice(0, 10);
    return (lista || [])
      .map((evento) => {
        const sedes = (evento.eventos_municipios || []).map((sede) => {
          const municipioNombre = municipioNombreById.get(sede.municipio_id) || "";
          const fechas = (sede.eventoFechas || []).map((item) => ({
            fecha: item.fecha,
            horainicio: item.horainicio,
            mismahora: item.mismahora ?? false,
            municipio_id: sede.municipio_id,
            municipioNombre,
            lugar: sede.lugar || "",
            direccion: sede.direccion || "",
            enlaceboletos: sede.enlaceboletos || ""
          }));
          return {
            municipio_id: sede.municipio_id,
            municipioNombre,
            lugar: sede.lugar || "",
            direccion: sede.direccion || "",
            enlaceboletos: sede.enlaceboletos || "",
            fechas
          };
        });

      const municipioIds = Array.from(new Set(sedes.map((s) => s.municipio_id).filter(Boolean)));
      const municipioNombre =
        municipioIds.length > 1
          ? t("evento.variosMunicipios")
          : (municipioNombreById.get(municipioIds[0]) || "");

      const eventoFechas = sedes.flatMap((sede) => sede.fechas || []).sort((a, b) => a.fecha.localeCompare(b.fecha));
      const ultimaFecha = eventoFechas.length ? eventoFechas[eventoFechas.length - 1].fecha : null;

      return {
        ...evento,
        sedes,
        municipioIds,
        municipioNombre,
        eventoFechas,
        ultimaFecha,
        boletos_por_localidad: Boolean(evento.boletos_por_localidad)
      };
    })
    .filter((evento) => !evento.ultimaFecha || evento.ultimaFecha >= hoyISO);
};

/**
 * 🔹 Cargar eventos filtrados por área o municipio
 * Incluye fallback automático por área con mensaje visual.
 */
export async function renderEventosCarousel(containerId, filtros = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { idArea, idMunicipio } = filtros;
  let municipiosIds = [];
  let nombreMunicipio = "";
  let nombreArea = "";
  const municipioNombreById = new Map();

  try {
    container.innerHTML = `<p class="text-gray-500 text-center">${t('area.cargandoEventos')}</p>`;

    // 🧭 Obtener nombres del municipio y área
    if (idMunicipio) {
      const { data: muni } = await supabase
        .from("Municipios")
        .select("id, nombre, idArea")
        .eq("id", idMunicipio)
        .maybeSingle();
      nombreMunicipio = muni?.nombre || "";
      if (muni?.id) municipioNombreById.set(muni.id, muni.nombre || "");
      if (!idArea && muni?.idArea) {
        filtros.idArea = muni.idArea; // fallback al área si no se pasó
      }
    }

    if (idArea) {
      const { data: area } = await supabase
        .from("Area")
        .select("nombre")
        .eq("idArea", idArea)
        .maybeSingle();
      nombreArea = area?.nombre || "";
    }

    if (!idArea && !idMunicipio) {
      const { data: municipiosTodos } = await supabase
        .from("Municipios")
        .select("id, nombre");
      (municipiosTodos || []).forEach((m) => municipioNombreById.set(m.id, m.nombre || ""));
    }

    // 🔸 Obtener siempre los municipios del área (aunque haya municipio activo)
    if (idArea) {
      const { data: municipios, error: muniError } = await supabase
        .from("Municipios")
        .select("id, nombre")
        .eq("idArea", idArea);
      if (muniError) throw muniError;
      municipiosIds = municipios?.map((m) => m.id) || [];
      (municipios || []).forEach((m) => municipioNombreById.set(m.id, m.nombre || ""));
    }

    const usarJoinInner = Boolean(idMunicipio || (idArea && municipiosIds.length > 0));
    const joinSedes = usarJoinInner ? "eventos_municipios!inner" : "eventos_municipios";

    // 🔸 Query base
    let query = supabase
      .from("eventos")
      .select(`
        id,
        nombre,
        descripcion,
        costo,
        gratis,
        boletos_por_localidad,
        imagen,
        enlaceboletos,
        ${joinSedes} (
          id,
          municipio_id,
          lugar,
          direccion,
          enlaceboletos,
          eventoFechas (fecha, horainicio, mismahora)
        )
      `)
      .eq("activo", true)
      .order("creado", { ascending: false })
      .limit(20);

    // 🔸 Filtro principal
    if (idMunicipio) {
      query = query.eq("eventos_municipios.municipio_id", idMunicipio);
    } else if (idArea && municipiosIds.length > 0) {
      query = query.in("eventos_municipios.municipio_id", municipiosIds);
    }

    let { data: eventos, error } = await query;
    if (error) throw error;

    console.log("🎟️ Eventos obtenidos (municipio/área):", eventos);
    eventos = normalizarEventos(eventos, municipioNombreById);

    let mensajeFallback = "";

    // 🔹 Si no hay eventos en municipio → buscar en el área
    if ((!eventos || eventos.length === 0) && idArea) {
      console.warn("⚠️ Sin eventos en el municipio, cargando por área...");

      const { data: eventosArea, error: areaError } = await supabase
        .from("eventos")
        .select(`
          id,
          nombre,
          descripcion,
          costo,
          gratis,
          boletos_por_localidad,
          imagen,
          enlaceboletos,
          eventos_municipios!inner (
            id,
            municipio_id,
            lugar,
            direccion,
            enlaceboletos,
            eventoFechas (fecha, horainicio, mismahora)
          )
        `)
        .eq("activo", true)
        .in("eventos_municipios.municipio_id", municipiosIds)
        .order("creado", { ascending: false })
        .limit(20);

      if (areaError) throw areaError;
      eventos = normalizarEventos(eventosArea || [], municipioNombreById);

      // Mostrar mensaje visual
      if (nombreMunicipio && nombreArea) {
        mensajeFallback = `
          <div class="text-center text-gray-600 my-4 leading-snug">
            <span class="inline-block text-[#3ea6c4] text-xl mr-1">🎟️</span>
            ${t('area.noEventosMunicipio')} <b>${nombreMunicipio}</b>.<br>
            ${t('area.mostrarArea')} <b>${nombreArea}</b>.
          </div>
        `;
      }
    }

    // 🔸 Si no hay eventos en absoluto
    if (!eventos || eventos.length === 0) {
      const mensaje =
        nombreMunicipio
          ? `${t('area.noEventosMunicipio')} <b>${nombreMunicipio}</b>.`
          : nombreArea
          ? `${t('area.noEventosArea')} <b>${nombreArea}</b>.`
          : t('area.sinEventos');
      container.innerHTML = `<p class="text-center text-gray-500 my-6">${mensaje}</p>`;
      return;
    }

    // 🔹 Mostrar mensaje de fallback si aplica
    container.innerHTML = mensajeFallback ? mensajeFallback : "";

    // 🔸 Estructura del carrusel
    container.innerHTML += `
      <div class="swiper eventosSwiper">
        <div class="swiper-wrapper">
          ${eventos
            .map(
              (evento) => {
                const urlImagen = evento.imagen || "https://placehold.co/400x500?text=Sin+Imagen";
                return `
            <div class="swiper-slide cursor-pointer" data-id="${evento.id}">
              <div class="w-full aspect-[3/4] overflow-hidden rounded-lg bg-gray-200 relative shadow">
                <img src="${urlImagen}"
                     alt=""
                     aria-hidden="true"
                     class="absolute inset-0 w-full h-full object-cover blur-md scale-110" />
                <img src="${urlImagen}"
                     alt="${evento.nombre || "Evento"}"
                     class="relative z-10 w-full h-full object-contain" />
              </div>
            </div>`;
              }
            )
            .join("")}
        </div>
      </div>
    `;

    // 🔹 Inicializar Swiper
    const pathname = window.location.pathname || "";
    const esListadoArea = pathname.includes("listadoArea.html");
    const esIndex = pathname.endsWith("/") || pathname.includes("index.html");
    new Swiper(container.querySelector(".eventosSwiper"), {
      loop: true,
      autoplay: { delay: 2500, disableOnInteraction: false },
      speed: 900,
      slidesPerView: (esIndex || esListadoArea) ? 2 : 1.2,
      spaceBetween: (esIndex || esListadoArea) ? 10 : 8, // pequeño espacio entre tarjetas
      centeredSlides: false,
    });

    // 🔹 Click → abrir modal
    container.querySelectorAll(".swiper-slide").forEach((slide) => {
      slide.addEventListener("click", () => {
        const id = slide.getAttribute("data-id");
        const evento = eventos.find((e) => e.id == id);
        if (evento) abrirModal(evento);
      });
    });

    // 🔹 Botón “Ver más eventos”
    const btnContainer = document.createElement("div");
    btnContainer.className = "flex justify-center mt-6 w-full";

    const btnVerMas = document.createElement("a");
    btnVerMas.href = "listadoEventos.html";
    btnVerMas.textContent = t('area.verMasEventos');
    btnVerMas.className =
      "bg-[#023047] hover:bg-[#023047] text-white font-light py-2 px-8 rounded-lg shadow transition";

    btnContainer.appendChild(btnVerMas);
    container.appendChild(btnContainer);

  } catch (err) {
    console.error("❌ Error cargando eventos:", err);
    container.innerHTML = `<p class="text-red-500 text-center mt-6">${t('area.errorEventos')}</p>`;
  }
}

// Re-render al cambiar idioma
window.addEventListener('lang:changed', () => {
  renderEventosCarousel("eventosCarousel", window.filtrosArea || {});
});
