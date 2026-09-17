export function obtenerIconoClima(icono) {
  if (!icono) return null;

  const base =
    "https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/";

  const mapa = {
    "01d": "1.svg",   // Cielo despejado (día)
    "01n": "1n.svg",  // Cielo despejado (noche)
    "02d": "2.svg",   // Parcialmente nublado (día)
    "02n": "2n.svg",  // Parcialmente nublado (noche)
    "03d": "2.svg",   // Nublado
    "03n": "3.svg",
    "04d": "45.svg",  // Nubes densas
    "04n": "45.svg",
    "09d": "61.svg",  // Lluvia ligera
    "09n": "61.svg",
    "10d": "53.svg",  // Lluvia moderada
    "10n": "53.svg",
    "11d": "95.svg",  // Tormentas
    "11n": "95.svg",
    "13d": "55.svg",  // Nieve
    "13n": "55.svg",
    "50d": "51.svg",  // Neblina
    "50n": "51n.svg",
  };

  const archivo = mapa[icono] || "1.svg";
  return `${base}${archivo}`;
}
