import { supabase } from '../shared/supabaseClient.js';
import { t } from './i18n.js';

function toOrderValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.MAX_SAFE_INTEGER;
  return Math.floor(parsed);
}

function ordenarCategorias(categorias = []) {
  return [...categorias].sort((a, b) => {
    const orderDiff = toOrderValue(a?.orden) - toOrderValue(b?.orden);
    if (orderDiff !== 0) return orderDiff;
    return Number(a?.id || 0) - Number(b?.id || 0);
  });
}

async function initCategoriasIndex() {
  const contenedor = document.getElementById('categoriasContainer');
  const toggleBtn = document.getElementById('toggleCategorias');
  const section = document.getElementById('categoriasSection');
  if (!contenedor || !toggleBtn || !section) return;

  let todasCategorias = [];
  let mostrandoTodas = false;
  let lastScrollY = window.scrollY || window.pageYOffset || 0;

  async function cargarCategorias() {
    const queryAttempts = [
      'id, orden, imagen, nombre, nombre_es, nombre_en, nombre_zh, nombre_fr, nombre_pt, nombre_de, nombre_it, nombre_ko, nombre_ja',
      'id, imagen, nombre, nombre_es, nombre_en, nombre_pt',
      'id, nombre',
    ];

    let data = null;
    let error = null;

    for (const columns of queryAttempts) {
      const result = await supabase
        .from('Categorias')
        .select(columns)
        .order('id', { ascending: true });
      data = result.data;
      error = result.error;
      if (!error) break;
    }

    if (error) {
      console.error('❌ Error cargando categorías:', error);
      contenedor.innerHTML = '';
      toggleBtn.classList.add('hidden');
      return;
    }

    todasCategorias = ordenarCategorias(data || []);
    renderizarCategorias();
  }

  function renderizarCategorias() {
    contenedor.innerHTML = '';

    const categoriasAMostrar = mostrandoTodas ? todasCategorias : todasCategorias.slice(0, 6);
    const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'es')
      .toLowerCase()
      .split('-')[0];
    const col = `nombre_${lang}`;

    categoriasAMostrar.forEach((cat) => {
      const card = document.createElement('a');
      card.href = `listadoComercios.html?idCategoria=${cat.id}`;
      card.className = 'flex flex-col items-center';
      const label = cat[col] || cat.nombre_es || cat.nombre;
      card.innerHTML = `
        <img src="${cat.imagen || 'https://via.placeholder.com/150'}"
             alt="${label}"
             class="rounded-full w-24 h-24 object-cover mb-1">
        <p class="text-gray-700">${label}</p>
      `;
      contenedor.appendChild(card);
    });

    toggleBtn.textContent = mostrandoTodas ? t('home.verMenosCategorias') : t('home.verTodasCategorias');
    toggleBtn.className = 'text-gray-500 text-sm font-medium hover:text-gray-700 mt-2';
  }

  toggleBtn.addEventListener('click', () => {
    mostrandoTodas = !mostrandoTodas;
    renderizarCategorias();
  });

  window.addEventListener(
    'scroll',
    () => {
      if (!mostrandoTodas) {
        lastScrollY = window.scrollY || window.pageYOffset || 0;
        return;
      }

      const currentScrollY = window.scrollY || window.pageYOffset || 0;
      const scrollingDown = currentScrollY > lastScrollY;
      lastScrollY = currentScrollY;

      if (!scrollingDown) return;

      const rect = section.getBoundingClientRect();
      const categoriaYaNoVisible = rect.bottom <= 0;
      if (categoriaYaNoVisible) {
        mostrandoTodas = false;
        renderizarCategorias();
      }
    },
    { passive: true }
  );

  cargarCategorias();
  window.addEventListener('lang:changed', cargarCategorias);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCategoriasIndex, { once: true });
} else {
  initCategoriasIndex();
}
