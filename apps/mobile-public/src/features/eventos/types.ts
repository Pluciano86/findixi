import type { HomeEventoCard } from '../home/types';

export type EventoOption = {
  value: string;
  label: string;
  iconName: string;
};

export type EventoMunicipioOption = {
  value: string;
  label: string;
};

export type EventoListadoItem = HomeEventoCard & {
  categoriaId: number | null;
  categoriaNombre: string;
  categoriaIcono: string;
  municipioIds: number[];
  ultimaFecha: string | null;
};

export type ListadoEventosData = {
  eventos: EventoListadoItem[];
  municipios: EventoMunicipioOption[];
  categorias: EventoOption[];
};
