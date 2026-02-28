export type PlayaListItem = {
  id: number;
  nombre: string;
  municipio: string;
  costa: string;
  latitud: number | null;
  longitud: number | null;
  imagen: string | null;
  portada: string | null;
  favorito: boolean;
  bote: boolean;
  nadar: boolean;
  surfear: boolean;
  snorkel: boolean;
  snorkeling: boolean;
};

export type PlayaWeather = {
  estado: string;
  viento: string;
  iconoUrl: string | null;
};
