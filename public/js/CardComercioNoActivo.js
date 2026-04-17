import { calcularTiempoEnVehiculo, formatearTelefonoDisplay, formatearTelefonoHref } from '../shared/utils.js';

function resolveAppBase() {
  const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  return isLocal ? '/public/' : '/';
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function buildReclamarPerfilUrl(comercio = {}) {
  const params = new URLSearchParams({
    claim: '1',
    source: 'noactivo_card',
  });

  const comercioId = toFiniteNumber(comercio?.id);
  if (Number.isFinite(comercioId)) params.set('comercioId', String(comercioId));

  const nombre = String(comercio?.nombre || '').trim();
  if (nombre) params.set('nombre', nombre);

  const municipio = String(comercio?.municipio || comercio?.pueblo || '').trim();
  if (municipio) params.set('municipio', municipio);
  const idMunicipio = toFiniteNumber(comercio?.idMunicipio);
  if (Number.isFinite(idMunicipio)) params.set('idMunicipio', String(idMunicipio));

  const lat = toFiniteNumber(comercio?.latitud);
  const lon = toFiniteNumber(comercio?.longitud);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    params.set('lat', String(lat));
    params.set('lon', String(lon));
  }

  const placeId = String(
    comercio?.google_place_id_posible_match ||
      comercio?.google_place_id ||
      comercio?.place_id ||
      ''
  ).trim();
  if (placeId) params.set('placeId', placeId);

  const telefono = String(comercio?.telefono || '').trim();
  if (telefono) params.set('telefono', telefono);

  const direccion = String(comercio?.direccion || '').trim();
  if (direccion) params.set('direccion', direccion);

  const portada = String(comercio?.portada || '').trim();
  if (portada) params.set('portada', portada);

  const logo = String(comercio?.logo || '').trim();
  if (logo) params.set('logo', logo);

  return `${resolveAppBase()}registroComercio.html?${params.toString()}`;
}

export function cardComercioNoActivo(comercio) {
  const div = document.createElement('div');
  div.className = `
    bg-gray-100 rounded-2xl shadow-md overflow-hidden 
    text-center w-full max-w-[180px] sm:max-w-[200px] mx-auto
  `;

  let textoTiempoEstimado = comercio.tiempoVehiculo || comercio.tiempoTexto || '';
  if (!textoTiempoEstimado && Number.isFinite(comercio.distanciaKm)) {
    const { minutos, texto } = calcularTiempoEnVehiculo(comercio.distanciaKm);
    textoTiempoEstimado = minutos < 60 ? `a ${minutos} minutos` : `a ${texto}`;
  }

  const portadaUrl =
    'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/portadaNoActivo.png';
  const logoUrl =
    'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/logoNoActivo.png';
  const reclamarPerfilUrl = buildReclamarPerfilUrl(comercio);

  div.innerHTML = `
    <div class="relative">
      <img src="${portadaUrl}"
        alt="Portada no disponible" class="w-full h-20 object-cover" />

      <div class="relative w-full flex flex-col items-center pt-9 mt-6 no-underline">
        <img src="${logoUrl}"
          alt="Logo"
          class="w-20 h-20 rounded-full absolute left-1/2 -top-10 transform -translate-x-1/2 
                 bg-white object-contain shadow-[0px_-17px_11px_-5px_rgba(0,_0,_0,_0.3)] 
                 border-4 border-white z-20" />

        <div class="relative h-12 w-full">
          <div class="absolute inset-0 flex items-center justify-center px-2 text-center">
            <h3 class="${comercio.nombre.length > 25 ? 'text-lg' : 'text-xl'} 
                       font-medium text-[#424242] z-30 mt-2 leading-[0.9] text-center">
              ${comercio.nombre}
            </h3>
          </div>
        </div>

${
  comercio.telefono && comercio.telefono.trim() && comercio.telefono.toLowerCase() !== "null"
    ? `<a href="${formatearTelefonoHref(comercio.telefono)}" class="text-[15px] text-gray-600 mt-1 mb-1 no-underline">
         ${formatearTelefonoDisplay(comercio.telefono)}
       </a>`
    : `<div class="text-[15px] text-gray-600 mt-1 mb-1 h-[22px]">&nbsp;</div>`
}

        <div class="flex justify-center items-center gap-1 font-medium mb-1 text-sm text-[#9c9c9c] mt-1">
          <i class="fas fa-map-pin"></i> ${comercio.pueblo}
        </div>

        ${textoTiempoEstimado ? `
          <div class="flex justify-center items-center gap-1 text-[#9c9c9c] font-medium text-sm mb-3">
            <i class="fas fa-car"></i> ${textoTiempoEstimado}
          </div>` : ''
        }

        <a
          href="${reclamarPerfilUrl}"
          class="block text-center text-[12px] leading-4 text-black font-semibold mb-3 underline max-w-[170px]"
        >
          <span class="block">¿Eres el propietario?</span>
          <span class="block">Reclama tu Comercio hoy</span>
        </a>
      </div>
    </div>
  `;

  return div;
}
