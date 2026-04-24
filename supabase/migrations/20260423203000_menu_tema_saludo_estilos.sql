-- Perfil Tienda: estilos dedicados para texto de saludo/bienvenida

alter table if exists public.menu_tema
  add column if not exists saludo_tienda text,
  add column if not exists colorsaludo text,
  add column if not exists fontsaludofamily text,
  add column if not exists fontsaludourl text,
  add column if not exists fontsaludo_size integer;

update public.menu_tema
set
  saludo_tienda = coalesce(saludo_tienda, ''),
  colorsaludo = coalesce(nullif(colorsaludo, ''), nullif(colortexto, ''), '#374151'),
  fontsaludofamily = coalesce(nullif(fontsaludofamily, ''), nullif(fontdescfamily, ''), nullif(fontbodyfamily, ''), 'Kanit'),
  fontsaludourl = coalesce(
    nullif(fontsaludourl, ''),
    nullif(fontdescurl, ''),
    nullif(fontbodyurl, ''),
    'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap'
  ),
  fontsaludo_size = coalesce(fontsaludo_size, fontdesc_size, fontbody_size, 14);

alter table if exists public.menu_tema
  alter column saludo_tienda set default '',
  alter column colorsaludo set default '#374151',
  alter column fontsaludofamily set default 'Kanit',
  alter column fontsaludourl set default 'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap',
  alter column fontsaludo_size set default 14;
