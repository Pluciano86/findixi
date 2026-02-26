import { supabase } from '../shared/supabaseClient.js';
import { t } from './i18n.js';

const state = { areas: [] };

function getLang() {
  return localStorage.getItem('lang') || document.documentElement.lang || 'es';
}

function getAreaLabel(area) {
  const lang = getLang().toLowerCase();
  const col = `nombre_${lang}`;
  return area?.[col] || area?.nombre_es || '';
}

function renderAreas(container) {
  container.innerHTML = '';

  state.areas.forEach((area) => {
    const label = getAreaLabel(area);
    const imgSrc = area.imagen || 'https://via.placeholder.com/500x360?text=Area';

    const card = document.createElement('a');
    card.href = `listadoArea.html?idArea=${area.idArea}`;
    card.className = 'block';
    card.innerHTML = `
      <div class="relative rounded-xl overflow-hidden cursor-pointer">
        <img class="w-full h-full object-cover" src="${imgSrc}" alt="${label}">
        <div class="absolute inset-0 bg-black/30"></div>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
          <div data-area-id="${area.idArea}" class="text-white text-3xl font-semibold tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">${label}</div>
          ${
            area.slug === 'metro'
              ? `<div data-area-subtitle="metro" class="mt-1 text-white/95 text-sm font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">${t('home.area.metroSubtitle')}</div>`
              : ''
          }
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function updateLabels() {
  document.querySelectorAll('[data-area-id]').forEach((el) => {
    const id = Number(el.getAttribute('data-area-id'));
    const area = state.areas.find((a) => a.idArea === id);
    if (!area) return;
    el.textContent = getAreaLabel(area);
  });

  const subtitle = document.querySelector('[data-area-subtitle="metro"]');
  if (subtitle) subtitle.textContent = t('home.area.metroSubtitle');
}

async function loadAreas(container) {
  const { data, error } = await supabase
    .from('Area')
    .select(`
      idArea,
      slug,
      imagen,
      nombre_es,
      nombre_en,
      nombre_fr,
      nombre_pt,
      nombre_de,
      nombre_it,
      nombre_zh,
      nombre_ko,
      nombre_ja
    `);

  if (error) {
    console.error('Error cargando áreas', error);
    return;
  }

  const esIslasMunicipio = (area = {}) => {
    const bySlug = (area.slug || '').toLowerCase() === 'islas-municipio';
    const byNombre = (area.nombre_es || area.nombre || '').toLowerCase() === 'islas municipio';
    return bySlug || byNombre;
  };

  state.areas = (data || []).filter((area) => !esIslasMunicipio(area));

  // Mezclar orden de áreas aleatoriamente
  state.areas.sort(() => Math.random() - 0.5);
  renderAreas(container);
}

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('areasGrid');
  if (!container) return;

  await loadAreas(container);

  window.addEventListener('lang:changed', updateLabels);
});
