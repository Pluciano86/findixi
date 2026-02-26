import { supabase } from '../shared/supabaseClient.js';
import { resolvePath } from '../shared/pathResolver.js';
import { getPublicBase } from '../shared/utils.js';

const PLACEHOLDER_IMAGEN = resolvePath('img/default-lugar.jpg');

let todosLosLugares = [];
let categoriasGlobales = [];

const elementos = {
  tabla: document.getElementById('tabla-lugares'),
  tarjetas: document.getElementById('lista-lugares-mobile'),
  contador: document.getElementById('contador-lugares'),
  filtroNombre: document.getElementById('filtro-nombre-lugares'),
  filtroCategoria: document.getElementById('filtro-categoria-lugares'),
};

function normalizarTexto(texto = '') {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function obtenerImagen(lugar) {
  const raw = (lugar?.imagen || '').toString().trim();
  if (!raw) return PLACEHOLDER_IMAGEN;
  if (/^https?:\/\//i.test(raw)) return raw;
  return getPublicBase(raw);
}

function obtenerFecha(lugar) {
  const raw = lugar?.created_at || lugar?.creado || lugar?.fechaRegistro;
  if (!raw) return '—';
  const fecha = new Date(raw);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleDateString('es-PR');
}

function leerFiltros() {
  return {
    nombre: normalizarTexto(elementos.filtroNombre?.value),
    categoria: elementos.filtroCategoria?.value || '',
  };
}

function renderSinResultados() {
  if (!elementos.tabla || !elementos.tarjetas) return;

  elementos.tabla.innerHTML = `
    <tr>
      <td colspan="5" class="px-4 py-6 text-center text-sm text-gray-500">
        No se encontraron lugares con estos criterios.
      </td>
    </tr>`;

  elementos.tarjetas.innerHTML = `
    <div class="text-center text-sm text-gray-500 bg-white rounded-lg shadow px-4 py-6">
      No se encontraron lugares con estos criterios.
    </div>`;
}

function aplicarFiltros() {
  if (!elementos.tabla || !elementos.tarjetas || !elementos.contador) return;

  const filtros = leerFiltros();

  let lista = todosLosLugares.filter((lugar) => {
    if (filtros.nombre && !normalizarTexto(lugar.nombre).includes(filtros.nombre)) {
      return false;
    }
    if (filtros.categoria) {
      return lugar.categoriasIds.includes(Number(filtros.categoria));
    }
    return true;
  });

  elementos.contador.textContent = `Mostrando ${lista.length} lugar${lista.length !== 1 ? 'es' : ''}`;

  if (lista.length === 0) {
    renderSinResultados();
    return;
  }

  elementos.tabla.innerHTML = '';
  elementos.tarjetas.innerHTML = '';

  lista.forEach((lugar) => {
    const imagen = obtenerImagen(lugar);
    const municipio = lugar.municipio || '—';
    const categoriasTexto = lugar.categoriasTexto || 'Sin categoría';
    const fecha = obtenerFecha(lugar);

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td class="px-4 py-3">
        <img src="${imagen}" alt="Imagen de ${lugar.nombre}" class="w-16 h-16 object-cover rounded-lg border" />
      </td>
      <td class="px-4 py-3 font-semibold text-gray-800">${lugar.nombre}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${municipio}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${categoriasTexto}</td>
      <td class="px-4 py-3">
        <div class="flex items-center justify-center gap-3">
          <button class="text-orange-500 hover:text-orange-600 transition btn-editar" data-id="${lugar.id}" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="text-red-500 hover:text-red-600 transition btn-eliminar" data-id="${lugar.id}" title="Eliminar">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    `;
    elementos.tabla.appendChild(fila);

    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow p-4 flex gap-4';
    card.innerHTML = `
      <img src="${imagen}" alt="Imagen de ${lugar.nombre}" class="w-24 h-24 object-cover rounded-lg border" />
      <div class="flex-1">
        <div class="text-lg font-semibold text-gray-800">${lugar.nombre}</div>
        <div class="text-sm text-gray-600">Municipio: <strong>${municipio}</strong></div>
        <div class="text-sm text-gray-600">Categorías: <strong>${categoriasTexto}</strong></div>
        <div class="flex gap-4 mt-3">
          <button class="text-orange-500 hover:text-orange-600 transition btn-editar flex items-center gap-1" data-id="${lugar.id}">
            <i class="fas fa-edit"></i><span>Editar</span>
          </button>
          <button class="text-red-500 hover:text-red-600 transition btn-eliminar flex items-center gap-1" data-id="${lugar.id}">
            <i class="fas fa-trash-alt"></i><span>Eliminar</span>
          </button>
        </div>
      </div>
    `;
    elementos.tarjetas.appendChild(card);
  });

  elementos.tabla.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => irAEditar(btn.dataset.id));
  });
  elementos.tarjetas.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => irAEditar(btn.dataset.id));
  });

  elementos.tabla.querySelectorAll('.btn-eliminar').forEach((btn) => {
    btn.addEventListener('click', () => eliminarLugar(btn.dataset.id));
  });
  elementos.tarjetas.querySelectorAll('.btn-eliminar').forEach((btn) => {
    btn.addEventListener('click', () => eliminarLugar(btn.dataset.id));
  });
}

function irAEditar(id) {
  if (!id) return;
  const url = resolvePath(`editarLugar.html?id=${id}`);
  window.location.href = url;
}

async function eliminarLugar(id) {
  const lugar = todosLosLugares.find((l) => String(l.id) === String(id));
  const nombre = lugar?.nombre || 'este lugar';
  if (!window.confirm(`¿Deseas eliminar ${nombre}?`)) return;

  const { error } = await supabase
    .from('LugaresTuristicos')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error eliminando lugar:', error);
    alert('Hubo un problema eliminando el lugar.');
    return;
  }

  todosLosLugares = todosLosLugares.filter((l) => String(l.id) !== String(id));
  aplicarFiltros();
}

function poblarCategoriasSelect(listado) {
  if (!elementos.filtroCategoria) return;
  const valorActual = elementos.filtroCategoria.value;
  elementos.filtroCategoria.innerHTML = '<option value="">Todas las categorías</option>';

  listado.forEach(({ id, nombre }) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = nombre;
    elementos.filtroCategoria.appendChild(option);
  });

  if (valorActual && listado.some((cat) => String(cat.id) === valorActual)) {
    elementos.filtroCategoria.value = valorActual;
  }
}

async function cargarCategorias() {
  const { data, error } = await supabase
    .from('categoriaLugares')
    .select('id, nombre')
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error cargando categorías de lugares:', error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

function normalizarCategorias(lugar) {
  const relaciones = Array.isArray(lugar.lugarCategoria) ? lugar.lugarCategoria : [];
  const nombres = [];
  const ids = [];

  relaciones.forEach((rel) => {
    const categoria = rel?.categoria;
    if (categoria?.id) {
      ids.push(Number(categoria.id));
    } else if (rel?.idCategoria) {
      ids.push(Number(rel.idCategoria));
    }
    const nombre = categoria?.nombre || rel?.nombre;
    if (nombre) {
      nombres.push(nombre);
    }
  });

  return {
    categoriasIds: ids.filter((id) => Number.isFinite(id)),
    categoriasTexto: nombres.filter(Boolean).join(', ') || 'Sin categoría',
  };
}

async function cargarLugares() {
  const { data, error } = await supabase
    .from('LugaresTuristicos')
    .select(`
      id,
      nombre,
      municipio,
      imagen,
      lugarCategoria:lugarCategoria (
        idCategoria,
        categoria:categoriaLugares (
          id,
          nombre
        )
      )
    `);

  if (error) {
    console.error('Error cargando lugares turísticos:', error);
    alert('No fue posible cargar los lugares.');
    return [];
  }

  return Array.isArray(data) ? data : [];
}

function inicializarListeners() {
  const listeners = [
    { elem: elementos.filtroNombre, evento: 'input' },
    { elem: elementos.filtroCategoria, evento: 'change' },
  ];

  listeners.forEach(({ elem, evento }) => {
    if (elem) {
      elem.addEventListener(evento, aplicarFiltros);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  categoriasGlobales = await cargarCategorias();
  poblarCategoriasSelect(categoriasGlobales);

  const lugaresRaw = await cargarLugares();
  todosLosLugares = lugaresRaw.map((lugar) => {
    const { categoriasIds, categoriasTexto } = normalizarCategorias(lugar);
    return {
      ...lugar,
      categoriasIds,
      categoriasTexto,
    };
  });

  inicializarListeners();
  aplicarFiltros();
});
