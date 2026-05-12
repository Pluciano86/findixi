// Ajustes manuales de foco para tarjetas de eventos.
// Puedes agregar más entradas con nombre normalizado del evento.
// x/y están en rango 0..1, zoom en ~1.0..1.5
export const EVENT_IMAGE_FOCUS_OVERRIDES = {
  bySourceEventId: {
    asalto: { x: 0.5, y: 0.24, zoom: 1.08 },
    cortaditoocapuchino: { x: 0.5, y: 0.22, zoom: 1.09 },
    "best-jevas": { x: 0.5, y: 0.22, zoom: 1.08 },
    reynoldalexanderquematoarenemonclova: { x: 0.5, y: 0.24, zoom: 1.08 },
    comicosanonimos: { x: 0.5, y: 0.22, zoom: 1.1 },
    nochesdeimpro: { x: 0.5, y: 0.2, zoom: 1.1 },
    "ndi-calle": { x: 0.5, y: 0.2, zoom: 1.1 },
    porlaescena: { x: 0.5, y: 0.24, zoom: 1.08 },
    cumbredeexportacionesparapymes: { x: 0.5, y: 0.3, zoom: 1.06 },
  },
  byEventName: {
    "comedia geek": { x: 0.5, y: 0.34, zoom: 1.12 },
    "mas turbado que tu": { x: 0.5, y: 0.4, zoom: 1.1 },
    "lo mejor de noche de jevas": { x: 0.5, y: 0.34, zoom: 1.1 },
    "reynold alexander quien mato a rene monclova": { x: 0.5, y: 0.42, zoom: 1.08 },
  },
  byImageIncludes: [
    { match: "2359", x: 0.5, y: 0.34, zoom: 1.12 }, // Comedia Geek
    { match: "2313", x: 0.5, y: 0.4, zoom: 1.1 },  // Mas Turbado
    { match: "1361", x: 0.5, y: 0.34, zoom: 1.1 }, // Noche de Jevas
  ],
};
