export function mostrarMensajeVacio(contenedor, mensaje = 'No se encontraron lugares de interés para los filtros seleccionados.', icono = '📍') {
  contenedor.innerHTML = `
    <div class="col-span-full flex justify-center items-center py-12">
      <div class="w-full max-w-xs text-center text-gray-600 px-4">
        <div class="text-5xl mb-2 animate-bounce">${icono}</div>
        <p class="text-lg font-medium leading-tight mb-1">${mensaje}</p>
        <p class="text-sm text-gray-400">Prueba cambiar los filtros o intenta otra búsqueda.</p>
      </div>
    </div>
  `;
}

export function mostrarError(contenedor, mensaje = 'Ocurrió un error inesperado.', icono = '⚠️') {
  contenedor.className = 'w-full min-h-[300px] bg-white flex items-center justify-center';
  contenedor.innerHTML = `
    <div class="w-full max-w-xs text-center text-red-500 p-6">
      <div class="text-5xl mb-2">${icono}</div>
      <p class="text-lg font-semibold leading-tight">${mensaje}</p>
    </div>
  `;
}

const LOADER_IMAGE_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/loader.png';

export function mostrarCargando(contenedor, mensaje = 'Cargando datos...') {
  contenedor.className = 'w-full min-h-[300px] bg-white flex items-center justify-center';
  contenedor.innerHTML = `
    <div class="w-full max-w-xs text-center text-gray-500 p-6">
      <img src="${LOADER_IMAGE_URL}" alt="Cargando" class="w-16 h-16 mx-auto mb-3 animate-spin">
      <p class="text-lg font-medium">${mensaje}</p>
    </div>
  `;
}
