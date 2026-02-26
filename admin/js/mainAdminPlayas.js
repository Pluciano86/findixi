import { supabase } from '../shared/supabaseClient.js';
import { resolvePath } from '../shared/pathResolver.js';
import { getPublicBase } from '../shared/utils.js';

const PLACEHOLDER_IMAGEN = resolvePath('img/default-playa.jpg');

let todasLasPlayas = [];

const elementos = {
  tabla: document.getElementById('tabla-playas'),
  tarjetas: document.getElementById('lista-playas-mobile'),
  contador: document.getElementById('contador-playas'),
  filtroNombre: document.getElementById('filtro-nombre'),
  filtroOrden: document.getElementById('filtro-orden'),
  filtroMunicipio: document.getElementById('filtro-municipio'),
  filtroCosta: document.getElementById('filtro-costa'),
};

function normalizarTexto(texto = '') {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function obtenerImagen(playa) {
  const raw = (playa?.imagen || '').toString().trim();
  if (!raw) return PLACEHOLDER_IMAGEN;
  if (/^https?:\/\//i.test(raw)) return raw;
  return getPublicBase(raw);
}

function obtenerFecha(playa) {
  const raw = playa?.created_at || playa?.creado || playa?.fechaRegistro;
  if (!raw) return '—';
  const fecha = new Date(raw);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleDateString('es-PR');
}

function leerFiltros() {
  return {
    nombre: normalizarTexto(elementos.filtroNombre?.value),
    orden: elementos.filtroOrden?.value || 'recientes',
    municipio: elementos.filtroMunicipio?.value || '',
    costa: elementos.filtroCosta?.value || '',
  };
}

function aplicarFiltros() {
  if (!elementos.tabla || !elementos.tarjetas || !elementos.contador) return;

  const filtros = leerFiltros();

  let lista = [...todasLasPlayas].filter((playa) => {
    if (filtros.nombre && !normalizarTexto(playa.nombre).includes(filtros.nombre)) {
      return false;
    }
    if (filtros.municipio && playa.municipio !== filtros.municipio) {
      return false;
    }
    if (filtros.costa && (playa.costa || '').toString() !== filtros.costa) {
      return false;
    }
    return true;
  });

  if (filtros.orden === 'az') {
    lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  } else {
    lista.sort((a, b) => {
      const fechaA = new Date(a.created_at || a.creado || 0).getTime();
      const fechaB = new Date(b.created_at || b.creado || 0).getTime();
      return fechaB - fechaA;
    });
  }

  elementos.contador.textContent = `Mostrando ${lista.length} playa${lista.length !== 1 ? 's' : ''}`;

  if (lista.length === 0) {
    elementos.tabla.innerHTML = `
      <tr>
        <td colspan="4" class="px-4 py-6 text-center text-sm text-gray-500">
          No se encontraron playas con estos criterios.
        </td>
      </tr>`;
    elementos.tarjetas.innerHTML = `
      <div class="text-center text-sm text-gray-500 bg-white rounded-lg shadow px-4 py-6">
        No se encontraron playas con estos criterios.
      </div>`;
    return;
  }

  elementos.tabla.innerHTML = '';
  elementos.tarjetas.innerHTML = '';

  lista.forEach((playa) => {
    const imagen = obtenerImagen(playa);
    const municipio = playa.municipio || '—';
    const costa = playa.costa || '—';
    const fecha = obtenerFecha(playa);
    const safeNombre = playa.nombre || 'Sin nombre';

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td class="px-4 py-3">
        <img src="${imagen}" alt="Imagen de ${safeNombre}" class="w-16 h-16 object-cover rounded-lg border" />
      </td>
      <td class="px-4 py-3 font-semibold text-gray-800">${safeNombre}</td>
      <td class="px-4 py-3 text-sm text-gray-600">
        <div class="font-medium">${municipio}</div>
        <div class="text-xs text-gray-500">${costa}</div>
      </td>
      <td class="px-4 py-3">
        <div class="flex items-center justify-center gap-3">
          <button class="text-orange-500 hover:text-orange-600 transition btn-editar" data-id="${playa.id}" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="text-red-500 hover:text-red-600 transition btn-eliminar" data-id="${playa.id}" title="Eliminar">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    `;
    elementos.tabla.appendChild(fila);

    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow p-4 flex gap-4';
    card.innerHTML = `
      <img src="${imagen}" alt="Imagen de ${safeNombre}" class="w-24 h-24 object-cover rounded-lg border" />
      <div class="flex-1">
        <div class="text-lg font-semibold text-gray-800">${safeNombre}</div>
        <div class="text-sm text-gray-600">Municipio: <strong>${municipio}</strong></div>
        <div class="text-sm text-gray-600">Costa: <strong>${costa}</strong></div>
        <div class="text-xs text-gray-500 mt-1">Creada: ${fecha}</div>
        <div class="flex gap-4 mt-3">
          <button class="text-orange-500 hover:text-orange-600 transition btn-editar flex items-center gap-1" data-id="${playa.id}">
            <i class="fas fa-edit"></i>
            <span>Editar</span>
          </button>
          <button class="text-red-500 hover:text-red-600 transition btn-eliminar flex items-center gap-1" data-id="${playa.id}">
            <i class="fas fa-trash-alt"></i>
            <span>Eliminar</span>
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
    btn.addEventListener('click', () => eliminarPlaya(btn.dataset.id));
  });
  elementos.tarjetas.querySelectorAll('.btn-eliminar').forEach((btn) => {
    btn.addEventListener('click', () => eliminarPlaya(btn.dataset.id));
  });
}

function irAEditar(id) {
  if (!id) return;
  const url = resolvePath(`editarPlaya.html?id=${id}`);
  window.location.href = url;
}

async function eliminarPlaya(id) {
  const playa = todasLasPlayas.find((p) => String(p.id) === String(id));
  const nombre = playa?.nombre || 'esta playa';

  if (!window.confirm(`¿Deseas eliminar ${nombre}?`)) {
    return;
  }

  const { error } = await supabase
    .from('playas')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error eliminando playa:', error);
    alert('Hubo un problema eliminando la playa.');
    return;
  }

  todasLasPlayas = todasLasPlayas.filter((p) => String(p.id) !== String(id));
  actualizarFiltrosDisponibles();
  aplicarFiltros();
}

function poblarSelect(select, opciones) {
  if (!select) return;
  const valorActual = select.value;
  select.innerHTML = select.id === 'filtro-municipio'
    ? '<option value="">Todos los municipios</option>'
    : '<option value="">Todas las costas</option>';

  opciones.forEach((valor) => {
    const option = document.createElement('option');
    option.value = valor;
    option.textContent = valor;
    select.appendChild(option);
  });

  if (valorActual && opciones.includes(valorActual)) {
    select.value = valorActual;
  }
}

function actualizarFiltrosDisponibles() {
  const municipios = [...new Set(todasLasPlayas.map((p) => p.municipio).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const costas = [...new Set(todasLasPlayas.map((p) => (p.costa || '').toString()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  poblarSelect(elementos.filtroMunicipio, municipios);
  poblarSelect(elementos.filtroCosta, costas);
}

async function cargarPlayas() {
  const { data, error } = await supabase
    .from('playas')
    .select('id, nombre, municipio, costa, imagen, created_at');

  if (error) {
    console.error('Error cargando playas:', error);
    alert('No fue posible cargar las playas.');
    return;
  }

  todasLasPlayas = Array.isArray(data) ? data : [];
  actualizarFiltrosDisponibles();
  aplicarFiltros();
}

function inicializarListeners() {
  const inputs = [
    { elemento: elementos.filtroNombre, evento: 'input' },
    { elemento: elementos.filtroOrden, evento: 'change' },
    { elemento: elementos.filtroMunicipio, evento: 'change' },
    { elemento: elementos.filtroCosta, evento: 'change' },
  ];

  inputs.forEach(({ elemento, evento }) => {
    if (elemento) {
      elemento.addEventListener(evento, aplicarFiltros);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  inicializarListeners();
  await cargarPlayas();
});
