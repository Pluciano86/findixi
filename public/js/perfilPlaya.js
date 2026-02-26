// public/js/perfilPlaya.js
import { supabase } from "../shared/supabaseClient.js";
import { requireAuth } from "./authGuard.js";
import { obtenerClima } from "./obtenerClima.js";
import { calcularTiemposParaLista } from "./calcularTiemposParaLista.js";
import { formatTiempo } from "../shared/osrmClient.js";
import { getLang, t } from "./i18n.js";
import { getPlayaI18n } from "../shared/playaI18n.js";

let usuarioId = null;
let playaFavorita = false;
let playaActual = null;
const PLAYA_PLACEHOLDER =
  "https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/imgPlayaNoDisponible.jpg";

// Loader
function mostrarLoader() {
  document.getElementById("loader")?.classList.remove("hidden");
}
function ocultarLoader() {
  document.getElementById("loader")?.classList.add("hidden");
}

// ID por querystring
function obtenerIdPlaya() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

// Obtener coordenadas del usuario
function obtenerCoordenadasUsuario() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function actualizarFavoritoPlayaUI(icono, texto) {
  if (!icono || !texto) return;
  if (playaFavorita) {
    icono.className = "fas fa-heart text-xl text-red-500 animate-bounce";
    texto.textContent = t("perfilPlaya.enFavoritos");
  } else {
    icono.className = "far fa-heart text-xl";
    texto.textContent = t("perfilPlaya.btnFavorito");
  }
}

function traducirCosta(costa) {
  const normalized = String(costa || '').trim().toLowerCase();
  const map = {
    'sur': t('playas.costaSur'),
    'este': t('playas.costaEste'),
    'metro': t('playas.costaMetro'),
    'norte': t('playas.costaNorte'),
    'oeste': t('playas.costaOeste'),
    'islas municipio': t('playas.costaIslas'),
    'islas': t('playas.costaIslas')
  };
  return map[normalized] || costa;
}

async function renderDescripcionAcceso() {
  if (!playaActual) return;
  const lang = getLang();
  const descripcionEl = document.getElementById("descripcionPlaya");
  const accesoEl = document.getElementById("infoAcceso");
  if (!descripcionEl || !accesoEl) return;

  let descripcionTexto = playaActual.descripcion?.trim() || "";
  let accesoTexto = playaActual.acceso?.trim() || "";

  if (lang && lang !== "es") {
    const traducido = await getPlayaI18n(playaActual.id, lang);
    if (traducido?.descripcion) descripcionTexto = traducido.descripcion;
    if (traducido?.acceso) accesoTexto = traducido.acceso;
  }

  descripcionEl.textContent = descripcionTexto || t("playa.descripcionNoDisponible");
  accesoEl.textContent = accesoTexto || t("playa.accesoNoDisponible");
}

function ensureNoImageText(container, mostrar) {
  if (!container) return;
  let overlay = container.querySelector(".playa-no-image-text");
  if (!mostrar) {
    overlay?.remove();
    return;
  }
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className =
      "playa-no-image-text absolute inset-0 flex flex-col items-center justify-center text-center text-white font-semibold text-2xl leading-tight";
    overlay.innerHTML = `
      <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.85);">${t("playa.noImageTitle")}</span>
      <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.85);">${t("playa.noImageSubtitle")}</span>
    `;
    container.appendChild(overlay);
  } else {
    const spans = overlay.querySelectorAll("span");
    if (spans[0]) spans[0].textContent = t("playa.noImageTitle");
    if (spans[1]) spans[1].textContent = t("playa.noImageSubtitle");
  }
}


async function sincronizarFavoritoPlaya(idPlaya) {
  if (!usuarioId) {
    playaFavorita = false;
    return;
  }
  const { data, error } = await supabase
    .from("favoritosPlayas")
    .select("id")
    .eq("idusuario", usuarioId)
    .eq("idplaya", idPlaya)
    .maybeSingle();
  if (error) {
    console.error("Error verificando favorito de playa:", error);
    return;
  }
  playaFavorita = !!data;
}

async function inicializarFavoritoPlaya(idPlaya) {
  const btnFavorito = document.getElementById("btnFavoritoPlaya");
  if (!btnFavorito || !idPlaya) return;

  const icono = btnFavorito.querySelector("i");
  const texto = btnFavorito.querySelector("span");

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      usuarioId = user.id;
      await sincronizarFavoritoPlaya(idPlaya);
    }
  } catch (error) {
    console.warn("⚠️ No se pudo obtener el usuario actual:", error?.message);
  }
  actualizarFavoritoPlayaUI(icono, texto);

  btnFavorito.addEventListener("click", async () => {
    if (!usuarioId) {
      try {
        const authUser = await requireAuth("favoriteBeach");
        if (!authUser?.id) return;
        usuarioId = authUser.id;
        await sincronizarFavoritoPlaya(idPlaya);
        actualizarFavoritoPlayaUI(icono, texto);
      } catch {
        return;
      }
    }

    if (playaFavorita) {
      console.log("Eliminando de favoritosPlayas");
      const { error } = await supabase
        .from("favoritosPlayas")
        .delete()
        .eq("idusuario", usuarioId)
        .eq("idplaya", idPlaya);
      if (!error) {
        playaFavorita = false;
        actualizarFavoritoPlayaUI(icono, texto);
      } else {
        console.error("Error eliminando favorito de playa:", error);
      }
    } else {
      console.log("Insertando en favoritosPlayas");
      const { error } = await supabase
        .from("favoritosPlayas")
        .insert([{ idusuario: usuarioId, idplaya: idPlaya }]);
      if (!error) {
        playaFavorita = true;
        actualizarFavoritoPlayaUI(icono, texto);
      } else {
        console.error("Error insertando favorito de playa:", error);
        alert("No se pudo añadir esta playa a tus favoritos.");
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const idPlaya = obtenerIdPlaya();
  if (!idPlaya) return console.error("No se encontró el ID de la playa");

  mostrarLoader();

  try {
    const { data, error } = await supabase
      .from("playas")
      .select(`
        id,
        nombre,
        municipio,
        direccion,
        costa,
        descripcion,
        acceso,
        estacionamiento,
        imagen,
        nadar,
        surfear,
        snorkeling,
        latitud,
        longitud
      `)
      .eq("id", idPlaya)
      .single();

    if (error) throw error;
    if (!data) throw new Error("No se encontró la playa");
    playaActual = data;

    // === Imagen principal ===
    const imagenPlayaEl = document.getElementById("imagenPlaya");
    if (imagenPlayaEl) {
      const tieneImagen = Boolean(data.imagen?.trim());
      imagenPlayaEl.src = tieneImagen ? data.imagen.trim() : PLAYA_PLACEHOLDER;
      imagenPlayaEl.alt = `Imagen de ${data.nombre}`;
      ensureNoImageText(imagenPlayaEl.parentElement, !tieneImagen);
      imagenPlayaEl.onerror = () => {
        imagenPlayaEl.src = PLAYA_PLACEHOLDER;
        ensureNoImageText(imagenPlayaEl.parentElement, true);
      };
    }

    // === Nombre, municipio y costa ===
    document.getElementById("nombrePlaya").textContent =
      data.nombre || "Playa sin nombre";
    const municipioText = data.municipio ? data.municipio : "";
    const costaText = data.costa
      ? t("playas.costaPrefix", { valor: traducirCosta(data.costa) })
      : "";
    document.getElementById("municipioPlaya").textContent =
      municipioText && costaText
        ? `${municipioText} – ${costaText}`
        : municipioText || costaText;

    // === Dirección ===
const direccionSpan = document.getElementById("direccionPlaya");
if (direccionSpan) {
  direccionSpan.textContent =
    data.direccion?.trim() || "Dirección no disponible";
}

    // === Aptitudes ===
    const aptitudesContainer = document.getElementById("aptitudesContainer");
    aptitudesContainer.innerHTML = "";
    const aptitudes = [];
    if (data.nadar) aptitudes.push({ emoji: "🏊", texto: t("playas.nadar") });
    if (data.surfear) aptitudes.push({ emoji: "🏄", texto: t("playas.surfear") });
    if (data.snorkeling) aptitudes.push({ emoji: "🤿", texto: t("playas.snorkel") });

    if (aptitudes.length > 0) {
      aptitudes.forEach((apt) => {
        const item = document.createElement("div");
        item.className = "flex flex-col items-center";
        item.innerHTML = `
          <div class="text-5xl">${apt.emoji}</div>
          <div class="text-[#9c9c9c] font-medium mt-1">${apt.texto}</div>
        `;
        aptitudesContainer.appendChild(item);
      });
    }

    await renderDescripcionAcceso();

    // === Clima ===
    const clima = await obtenerClima(data.latitud, data.longitud);
    if (clima) {
      const climaSection = document.getElementById("climaSection");
      climaSection.querySelector("#temperatura").textContent = clima.temperatura;
      const rangoEl = climaSection.querySelector("#rangoTemperatura");
      if (rangoEl) {
        rangoEl.dataset.min = clima.min;
        rangoEl.dataset.max = clima.max;
        rangoEl.innerHTML = `
          ${t("perfilPlaya.minLabel")}: ${clima.min}<br>
          ${t("perfilPlaya.maxLabel")}: ${clima.max}
        `;
      }
      climaSection.querySelector("#descripcionClima").textContent = clima.estado;
      climaSection.querySelector("#viento").textContent = clima.viento;
      climaSection.querySelector("#humedad").textContent = clima.humedad;

      // Icono
      const columnaEstado = climaSection.querySelector("#descripcionClima")?.parentElement;
      if (columnaEstado) {
        columnaEstado.querySelectorAll(".icono-clima").forEach((n) => n.remove());
        if (clima.iconoURL) {
          const iconoEl = document.createElement("img");
          iconoEl.src = clima.iconoURL;
          iconoEl.alt = clima.estado;
          iconoEl.className = "icono-clima w-16 h-16 mb-2 drop-shadow-md";
          columnaEstado.insertBefore(iconoEl, columnaEstado.firstChild);
        }
      }
    }

    // === Distancia y tiempo en vehículo ===
    const coordsUsuario = await obtenerCoordenadasUsuario();
    if (coordsUsuario && data.latitud && data.longitud) {
      const lista = [data];
      await calcularTiemposParaLista(lista, coordsUsuario);
      const minutosCrudos = lista[0]?.minutosCrudos;
      const tiempo = Number.isFinite(minutosCrudos)
        ? formatTiempo(minutosCrudos * 60)
        : (lista[0]?.tiempoTexto || t("area.noDisponible"));
      playaActual.minutosCrudos = minutosCrudos;
      playaActual.tiempoTexto = tiempo;

      const tiempoVehiculoEl = document.getElementById("tiempoVehiculo");
      if (tiempoVehiculoEl)
        tiempoVehiculoEl.innerHTML = `<i class="fas fa-car"></i> ${tiempo}`;
    }

    // === Botones de navegación ===
    if (data.latitud && data.longitud) {
      const lat = data.latitud;
      const lon = data.longitud;
      document.getElementById(
        "btnGoogleMaps"
      ).href = `https://www.google.com/maps?q=${lat},${lon}`;
      document.getElementById(
        "btnWaze"
      ).href = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
    }

    await inicializarFavoritoPlaya(idPlaya);
  } catch (err) {
    console.error("Error al cargar la playa:", err.message);
  } finally {
    ocultarLoader();
  }
});

window.addEventListener("lang:changed", () => {
  const imagenPlayaEl = document.getElementById("imagenPlaya");
  const container = imagenPlayaEl?.parentElement;
  if (container?.querySelector(".playa-no-image-text")) {
    ensureNoImageText(container, true);
  }

  const favoritoTexto = document.querySelector("#btnFavoritoPlaya span");
  if (favoritoTexto) {
    favoritoTexto.textContent = playaFavorita
      ? t("perfilPlaya.enFavoritos")
      : t("perfilPlaya.btnFavorito");
  }

  if (playaActual) {
    const municipioText = playaActual.municipio ? playaActual.municipio : "";
    const costaText = playaActual.costa
      ? t("playas.costaPrefix", { valor: traducirCosta(playaActual.costa) })
      : "";
    const municipioEl = document.getElementById("municipioPlaya");
    if (municipioEl) {
      municipioEl.textContent =
        municipioText && costaText
          ? `${municipioText} – ${costaText}`
          : municipioText || costaText;
    }

    const aptitudesContainer = document.getElementById("aptitudesContainer");
    if (aptitudesContainer) {
      aptitudesContainer.innerHTML = "";
      const aptitudes = [];
      if (playaActual.nadar) aptitudes.push({ emoji: "🏊", texto: t("playas.nadar") });
      if (playaActual.surfear) aptitudes.push({ emoji: "🏄", texto: t("playas.surfear") });
      if (playaActual.snorkeling) aptitudes.push({ emoji: "🤿", texto: t("playas.snorkel") });
      aptitudes.forEach((apt) => {
        const item = document.createElement("div");
        item.className = "flex flex-col items-center";
        item.innerHTML = `
          <div class="text-5xl">${apt.emoji}</div>
          <div class="text-[#9c9c9c] font-medium mt-1">${apt.texto}</div>
        `;
        aptitudesContainer.appendChild(item);
      });
    }
  }

  if (playaActual) {
    const tiempoVehiculoEl = document.getElementById("tiempoVehiculo");
    if (tiempoVehiculoEl) {
      const minutos = playaActual.minutosCrudos;
      const tiempoTexto = Number.isFinite(minutos)
        ? formatTiempo(minutos * 60)
        : t("area.noDisponible");
      tiempoVehiculoEl.innerHTML = `<i class="fas fa-car"></i> ${tiempoTexto}`;
    }
  }

  const climaSection = document.getElementById("climaSection");
  if (climaSection) {
    const rangoEl = climaSection.querySelector("#rangoTemperatura");
    const min = climaSection.querySelector("#rangoTemperatura")?.dataset?.min;
    const max = climaSection.querySelector("#rangoTemperatura")?.dataset?.max;
    if (rangoEl && min && max) {
      rangoEl.innerHTML = `
        ${t("perfilPlaya.minLabel")}: ${min}<br>
        ${t("perfilPlaya.maxLabel")}: ${max}
      `;
    }
  }

  renderDescripcionAcceso();
});
