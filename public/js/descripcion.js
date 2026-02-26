import { supabase } from '../shared/supabaseClient.js';
import { getLang, t } from './i18n.js';
import { getComercioDescripcionI18n } from '../shared/comercioI18n.js';

const idComercio = new URLSearchParams(window.location.search).get('id');

let comercioBase = null;

async function cargarDescripcion() {
  if (!comercioBase) {
    const { data, error } = await supabase
      .from('Comercios')
      .select('nombre, descripcion')
      .eq('id', idComercio)
      .single();

    if (error || !data) {
      console.error('Error cargando descripción:', error);
      return;
    }
    comercioBase = data;
  }

  const descripcionEl = document.getElementById('descripcionTexto');
  const toggleBtn = document.getElementById('toggleDescripcion');

  if (!descripcionEl || !toggleBtn) return;

  const lang = getLang();
  let descripcionTexto = comercioBase.descripcion || '';
  if (lang && lang !== 'es') {
    const traducida = await getComercioDescripcionI18n(idComercio, lang);
    if (traducida) descripcionTexto = traducida;
  }

  const descripcion = String(descripcionTexto || '').replace(/\n/g, '<br>');

  // Mostrar todo como un solo párrafo
  descripcionEl.innerHTML = `
  <span class="text-base leading-relaxed">
    <span class="font-light">${descripcion}</span>
  </span>
`;

  let expandido = false;

  toggleBtn.addEventListener('click', () => {
    expandido = !expandido;
    descripcionEl.classList.toggle('line-clamp-5', !expandido);
    toggleBtn.textContent = expandido
      ? t('perfilComercio.ocultarInfo')
      : t('perfilComercio.verInfo');
  });
}

document.addEventListener('DOMContentLoaded', cargarDescripcion);
window.addEventListener('lang:changed', cargarDescripcion);
