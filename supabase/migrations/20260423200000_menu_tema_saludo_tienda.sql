-- Perfil Tienda: saludo/descripcion corta visible sobre categorías en tienda pública

alter table if exists public.menu_tema
  add column if not exists saludo_tienda text;

update public.menu_tema
set saludo_tienda = coalesce(saludo_tienda, '');

alter table if exists public.menu_tema
  alter column saludo_tienda set default '';
