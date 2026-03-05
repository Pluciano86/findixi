export type MenuTheme = {
  colortexto: string;
  colortitulo: string;
  colorprecio: string;
  colorboton: string;
  colorbotontexto: string;
  colorComercio: string;
  colorMenu: string;
  overlayoscuro: number;
  portadaimagen: string | null;
  backgroundimagen: string | null;
  backgroundcolor: string;
  textomenu: string;
  pdfurl: string | null;
  colorBotonPDF: string | null;
  ocultar_nombre: boolean;
  ocultar_menu: boolean;
  nombre_font_size: number;
  menu_font_size: number;
  fontbody_size: number;
  fonttitle_size: number;
  fontbodyfamily: string | null;
  fontbodyurl: string | null;
  fonttitlefamily: string | null;
  fonttitleurl: string | null;
  fontnombrefamily: string | null;
  fontnombreurl: string | null;
  fontmenuwordfamily: string | null;
  fontmenuwordurl: string | null;
  nombre_shadow: string | null;
  nombre_stroke_width: number;
  nombre_stroke_color: string | null;
  menu_shadow: string | null;
  menu_stroke_width: number;
  menu_stroke_color: string | null;
  seccion_desc_font_family: string | null;
  seccion_desc_font_url: string | null;
  seccion_desc_font_size: number;
  seccion_desc_color: string | null;
  item_bg_color: string;
  item_overlay: number;
  productoAlign: 'left' | 'center';
};

export type MenuComercio = {
  id: number;
  nombre: string;
  colorPrimario: string | null;
  colorSecundario: string | null;
  logo: string | null;
  telefono: string | null;
  facebook: string | null;
  instagram: string | null;
  plan_id: number | null;
  plan_nivel: string | null;
  plan_nombre: string | null;
  permite_menu: boolean | null;
  permite_ordenes: boolean | null;
  estado_propiedad: string | null;
  estado_verificacion: string | null;
  propietario_verificado: boolean | null;
};

export type MenuSection = {
  id: number;
  titulo: string;
  descripcion: string;
  subtitulo: string;
  orden: number;
  no_traducir: boolean;
};

export type MenuProduct = {
  id: number;
  idMenu: number;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string | null;
  orden: number;
  activo: boolean;
  no_traducir_nombre: boolean;
  no_traducir_descripcion: boolean;
};

export type MenuTranslationProduct = {
  id?: number | string | null;
  idproducto?: number | string | null;
  nombre?: string | null;
  name?: string | null;
  descripcion?: string | null;
  description?: string | null;
};

export type MenuTranslationResult = {
  menu?: {
    titulo?: string | null;
    title?: string | null;
    descripcion?: string | null;
    description?: string | null;
  } | null;
  productos?: MenuTranslationProduct[] | null;
} | null;

export type ModifierGroup = {
  id: number;
  nombre: string;
  min_sel: number;
  max_sel: number;
  requerido: boolean;
  orden: number;
};

export type ModifierItem = {
  id: number;
  idgrupo: number | null;
  idGrupo: number | null;
  nombre: string;
  precio_extra: number;
  orden: number;
};

export type CloverTaxRate = {
  id: number;
  rate: number;
  is_default: boolean;
};

export type ProductTaxRates = {
  defaultRates: CloverTaxRate[];
  byProductId: Map<number, CloverTaxRate[]>;
};
