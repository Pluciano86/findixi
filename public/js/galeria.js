import { supabase } from '../shared/supabaseClient.js';

const idComercio = new URLSearchParams(window.location.search).get('id');
const galeriaContenedor = document.getElementById('galeriaImagenes');
const modal = document.getElementById('modalGaleria');
const slider = document.getElementById('sliderModal');

let imagenesGaleria = [];
let imagenActual = 0;

async function cargarGaleria() {
  const { data, error } = await supabase
    .from('imagenesComercios')
    .select('imagen')
    .eq('idComercio', idComercio)
    .or('logo.is.false,logo.is.null')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error cargando imágenes', error);
    return;
  }

  imagenesGaleria = data.map(i =>
    supabase.storage.from('galeriacomercios').getPublicUrl(i.imagen).data.publicUrl
  );

  imagenesGaleria.forEach((url, index) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Imagen del comercio';
    img.className = 'h-64 object-cover w-full cursor-pointer snap-center transition-transform duration-500 ease-in-out';
    img.onclick = () => abrirModal(index);
    galeriaContenedor.appendChild(img);
  });

  if (imagenesGaleria.length > 0) {
    const clone = galeriaContenedor.children[0].cloneNode(true);
    galeriaContenedor.appendChild(clone);
  }

  iniciarAutoSlide();
}

function iniciarAutoSlide() {
  let currentIndex = 0;
  const total = galeriaContenedor.children.length;

  setInterval(() => {
    currentIndex++;
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

function abrirModal(index) {
  if (!modal || !slider) return;

  slider.innerHTML = '';
  imagenActual = 0;

  slider.style.display = 'flex';
  slider.style.transition = 'transform 0.5s ease';
  slider.style.width = `${imagenesGaleria.length * 100}%`;

  for (let i = 0; i < imagenesGaleria.length; i++) {
    const url = imagenesGaleria[(index + i) % imagenesGaleria.length];
    const img = document.createElement('img');
    img.src = url;
    img.className = 'object-contain flex-shrink-0';
    img.style.width = `${100 / imagenesGaleria.length}%`;
    img.style.maxHeight = '90vh';
    slider.appendChild(img);
  }

  imagenActual = 0;
  updateTransform();
  modal.classList.remove('hidden');
  document.getElementById('bodyPrincipal')?.classList.add('overflow-hidden');
}

function updateTransform() {
  if (slider) {
    slider.style.transform = `translateX(-${imagenActual * (100 / imagenesGaleria.length)}%)`;
  }
}

modal?.addEventListener('click', (e) => {
  if (e.target.id === 'modalGaleria') {
    modal.classList.add('hidden');
    document.getElementById('bodyPrincipal')?.classList.remove('overflow-hidden');
  }
});

document.getElementById('cerrarModal')?.addEventListener('click', () => {
  modal?.classList.add('hidden');
  document.getElementById('bodyPrincipal')?.classList.remove('overflow-hidden');
});

document.getElementById('prevModal')?.addEventListener('click', () => {
  if (imagenActual > 0) imagenActual--;
  updateTransform();
});

document.getElementById('nextModal')?.addEventListener('click', () => {
  if (imagenActual < imagenesGaleria.length - 1) imagenActual++;
  updateTransform();
});

let startX = 0;
let isDragging = false;

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

function handleSwipe(diff) {
  const threshold = 50;
  if (diff > threshold && imagenActual > 0) {
    imagenActual--;
  } else if (diff < -threshold && imagenActual < imagenesGaleria.length - 1) {
    imagenActual++;
  }
  updateTransform();
}

cargarGaleria();
