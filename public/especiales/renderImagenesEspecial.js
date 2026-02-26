import { supabase } from '../shared/supabaseClient.js';

/**
 * Busca la primera imagen del especial desde la tabla imgEspeciales
 * @param {number} idEspecial - ID del especial
 * @returns {Promise<string>} - URL pública de la imagen o una imagen por defecto
 */
export async function obtenerImagenEspecial(idEspecial) {
  const { data: imagenes, error } = await supabase
  .from('imgEspeciales')
  .select('imagen')
  .eq('idEspecial', idEspecial)
  .limit(1); // ✅ elimina .single()

if (error) {
  console.error(`🛑 Error obteniendo imagen para especial ${idEspecial}:`, error);
  return 'https://via.placeholder.com/100x100.png?text=Especial';
}

if (!imagenes || imagenes.length === 0) {
  return 'https://via.placeholder.com/100x100.png?text=Especial';
}

const ruta = encodeURIComponent(imagenes[0].imagen);
return `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${ruta}`;
}
