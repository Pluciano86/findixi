import { supabase } from '../shared/supabaseClient.js';
import { mostrarMensajeVacio } from '/js/mensajesUI.js';

const contenedorAlmuerzos = document.getElementById('contenedorAlmuerzos');
const contenedorHappy = document.getElementById('contenedorHappy');
const seccionAlmuerzo = contenedorAlmuerzos.closest('section');
const seccionHappy = contenedorHappy.closest('section');

async function renderizarEspeciales(lista) {
  const ahora = new Date();
  const hora = ahora.getHours() + ahora.getMinutes() / 60;

  const esAlmuerzo = hora >= 2 && hora < 15.5;
  const tipoSeleccionado = esAlmuerzo ? 'almuerzo' : 'happyhour';

  contenedorAlmuerzos.innerHTML = '';
  contenedorHappy.innerHTML = '';
  seccionAlmuerzo.classList.add('hidden');
  seccionHappy.classList.add('hidden');

  let hayResultados = false;

  for (const grupo of lista) {
    const { comercio, especiales } = grupo;
    const urlLogo = comercio.logo;
    const nombreComercio = comercio.nombre || 'Comercio';
    const municipio = comercio.municipio || '';
    const categorias = comercio.categorias || [];

    const categoriasTexto = categorias.join(', ');
    const subtitulo = `${categoriasTexto} en ${municipio}`;

    const especialesFiltrados = especiales.filter(esp => esp.tipo === tipoSeleccionado);
    if (especialesFiltrados.length === 0) continue;

    const contenido = await Promise.all(especialesFiltrados.map(async (esp) => `
      <div class="flex gap-4 items-start mb-4">
        <img src="${esp.imagen 
          ? `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${encodeURIComponent(esp.imagen)}`
          : 'https://via.placeholder.com/100x100.png?text=Especial'}" 
          alt="Imagen especial" 
          class="w-24 h-24 object-cover rounded-md">
        <div class="flex flex-col justify-between flex-1">
          <h3 class="font-normal text-xl">${esp.nombre}</h3>
          <p class="text-sm font-light text-gray-600">${esp.descripcion || ''}</p>
          <p class="font-medium text-xl mt-2">$${esp.precio?.toFixed(2) || ''}</p>
        </div>
      </div>
    `));

    const tarjeta = document.createElement('div');
    tarjeta.className = 'bg-white rounded-lg shadow p-4';
    tarjeta.innerHTML = `
      <div class="flex items-center justify-start gap-4 mb-3">
        ${urlLogo ? `<img src="${urlLogo}" class="w-24 h-24 rounded-full object-cover">` : ''}
        <div>
          <h2 class="text-xl font-semibold leading-tight text-gray-800">${nombreComercio}</h2>
          <p class="text-sm text-gray-500">${subtitulo}</p>
        </div>
      </div>
      <hr class="border-t border-gray-200 mb-2">
      ${contenido.join('')}
    `;

    if (tipoSeleccionado === 'almuerzo') {
      contenedorAlmuerzos.appendChild(tarjeta);
      seccionAlmuerzo.classList.remove('hidden');
    } else {
      contenedorHappy.appendChild(tarjeta);
      seccionHappy.classList.remove('hidden');
    }

    hayResultados = true;
  }

  if (!hayResultados) {
    const emoji = tipoSeleccionado === 'almuerzo' ? '🍴' : '🍻';
    const mensaje = tipoSeleccionado === 'almuerzo'
      ? 'No hay Almuerzos disponibles para hoy en esta selección.'
      : 'No hay Happy Hours disponibles para en esta selección.';

    const contenedor = tipoSeleccionado === 'almuerzo' ? contenedorAlmuerzos : contenedorHappy;
    const seccion = tipoSeleccionado === 'almuerzo' ? seccionAlmuerzo : seccionHappy;
    mostrarMensajeVacio(contenedor, mensaje, emoji);
    seccion.classList.remove('hidden');
  }
}

export { renderizarEspeciales };
