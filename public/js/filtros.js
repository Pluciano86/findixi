import { aplicarFiltrosYRedibujar, filtrosActivos } from './visualizacion.js';
import { cargarComerciosConOrden } from './ordenamiento.js';

['filtro-nombre', 'filtro-municipio', 'filtro-subcategoria', 'filtro-orden', 'filtro-abierto', 'filtro-destacados']
  .forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    const evento = id === 'filtro-nombre' ? 'input' : 'change';
    el.addEventListener(evento, async (e) => {
      const v = e.target;
      console.log(`🛠 Cambió filtro ${id}:`, v.value ?? v.checked);

      if (id === 'filtro-nombre') {
        filtrosActivos.textoBusqueda = v.value.trim();
      }
      if (id === 'filtro-municipio') filtrosActivos.municipio = v.value;
      if (id === 'filtro-subcategoria') filtrosActivos.subcategoria = v.value;
      if (id === 'filtro-orden') filtrosActivos.orden = v.value;
      if (id === 'filtro-abierto') filtrosActivos.abiertoAhora = v.checked;
      if (id === 'filtro-destacados') filtrosActivos.destacadosPrimero = v.checked;

      if (id === 'filtro-orden' || id === 'filtro-destacados') {
        await cargarComerciosConOrden();
      } else {
        aplicarFiltrosYRedibujar();
      }
    });
});