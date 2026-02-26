import { supabase } from '../shared/supabaseClient.js';

export async function obtenerImagenesComercio(idComercio) {
  const { data, error } = await supabase
    .from('imagenesComercios')
    .select('imagen, portada, logo')
    .eq('idComercio', idComercio);

  if (error || !data) {
    console.warn("Error cargando imágenes del comercio:", error);
    return { portadaUrl: null, logoUrl: null };
  }

  const storageUrl = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/';

  const portada = data.find(img => img.portada);
  const logo = data.find(img => img.logo);

  return {
    portadaUrl: portada ? `${storageUrl}${portada.imagen}` : null,
    logoUrl: logo ? `${storageUrl}${logo.imagen}` : null
  };
}