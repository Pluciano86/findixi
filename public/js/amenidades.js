// js/amenidades.js
import { supabase } from '../shared/supabaseClient.js';
import { t } from './i18n.js';

const idComercio = new URLSearchParams(window.location.search).get('id');

const AMENIDAD_KEY_BY_ES = {
  'Wi-Fi': 'amenidad.wifi',
  'Pet Friendly': 'amenidad.petFriendly',
  'Estacionamiento': 'amenidad.estacionamiento',
  'Aire Acondicionado': 'amenidad.aireAcondicionado',
  'Baño': 'amenidad.bano',
  'Bano': 'amenidad.bano',
  'Accesible': 'amenidad.accesible',
  'Área para Niños': 'amenidad.areaNinos',
  'Area para Ninos': 'amenidad.areaNinos',
  'Area para Niños': 'amenidad.areaNinos',
  'TV': 'amenidad.tv',
  'Servicio de Mesa': 'amenidad.servicioMesa',
  'Barra': 'amenidad.barra',
  'Cervezas Artesanales': 'amenidad.cervezasArtesanales',
  'Música en Vivo': 'amenidad.musicaEnVivo',
  'Musica en Vivo': 'amenidad.musicaEnVivo',
  'Eventos Privados': 'amenidad.eventosPrivados',
  'Área al Aire Libre': 'amenidad.areaAireLibre',
  'Area al Aire Libre': 'amenidad.areaAireLibre',
  'Instagram Spot': 'amenidad.instagramSpot',
  'Terraza': 'amenidad.terraza',
  'Vista al Mar': 'amenidad.vistaMar',
};

function traducirAmenidad(nombre) {
  const key = AMENIDAD_KEY_BY_ES[nombre];
  if (!key) return nombre;
  return t(key);
}

async function cargarAmenidades() {
  const contenedor = document.getElementById('contenedorAmenidades');
  const titulo = document.getElementById('tituloAmenidades');
  if (!contenedor || !titulo) return;

  const { data: comercio, error: errorComercio } = await supabase
    .from('Comercios')
    .select('nombre')
    .eq('id', idComercio)
    .single();

  if (comercio?.nombre) {
    titulo.textContent = t('perfilComercio.amenidadesNombre', { nombre: comercio.nombre });
  }

  const { data: relaciones, error } = await supabase
    .from('comercioAmenidades')
    .select('idAmenidad')
    .eq('idComercio', idComercio);

  if (error || !relaciones) {
    contenedor.innerHTML = `<p class="text-sm text-red-600">${t('amenidades.errorCarga')}</p>`;
    return;
  }

  if (relaciones.length === 0) {
    contenedor.innerHTML = `<p class="text-sm text-gray-500 col-span-full">${t('amenidades.sinAmenidades')}</p>`;
    return;
  }

  const ids = relaciones.map(r => r.idAmenidad);
  const { data: amenidades, error: errorAmenidades } = await supabase
    .from('Amenidades')
    .select('nombre, icono')
    .in('id', ids);

  if (errorAmenidades || !amenidades) {
    contenedor.innerHTML = `<p class="text-sm text-red-600">${t('amenidades.errorDetalles')}</p>`;
    return;
  }

  contenedor.innerHTML = '';
  amenidades.forEach(amenidad => {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="flex flex-col items-center gap-2 text-medium">
      <i class="${amenidad.icono} text-xl md:text-xl" style="color: #3ea6c4;"></i>
      <span>${traducirAmenidad(amenidad.nombre)}</span>
    </div>
  `;
  contenedor.appendChild(div);
});
}

document.addEventListener('DOMContentLoaded', cargarAmenidades);
window.addEventListener('lang:changed', cargarAmenidades);
window.refreshAmenidades = cargarAmenidades;
