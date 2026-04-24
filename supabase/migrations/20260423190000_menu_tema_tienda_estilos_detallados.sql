-- Perfil Tienda: estilos detallados para botones y tarjeta de producto
-- Incluye soporte para:
-- 1) Botones de categoría (color activo/normal, borde, redondeado, fuente)
-- 2) Tarjeta de producto por campo (nombre/precio/descripcion: color, fuente y size)

alter table if exists public.menu_tema
  add column if not exists colorboton_idle_bg text,
  add column if not exists colorboton_idle_text text,
  add column if not exists boton_round boolean,
  add column if not exists fontbuttonfamily text,
  add column if not exists fontbuttonurl text,
  add column if not exists fonttitle_size integer,
  add column if not exists fontpricefamily text,
  add column if not exists fontpriceurl text,
  add column if not exists fontprice_size integer,
  add column if not exists fontdescfamily text,
  add column if not exists fontdescurl text,
  add column if not exists fontdesc_size integer,
  add column if not exists fontbody_size integer;

update public.menu_tema
set
  colorboton_idle_bg = coalesce(nullif(colorboton_idle_bg, ''), '#ffffff'),
  colorboton_idle_text = coalesce(nullif(colorboton_idle_text, ''), '#374151'),
  boton_round = coalesce(boton_round, true),

  fontbuttonfamily = coalesce(nullif(fontbuttonfamily, ''), nullif(fontdescfamily, ''), nullif(fontbodyfamily, ''), 'Kanit'),
  fontbuttonurl = coalesce(
    nullif(fontbuttonurl, ''),
    nullif(fontdescurl, ''),
    nullif(fontbodyurl, ''),
    'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap'
  ),

  fonttitle_size = coalesce(fonttitle_size, 16),
  fontpricefamily = coalesce(nullif(fontpricefamily, ''), nullif(fontbodyfamily, ''), 'Kanit'),
  fontpriceurl = coalesce(
    nullif(fontpriceurl, ''),
    nullif(fontbodyurl, ''),
    'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap'
  ),
  fontprice_size = coalesce(fontprice_size, fontbody_size, 16),

  fontdescfamily = coalesce(nullif(fontdescfamily, ''), nullif(fontbodyfamily, ''), 'Kanit'),
  fontdescurl = coalesce(
    nullif(fontdescurl, ''),
    nullif(fontbodyurl, ''),
    'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap'
  ),
  fontdesc_size = coalesce(fontdesc_size, fontbody_size, 14),
  fontbody_size = coalesce(fontbody_size, 14);

alter table if exists public.menu_tema
  alter column colorboton_idle_bg set default '#ffffff',
  alter column colorboton_idle_text set default '#374151',
  alter column boton_round set default true,
  alter column fontbuttonfamily set default 'Kanit',
  alter column fontbuttonurl set default 'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap',
  alter column fonttitle_size set default 16,
  alter column fontpricefamily set default 'Kanit',
  alter column fontpriceurl set default 'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap',
  alter column fontprice_size set default 16,
  alter column fontdescfamily set default 'Kanit',
  alter column fontdescurl set default 'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap',
  alter column fontdesc_size set default 14,
  alter column fontbody_size set default 14;
