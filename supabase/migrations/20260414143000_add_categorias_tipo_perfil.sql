-- Clasificación de perfil para categorías (menu | servicios)
alter table public."Categorias"
  add column if not exists tipo_perfil text not null default 'menu';

alter table public."Categorias"
  drop constraint if exists categorias_tipo_perfil_check;

alter table public."Categorias"
  add constraint categorias_tipo_perfil_check
  check (tipo_perfil in ('menu', 'servicios'));

-- Clasificación inicial para categorías de servicios de belleza.
update public."Categorias"
set tipo_perfil = 'servicios'
where lower(
  replace(replace(replace(replace(replace(coalesce(nombre_es, nombre, ''), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u')
) in (
  'salon de belleza',
  'tecnicas de unas',
  'barberias',
  'esteticas',
  'spa'
);
