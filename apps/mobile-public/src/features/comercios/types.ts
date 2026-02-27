export type ComercioRow = {
  id: number;
  nombre: string;
  municipio: string | null;
  direccion: string | null;
  telefono: string | null;
  latitud: number | null;
  longitud: number | null;
  logo: string | null;
  portada: string | null;
  descripcion: string | null;
  plan_id: number | null;
  plan_nivel: number | null;
  plan_nombre: string | null;
  plan_status: string | null;
  permite_perfil: boolean | null;
  aparece_en_cercanos: boolean | null;
  permite_menu: boolean | null;
  permite_especiales: boolean | null;
  permite_ordenes: boolean | null;
  estado_propiedad: string | null;
  estado_verificacion: string | null;
  propietario_verificado: boolean | null;
  activo: boolean | null;
};

export type ComercioListItem = ComercioRow;
