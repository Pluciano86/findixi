// public/js/popups.js

import { supabase } from "../shared/supabaseClient.js";
import { showPopup as showPopupManager } from "./popupManager.js";
import { t } from "./i18n.js";

// ─────────────────────────────────────────────
// UNIVERSAL POPUP SYSTEM
// ─────────────────────────────────────────────

// Crear contenedor si no existe
function ensurePopupContainer() {
  if (!document.getElementById("popupContainer")) {
    const div = document.createElement("div");
    div.id = "popupContainer";
    div.className =
      "fixed inset-0 hidden bg-black/60 z-[9999] flex items-center justify-center p-4";
    document.body.appendChild(div);
  }
}

function detectarNavegadorMovil() {
  const ua = navigator.userAgent || navigator.vendor || "";

  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  // Chrome en iOS
  if (isIOS && /CriOS/i.test(ua)) return "chrome-ios";
  // Safari en iOS
  if (isIOS && /Safari/i.test(ua) && !/CriOS/i.test(ua)) return "safari-ios";
  // Chrome en Android
  if (isAndroid && /Chrome/i.test(ua)) return "chrome-android";

  return "otro";
}

// Mostrar popup genérico
export function showPopup(html) {
  ensurePopupContainer();
  const container = document.getElementById("popupContainer");

  container.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-xl animate-fadeIn flex flex-col items-center">
      
      <img src="https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/logoFindixi.png"
           alt="Findixi"
           class="w-24 mx-auto mb-3 select-none"/>

      ${html}

      <button id="popupCloseBtn"
        class="mt-5 w-full bg-gray-200 text-gray-800 py-2 rounded-xl hover:bg-gray-300 transition">
        ${t('popup.cerrar')}
      </button>
    </div>
  `;

  container.classList.remove("hidden");

  document.getElementById("popupCloseBtn").onclick = () =>
    container.classList.add("hidden");
}

// Determina la ruta correcta hacia login.html según el entorno
function getLoginUrl() {
  const { hostname, protocol, pathname } = window.location;
  const isLiveServer = hostname === "localhost" || protocol === "file:";

  if (isLiveServer) {
    return "login.html";
  }

  const inPublicPath = pathname.includes("/public/");
  return inPublicPath ? "/public/logearse.html" : "/login.html";
}

export function showPopupFavoritosVacios(tipo) {
  const cerrarPopup = () => {
    // Los popups de popupManager se remueven al hacer click; no se requiere acción adicional
  };

  const config = {
    titulo: t('popup.favs.titulo'),
    mensaje: t('popup.favs.msg'),
    botones: [{ texto: t('common.aceptar'), accion: cerrarPopup }],
  };

  if (typeof showPopupManager === "function") {
    showPopupManager({
      title: config.titulo,
      message: config.mensaje,
      buttons: config.botones.map((btn) => ({
        text: btn.texto,
        onClick: btn.accion,
      })),
    });
  }
}

function mostrarPopupAyudaUbicacion() {
  const navegador = detectarNavegadorMovil();
  let mensaje = "";

  if (navegador === "chrome-ios") {
    mensaje = t('popup.geo.chromeIos');
  } else if (navegador === "safari-ios") {
    mensaje = t('popup.geo.safariIos');
  } else if (navegador === "chrome-android") {
    mensaje = t('popup.geo.chromeAndroid');
  } else {
    mensaje = t('popup.geo.generic');
  }

  showPopupManager({
    title: t('popup.geo.needPermission'),
    message: mensaje,
    buttons: [
      {
        text: t('common.aceptar'),
        onClick: () => {},
      },
    ],
  });
}

const UBICACION_BLOQUEADA_KEY = "ubicacionBloqueadaHasta";

function cerrarPopupUbicacion() {
  const overlay = document.getElementById("popupUbicacionDenegada");
  if (overlay) {
    overlay.classList.add("hidden");
  }
}

function ejecutarCallbackUbicacionConcedida(pos) {
  const posiblesCallbacks = [
    window.initUbicacionUsuario,
    window.locateUser,
    window.cargarCercanosDesdeUsuario,
    window.onGeolocationGranted,
  ].filter((fn) => typeof fn === "function");

  posiblesCallbacks.forEach((fn) => {
    try {
      fn(pos);
    } catch (error) {
      console.warn("Error al ejecutar callback de ubicación concedida:", error);
    }
  });
}

export function solicitarUbicacionDesdePopup() {
  const overlay = document.getElementById("popupUbicacionDenegada");
  const mensajeEl = overlay?.querySelector("[data-popup-geo-msg]");

  if (!navigator.geolocation) {
    if (mensajeEl) {
      mensajeEl.textContent = t('popup.geo.noSupport');
    }
    return;
  }

  const handleSuccess = (pos) => {
    try {
      localStorage.removeItem(UBICACION_BLOQUEADA_KEY);
      localStorage.setItem("permisoUbicacion", "true");
    } catch (_) {
      /* noop */
    }
    cerrarPopupUbicacion();
    ejecutarCallbackUbicacionConcedida(pos);
  };

  const handleDenied = () => {
    if (mensajeEl) {
      mensajeEl.textContent =
        t('popup.geo.needPermission');
    }
  };

  const solicitarConPopup = () => {
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (error) => {
        if (error && error.code === error.PERMISSION_DENIED) {
          handleDenied();
          return;
        }
        if (mensajeEl) {
          mensajeEl.textContent = t('popup.geo.retry');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (navigator.permissions?.query) {
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (result.state === "granted") {
          navigator.geolocation.getCurrentPosition(handleSuccess, handleDenied, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        } else if (result.state === "prompt") {
          solicitarConPopup();
        } else if (result.state === "denied") {
          handleDenied();
        }
      })
      .catch(() => {
        solicitarConPopup();
      });
  } else {
    solicitarConPopup();
  }
}

// Popup para geolocalización denegada
export function mostrarPopupUbicacionDenegada(forceShow = false) {
  const bloqueoHastaRaw = localStorage.getItem(UBICACION_BLOQUEADA_KEY);
  const bloqueoHasta = bloqueoHastaRaw ? Number(bloqueoHastaRaw) : null;
  if (!forceShow && Number.isFinite(bloqueoHasta) && bloqueoHasta > Date.now()) {
    return;
  }

  let overlay = document.getElementById("popupUbicacionDenegada");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "popupUbicacionDenegada";
    overlay.className =
      "fixed inset-0 hidden z-[10000] flex items-center justify-center bg-black/70 px-4";
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-xl flex flex-col gap-4">
      <h2 class="text-xl font-semibold leading-tight">🫣 Wooo… No te escondas!!</h2>
      <p class="text-gray-600 text-sm leading-relaxed">
        Activa la ubicación pa’ mostrarte lo mejor cerca de ti. Sin eso, terminamos recomendándote sitios en Fajardo aunque estés por Maya. 😅
      </p>
      <p data-popup-geo-msg class="text-sm text-red-500 min-h-[1.5rem]"></p>
      <div class="flex flex-col gap-2">
        <button data-action="activar" class="bg-[#3ea6c4] text-white py-2 rounded-xl font-semibold hover:bg-[#199ac8] transition">
          Activar ubicación
        </button>
        <button data-action="mas-tarde" class="bg-gray-200 text-gray-800 py-2 rounded-xl hover:bg-gray-300 transition">
          Más tarde
        </button>
        <button data-action="no-deseo" class="bg-white text-gray-600 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 transition">
          No deseo activarla
        </button>
      </div>
    </div>
  `;

  const closePopup = () => overlay.classList.add("hidden");
  overlay.classList.remove("hidden");

  const btnActivar = overlay.querySelector('[data-action="activar"]');
  const btnMasTarde = overlay.querySelector('[data-action="mas-tarde"]');
  const btnNoDeseo = overlay.querySelector('[data-action="no-deseo"]');

  const guardarBloqueoTemporal = () => {
    try {
      localStorage.setItem(UBICACION_BLOQUEADA_KEY, Date.now() + 24 * 60 * 60 * 1000);
    } catch (_) {
      /* noop */
    }
  };

  if (btnActivar) {
    btnActivar.onclick = () => {
      closePopup();
      mostrarPopupAyudaUbicacion();
    };
  }

  if (btnMasTarde) {
    btnMasTarde.onclick = closePopup;
  }

  if (btnNoDeseo) {
    btnNoDeseo.onclick = () => {
      guardarBloqueoTemporal();
      closePopup();
    };
  }
}

// ─────────────────────────────────────────────
// POPUP AUTOMÁTICO: INVITAR A CREAR CUENTA
// ─────────────────────────────────────────────

async function popupCrearCuenta() {
  const { data: user } = await supabase.auth.getUser();

  if (user?.user) return;

  // evitar mostrarlo más de una vez por día
  const lastShown = localStorage.getItem("popupCrearCuentaShown");
  const today = new Date().toISOString().slice(0, 10);
  if (lastShown === today) return;

  localStorage.setItem("popupCrearCuentaShown", today);

  showPopup(`
    <h2 class="text-xl font-semibold mb-2">${t("popup.crearCuenta.title")}</h2>

    <p class="text-gray-600 text-sm leading-relaxed mb-3">
      ${t("popup.crearCuenta.body")}
    </p>

    <a id="btnCrearCuenta"
      class="inline-block w-full bg-[#3ea6c4] text-white py-2 rounded-xl font-semibold hover:bg-[#199ac8] transition">
      ${t("popup.crearCuenta.cta")}
    </a>
  `);

  const btnCrearCuenta = document.getElementById("btnCrearCuenta");
  if (btnCrearCuenta) {
    btnCrearCuenta.addEventListener("click", () => {
      window.location.href = getLoginUrl();
    });
  }
}

document.addEventListener("DOMContentLoaded", popupCrearCuenta);
