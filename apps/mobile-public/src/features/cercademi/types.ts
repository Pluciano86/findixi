import type { ComercioListItem } from '../comercios/types';

export type CercaCategoriaOption = {
  id: number;
  label: string;
};

export type CercaComercioItem = ComercioListItem & {
  logoUrl: string | null;
  portadaUrl: string | null;
  favorito: boolean;
};
