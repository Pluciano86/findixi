// public/js/modalEventos.js
import { getEventoI18n } from "../shared/eventoI18n.js";
import { t } from "./i18n.js";

let eventoOriginal = null;

function obtenerLightboxImagenEvento() {
  let lightbox = document.getElementById("eventoImagenLightbox");
  if (lightbox) return lightbox;

  lightbox = document.createElement("div");
  lightbox.id = "eventoImagenLightbox";
  lightbox.className = "fixed inset-0 z-[12000] hidden items-center justify-center bg-black/90 p-4";
  lightbox.innerHTML = `
    <button type="button"
            class="absolute right-4 top-2 text-white text-5xl font-extralight leading-none hover:text-gray-300"
            aria-label="Cerrar imagen">&times;</button>
    <img id="eventoImagenLightboxImg"
         src=""
         alt="Imagen ampliada del evento"
         class="max-h-[92vh] max-w-[95vw] object-contain rounded-lg shadow-2xl" />
  `;

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target.tagName === "BUTTON") {
      cerrarLightboxImagenEvento();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cerrarLightboxImagenEvento();
    }
  });

  document.body.appendChild(lightbox);
  return lightbox;
}

function abrirLightboxImagenEvento(src = "", alt = "") {
  if (!src) return;
  const lightbox = obtenerLightboxImagenEvento();
  const img = lightbox.querySelector("#eventoImagenLightboxImg");
  if (!img) return;

  img.src = src;
  img.alt = alt || "Imagen ampliada del evento";
  lightbox.classList.remove("hidden");
  lightbox.classList.add("flex");
}

function cerrarLightboxImagenEvento() {
  const lightbox = document.getElementById("eventoImagenLightbox");
  if (!lightbox || lightbox.classList.contains("hidden")) return;

  lightbox.classList.add("hidden");
  lightbox.classList.remove("flex");
  const img = lightbox.querySelector("#eventoImagenLightboxImg");
  if (img) img.src = "";
}

function ajustarImagenModalSegunProporcion(imagen) {
  if (!imagen) return;
  const contenedor = imagen.parentElement;

  const aplicarTamanoNormal = () => {
    imagen.style.width = "100%";
    imagen.style.maxWidth = "100%";
    imagen.style.height = "100%";
    imagen.style.margin = "0 auto";
    imagen.style.display = "block";
    if (contenedor) contenedor.style.backgroundColor = "";
  };

  const aplicarTamanoVertical = () => {
    imagen.style.width = "72%";
    imagen.style.maxWidth = "72%";
    imagen.style.height = "100%";
    imagen.style.margin = "0 auto";
    imagen.style.display = "block";
    if (contenedor) contenedor.style.backgroundColor = "transparent";
  };

  const evaluar = () => {
    const w = Number(imagen.naturalWidth || 0);
    const h = Number(imagen.naturalHeight || 0);
    if (!w || !h) {
      aplicarTamanoNormal();
      return;
    }

    const ratio = w / h;
    const esVerticalAprox45 = h > w && ratio >= 0.72 && ratio <= 0.9;
    if (esVerticalAprox45) {
      aplicarTamanoVertical();
    } else {
      aplicarTamanoNormal();
    }
  };

  aplicarTamanoNormal();
  imagen.onload = evaluar;
  imagen.onerror = aplicarTamanoNormal;
  if (imagen.complete) evaluar();
}

async function renderModal(evento) {
  const modal = document.getElementById("modalEvento");
  if (!modal) return;

  const lang =
    localStorage.getItem("lang") ||
    document.documentElement.lang ||
    "es";
  const locale = lang === "es" ? "es-PR" : lang;
  const ev = await getEventoI18n(evento, lang).catch(() => evento);

  const fallback = (key, def) => {
    const val = t(key);
    return val === key ? def : val;
  };

  // 🟢 Imagen principal y título
  const titulo = document.getElementById("modalTitulo");
  const imagen = document.getElementById("modalImagen");
  titulo.textContent = ev.nombre || fallback("modal.sinTitulo", "Evento sin título");
  imagen.src = ev.imagen || ev.img_principal || "https://placehold.co/560x400?text=Evento";
  imagen.alt = ev.nombre || fallback("modal.sinTitulo", "Evento sin título");
  ajustarImagenModalSegunProporcion(imagen);
  imagen.style.cursor = "zoom-in";
  imagen.onclick = () => abrirLightboxImagenEvento(imagen.src, imagen.alt);

  // 🟢 Descripción
  const descripcion = document.getElementById("modalDescripcion");
  descripcion.textContent = ev.descripcion?.trim()
    ? ev.descripcion
    : fallback("evento.sinDescripcion", "Sin descripción disponible");

  // 🟢 Lugar y dirección (manejo multi-municipio)
  const lugar = document.getElementById("modalLugar");
  const direccion = document.getElementById("modalDireccion");
  if (direccion) {
    direccion.removeAttribute("href");
    direccion.removeAttribute("target");
    direccion.removeAttribute("rel");
    direccion.onclick = null;
  }
  const fechasDisponibles = Array.isArray(ev.eventoFechas)
    ? ev.eventoFechas
    : (Array.isArray(ev.fechas) ? ev.fechas : []);
  const municipiosUnicos = Array.from(
    new Set(
      fechasDisponibles
        .map((item) => item.municipioNombre || item.municipio_id || "")
        .filter(Boolean)
    )
  );
  const lugaresUnicos = Array.from(
    new Set(
      fechasDisponibles
        .map((item) => item.lugar || "")
        .filter(Boolean)
    )
  );
  const hayVariasLocalidades = municipiosUnicos.length > 1 || lugaresUnicos.length > 1;

  if (hayVariasLocalidades) {
    lugar.textContent = t("evento.variosMunicipios");
    direccion.textContent = "";
  } else {
    const sedeBase = fechasDisponibles.find((item) => item.lugar || item.direccion) || {};
    lugar.textContent = sedeBase.lugar || ev.lugar || fallback("modal.lugarNoEspecificado", "Lugar no especificado");
    direccion.textContent = sedeBase.direccion || ev.direccion || "";
  }

  // 🟢 Costo o Entrada Gratis
  const costo = document.getElementById("modalCosto");
  if (ev.gratis || ev.entrada_gratis) {
    costo.textContent = t("area.gratis");
  } else if (ev.costo || ev.precio) {
    const costoValor = (ev.costo ?? ev.precio ?? "").toString().trim();
    const lower = costoValor.toLowerCase();
    const normalizarMonto = (texto) => {
      const val = texto.trim();
      const sinSimbolo = val.replace(/^\s*\$\s*/, "");
      const esNumero = /^[\d,.]+$/.test(sinSimbolo);
      if (!val.startsWith("$") && esNumero) return `$${sinSimbolo}`;
      return val;
    };
    if (lower.startsWith("desde")) {
      const valor = costoValor.replace(/^desde\s*:?/i, "").trim();
      costo.textContent = `${t("evento.desde")} ${normalizarMonto(valor)}`;
    } else if (lower.startsWith("costo")) {
      costo.textContent = costoValor;
    } else {
      costo.textContent = `${t("area.costo")} ${normalizarMonto(costoValor)}`;
    }
  } else {
    costo.textContent = "";
  }

  // 🟢 Enlace de boletos
  const enlaceBoletos = document.getElementById("modalBoletos");
  const enlaceGlobal = ev.enlaceboletos || ev.enlace_boleto || ev.link_boletos || "";
  const hayLinksPorLocalidad = fechasDisponibles.some((f) => f.enlaceboletos);
  const usarLinkPorLocalidad = ev.boletos_por_localidad === true || (!enlaceGlobal && hayLinksPorLocalidad);

  if (!usarLinkPorLocalidad && enlaceGlobal) {
    enlaceBoletos.href = enlaceGlobal;
    enlaceBoletos.textContent = t("evento.comprarBoletos");
    enlaceBoletos.classList.remove("hidden");
  } else {
    enlaceBoletos.classList.add("hidden");
  }

  const capitalizarPrimera = (texto = "") =>
    texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;

// 🗓️ FECHAS DEL EVENTO
const fechaElem = document.getElementById("modalFechaPrincipal");
const horaElem = document.getElementById("modalHoraPrincipal");
const verFechasBtn = document.getElementById("modalVerFechas");
const fechasListado = document.getElementById("modalFechasListado");

if (fechasDisponibles.length > 0) {
  // Ordenar por fecha
  const fechasOrdenadas = [...fechasDisponibles].sort(
    (a, b) => new Date(a.fecha) - new Date(b.fecha)
  );

  // Mostrar la próxima fecha disponible
  const hoyISO = new Date().toISOString().slice(0, 10);
  const proxima = fechasOrdenadas.find((item) => item.fecha >= hoyISO) || fechasOrdenadas[fechasOrdenadas.length - 1];
  const fechaPrincipal = new Date(proxima.fecha).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  fechaElem.textContent = capitalizarPrimera(fechaPrincipal);

  if (proxima.horainicio) {
    const [hora, minutos] = proxima.horainicio.split(":");
    horaElem.textContent = new Date(`1970-01-01T${hora}:${minutos}:00`).toLocaleTimeString(
      locale,
      { hour: "numeric", minute: "2-digit", hour12: true }
    );
  } else {
    horaElem.textContent = "";
  }

  // Mostrar botón "Ver más fechas" si hay más de una
  if (fechasOrdenadas.length > 1) {
    verFechasBtn.classList.remove("hidden");
    const textoVer = t("evento.verFechas", { count: fechasOrdenadas.length });
    const textoOcultar = t("evento.ocultarFechas", "Ocultar las fechas");
    verFechasBtn.textContent = textoVer;

    // Generar listado de fechas organizado por municipio y lugar
    const grupos = new Map();
    fechasOrdenadas.forEach((f) => {
      const muni = f.municipioNombre || "";
      const lugar = f.lugar || "";
      const key = `${muni}||${lugar}`;
      const lista = grupos.get(key) || { municipio: muni, lugar, fechas: [], enlaceboletos: "" };
      lista.fechas.push(f);
      if (!lista.enlaceboletos && f.enlaceboletos) {
        lista.enlaceboletos = f.enlaceboletos;
      }
      grupos.set(key, lista);
    });

    fechasListado.classList.add("text-center");
    fechasListado.classList.remove("space-y-1");
    fechasListado.classList.add("space-y-4");

    fechasListado.innerHTML = Array.from(grupos.values())
      .map((grupo) => {
        const tituloMunicipio = grupo.municipio || t("area.municipio");
        const fechasHtml = grupo.fechas
          .map((f) => {
            const fechaTextoBase = new Date(f.fecha).toLocaleDateString(locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            const fechaTexto = fechaTextoBase
              ? fechaTextoBase.charAt(0).toUpperCase() + fechaTextoBase.slice(1)
              : "";
            const horaTexto = f.horainicio
              ? new Date(`1970-01-01T${f.horainicio}`).toLocaleTimeString(locale, {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                }).toLowerCase().replace(/\s+/g, "").replace(/\./g, "")
              : "";
            const linea = `${fechaTexto}${horaTexto ? ` • ${horaTexto}` : ""}`;
            return `<div>${linea}</div>`;
          })
          .join("");

        const botonBoletos = usarLinkPorLocalidad && grupo.enlaceboletos
          ? `<a href="${grupo.enlaceboletos}" target="_blank" rel="noopener noreferrer" class="inline-flex justify-center items-center gap-2 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-full">${t("evento.comprarBoletos")}</a>`
          : "";

        return `
          <div class="border-b border-gray-200 pb-3 last:border-b-0">
            <div class="font-semibold text-gray-800">${tituloMunicipio}</div>
            ${grupo.lugar ? `<div class="text-sm text-gray-600">${grupo.lugar}</div>` : ""}
            <div class="mt-2 space-y-1 text-sm text-gray-600">${fechasHtml}</div>
            ${botonBoletos}
          </div>
        `;
      })
      .join("");

    // Acción del botón
    verFechasBtn.onclick = () => {
      const oculto = fechasListado.classList.toggle("hidden");
      verFechasBtn.textContent = oculto ? textoVer : textoOcultar;
    };
  } else {
    verFechasBtn.classList.add("hidden");
    fechasListado.classList.add("hidden");
  }
} else {
  fechaElem.textContent = "";
  horaElem.textContent = "";
  verFechasBtn.classList.add("hidden");
  fechasListado.classList.add("hidden");
}

  // 🔹 Mostrar modal
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // 🔹 Cerrar modal
  const cerrarModal = document.getElementById("cerrarModal");
  if (cerrarModal) {
    cerrarModal.onclick = () => cerrarModalEvento();
  }

  modal.onclick = (e) => {
    if (e.target === modal) cerrarModalEvento();
  };
}

// 🔹 Función para cerrar el modal con animación y scroll restore
function cerrarModalEvento() {
  cerrarLightboxImagenEvento();
  const modal = document.getElementById("modalEvento");
  if (modal) modal.classList.add("hidden");
  document.body.style.overflow = "auto";
  eventoOriginal = null;
}

export async function abrirModal(evento) {
  eventoOriginal = evento;
  await renderModal(eventoOriginal);
}

// Re-render si cambia el idioma y el modal está visible
window.addEventListener("lang:changed", () => {
  const modal = document.getElementById("modalEvento");
  if (modal && !modal.classList.contains("hidden") && eventoOriginal) {
    renderModal(eventoOriginal);
  }
});
