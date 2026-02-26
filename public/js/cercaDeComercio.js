import { cardComercio } from './CardComercio.js';
import { cardComercioNoActivo } from './CardComercioNoActivo.js';
import { fetchCercanosParaCoordenadas } from './buscarComerciosListado.js';

export async function mostrarComerciosCercanos(comercioOrigen) {
  const origenCoords = {
    lat: comercioOrigen.latitud,
    lon: comercioOrigen.longitud
  };

  if (!origenCoords.lat || !origenCoords.lon) {
    console.warn('⚠️ Comercio origen sin coordenadas válidas.');
    return;
  }

  try {
    const lista = await fetchCercanosParaCoordenadas({
      latitud: origenCoords.lat,
      longitud: origenCoords.lon,
      radioKm: 10,
      categoriaOpcional: null,
      abiertoAhora: null,
    });

    const cercanos = lista
      .filter((c) => c.id !== comercioOrigen.id)
      .filter((c) => c.minutosCrudos == null || c.minutosCrudos <= 15);

    const container = document.getElementById('cercanosComidaContainer');
    const slider = document.getElementById('sliderCercanosComida');

    if (!container || !slider) {
      console.warn('⚠️ No se encontraron los contenedores para mostrar los comercios cercanos.');
      return;
    }

    if (cercanos.length > 0) {
      slider.innerHTML = '';
      cercanos.forEach((c) => {
        const card = c.activo === true ? cardComercio(c) : cardComercioNoActivo(c);
        slider.appendChild(card);
      });
      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
    }
  } catch (error) {
    console.error('❌ Error buscando comercios cercanos:', error);
  }
}
