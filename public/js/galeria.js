import { supabase } from '../shared/supabaseClient.js';

const idComercio = new URLSearchParams(window.location.search).get('id');
const galeriaContenedor = document.getElementById('galeriaImagenes');
const galeriaSection = document.getElementById('galeriaSection');
const modal = document.getElementById('modalGaleria');
const slider = document.getElementById('sliderModal');
const sliderWrapper = document.getElementById('sliderModalWrapper');
const cerrarModalBtn = document.getElementById('cerrarModal');

let imagenesGaleria = [];
let autoSlideIntervalId = null;
let modalSwiper = null;
let touchStartY = 0;
let wheelWrapLocked = false;

if (modal && modal.parentElement !== document.body) {
  document.body.appendChild(modal);
}

function detenerAutoSlide() {
  if (autoSlideIntervalId) {
    clearInterval(autoSlideIntervalId);
    autoSlideIntervalId = null;
  }
}

function destruirModalSwiper() {
  if (modalSwiper) {
    modalSwiper.destroy(true, true);
    modalSwiper = null;
  }
  if (sliderWrapper) {
    sliderWrapper.innerHTML = '';
  }
}

async function cargarGaleria() {
  if (!galeriaContenedor) return;
  detenerAutoSlide();

  const { data, error } = await supabase
    .from('imagenesComercios')
    .select('imagen')
    .eq('idComercio', idComercio)
    .or('logo.is.false,logo.is.null')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error cargando imágenes', error);
    galeriaSection?.classList.add('hidden');
    return;
  }

  imagenesGaleria = (data || [])
    .map((item) => item?.imagen)
    .filter(Boolean)
    .map((ruta) => supabase.storage.from('galeriacomercios').getPublicUrl(ruta).data.publicUrl)
    .filter(Boolean);

  galeriaContenedor.innerHTML = '';

  if (!imagenesGaleria.length) {
    galeriaSection?.classList.add('hidden');
    return;
  }

  galeriaSection?.classList.remove('hidden');

  imagenesGaleria.forEach((url, index) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Imagen del comercio';
    img.className = 'h-64 object-cover w-full cursor-pointer snap-center transition-transform duration-500 ease-in-out';
    img.onclick = () => abrirModal(index);
    galeriaContenedor.appendChild(img);
  });

  if (imagenesGaleria.length > 1) {
    const clone = galeriaContenedor.children[0].cloneNode(true);
    galeriaContenedor.appendChild(clone);
    iniciarAutoSlide();
  }
}

function iniciarAutoSlide() {
  let currentIndex = 0;
  const total = galeriaContenedor.children.length;
  if (total <= 1) return;

  autoSlideIntervalId = setInterval(() => {
    currentIndex += 1;
    galeriaContenedor.scrollTo({
      left: galeriaContenedor.clientWidth * currentIndex,
      behavior: 'smooth',
    });

    if (currentIndex === total - 1) {
      setTimeout(() => {
        galeriaContenedor.scrollTo({ left: 0, behavior: 'auto' });
        currentIndex = 0;
      }, 100);
    }
  }, 3000);
}

function construirSlidesModal() {
  if (!sliderWrapper) return;
  sliderWrapper.innerHTML = '';

  imagenesGaleria.forEach((url) => {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide';

    const zoomContainer = document.createElement('div');
    zoomContainer.className = 'swiper-zoom-container';

    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Imagen del comercio';
    img.loading = 'lazy';

    zoomContainer.appendChild(img);
    slide.appendChild(zoomContainer);
    sliderWrapper.appendChild(slide);
  });
}

function abrirModal(index) {
  if (!modal || !slider || !sliderWrapper || !imagenesGaleria.length) return;

  const SwiperClass = window.Swiper;
  if (typeof SwiperClass !== 'function') {
    console.error('Swiper no está disponible para la galería vertical.');
    return;
  }

  destruirModalSwiper();
  construirSlidesModal();

  modal.classList.remove('hidden');
  document.getElementById('bodyPrincipal')?.classList.add('overflow-hidden');

  modalSwiper = new SwiperClass(slider, {
    direction: 'vertical',
    loop: false,
    rewind: imagenesGaleria.length > 1,
    centeredSlides: true,
    slidesPerView: 'auto',
    spaceBetween: 4,
    speed: 420,
    grabCursor: true,
    zoom: {
      maxRatio: 3,
      minRatio: 1,
      toggle: true,
    },
    mousewheel: {
      forceToAxis: true,
      sensitivity: 0.9,
      releaseOnEdges: false,
    },
    keyboard: {
      enabled: true,
      onlyInViewport: false,
    },
    on: {
      touchStart(swiper, event) {
        const y = event?.touches?.[0]?.clientY;
        touchStartY = Number.isFinite(y) ? y : 0;
      },
      touchEnd(swiper, event) {
        if (imagenesGaleria.length <= 1) return;
        const y = event?.changedTouches?.[0]?.clientY;
        const touchEndY = Number.isFinite(y) ? y : touchStartY;
        const deltaY = touchEndY - touchStartY;
        const threshold = 24;

        // Swipe hacia abajo estando en la primera -> ir a la última.
        if (deltaY > threshold && swiper.isBeginning) {
          swiper.slideTo(swiper.slides.length - 1, 260);
          return;
        }
        // Swipe hacia arriba estando en la última -> ir a la primera.
        if (deltaY < -threshold && swiper.isEnd) {
          swiper.slideTo(0, 260);
        }
      },
    },
  });

  if (imagenesGaleria.length > 1) {
    modalSwiper.slideTo(index, 0, false);
  } else {
    modalSwiper.allowTouchMove = false;
    modalSwiper.slideTo(0, 0, false);
  }
}

function cerrarModal() {
  if (modalSwiper?.zoom) {
    try {
      modalSwiper.zoom.out();
    } catch (_) {
      // noop
    }
  }

  destruirModalSwiper();
  modal?.classList.add('hidden');
  document.getElementById('bodyPrincipal')?.classList.remove('overflow-hidden');
}

modal?.addEventListener('click', (e) => {
  if (e.target?.dataset?.modalBackdrop === 'true') {
    cerrarModal();
  }
});

cerrarModalBtn?.addEventListener('click', cerrarModal);

slider?.addEventListener(
  'wheel',
  (event) => {
    if (!modalSwiper || imagenesGaleria.length <= 1 || wheelWrapLocked) return;
    const delta = Number(event?.deltaY || 0);
    if (!delta) return;

    if (delta < 0 && modalSwiper.isBeginning) {
      event.preventDefault();
      wheelWrapLocked = true;
      modalSwiper.slideTo(modalSwiper.slides.length - 1, 240);
      setTimeout(() => { wheelWrapLocked = false; }, 280);
      return;
    }
    if (delta > 0 && modalSwiper.isEnd) {
      event.preventDefault();
      wheelWrapLocked = true;
      modalSwiper.slideTo(0, 240);
      setTimeout(() => { wheelWrapLocked = false; }, 280);
    }
  },
  { passive: false }
);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
    cerrarModal();
  }
});

cargarGaleria();
