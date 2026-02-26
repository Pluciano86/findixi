import { supabase } from '../shared/supabaseClient.js';

const CAROUSEL_ATTR = 'data-banner-carousel';
const CAROUSEL_TIMER_ATTR = 'data-carousel-timer-id';
const CAROUSEL_SLOT_ATTR = 'data-banner-slot';

const SLOT_WRAPPER_CLASSES = {
  'banner-top': 'w-full my-4 px-4 md:px-6 max-w-6xl mx-auto',
  'banner-inline': 'w-full my-4 col-span-full',
  'banner-bottom': 'w-full my-4 col-span-full px-4 md:px-6 max-w-6xl mx-auto'
};

const FALLBACK_WRAPPER_CLASS = 'w-full my-4 col-span-full';

let bannersCache = null;
let bannersPromise = null;
let loaderLocks = 0;

async function withLoader(asyncFn) {
  const canShow = typeof mostrarLoader === 'function';
  const canHide = typeof ocultarLoader === 'function';

  if (canShow) {
    loaderLocks += 1;
    if (loaderLocks === 1) {
      await mostrarLoader();
    }
  }

  try {
    return await asyncFn();
  } finally {
    if (canHide && loaderLocks > 0) {
      loaderLocks -= 1;
      if (loaderLocks === 0) {
        await ocultarLoader();
      }
    }
  }
}

function inferMedia(item) {
  const normalizeUrl = (url) => (typeof url === 'string' && url.trim().length ? url.trim() : null);

  const imagenUrl = normalizeUrl(item.imagenurl);
  const videoUrl = normalizeUrl(item.videourl);

  let mediaType = null;
  let mediaUrl = null;

  if (videoUrl) {
    mediaType = 'video';
    mediaUrl = videoUrl;
  } else if (imagenUrl) {
    mediaType = 'image';
    mediaUrl = imagenUrl;
  }

  if (!mediaUrl) return null;

  const idComercio = typeof item.idComercio === 'number' ? item.idComercio : null;
  const urlExterna = normalizeUrl(item.urlExterna);

  return {
    id: item.id,
    mediaType,
    mediaUrl,
    idComercio,
    urlExterna,
    titulo: item.titulo ?? ''
  };
}

async function fetchGlobalBanners() {
  if (bannersCache) return bannersCache;
  if (bannersPromise) return bannersPromise;

  bannersPromise = withLoader(async () => {
    const { data, error } = await supabase
      .from('banners')
      .select('id, titulo, descripcion, tipo, idArea, idMunicipio, imagenurl, videourl, activo, fechaInicio, fechaFin, created_at, urlExterna, idComercio')
      .eq('tipo', 'global')
      .eq('activo', true);

    console.log('[bannerCarousel] fetchGlobalBanners result:', { data, error });

    if (error) {
      console.error('Error obteniendo banners globales:', error);
      return [];
    }

    const hoy = new Date();

    const normalized = (data ?? [])
      .filter((banner) => {
        const inicio = banner.fechaInicio ? new Date(banner.fechaInicio) : null;
        if (inicio && Number.isNaN(inicio.getTime())) return false;

        const fin = banner.fechaFin ? new Date(banner.fechaFin) : null;
        if (fin && Number.isNaN(fin.getTime())) return false;

        if (inicio && inicio > hoy) return false;
        if (fin && fin < hoy) return false;

        return true;
      })
      .map(inferMedia)
      .filter(Boolean);

    bannersCache = normalized;
    return normalized;
  }).finally(() => {
    bannersPromise = null;
  });

  return bannersPromise;
}

function createMediaElement(banner) {
  if (banner.mediaType === 'video') {
    const video = document.createElement('video');
    video.src = banner.mediaUrl;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.className = 'w-full h-full object-cover';
    video.setAttribute('aria-hidden', 'true');
    return video;
  }

  const img = document.createElement('img');
  img.src = banner.mediaUrl;
  img.alt = banner.titulo || 'Banner';
  img.className = 'w-full h-full object-cover';
  return img;
}

function renderSlide(frame, banner) {
  if (!(frame instanceof HTMLElement)) return;

  const slide = document.createElement('div');
  slide.className = 'relative w-full h-full';

  const mediaElement = createMediaElement(banner);
  slide.appendChild(mediaElement);

  if (banner.idComercio != null || banner.urlExterna) {
    slide.classList.add('cursor-pointer');
    slide.addEventListener('click', () => {
      if (banner.idComercio != null) {
        window.location.href = `perfilComercio.html?id=${banner.idComercio}`;
      } else if (banner.urlExterna) {
        window.open(banner.urlExterna, '_blank', 'noopener');
      }
    });
  }

  frame.replaceChildren(slide);
}

function createCarouselWrapper(slotName, customClassName) {
  const wrapper = document.createElement('div');
  wrapper.setAttribute(CAROUSEL_ATTR, 'true');
  if (slotName) {
    wrapper.setAttribute(CAROUSEL_SLOT_ATTR, slotName);
  }

  const resolvedClass = customClassName
    || SLOT_WRAPPER_CLASSES[slotName]
    || FALLBACK_WRAPPER_CLASS;

  wrapper.className = resolvedClass;

  const frame = document.createElement('div');
  frame.className = 'relative aspect-[8/3] overflow-hidden rounded-lg bg-black/5';
  wrapper.appendChild(frame);

  return { wrapper, frame };
}

export function destroyCarousel(element) {
  if (!element) return;
  const timerId = Number(element.getAttribute(CAROUSEL_TIMER_ATTR));
  if (!Number.isNaN(timerId) && timerId) {
    clearInterval(timerId);
  }
  element.removeAttribute(CAROUSEL_TIMER_ATTR);
}

function removeExistingCarousels(container) {
  if (!container) return;
  const existing = container.querySelectorAll(`[${CAROUSEL_ATTR}="true"]`);
  existing.forEach(carousel => {
    destroyCarousel(carousel);
    carousel.remove();
  });
}

export function startCarousel(slotName, banners, options = {}) {
  if (!Array.isArray(banners) || banners.length === 0) {
    return null;
  }

  const { intervalMs = 8000, wrapperClassName } = options;
  const { wrapper, frame } = createCarouselWrapper(slotName, wrapperClassName);

  // 🚀 Iniciar en un índice random
  let currentIndex = Math.floor(Math.random() * banners.length);
  renderSlide(frame, banners[currentIndex]);

  if (banners.length > 1) {
    const timerId = window.setInterval(() => {
      currentIndex = (currentIndex + 1) % banners.length;
      renderSlide(frame, banners[currentIndex]);
    }, intervalMs);

    wrapper.setAttribute(CAROUSEL_TIMER_ATTR, String(timerId));
  }

  return { element: wrapper };
}

export async function createGlobalBannerElement(options = {}) {
  const {
    intervalMs = 8000,
    slotName = 'banner-inline',
    wrapperClassName
  } = options;

  const banners = await fetchGlobalBanners();
  if (!Array.isArray(banners) || banners.length === 0) return null;

  // 👆 ahora usamos startCarousel que ya arranca en random
  const result = startCarousel(slotName, banners, { intervalMs, wrapperClassName });
  return result?.element ?? null;
}

export async function insertGlobalBannerCarousels(container, options = {}) {
  const target = container instanceof HTMLElement ? container : null;
  if (!target) return;

  removeExistingCarousels(target);

  const banners = await fetchGlobalBanners();
  if (!Array.isArray(banners) || banners.length === 0) return;

  const { frequency = 8, intervalMs = 8000 } = options;

  const originalChildren = Array.from(target.children);

  const createAndInsert = (referenceNode, slotName) => {
    const result = startCarousel(slotName, banners, { intervalMs });
    if (!result?.element) return;

    if (referenceNode) {
      target.insertBefore(result.element, referenceNode);
    } else {
      target.appendChild(result.element);
    }
  };

  createAndInsert(originalChildren[0] || null, 'banner-top');

  if (originalChildren.length >= frequency && frequency > 0) {
    for (let index = frequency; index < originalChildren.length; index += frequency) {
      createAndInsert(originalChildren[index] || null, 'banner-inline');
    }
  }

  if (originalChildren.length > 0) {
    createAndInsert(null, 'banner-bottom');
  }
}