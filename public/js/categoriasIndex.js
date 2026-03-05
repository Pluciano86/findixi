import { supabase } from '../shared/supabaseClient.js';
import { t } from './i18n.js';

async function initCategoriasIndex() {
  const contenedor = document.getElementById('categoriasContainer');
  const toggleBtn = document.getElementById('toggleCategorias');
  const section = document.getElementById('categoriasSection');
  if (!contenedor || !toggleBtn || !section) return;

  let todasCategorias = [];
  let mostrandoTodas = false;

  // 🔹 Orden personalizado de categorías
  const ordenPersonalizado = [
    "Restaurantes",
    "Coffee Shops",
    "Jangueo",
    "Antojitos Dulces",
    "Food Trucks",
    "Dispensarios",
    "Panaderías",
    "Playground",
    "Bares"
  ];

  // 🔹 Cargar categorías desde Supabase
  async function cargarCategorias() {
    const queryAttempts = [
      'id, imagen, nombre, nombre_es, nombre_en, nombre_zh, nombre_fr, nombre_pt, nombre_de, nombre_it, nombre_ko, nombre_ja',
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

    // 🧩 Aplicar el orden personalizado
    todasCategorias = (data || []).sort((a, b) => {
      // Ordenar siempre según el nombre en español para mantener el orden original,
      // pero luego se renderiza usando el label del idioma activo.
      const baseA = a.nombre_es || a.nombre;
      const baseB = b.nombre_es || b.nombre;
      const indexA = ordenPersonalizado.indexOf(baseA);
      const indexB = ordenPersonalizado.indexOf(baseB);

      // Si alguna categoría no está en la lista, se manda al final
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    renderizarCategorias();
  }

  // 🔹 Renderizar categorías
  function renderizarCategorias() {
    contenedor.innerHTML = '';

    const categoriasAMostrar = mostrandoTodas ? todasCategorias : todasCategorias.slice(0, 6);
    const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'es')
      .toLowerCase()
      .split('-')[0];
    const col = `nombre_${lang}`;

    categoriasAMostrar.forEach(cat => {
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

    // 🔸 Cambiar texto y color del botón
    toggleBtn.textContent = mostrandoTodas ? t('home.verMenosCategorias') : t('home.verTodasCategorias');
    toggleBtn.className = 'text-gray-500 text-sm font-medium hover:text-gray-700 mt-2';
  }

  // 🔹 Alternar entre ver todas / solo las principales
  toggleBtn.addEventListener('click', () => {
    mostrandoTodas = !mostrandoTodas;
    renderizarCategorias();
  });

  // 🔹 Ocultar al pasar la sección con scroll
  window.addEventListener('scroll', () => {
    const rect = section.getBoundingClientRect();
    const visible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!visible && mostrandoTodas) {
      mostrandoTodas = false;
      renderizarCategorias();
    }
  });

  cargarCategorias();
  window.addEventListener('lang:changed', cargarCategorias);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCategoriasIndex, { once: true });
} else {
  initCategoriasIndex();
}
