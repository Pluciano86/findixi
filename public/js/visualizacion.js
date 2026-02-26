import { cardComercio } from './CardComercio.js';
import { cardComercioNoActivo } from './CardComercioNoActivo.js';

export const filtrosActivos = {
  textoBusqueda: '',
  municipio: '',
  categoria: '',
  subcategoria: '',
  orden: 'ubicacion',
  abiertoAhora: false,
  favoritos: false,
  activos: false,
  destacadosPrimero: true,
  comerciosPorPlato: []
};

export let listaOriginal = [];

export function aplicarFiltrosYRedibujar() {
  console.log("🟡 Aplicando filtros con:", filtrosActivos);
  const contenedor = document.getElementById('app');
  contenedor.innerHTML = '';

  let filtrados = listaOriginal;

  if (filtrosActivos.textoBusqueda) {
    filtrados = filtrados.filter(c =>
      c.nombre.toLowerCase().includes(filtrosActivos.textoBusqueda.toLowerCase())
    );
  }

  if (filtrosActivos.municipio) {
    filtrados = filtrados.filter(c => c.pueblo === filtrosActivos.municipio);
  }

  if (filtrosActivos.subcategoria) {
    filtrados = filtrados.filter(c =>
      Array.isArray(c.idSubcategoria) &&
      c.idSubcategoria.includes(parseInt(filtrosActivos.subcategoria))
    );
  }

  if (filtrosActivos.abiertoAhora) {
    filtrados = filtrados.filter(c => c.abierto);
  }

  for (const comercio of filtrados) {
    const card = comercio.activoEnPeErre
      ? cardComercio(comercio)
      : cardComercioNoActivo(comercio);
    contenedor.appendChild(card);
  }
}