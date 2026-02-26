import { cardComercio } from './CardComercio.js';
import { cardComercioNoActivo } from './CardComercioNoActivo.js';
import { fetchCercanosParaCoordenadas } from './buscarComerciosListado.js';

// Ajusta estos IDs según tu Supabase
const ID_PLAYAS = 1;
const ID_LUGARES = 2;
const IDS_COMIDA = [3, 4, 5, 6]; // Ej: restaurantes, panaderías, coffee shops, food trucks

export function cargarCercanosDesdeUsuario() {
  if (!navigator.geolocation) {
    console.warn("Geolocalización no soportada.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const origen = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };

      await Promise.all([
        cargarCercanosCategoria(IDS_COMIDA, 10, 'sliderCercanosComida', 'cercanosComidaContainer', origen),
        cargarCercanosCategoria([ID_PLAYAS], 45, 'sliderPlayasCercanas', 'cercanosPlayasContainer', origen),
        cargarCercanosCategoria([ID_LUGARES], 45, 'sliderCercanosLugares', 'cercanosLugaresContainer', origen),
      ]);
    },
    (err) => {
      console.error("❌ No se pudo obtener la ubicación del usuario:", err);
    }
  );
}

async function cargarCercanosCategoria(idCategorias, minutosMax, idSlider, idContainer, origen) {
  if (!origen || !Number.isFinite(origen.lat) || !Number.isFinite(origen.lon)) return;

  const radioKm = Math.max(10, (minutosMax / 60) * 45);

  try {
    const peticiones =
      Array.isArray(idCategorias) && idCategorias.length > 0
        ? idCategorias.map((catId) =>
            fetchCercanosParaCoordenadas({
              latitud: origen.lat,
              longitud: origen.lon,
              radioKm,
              categoriaOpcional: catId,
              abiertoAhora: null,
            })
          )
        : [
            fetchCercanosParaCoordenadas({
              latitud: origen.lat,
              longitud: origen.lon,
              radioKm,
              categoriaOpcional: null,
              abiertoAhora: null,
            }),
          ];

    const respuestas = await Promise.all(peticiones);
    const mapa = new Map();
    respuestas.flat().forEach((comercio) => {
      if (!mapa.has(comercio.id)) mapa.set(comercio.id, comercio);
    });
    const lista = Array.from(mapa.values());

    const filtrados = lista.filter((c) => {
      if (!Array.isArray(c.categoriaIds) || !c.categoriaIds.length) return false;
      return idCategorias.some((id) => c.categoriaIds.includes(id));
    });

    const cercanos = filtrados.filter((c) => c.minutosCrudos == null || c.minutosCrudos <= minutosMax);

    const container = document.getElementById(idContainer);
    const slider = document.getElementById(idSlider);
    if (!container || !slider) return;

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
    console.error(`❌ Error cargando cercanos para categorías ${idCategorias}:`, error);
  }
}
