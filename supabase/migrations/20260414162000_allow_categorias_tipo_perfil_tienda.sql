-- Permite nuevo tipo_perfil 'tienda' en Categorias
alter table public."Categorias"
  drop constraint if exists categorias_tipo_perfil_check;

alter table public."Categorias"
  add constraint categorias_tipo_perfil_check
  check (tipo_perfil in ('menu', 'servicios', 'tienda'));
