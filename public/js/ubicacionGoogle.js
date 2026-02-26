import { supabase } from '../shared/supabaseClient.js';
import { getDrivingDistance, formatTiempo } from '../shared/osrmClient.js';
import { calcularTiempoEnVehiculo } from '../shared/utils.js';

// ✅ Solo se ejecuta si hay ID en URL (usado en perfilComercio.html)
const idComercio = new URLSearchParams(window.location.search).get('id');
if (idComercio && !isNaN(parseInt(idComercio))) {
  mostrarTiempoIndividual(idComercio);
}

// ✅ Función para mostrar tiempo en perfilComercio
export async function mostrarTiempoIndividual(id) {
  const mapsBtn = document.getElementById('btnGoogleMaps');
  const wazeBtn = document.getElementById('btnWaze');
  const tiempoEl = document.getElementById('tiempoVehiculo');

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const origenLat = pos.coords.latitude;
    const origenLon = pos.coords.longitude;

    const { data, error } = await supabase
      .from('Comercios')
      .select('latitud, longitud')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Error cargando coordenadas del comercio:', error);
      return;
    }

    const destinoLat = Number(data.latitud);
    const destinoLon = Number(data.longitud);

    let texto = 'N/D';

    if (Number.isFinite(destinoLat) && Number.isFinite(destinoLon)) {
      const resultado = await getDrivingDistance(
        { lat: origenLat, lng: origenLon },
        { lat: destinoLat, lng: destinoLon }
      );
      if (resultado?.duracion != null) {
        texto = formatTiempo(resultado.duracion);
      } else {
        const distanciaLinea = calcularTiempoEnVehiculo(
          Math.max(0, calcularDistanciaFallback(origenLat, origenLon, destinoLat, destinoLon))
        );
        const minutosFallback = distanciaLinea.minutos;
        texto = formatTiempo(minutosFallback * 60);
      }

      if (mapsBtn) {
        mapsBtn.href = `https://www.google.com/maps/dir/?api=1&origin=${origenLat},${origenLon}&destination=${destinoLat},${destinoLon}&travelmode=driving`;
      }

      if (wazeBtn) {
        wazeBtn.href = `https://waze.com/ul?ll=${destinoLat},${destinoLon}&navigate=yes`;
      }
    }

    if (tiempoEl) {
      tiempoEl.innerHTML = `<i class="fas fa-car"></i> ${texto}`;
    }
  }, (err) => {
    console.error('Error obteniendo ubicación del usuario:', err.message);
  });
}

function calcularDistanciaFallback(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}
