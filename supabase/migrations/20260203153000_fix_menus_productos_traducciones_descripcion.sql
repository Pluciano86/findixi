-- Asegura que las tablas de traducciones tengan la columna descripcion usada por translate-menu.

alter table if exists public.menus_traducciones
  add column if not exists descripcion text null;

alter table if exists public.productos_traducciones
  add column if not exists descripcion text null;
