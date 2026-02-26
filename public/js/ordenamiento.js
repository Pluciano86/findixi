document.addEventListener('DOMContentLoaded', () => {
  ['filtro-nombre', 'filtro-municipio', 'filtro-subcategoria', 'filtro-orden', 'filtro-abierto', 'filtro-destacados']
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      const evento = id === 'filtro-nombre' ? 'input' : 'change';
      el.addEventListener(evento, async (e) => {
        const v = e.target;
        console.log(`🛠 Cambio en ${id}:`, v.value ?? v.checked);

        if (id === 'filtro-nombre') {
          const texto = v.value.trim();
          filtrosActivos.textoBusqueda = texto;

          if (texto.length >= 3) {
            const { data: productos, error } = await supabase
              .from('productos')
              .select('idMenu, nombre')
              .ilike('nombre', `%${texto}%`);

            if (!error && productos?.length) {
              const idMenus = productos.map(p => p.idMenu);
              const { data: menus, error: errMenus } = await supabase
                .from('menus')
                .select('idComercio')
                .in('id', idMenus);

              if (!errMenus && menus?.length) {
                const idComercios = [...new Set(menus.map(m => m.idComercio))];
                filtrosActivos.comerciosPorPlato = idComercios;
              }
            } else {
              filtrosActivos.comerciosPorPlato = [];
            }
          } else {
            filtrosActivos.comerciosPorPlato = [];
          }
        }

        if (id === 'filtro-municipio') filtrosActivos.municipio = v.value;
        if (id === 'filtro-subcategoria') filtrosActivos.subcategoria = v.value;
        if (id === 'filtro-orden') filtrosActivos.orden = v.value;
        if (id === 'filtro-abierto') filtrosActivos.abiertoAhora = v.checked;

        if (id === 'filtro-destacados') {
          filtrosActivos.destacadosPrimero = v.checked;
          console.log(`⭐ Cambió filtro destacadosPrimero: ${v.checked}`);
          await cargarComerciosConOrden();
          return;
        }

        console.log('🟡 Aplicando filtros con:', { ...filtrosActivos });

        if (id === 'filtro-orden') {
          await cargarComerciosConOrden();
        } else {
          aplicarFiltrosYRedibujar();
        }
      });
    });
});

async function cargarComerciosConOrden() {
  console.log('🔄 Orden seleccionado:', filtrosActivos.orden);

  if (filtrosActivos.orden === 'ubicacion') {
    listaOriginal.sort((a, b) => {
      if (a.tiempoVehiculo == null) return 1;
      if (b.tiempoVehiculo == null) return -1;
      return a.tiempoVehiculo - b.tiempoVehiculo;
    });
  } else if (filtrosActivos.orden === 'az') {
    listaOriginal.sort((a, b) => a.nombre.localeCompare(b.nombre));
  } else if (filtrosActivos.orden === 'recientes') {
    listaOriginal.sort((a, b) => b.id - a.id);
  }

  if (filtrosActivos.destacadosPrimero) {
    const activos = listaOriginal.filter(c => c.activoEnPeErre);
    const inactivos = listaOriginal.filter(c => !c.activoEnPeErre);

    activos.sort((a, b) => (a.tiempoVehiculo ?? Infinity) - (b.tiempoVehiculo ?? Infinity));
    inactivos.sort((a, b) => (a.tiempoVehiculo ?? Infinity) - (b.tiempoVehiculo ?? Infinity));

    listaOriginal = [...activos, ...inactivos];
  }

  if (filtrosActivos.comerciosPorPlato?.length > 0) {
    listaOriginal = listaOriginal.filter(c => filtrosActivos.comerciosPorPlato.includes(c.id));
  }

// ✅ Define la función completa antes de exportarla
function aplicarFiltrosYRedibujar() {
  const contenedor = document.getElementById('app');
  contenedor.innerHTML = '';

  let filtrados = listaOriginal;

  const texto = filtrosActivos.textoBusqueda.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (texto) {
    filtrados = filtrados.filter(c =>
      c.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(texto) ||
      (c.platos && c.platos.some(p =>
        p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(texto)))
    );
  }

  if (filtrosActivos.comerciosPorPlato?.length > 0) {
    filtrados = filtrados.filter(c => filtrosActivos.comerciosPorPlato.includes(c.id));
  }

  if (filtrosActivos.municipio) {
    filtrados = filtrados.filter(c => c.pueblo === filtrosActivos.municipio);
  }

  if (filtrosActivos.subcategoria) {
    filtrados = filtrados.filter(c =>
      Array.isArray(c.idSubcategoria) && c.idSubcategoria.includes(parseInt(filtrosActivos.subcategoria))
    );
  }

  if (filtrosActivos.abiertoAhora) {
    filtrados = filtrados.filter(c => c.abierto === true);
  }

  for (const comercio of filtrados) {
    const card = comercio.activoEnPeErre
      ? cardComercio(comercio)
      : cardComercioNoActivo(comercio);
    contenedor.appendChild(card);
  }
}

// ✅ Ahora sí puedes exportarlas
export { aplicarFiltrosYRedibujar, cargarComerciosConOrden };