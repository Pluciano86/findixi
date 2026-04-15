import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/supabaseClient.js';

const STORAGE_BUCKET = 'findixi';
const STORAGE_PUBLIC_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/';
const TRANSLATE_ENDPOINT = `${SUPABASE_URL}/functions/v1/translate-categoria`;

const form = document.getElementById('categoriaForm');
const feedbackEl = document.getElementById('feedback');
const tablaCategorias = document.getElementById('tablaCategorias');
const searchInput = document.getElementById('searchCategoria');

const categoriaIdInput = document.getElementById('categoriaId');
const nombreEsInput = document.getElementById('nombreEs');
const slugInput = document.getElementById('slug');
const tipoPerfilInput = document.getElementById('tipoPerfil');
const ordenInput = document.getElementById('orden');
const colorHexInput = document.getElementById('colorHex');
const iconoInput = document.getElementById('icono');
const imagenInput = document.getElementById('imagen');
const imagenFileInput = document.getElementById('imagenFile');
const traducirAutoInput = document.getElementById('traducirAuto');

const nombreEnInput = document.getElementById('nombreEn');
const nombreZhInput = document.getElementById('nombreZh');
const nombreFrInput = document.getElementById('nombreFr');
const nombrePtInput = document.getElementById('nombrePt');
const nombreDeInput = document.getElementById('nombreDe');
const nombreItInput = document.getElementById('nombreIt');
const nombreKoInput = document.getElementById('nombreKo');
const nombreJaInput = document.getElementById('nombreJa');

const btnGuardar = document.getElementById('btnGuardar');
const btnLimpiar = document.getElementById('btnLimpiar');
const btnTraducir = document.getElementById('btnTraducir');
const btnSubirImagen = document.getElementById('btnSubirImagen');

let categorias = [];
let schemaHasTipoPerfil = true;
let schemaHasOrden = true;

let draggedRowId = null;
let dragStartOrder = [];
let isPersistingOrder = false;

function toNull(value) {
  const clean = String(value ?? '').trim();
  return clean ? clean : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeHexColor(value) {
  const clean = String(value || '').trim();
  if (!clean) return null;
  const withHash = clean.startsWith('#') ? clean : `#${clean}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : null;
}

function parseOrden(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num <= 0) return null;
  return Math.floor(num);
}

function compareByOrden(a, b) {
  const aOrden = parseOrden(a?.orden) ?? Number.MAX_SAFE_INTEGER;
  const bOrden = parseOrden(b?.orden) ?? Number.MAX_SAFE_INTEGER;
  if (aOrden !== bOrden) return aOrden - bOrden;
  return Number(a?.id || 0) - Number(b?.id || 0);
}

function sortCategorias(list = []) {
  return [...list].sort(compareByOrden);
}

function setFeedback(message, type = 'info') {
  if (!feedbackEl) return;
  feedbackEl.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'bg-emerald-50', 'text-emerald-700', 'bg-sky-50', 'text-sky-700');
  if (type === 'error') {
    feedbackEl.classList.add('bg-red-50', 'text-red-700');
  } else if (type === 'success') {
    feedbackEl.classList.add('bg-emerald-50', 'text-emerald-700');
  } else {
    feedbackEl.classList.add('bg-sky-50', 'text-sky-700');
  }
  feedbackEl.textContent = message;
}

function clearFeedback() {
  if (!feedbackEl) return;
  feedbackEl.classList.add('hidden');
  feedbackEl.textContent = '';
}

function setLoading(button, loadingText) {
  if (!button) return () => {};
  const prev = button.textContent;
  button.disabled = true;
  button.textContent = loadingText;
  return () => {
    button.disabled = false;
    button.textContent = prev;
  };
}

function getCurrentFormId() {
  const raw = Number(categoriaIdInput?.value || 0);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function clearForm() {
  form?.reset();
  categoriaIdInput.value = '';
  tipoPerfilInput.value = 'menu';
  if (ordenInput) ordenInput.value = '';
  btnGuardar.textContent = 'Guardar categoría';
  clearFeedback();
}

function fillTranslationFields(row, { onlyEmpty = false } = {}) {
  const mapping = [
    [nombreEnInput, row?.nombre_en],
    [nombreZhInput, row?.nombre_zh],
    [nombreFrInput, row?.nombre_fr],
    [nombrePtInput, row?.nombre_pt],
    [nombreDeInput, row?.nombre_de],
    [nombreItInput, row?.nombre_it],
    [nombreKoInput, row?.nombre_ko],
    [nombreJaInput, row?.nombre_ja],
  ];

  mapping.forEach(([input, value]) => {
    if (!input) return;
    if (onlyEmpty && String(input.value || '').trim()) return;
    input.value = String(value || '').trim();
  });
}

function mapCategoriaRow(row) {
  return {
    ...row,
    tipo_perfil: ['menu', 'servicios', 'tienda'].includes(String(row?.tipo_perfil || '').toLowerCase())
      ? String(row.tipo_perfil).toLowerCase()
      : 'menu',
    nombre_es: row?.nombre_es || row?.nombre || '',
    orden: parseOrden(row?.orden),
  };
}

function getDomOrderedIds() {
  return Array.from(tablaCategorias?.querySelectorAll('tr[data-id]') || [])
    .map((row) => Number(row.getAttribute('data-id')))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function arraysEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Number(a[i]) !== Number(b[i])) return false;
  }
  return true;
}

function renderTabla() {
  if (!tablaCategorias) return;

  const filter = normalizeText(searchInput?.value || '');
  const canReorder = schemaHasOrden && !filter;

  const rows = sortCategorias(categorias).filter((cat) => {
    if (!filter) return true;
    const haystack = [cat.nombre, cat.nombre_es, cat.slug].map((v) => normalizeText(v)).join(' ');
    return haystack.includes(filter);
  });

  if (!rows.length) {
    tablaCategorias.innerHTML = '<tr><td colspan="8" class="px-3 py-6 text-center text-gray-500">No hay categorías para mostrar.</td></tr>';
    return;
  }

  tablaCategorias.innerHTML = rows
    .map((cat) => {
      const imagePreview = cat.imagen
        ? `<img src="${escapeHtml(cat.imagen)}" alt="${escapeHtml(cat.nombre_es || cat.nombre || 'Categoria')}" class="w-12 h-12 rounded-full object-cover border border-gray-200" loading="lazy" />`
        : '<div class="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-400">—</div>';

      return `
        <tr data-id="${cat.id}" draggable="${canReorder ? 'true' : 'false'}" class="${canReorder ? 'cursor-move' : ''}">
          <td class="px-3 py-2 text-center">
            <button type="button" data-drag-handle class="inline-flex items-center justify-center w-7 h-7 rounded ${canReorder ? 'text-gray-500 hover:bg-gray-100 cursor-grab' : 'text-gray-300 cursor-not-allowed'}" ${canReorder ? '' : 'disabled'} title="Arrastrar para reordenar">
              <i class="fa-solid fa-grip-vertical"></i>
            </button>
          </td>
          <td class="px-3 py-2">${cat.id}</td>
          <td class="px-3 py-2 text-gray-700">${cat.orden ?? '—'}</td>
          <td class="px-3 py-2 font-medium text-gray-900">${escapeHtml(cat.nombre_es || cat.nombre || '—')}</td>
          <td class="px-3 py-2 text-gray-600">${escapeHtml(cat.slug || '—')}</td>
          <td class="px-3 py-2">
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs ${
              cat.tipo_perfil === 'servicios'
                ? 'bg-fuchsia-100 text-fuchsia-700'
                : cat.tipo_perfil === 'tienda'
                  ? 'bg-cyan-100 text-cyan-700'
                  : 'bg-emerald-100 text-emerald-700'
            }">
              ${escapeHtml(cat.tipo_perfil || 'menu')}
            </span>
          </td>
          <td class="px-3 py-2">${imagePreview}</td>
          <td class="px-3 py-2">
            <div class="flex justify-center gap-2">
              <button data-action="up" data-id="${cat.id}" class="px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs" title="Mover arriba">↑</button>
              <button data-action="down" data-id="${cat.id}" class="px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs" title="Mover abajo">↓</button>
              <button data-action="edit" data-id="${cat.id}" class="px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs">Editar</button>
              <button data-action="delete" data-id="${cat.id}" class="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 text-xs">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function ensureSession() {
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user) {
    window.location.href = './login.html';
    return false;
  }
  return true;
}

async function fetchCategoriasWithFallback() {
  const baseSelect = 'id, nombre, imagen, color_hex, icono, slug, nombre_es, nombre_en, nombre_zh, nombre_fr, nombre_pt, nombre_de, nombre_it, nombre_ko, nombre_ja';

  const attempts = [
    { select: `${baseSelect}, tipo_perfil, orden`, hasTipo: true, hasOrden: true },
    { select: `${baseSelect}, tipo_perfil`, hasTipo: true, hasOrden: false },
    { select: `${baseSelect}, orden`, hasTipo: false, hasOrden: true },
    { select: baseSelect, hasTipo: false, hasOrden: false },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    const result = await supabase
      .from('Categorias')
      .select(attempt.select)
      .order('id', { ascending: true });

    if (!result.error) {
      schemaHasTipoPerfil = attempt.hasTipo;
      schemaHasOrden = attempt.hasOrden;
      return result;
    }

    lastError = result.error;
  }

  return { data: null, error: lastError };
}

function buildSchemaWarnings() {
  const warnings = [];
  if (!schemaHasTipoPerfil) warnings.push('falta la columna tipo_perfil');
  if (!schemaHasOrden) warnings.push('falta la columna orden');
  if (!warnings.length) return '';
  return `Aviso: ${warnings.join(' y ')} en Categorias. Aplica migraciones para habilitar todo el módulo.`;
}

async function cargarCategorias() {
  const { data, error } = await fetchCategoriasWithFallback();
  if (error) {
    console.error('Error cargando categorías:', error);
    setFeedback('No se pudieron cargar las categorías.', 'error');
    categorias = [];
    renderTabla();
    return;
  }

  categorias = sortCategorias((data || []).map(mapCategoriaRow));
  renderTabla();

  const warn = buildSchemaWarnings();
  if (warn) setFeedback(warn, 'info');
}

function setFormFromCategoria(cat) {
  categoriaIdInput.value = String(cat.id || '');
  nombreEsInput.value = cat.nombre_es || cat.nombre || '';
  slugInput.value = cat.slug || '';
  tipoPerfilInput.value = cat.tipo_perfil || 'menu';
  if (ordenInput) ordenInput.value = cat.orden ?? '';
  colorHexInput.value = cat.color_hex || '';
  iconoInput.value = cat.icono || '';
  imagenInput.value = cat.imagen || '';

  fillTranslationFields(cat, { onlyEmpty: false });
  btnGuardar.textContent = 'Actualizar categoría';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getNextOrden() {
  const maxOrden = categorias.reduce((max, item) => {
    const value = parseOrden(item?.orden) || 0;
    return Math.max(max, value);
  }, 0);
  return maxOrden + 1;
}

function buildPayloadFromForm() {
  const nombreEs = String(nombreEsInput.value || '').trim();
  const slug = String(slugInput.value || '').trim() || slugify(nombreEs);
  const colorHex = normalizeHexColor(colorHexInput.value);

  const payload = {
    nombre: nombreEs,
    nombre_es: nombreEs,
    slug: toNull(slug),
    imagen: toNull(imagenInput.value),
    color_hex: colorHex,
    icono: toNull(iconoInput.value),
    nombre_en: toNull(nombreEnInput.value),
    nombre_zh: toNull(nombreZhInput.value),
    nombre_fr: toNull(nombreFrInput.value),
    nombre_pt: toNull(nombrePtInput.value),
    nombre_de: toNull(nombreDeInput.value),
    nombre_it: toNull(nombreItInput.value),
    nombre_ko: toNull(nombreKoInput.value),
    nombre_ja: toNull(nombreJaInput.value),
  };

  if (schemaHasTipoPerfil) {
    const selected = String(tipoPerfilInput.value || 'menu').trim().toLowerCase();
    payload.tipo_perfil = ['menu', 'servicios', 'tienda'].includes(selected) ? selected : 'menu';
  }

  return payload;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildOrderedIdsWithTargetPosition(targetId, desiredOrden, baseCategorias = []) {
  const orderedIds = sortCategorias(baseCategorias).map((item) => Number(item.id));
  const filtered = orderedIds.filter((id) => id !== Number(targetId));
  const safeIndex = clamp((parseOrden(desiredOrden) || 1) - 1, 0, filtered.length);
  filtered.splice(safeIndex, 0, Number(targetId));
  return filtered;
}

async function getAuthTokenForFunctionCall() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || SUPABASE_ANON_KEY;
}

async function traducirCategoria(nombreEs) {
  const token = await getAuthTokenForFunctionCall();

  const response = await fetch(TRANSLATE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ nombre_es: nombreEs }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = await response.json();
  if (!json?.ok) {
    throw new Error(json?.error || 'No se pudo traducir la categoría.');
  }

  return json.data || null;
}

async function handleTraducir({ onlyEmpty = false } = {}) {
  const nombreEs = String(nombreEsInput.value || '').trim();
  if (!nombreEs) {
    setFeedback('Primero escribe el nombre en español para traducir.', 'error');
    return null;
  }

  const restore = setLoading(btnTraducir, 'Traduciendo...');
  try {
    const traducciones = await traducirCategoria(nombreEs);
    if (!traducciones) {
      setFeedback('No se recibieron traducciones.', 'error');
      return null;
    }

    fillTranslationFields(traducciones, { onlyEmpty });
    setFeedback('Traducciones aplicadas correctamente.', 'success');
    return traducciones;
  } catch (error) {
    console.error('Error traduciendo categoría:', error);
    setFeedback('Error al traducir con OpenAI.', 'error');
    return null;
  } finally {
    restore();
  }
}

async function handleSubirImagen() {
  const file = imagenFileInput?.files?.[0];
  if (!file) {
    setFeedback('Selecciona una imagen para subir.', 'error');
    return;
  }

  const restore = setLoading(btnSubirImagen, 'Subiendo...');

  try {
    const nombreEs = String(nombreEsInput.value || '').trim();
    const slug = String(slugInput.value || '').trim() || slugify(nombreEs || 'categoria');
    if (!slugInput.value.trim()) slugInput.value = slug;

    const safeName = String(file.name || 'imagen')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `categorias/${slug}/${Date.now()}_${safeName}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
      });

    if (error) throw error;

    const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    const publicUrl = publicData?.publicUrl || `${STORAGE_PUBLIC_BASE}${path}`;

    imagenInput.value = publicUrl;
    setFeedback('Imagen subida correctamente al bucket findixi.', 'success');
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    setFeedback('No se pudo subir la imagen.', 'error');
  } finally {
    restore();
  }
}

async function handleSave(event) {
  event.preventDefault();
  clearFeedback();

  const nombreEs = String(nombreEsInput.value || '').trim();
  if (!nombreEs) {
    setFeedback('El nombre en español es obligatorio.', 'error');
    return;
  }

  if (!slugInput.value.trim()) {
    slugInput.value = slugify(nombreEs);
  }

  const desiredOrden = parseOrden(ordenInput?.value);

  if (traducirAutoInput?.checked) {
    await handleTraducir({ onlyEmpty: true });
  }

  const id = getCurrentFormId();
  const payload = buildPayloadFromForm();
  const restore = setLoading(btnGuardar, id ? 'Actualizando...' : 'Guardando...');

  try {
    if (id) {
      const { error } = await supabase
        .from('Categorias')
        .update(payload)
        .eq('id', id);
      if (error) throw error;

      if (schemaHasOrden && desiredOrden) {
        const reorderedIds = buildOrderedIdsWithTargetPosition(id, desiredOrden, categorias);
        await guardarOrdenActual(reorderedIds);
      }

      setFeedback('Categoría actualizada.', 'success');
    } else {
      const insertPayload = { ...payload };
      if (schemaHasOrden) {
        insertPayload.orden = getNextOrden();
      }

      const { data: inserted, error } = await supabase
        .from('Categorias')
        .insert(insertPayload)
        .select('id')
        .maybeSingle();
      if (error) throw error;

      const createdId = Number(inserted?.id);
      if (schemaHasOrden && Number.isFinite(createdId) && createdId > 0 && desiredOrden) {
        const reorderedIds = buildOrderedIdsWithTargetPosition(createdId, desiredOrden, categorias);
        await guardarOrdenActual(reorderedIds);
      }

      setFeedback('Categoría creada.', 'success');
    }

    await cargarCategorias();
    clearForm();
  } catch (error) {
    console.error('Error guardando categoría:', error);
    setFeedback(`No se pudo guardar la categoría: ${error?.message || 'error desconocido'}`, 'error');
  } finally {
    restore();
  }
}

async function handleDelete(id) {
  const categoria = categorias.find((row) => Number(row.id) === Number(id));
  const label = categoria?.nombre_es || categoria?.nombre || `ID ${id}`;
  const confirmar = window.confirm(`¿Eliminar la categoría "${label}"?`);
  if (!confirmar) return;

  try {
    const { error } = await supabase.from('Categorias').delete().eq('id', id);
    if (error) throw error;

    setFeedback('Categoría eliminada.', 'success');
    if (Number(categoriaIdInput.value) === Number(id)) {
      clearForm();
    }
    await cargarCategorias();
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    setFeedback(`No se pudo eliminar la categoría: ${error?.message || 'error desconocido'}`, 'error');
  }
}

async function guardarOrdenActual(orderedIds) {
  if (!schemaHasOrden) return;

  const updates = orderedIds.map((id, index) => ({ id, orden: index + 1 }));
  const results = await Promise.all(
    updates.map((item) =>
      supabase
        .from('Categorias')
        .update({ orden: item.orden })
        .eq('id', item.id)
    )
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw failed.error;
  }

  const mapById = new Map(categorias.map((item) => [Number(item.id), item]));
  categorias = updates
    .map((item) => {
      const base = mapById.get(Number(item.id));
      if (!base) return null;
      return { ...base, orden: item.orden };
    })
    .filter(Boolean);
}

async function reorderByButtons(id, direction) {
  if (!schemaHasOrden) {
    setFeedback('No puedes reordenar porque falta la columna orden.', 'error');
    return;
  }

  const ordered = sortCategorias(categorias);
  const index = ordered.findIndex((row) => Number(row.id) === Number(id));
  if (index === -1) return;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) return;

  const swapped = [...ordered];
  const temp = swapped[index];
  swapped[index] = swapped[targetIndex];
  swapped[targetIndex] = temp;

  const orderedIds = swapped.map((row) => Number(row.id));
  try {
    await guardarOrdenActual(orderedIds);
    await cargarCategorias();
    setFeedback('Orden actualizado y sincronizado con la base de datos.', 'success');
  } catch (error) {
    console.error('Error actualizando orden:', error);
    setFeedback(`No se pudo actualizar el orden: ${error?.message || 'error desconocido'}`, 'error');
  }
}

function getDragRowFromEvent(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return null;
  const row = target.closest('tr[data-id]');
  if (!(row instanceof HTMLTableRowElement)) return null;
  return row;
}

function handleDragStart(event) {
  const row = getDragRowFromEvent(event);
  if (!row) return;

  if (row.getAttribute('draggable') !== 'true') {
    event.preventDefault();
    return;
  }

  const id = Number(row.getAttribute('data-id'));
  if (!Number.isFinite(id)) {
    event.preventDefault();
    return;
  }

  draggedRowId = id;
  dragStartOrder = getDomOrderedIds();

  row.classList.add('opacity-50');

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(id));
  }
}

function handleDragOver(event) {
  if (!draggedRowId || isPersistingOrder) return;

  const targetRow = getDragRowFromEvent(event);
  if (!targetRow || targetRow.getAttribute('draggable') !== 'true') return;

  const sourceRow = tablaCategorias.querySelector(`tr[data-id="${draggedRowId}"]`);
  if (!(sourceRow instanceof HTMLTableRowElement)) return;
  if (sourceRow === targetRow) return;

  event.preventDefault();

  const rect = targetRow.getBoundingClientRect();
  const placeAfter = event.clientY > rect.top + rect.height / 2;

  if (placeAfter) {
    if (targetRow.nextElementSibling !== sourceRow) {
      targetRow.parentNode?.insertBefore(sourceRow, targetRow.nextElementSibling);
    }
  } else {
    if (targetRow.previousElementSibling !== sourceRow) {
      targetRow.parentNode?.insertBefore(sourceRow, targetRow);
    }
  }
}

async function handleDrop(event) {
  if (!draggedRowId || isPersistingOrder) return;
  event.preventDefault();

  const filter = normalizeText(searchInput?.value || '');
  if (filter) {
    setFeedback('Para reordenar, limpia el buscador y vuelve a arrastrar.', 'info');
    return;
  }

  const currentOrder = getDomOrderedIds();
  if (!currentOrder.length || arraysEqual(dragStartOrder, currentOrder)) return;

  isPersistingOrder = true;

  try {
    await guardarOrdenActual(currentOrder);
    await cargarCategorias();
    setFeedback('Orden actualizado y sincronizado con la base de datos.', 'success');
  } catch (error) {
    console.error('Error guardando orden:', error);
    setFeedback(`No se pudo guardar el orden de categorías: ${error?.message || 'error desconocido'}`, 'error');
    await cargarCategorias();
  } finally {
    isPersistingOrder = false;
  }
}

function handleDragEnd() {
  if (draggedRowId) {
    const row = tablaCategorias.querySelector(`tr[data-id="${draggedRowId}"]`);
    if (row) row.classList.remove('opacity-50');
  }
  draggedRowId = null;
  dragStartOrder = [];
}

function bindEvents() {
  form?.addEventListener('submit', handleSave);

  btnLimpiar?.addEventListener('click', () => {
    clearForm();
    setFeedback('Formulario limpiado.', 'info');
  });

  nombreEsInput?.addEventListener('input', () => {
    if (!slugInput.value.trim()) {
      slugInput.value = slugify(nombreEsInput.value);
    }
  });

  btnTraducir?.addEventListener('click', () => {
    void handleTraducir({ onlyEmpty: false });
  });

  btnSubirImagen?.addEventListener('click', () => {
    void handleSubirImagen();
  });

  searchInput?.addEventListener('input', () => {
    renderTabla();
  });

  tablaCategorias?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const actionButton = target.closest('button[data-action]');
    if (!(actionButton instanceof HTMLButtonElement)) return;

    const action = actionButton.dataset.action;
    const id = Number(actionButton.dataset.id);
    if (!Number.isFinite(id)) return;

    if (action === 'edit') {
      const categoria = categorias.find((row) => Number(row.id) === id);
      if (!categoria) return;
      setFormFromCategoria(categoria);
      clearFeedback();
      return;
    }

    if (action === 'up') {
      void reorderByButtons(id, 'up');
      return;
    }

    if (action === 'down') {
      void reorderByButtons(id, 'down');
      return;
    }

    if (action === 'delete') {
      void handleDelete(id);
    }
  });

  tablaCategorias?.addEventListener('dragstart', handleDragStart);
  tablaCategorias?.addEventListener('dragover', handleDragOver);
  tablaCategorias?.addEventListener('drop', (event) => {
    void handleDrop(event);
  });
  tablaCategorias?.addEventListener('dragend', handleDragEnd);
}

async function init() {
  const sessionOk = await ensureSession();
  if (!sessionOk) return;

  bindEvents();
  await cargarCategorias();
}

await init();
