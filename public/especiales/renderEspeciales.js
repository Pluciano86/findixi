import { supabase } from '../shared/supabaseClient.js';
import { mostrarMensajeVacio } from '../js/mensajesUI.js';

const contenedorAlmuerzos = document.getElementById('contenedorAlmuerzos');
const contenedorHappy = document.getElementById('contenedorHappy');
const seccionAlmuerzo = contenedorAlmuerzos.closest('section');
const seccionHappy = contenedorHappy.closest('section');
let coordsUsuario = null;
let listaCache = null;

const claseBaseAlmuerzos = contenedorAlmuerzos?.className || '';
const claseBaseHappy = contenedorHappy?.className || '';

function restaurarContenedor(contenedor, claseBase) {
  if (contenedor) {
    contenedor.className = claseBase;
  }
}

async function renderizarEspeciales(lista) {
  listaCache = lista;
  const ahora = new Date();
  const hora = ahora.getHours() + ahora.getMinutes() / 60;

  const esAlmuerzo = hora >= 2 && hora < 15.5;
  const tipoSeleccionado = esAlmuerzo ? 'almuerzo' : 'happyhour';

  restaurarContenedor(contenedorAlmuerzos, claseBaseAlmuerzos);
  restaurarContenedor(contenedorHappy, claseBaseHappy);
  contenedorAlmuerzos.innerHTML = '';
  contenedorHappy.innerHTML = '';
  seccionAlmuerzo.classList.add('hidden');
  seccionHappy.classList.add('hidden');

  let hayResultados = false;

  console.log('[especiales] Lista recibida:', lista);

  for (const grupo of lista) {
    const { comercio, especiales } = grupo;
    const urlLogo = comercio?.logo || '';
    const idComercio = Number(comercio?.id);
    const nombreComercio = comercio?.nombre || comercio?.nombreSucursal || 'Comercio';
    const municipio = comercio?.municipio || '';
    const telefono = comercio?.telefono || '';
    let tiempoTexto = '';
    const lat = Number(comercio?.latitud);
    const lon = Number(comercio?.longitud);
    if (coordsUsuario && Number.isFinite(lat) && Number.isFinite(lon)) {
      const km = calcularDistanciaKm(coordsUsuario.lat, coordsUsuario.lon, lat, lon);
      console.log('[especiales] distancia calculada', { idComercio, km, coordsUsuario, lat, lon });
      if (km > 0) {
        const minutos = Math.round((km / 40) * 60); // asumiendo 40 km/h promedio
        tiempoTexto = `a unos ${minutos} min en vehículo`;
      }
    }
    const partesUbicacion = [];
    if (municipio) partesUbicacion.push(`<i class="fa-solid fa-location-dot text-[#3ea6c4]"></i> en ${municipio}`);
    if (tiempoTexto) partesUbicacion.push(`<i class="fa-solid fa-car-side text-gray-500"></i> ${tiempoTexto}`);
    const subtitulo = partesUbicacion.join(' · ');

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
    const linkPerfil =
      Number.isFinite(idComercio) && idComercio > 0
        ? `<a href="../perfilComercio.html?id=${idComercio}" class="text-xl font-semibold leading-tight text-gray-800 hover:text-blue-600 transition" aria-label="Ir al perfil de ${nombreComercio}">
            ${nombreComercio}
          </a>`
        : `<span class="text-xl font-semibold leading-tight text-gray-800">${nombreComercio}</span>`;

    tarjeta.innerHTML = `
      <div class="flex items-center justify-start gap-4 mb-3">
        ${urlLogo ? `<img src="${urlLogo}" class="w-24 h-24 rounded-full object-cover" loading="lazy">` : ''}
        <div>
          ${linkPerfil}
          <p class="text-sm text-gray-500">${subtitulo}</p>
          ${telefono ? `
            <a href="tel:${telefono}" class="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-semibold px-3 py-1 rounded-full mt-2 shadow hover:bg-red-700 transition">
              <i class="fa-solid fa-phone text-sm"></i> ${telefono}
            </a>` : ''}
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

// Utilidades de distancia
function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

if (navigator.geolocation) {
  let logGeoErrorOnce = false;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      coordsUsuario = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      console.log('[especiales] ubicación usuario', coordsUsuario);
      if (listaCache) {
        renderizarEspeciales(listaCache);
      }
    },
    (err) => {
      if (!logGeoErrorOnce) {
        console.info('Ubicación no disponible para estimar tiempo en vehículo:', err?.message || err);
        logGeoErrorOnce = true;
      }
      coordsUsuario = null;
    },
    { enableHighAccuracy: false, maximumAge: 300000, timeout: 5000 }
  );
}
