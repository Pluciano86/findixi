import { supabase } from '../shared/supabaseClient.js';

const MODAL_ROOT_ID = 'adminModalRoot';
const CATEGORIAS_BUCKET = 'categorias';

function getModalRoot() {
  return document.getElementById(MODAL_ROOT_ID) || document.body;
}

function createOverlay({ title, content }) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4';

  overlay.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-800">${title}</h2>
        <button type="button" class="text-gray-500 hover:text-gray-700" data-modal-close>
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="p-4 space-y-4">
        ${content}
        <div class="text-sm text-gray-500 hidden" data-modal-feedback></div>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    if (event.target.dataset.modalClose !== undefined || event.target === overlay) {
      overlay.remove();
    }
  });

  return overlay;
}

function showFeedback(container, message, type = 'success') {
  if (!container) return;
  container.classList.remove('hidden', 'text-red-600', 'text-green-600');
  container.classList.add(type === 'error' ? 'text-red-600' : 'text-green-600');
  container.textContent = message;
}

function resetFeedback(container) {
  if (!container) return;
  container.classList.add('hidden');
  container.textContent = '';
}

function generarNombreUnico(prefijo, extension) {
  const base = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefijo}_${Date.now()}_${base}.${extension}`;
}

function obtenerExtension(nombreArchivo = '') {
  const partes = String(nombreArchivo).split('.');
  if (partes.length <= 1) return 'jpg';
  return partes.pop().toLowerCase() || 'jpg';
}

async function verificarCategoriaDuplicada(nombre) {
  const { data, error } = await supabase
    .from('Categorias')
    .select('id, nombre')
    .ilike('nombre', nombre.trim())
    .maybeSingle();

  if (error) {
    console.error('Error verificando duplicados de categoría:', error);
    return false;
  }

  return Boolean(data);
}

async function verificarSubcategoriaDuplicada(nombre, idCategoria) {
  const { data, error } = await supabase
    .from('subCategoria')
    .select('id')
    .eq('idCategoria', idCategoria)
    .ilike('nombre', nombre.trim())
    .maybeSingle();

  if (error) {
    console.error('Error verificando duplicados de subcategoría:', error);
    return false;
  }

  return Boolean(data);
}

async function subirImagenCategoria(archivo) {
  if (!archivo) return null;
  const extension = obtenerExtension(archivo.name);
  const nombre = generarNombreUnico('categoria', extension);

  const { error } = await supabase
    .storage
    .from(CATEGORIAS_BUCKET)
    .upload(nombre, archivo, {
      cacheControl: '3600',
      upsert: true,
      contentType: archivo.type || 'image/jpeg'
    });

  if (error) {
    console.error('Error subiendo imagen de categoría:', error);
    throw new Error('No se pudo subir la imagen.');
  }

  return nombre;
}

export function abrirModalNuevaCategoria({ onCreated } = {}) {
  const overlay = createOverlay({
    title: 'Nueva Categoría',
    content: `
      <form id="formNuevaCategoria" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="nombreCategoria">Nombre</label>
          <input id="nombreCategoria" type="text" class="w-full border rounded px-3 py-2" placeholder="Ej. Comida Criolla" required />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="colorCategoria">Color</label>
          <input id="colorCategoria" type="color" value="#0ea5e9" class="w-16 h-10 border rounded" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="imagenCategoria">Imagen (opcional)</label>
          <input id="imagenCategoria" type="file" accept="image/*" class="w-full border rounded px-3 py-2" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800" data-modal-close>Cancelar</button>
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Guardar</button>
        </div>
      </form>
    `
  });

  const modalRoot = getModalRoot();
  modalRoot.appendChild(overlay);

  const form = overlay.querySelector('#formNuevaCategoria');
  const feedback = overlay.querySelector('[data-modal-feedback]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetFeedback(feedback);

    const formData = new FormData(form);
    const nombre = (formData.get('nombreCategoria') || '').toString().trim();
    const color = (formData.get('colorCategoria') || '#0ea5e9').toString();
    const archivo = formData.get('imagenCategoria');

    if (!nombre) {
      showFeedback(feedback, 'El nombre es obligatorio.', 'error');
      return;
    }

    try {
      const duplicada = await verificarCategoriaDuplicada(nombre);
      if (duplicada) {
        showFeedback(feedback, 'Ya existe una categoría con ese nombre.', 'error');
        return;
      }

      let imagenPath = null;
      if (archivo && archivo.size > 0) {
        imagenPath = await subirImagenCategoria(archivo);
      }

      const { data, error } = await supabase
        .from('Categorias')
        .insert({
          nombre,
          color,
          imagen: imagenPath
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error insertando categoría:', error);
        showFeedback(feedback, 'Ocurrió un error al guardar la categoría.', 'error');
        return;
      }

      showFeedback(feedback, 'Categoría creada correctamente.', 'success');
      document.dispatchEvent(new CustomEvent('categoria-creada', { detail: data }));
      onCreated?.(data);

      setTimeout(() => overlay.remove(), 900);
    } catch (err) {
      console.error('Error al crear categoría:', err);
      showFeedback(feedback, err.message || 'No se pudo crear la categoría.', 'error');
    }
  });
}

export async function abrirModalNuevaSubcategoria({ onCreated } = {}) {
  const { data: categorias, error } = await supabase
    .from('Categorias')
    .select('id, nombre')
    .order('nombre');

  if (error) {
    console.error('Error cargando categorías para subcategorías:', error);
    alert('No se pudieron cargar las categorías. Intenta nuevamente.');
    return;
  }

  if (!categorias || !categorias.length) {
    alert('Primero crea al menos una categoría.');
    return;
  }

  const options = categorias
    .map(cat => `<option value="${cat.id}">${cat.nombre}</option>`)
    .join('');

  const overlay = createOverlay({
    title: 'Nueva Subcategoría',
    content: `
      <form id="formNuevaSubcategoria" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="nombreSubcategoria">Nombre</label>
          <input id="nombreSubcategoria" type="text" class="w-full border rounded px-3 py-2" placeholder="Ej. Postres" required />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="categoriaPadre">Categoría padre</label>
          <select id="categoriaPadre" class="w-full border rounded px-3 py-2" required>
            <option value="">Selecciona una categoría</option>
            ${options}
          </select>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800" data-modal-close>Cancelar</button>
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Guardar</button>
        </div>
      </form>
    `
  });

  const modalRoot = getModalRoot();
  modalRoot.appendChild(overlay);

  const form = overlay.querySelector('#formNuevaSubcategoria');
  const feedback = overlay.querySelector('[data-modal-feedback]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetFeedback(feedback);

    const nombre = (form.nombreSubcategoria.value || '').trim();
    const idCategoria = Number.parseInt(form.categoriaPadre.value, 10);

    if (!nombre) {
      showFeedback(feedback, 'El nombre es obligatorio.', 'error');
      return;
    }

    if (!Number.isFinite(idCategoria)) {
      showFeedback(feedback, 'Selecciona una categoría padre válida.', 'error');
      return;
    }

    try {
      const duplicada = await verificarSubcategoriaDuplicada(nombre, idCategoria);
      if (duplicada) {
        showFeedback(feedback, 'Ya existe una subcategoría con ese nombre en la categoría seleccionada.', 'error');
        return;
      }

      const { data, error } = await supabase
        .from('subCategoria')
        .insert({
          nombre,
          idCategoria
        })
        .select('id, nombre, idCategoria')
        .maybeSingle();

      if (error) {
        console.error('Error insertando subcategoría:', error);
        showFeedback(feedback, 'Ocurrió un error al guardar la subcategoría.', 'error');
        return;
      }

      showFeedback(feedback, 'Subcategoría creada correctamente.', 'success');
      document.dispatchEvent(new CustomEvent('subcategoria-creada', { detail: data }));
      onCreated?.(data);

      setTimeout(() => overlay.remove(), 900);
    } catch (err) {
      console.error('Error al crear subcategoría:', err);
      showFeedback(feedback, err.message || 'No se pudo crear la subcategoría.', 'error');
    }
  });
}
