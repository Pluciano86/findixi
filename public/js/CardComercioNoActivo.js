import { getPublicBase, calcularTiempoEnVehiculo, formatearTelefonoDisplay, formatearTelefonoHref } from '../shared/utils.js';

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

  const portadaUrl = getPublicBase('galeriacomercios/NoActivoPortada.jpg');
  const logoUrl = getPublicBase('galeriacomercios/NoActivoLogo.png');

  div.innerHTML = `
    <div class="relative">
      <img src="${portadaUrl}"
        alt="Portada no disponible" class="w-full h-20 object-cover" />

      <div class="relative w-full flex flex-col items-center pt-9 mt-6 no-underline">
        <img src="${logoUrl}"
          alt="Logo"
          class="w-20 h-20 rounded-full absolute left-1/2 -top-10 transform -translate-x-1/2 
                 bg-gray-100 object-contain shadow-[0px_-17px_11px_-5px_rgba(0,_0,_0,_0.3)] 
                 z-20" />

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

        <span class="mt-2 px-4 py-1 text-xs bg-gray-300 text-gray-700 rounded-full whitespace-nowrap">
          Perfil no disponible
        </span>

        <div class="flex justify-center items-center gap-1 font-medium mb-1 text-sm text-[#9c9c9c] mt-2">
          <i class="fas fa-map-pin"></i> ${comercio.pueblo}
        </div>

        ${textoTiempoEstimado ? `
          <div class="flex justify-center items-center gap-1 text-[#9c9c9c] font-medium text-sm mb-4">
            <i class="fas fa-car"></i> ${textoTiempoEstimado}
          </div>` : ''
        }
      </div>
    </div>
  `;

  return div;
}
