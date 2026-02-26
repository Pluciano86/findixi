import { supabase } from '../shared/supabaseClient.js';
import { getPublicBase } from '../shared/utils.js';

const galeriaContenedor = document.getElementById('galeriaImagenes');
const modal = document.getElementById('modalGaleria');
const slider = document.getElementById('sliderModal');

let imagenesGaleria = [];
let imagenActual = 0;
let autoSlideTimer = null;
let handlersInicializados = false;

function limpiarGaleria() {
  if (galeriaContenedor) {
    galeriaContenedor.innerHTML = '';
  }
  imagenesGaleria = [];
  imagenActual = 0;
  if (autoSlideTimer) {
    clearInterval(autoSlideTimer);
    autoSlideTimer = null;
  }
}

function initHandlers() {
  if (handlersInicializados) return;
  handlersInicializados = true;

  modal?.addEventListener('click', (e) => {
    if (e.target.id === 'modalGaleria') {
      cerrarModal();
    }
  });

  document.getElementById('cerrarModal')?.addEventListener('click', cerrarModal);

  slider?.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  });
  slider?.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - startX;
    handleSwipe(diff);
  });
  slider?.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
  });
  slider?.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diff = e.clientX - startX;
    handleSwipe(diff);
  });
}

let startX = 0;
let isDragging = false;

function handleSwipe(diff) {
  const threshold = 50;
  if (diff > threshold && imagenActual > 0) {
    imagenActual--;
  } else if (diff < -threshold && imagenActual < imagenesGaleria.length - 1) {
    imagenActual++;
  }
  updateTransform();
}

function cerrarModal() {
  modal?.classList.add('hidden');
  document.getElementById('bodyLugar')?.classList.remove('overflow-hidden');
}

function updateTransform() {
  if (slider && imagenesGaleria.length > 0) {
    slider.style.transform = `translateX(-${imagenActual * (100 / imagenesGaleria.length)}%)`;
  }
}

function iniciarAutoSlide() {
  if (!galeriaContenedor || imagenesGaleria.length <= 1) return;

  let currentIndex = 0;
  const total = galeriaContenedor.children.length;

  autoSlideTimer = setInterval(() => {
    currentIndex++;
    galeriaContenedor.scrollTo({
      left: galeriaContenedor.clientWidth * currentIndex,
      behavior: 'smooth',
    });

    if (currentIndex === total - 1) {
      setTimeout(() => {
        galeriaContenedor.scrollTo({ left: 0, behavior: 'auto' });
        currentIndex = 0;
      }, 150);
    }
  }, 3200);
}

function buildPublicUrl(rawPath) {
  if (!rawPath) return null;
  if (rawPath.startsWith('http')) return rawPath;

  const sanitized = rawPath.replace(/^public\//i, '');
  const lower = sanitized.toLowerCase();

  if (lower.startsWith('galerialugares/')) {
    const path = sanitized.replace(/^galerialugares\//i, '');
    return supabase.storage.from('galerialugares').getPublicUrl(path).data.publicUrl;
  }

  if (lower.startsWith('galeriacomercios/')) {
    const path = sanitized.replace(/^galeriacomercios\//i, '');
    return getPublicBase(`galeriacomercios/${path}`);
  }

  // Intentar primero galerialugares
  const { data: lugarUrl } = supabase.storage.from('galerialugares').getPublicUrl(sanitized);
  if (lugarUrl?.publicUrl) return lugarUrl.publicUrl;

  return getPublicBase(`galeriacomercios/${sanitized}`);
}

function abrirModal(index) {
  if (!slider || !modal || imagenesGaleria.length === 0) return;

  slider.innerHTML = '';
  slider.style.display = 'flex';
  slider.style.transition = 'transform 0.5s ease';
  slider.style.width = `${imagenesGaleria.length * 100}%`;

  imagenesGaleria.forEach((url) => {
    const img = document.createElement('img');
    img.src = url;
    img.className = 'object-contain flex-shrink-0';
    img.style.width = `${100 / imagenesGaleria.length}%`;
    img.style.maxHeight = '90vh';
    slider.appendChild(img);
  });

  imagenActual = index;
  updateTransform();
  modal.classList.remove('hidden');
  document.getElementById('bodyLugar')?.classList.add('overflow-hidden');
}

export async function cargarGaleriaLugar(idLugar) {
  if (!galeriaContenedor) return;

  limpiarGaleria();
  initHandlers();

  const { data, error } = await supabase
    .from('imagenesLugares')
    .select('imagen')
    .eq('idLugar', idLugar)
    .order('id', { ascending: true });

  if (error) {
    console.error('Error cargando imágenes del lugar:', error);
    return;
  }

  const imagenes = (data || [])
    .map((item) => buildPublicUrl(item.imagen))
    .filter(Boolean);

  if (imagenes.length === 0) {
    const placeholder = document.createElement('img');
    placeholder.src = 'https://placehold.co/800x400?text=Lugar';
    placeholder.alt = 'Imagen no disponible';
    placeholder.className = 'h-64 object-cover w-full';
    galeriaContenedor.appendChild(placeholder);
    return;
  }

  imagenesGaleria = imagenes;

  imagenesGaleria.forEach((url, index) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Imagen del lugar';
    img.className = 'h-64 object-cover w-full cursor-pointer snap-center transition-transform duration-500 ease-in-out';
    img.loading = 'lazy';
    img.addEventListener('click', () => abrirModal(index));
    galeriaContenedor.appendChild(img);
  });

  if (imagenesGaleria.length > 1) {
    const clone = galeriaContenedor.children[0].cloneNode(true);
    galeriaContenedor.appendChild(clone);
    iniciarAutoSlide();
  }
}
