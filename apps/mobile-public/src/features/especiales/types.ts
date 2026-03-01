export type EspecialTipo = 'almuerzo' | 'happyhour';

export type EspecialItem = {
  id: number;
  idComercio: number;
  tipo: EspecialTipo;
  nombre: string;
  descripcion: string;
  precio: number | null;
  imagenUrl: string | null;
};

export type EspecialComercio = {
  id: number;
  nombre: string;
  municipio: string;
  categoria: string;
  telefono: string;
  latitud: number | null;
  longitud: number | null;
  logoUrl: string | null;
};

export type EspecialGrupo = {
  comercio: EspecialComercio;
  especiales: EspecialItem[];
};
