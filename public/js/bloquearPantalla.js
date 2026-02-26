(function () {
  const isTouchDevice =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0;

  if (!isTouchDevice) {
    return;
  }

  const noop = () => {};

  // Bloquear zoom por gestos (pinch) y gestos de Safari
  const preventDefault = (event) => {
    if (event.cancelable !== false) {
      event.preventDefault();
    }
  };

  const touchListenerOptions = { passive: false };

  document.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length > 1) {
        preventDefault(event);
      }
    },
    touchListenerOptions
  );

  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1) {
        preventDefault(event);
      }
    },
    touchListenerOptions
  );

  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 400) {
        preventDefault(event);
      }
      lastTouchEnd = now;
    },
    touchListenerOptions
  );

  ["gesturestart", "gesturechange", "gestureend"].forEach((name) => {
    document.addEventListener(name, preventDefault);
  });

  window.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) {
        preventDefault(event);
      }
    },
    { passive: false }
  );

  // Fallback para Safari: impedir doble tap en elementos interactivos
  document.addEventListener(
    "dblclick",
    (event) => {
      preventDefault(event);
    },
    { passive: false }
  );

  // Protección adicional en carruseles Swiper (evita pinch sin bloquear swipe)
  const swiperGuardListener = (event) => {
    if (event.touches && event.touches.length > 1) {
      preventDefault(event);
    }
  };

  const attachSwiperGuards = (root = document) => {
    root
      .querySelectorAll(".swiper")
      .forEach((el) => {
        el.removeEventListener("touchstart", swiperGuardListener, false);
        el.removeEventListener("touchmove", swiperGuardListener, false);
        el.addEventListener("touchstart", swiperGuardListener, touchListenerOptions);
        el.addEventListener("touchmove", swiperGuardListener, touchListenerOptions);
        ["gesturestart", "gesturechange", "gestureend"].forEach((name) => {
          el.removeEventListener(name, preventDefault, false);
          el.addEventListener(name, preventDefault, false);
        });
      });
  };

  attachSwiperGuards();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(".swiper")) {
          attachSwiperGuards(node.parentElement || node);
        } else {
          attachSwiperGuards(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Manejo de orientación
  const portrait = "portrait-primary";

  const legacyLock =
    screen.lockOrientation ||
    screen.mozLockOrientation ||
    screen.msLockOrientation ||
    noop;

  const unlock =
    screen.unlockOrientation ||
    screen.mozUnlockOrientation ||
    screen.msUnlockOrientation ||
    noop;

  const applyFallbackPortrait = () => {
    document.documentElement.style.transform = "";
    document.documentElement.style.width = "";
    document.documentElement.style.height = "";
    document.body.style.transform = "";
    document.body.style.width = "";
    document.body.style.height = "";
  };

  const clearFallbackPortrait = applyFallbackPortrait;

  // Overlay para iOS cuando se fuerza landscape
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const platform = typeof navigator !== "undefined" ? navigator.platform || "" : "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1);

  let overlayEl = null;
  let htmlOverflowBackup = "";
  let bodyOverflowBackup = "";

  const ensureOverlay = () => {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement("div");
    overlayEl.id = "orientation-lock-overlay";
    Object.assign(overlayEl.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0, 0, 0, 0.92)",
      color: "#ffffff",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "2.5rem",
      zIndex: "9999",
      fontFamily: "inherit",
      fontSize: "clamp(1.1rem, 2.8vw, 1.6rem)",
      lineHeight: "1.4",
      letterSpacing: "0.02em",
      pointerEvents: "auto",
      touchAction: "none",
    });
    overlayEl.innerHTML =
      "<div>🔒 La aplicación solo está disponible en orientación vertical.</div>";
    document.body.appendChild(overlayEl);
    return overlayEl;
  };

  const showOverlay = () => {
    const overlay = ensureOverlay();
    if (overlay.style.display === "flex") return;
    htmlOverflowBackup = document.documentElement.style.overflow;
    bodyOverflowBackup = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    overlay.style.display = "flex";
  };

  const hideOverlay = () => {
    if (!overlayEl || overlayEl.style.display === "none") return;
    document.documentElement.style.overflow = htmlOverflowBackup;
    document.body.style.overflow = bodyOverflowBackup;
    overlayEl.style.display = "none";
  };

  const isLandscape = () => {
    if (typeof window === "undefined") return false;

    if (typeof window.orientation === "number") {
      return Math.abs(window.orientation) === 90;
    }

    const orientation =
      screen.orientation || screen.mozOrientation || screen.msOrientation;
    if (orientation && typeof orientation.type === "string") {
      return orientation.type.startsWith("landscape");
    }

    return window.matchMedia("(orientation: landscape)").matches;
  };

  const syncIOSOverlay = () => {
    if (!isIOS) return;
    if (isLandscape()) {
      showOverlay();
    } else {
      hideOverlay();
    }
  };

  const lockOrientation = () => {
    const orientation = screen.orientation || screen.mozOrientation || screen.msOrientation;
    if (orientation && typeof orientation.lock === "function") {
      orientation.lock("portrait").catch(noop);
      return;
    }

    if (typeof legacyLock === "function") {
      try {
        legacyLock.call(screen, portrait);
      } catch (_) {
        noop();
      }
      return;
    }

    applyFallbackPortrait();
  };

  const requestLockWithRetry = () => {
    lockOrientation();
    setTimeout(lockOrientation, 500);
    syncIOSOverlay();
  };

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        requestLockWithRetry();
      }
    },
    false
  );

  window.addEventListener("orientationchange", requestLockWithRetry);
  window.addEventListener("resize", syncIOSOverlay, { passive: true });

  const userActivationLock = () => {
    requestLockWithRetry();
  };

  ["click", "touchstart"].forEach((name) => {
    document.addEventListener(name, userActivationLock, {
      once: true,
      passive: true,
    });
  });

  requestLockWithRetry();
  syncIOSOverlay();

  window.addEventListener(
    "beforeunload",
    () => {
      hideOverlay();
      clearFallbackPortrait();
      if (typeof unlock === "function") {
        try {
          unlock.call(screen);
        } catch (_) {
          noop();
        }
      }
    },
    { once: true }
  );
})();
