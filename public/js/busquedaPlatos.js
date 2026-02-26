// js/busquedaPlatos.js
import { filtrosActivos, aplicarFiltrosYRedibujar } from './main.js';
import { supabase } from '../shared/supabaseClient.js';

const inputBusquedaPlatos = document.createElement('input');
inputBusquedaPlatos.type = 'text';
inputBusquedaPlatos.placeholder = 'Buscar platos';
inputBusquedaPlatos.className = 'flex-1 px-3 py-2 border rounded-full text-base';
inputBusquedaPlatos.id = 'filtro-platos';

// Insertar el nuevo input junto al buscador principal
const buscadorNombre = document.getElementById('filtro-nombre');
if (buscadorNombre?.parentNode) {
  buscadorNombre.parentNode.insertBefore(inputBusquedaPlatos, buscadorNombre.nextSibling);
}

inputBusquedaPlatos.addEventListener('input', async (e) => {
  const valor = e.target.value.trim();

  if (valor.length < 2) {
    window.filtrosActivos.comerciosPorPlato = [];
    window.aplicarFiltrosYRedibujar();
    return;
  }

  const { data: productos, error } = await supabase
    .from('productos')
    .select('id, idMenu, nombre')
    .ilike('nombre', `%${valor}%`);

  if (error) {
    console.error('Error buscando productos:', error);
    return;
  }

  const idMenus = productos.map(p => p.idMenu);
  if (idMenus.length === 0) {
    window.filtrosActivos.comerciosPorPlato = [];
    window.aplicarFiltrosYRedibujar();
    return;
  }

  const { data: menus, error: errorMenus } = await supabase
    .from('menus')
    .select('id, idComercio')
    .in('id', idMenus);

  if (errorMenus) {
    console.error('Error buscando menús:', errorMenus);
    return;
  }

  const idComercios = menus.map(m => m.idComercio);
  window.filtrosActivos.comerciosPorPlato = [...new Set(idComercios)];
  window.aplicarFiltrosYRedibujar();
});
