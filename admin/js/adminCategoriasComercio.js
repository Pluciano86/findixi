// ✅ adminCategoriasComercio.js (actualizado para relaciones actuales)
import { supabase } from '../shared/supabaseClient.js';
import { abrirModalNuevaCategoria, abrirModalNuevaSubcategoria } from './adminCategoriasModal.js';

const idComercio = new URLSearchParams(window.location.search).get('id');

let categorias = [];
let subcategorias = [];

window.categoriasSeleccionadas = [];
window.subcategoriasSeleccionadas = [];

// Cargar todas las categorías disponibles
async function cargarCategorias() {
  if (!categorias.length) {
    const { data, error } = await supabase.from('Categorias').select('id, nombre').order('nombre');
    if (error) {
      console.error('Error cargando categorías:', error);
      categorias = [];
    } else {
      categorias = data || [];
    }
  }

  const contenedor = document.getElementById('opcionesCategorias');
  if (!contenedor) return;
  contenedor.innerHTML = '';

  categorias.forEach((c) => {
    const checked = window.categoriasSeleccionadas.includes(c.id) ? 'checked' : '';
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2';
    div.innerHTML = `
      <input type="checkbox" value="${c.id}" id="cat_${c.id}" ${checked}>
      <label for="cat_${c.id}">${c.nombre}</label>
    `;
    contenedor.appendChild(div);
  });

 contenedor.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = parseInt(input.value);
      if (input.checked) {
        if (!window.categoriasSeleccionadas.includes(id))
          window.categoriasSeleccionadas.push(id);
      } else {
        window.categoriasSeleccionadas = window.categoriasSeleccionadas.filter((c) => c !== id);
      }
      mostrarSeleccionadas('categoriasSeleccionadas', window.categoriasSeleccionadas, categorias, 'removerCategoria');
      cargarSubcategorias();
    });
  });

  mostrarSeleccionadas('categoriasSeleccionadas', window.categoriasSeleccionadas, categorias, 'removerCategoria');
}

// Cargar subcategorías relacionadas a las categorías seleccionadas
async function cargarSubcategorias() {
  if (!subcategorias.length) {
    const { data, error } = await supabase
      .from('subCategoria')
      .select('id, nombre, idCategoria')
      .order('nombre');
    if (error) {
      console.error('Error cargando subcategorías:', error);
      subcategorias = [];
    } else {
      subcategorias = data || [];
    }
  }

  const contenedor = document.getElementById('opcionesSubcategorias');
  if (!contenedor) return;

  contenedor.innerHTML = '';
  const categoriasSeleccionadas = (window.categoriasSeleccionadas || []).map(Number);
  const filtradas = subcategorias.filter((sc) =>
    categoriasSeleccionadas.includes(Number(sc.idCategoria))
  );

  filtradas.forEach((sub) => {
    const checked = window.subcategoriasSeleccionadas.includes(sub.id) ? 'checked' : '';
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2';
    div.innerHTML = `
      <input type="checkbox" value="${sub.id}" id="sub_${sub.id}" ${checked}>
      <label for="sub_${sub.id}">${sub.nombre}</label>
    `;
    contenedor.appendChild(div);
  });

  contenedor.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = parseInt(input.value);
      if (input.checked) {
        if (!window.subcategoriasSeleccionadas.includes(id))
          window.subcategoriasSeleccionadas.push(id);
      } else {
        window.subcategoriasSeleccionadas = window.subcategoriasSeleccionadas.filter((s) => s !== id);
      }
      mostrarSeleccionadas('subcategoriasSeleccionadas', window.subcategoriasSeleccionadas, subcategorias, 'removerSubcategoria');
    });
  });

  mostrarSeleccionadas('subcategoriasSeleccionadas', window.subcategoriasSeleccionadas, subcategorias, 'removerSubcategoria');
}

function mostrarSeleccionadas(wrapperId, array, listaReferencia, fnName) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;
  wrapper.innerHTML = '';
  const vistos = new Set();
  array.forEach((id) => {
    if (vistos.has(id)) return;
    vistos.add(id);
    const nombre = (listaReferencia.find((x) => x.id === id) || {}).nombre || id;
    const chip = document.createElement('span');
    chip.className =
      'inline-flex items-center bg-blue-200 text-blue-800 rounded-full px-3 py-1 text-sm m-1';
    chip.innerHTML = `${nombre} <button onclick="${fnName}(${id})" class="ml-2 text-red-500 font-bold">×</button>`;
    wrapper.appendChild(chip);
  });
}

window.removerCategoria = function (id) {
  window.categoriasSeleccionadas = window.categoriasSeleccionadas.filter((c) => c !== id);
  const checkbox = document.getElementById(`cat_${id}`);
  if (checkbox) checkbox.checked = false;
  mostrarSeleccionadas('categoriasSeleccionadas', window.categoriasSeleccionadas, categorias, 'removerCategoria');
  cargarSubcategorias();
};

window.removerSubcategoria = function (id) {
  window.subcategoriasSeleccionadas = window.subcategoriasSeleccionadas.filter((s) => s !== id);
  const checkbox = document.getElementById(`sub_${id}`);
  if (checkbox) checkbox.checked = false;
  mostrarSeleccionadas('subcategoriasSeleccionadas', window.subcategoriasSeleccionadas, subcategorias, 'removerSubcategoria');
};

// ✅ Cargar relaciones del comercio con categorías y subcategorías
async function cargarRelacionesComercio() {
  try {
    const { data: categoriasRel, error: errorCat } = await supabase
      .from('ComercioCategorias')
      .select('idCategoria')
      .eq('idComercio', idComercio);

    const { data: subcategoriasRel, error: errorSub } = await supabase
      .from('ComercioSubcategorias')
      .select('idSubcategoria')
      .eq('idComercio', idComercio);

    if (errorCat) console.error('Error cargando categorías del comercio:', errorCat);
    if (errorSub) console.error('Error cargando subcategorías del comercio:', errorSub);

    window.categoriasSeleccionadas = Array.from(
      new Set(
        (categoriasRel || [])
          .map((rel) => Number(rel.idCategoria))
          .filter((id) => !Number.isNaN(id))
      )
    );

    window.subcategoriasSeleccionadas = Array.from(
      new Set(
        (subcategoriasRel || [])
          .map((rel) => Number(rel.idSubcategoria))
          .filter((id) => !Number.isNaN(id))
      )
    );

  } catch (error) {

  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const btnNuevaCategoria = document.getElementById('btnNuevaCategoria');
  const btnNuevaSubcategoria = document.getElementById('btnNuevaSubcategoria');

  btnNuevaCategoria?.addEventListener('click', () => {
    abrirModalNuevaCategoria({
      onCreated: async (categoriaCreada) => {
        if (!categoriaCreada?.id) return;
        categorias = [];
        if (!window.categoriasSeleccionadas.includes(categoriaCreada.id)) {
          window.categoriasSeleccionadas.push(categoriaCreada.id);
        }
        await cargarCategorias();
        await cargarSubcategorias();
      },
    });
  });

  btnNuevaSubcategoria?.addEventListener('click', () => {
    abrirModalNuevaSubcategoria({
      onCreated: async (subcategoriaCreada) => {
        if (!subcategoriaCreada?.id) return;
        subcategorias = [];
        const categoriaPadre = Number(subcategoriaCreada.idCategoria);
        if (
          Number.isFinite(categoriaPadre) &&
          !window.categoriasSeleccionadas.includes(categoriaPadre)
        ) {
          window.categoriasSeleccionadas.push(categoriaPadre);
        }
        if (!window.subcategoriasSeleccionadas.includes(subcategoriaCreada.id)) {
          window.subcategoriasSeleccionadas.push(subcategoriaCreada.id);
        }
        await cargarSubcategorias();
      },
    });
  });

  await cargarRelacionesComercio();
  await cargarCategorias();
  await cargarSubcategorias();
});

// ✅ Exportar correctamente para otros módulos
export {
  cargarCategorias,
  cargarSubcategorias,
  cargarRelacionesComercio,
  cargarRelacionesComercio as cargarCategoriasYSubcategorias
};
