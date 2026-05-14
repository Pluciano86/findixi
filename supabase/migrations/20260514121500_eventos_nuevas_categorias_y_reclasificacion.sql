-- Nuevas categorías para eventos especiales.
-- Incluye reclasificación inicial de eventos ya existentes enviados por negocio.

with nuevas(nombre, icono) as (
  values
    ('Magia / Ilusionismo', 'fa-hat-wizard'),
    ('Comicon / Cosplay', 'fa-user-astronaut'),
    ('Charla / Conferencia', 'fa-chalkboard-user'),
    ('Experiencia', 'fa-seedling')
),
faltantes as (
  select n.nombre, n.icono
  from nuevas n
  left join public."categoriaEventos" c
    on lower(c.nombre) = lower(n.nombre)
  where c.id is null
),
base as (
  select coalesce(max(id), 0) as max_id
  from public."categoriaEventos"
)
insert into public."categoriaEventos" (id, nombre, icono)
select
  base.max_id + row_number() over (order by f.nombre),
  f.nombre,
  f.icono
from faltantes f
cross join base;

-- Completar icono si ya existía la categoría pero sin icono.
update public."categoriaEventos" c
set icono = v.icono
from (
  values
    ('Magia / Ilusionismo', 'fa-hat-wizard'),
    ('Comicon / Cosplay', 'fa-user-astronaut'),
    ('Charla / Conferencia', 'fa-chalkboard-user'),
    ('Experiencia', 'fa-seedling')
) as v(nombre, icono)
where lower(c.nombre) = lower(v.nombre)
  and (c.icono is null or trim(c.icono) = '');

-- Reclasificación puntual de eventos reportados.
with cats as (
  select
    max(case when lower(nombre) = lower('Magia / Ilusionismo') then id end) as magia_id,
    max(case when lower(nombre) = lower('Comicon / Cosplay') then id end) as comicon_id,
    max(case when lower(nombre) = lower('Charla / Conferencia') then id end) as charla_id,
    max(case when lower(nombre) = lower('Experiencia') then id end) as experiencia_id
  from public."categoriaEventos"
)
update public.eventos e
set categoria = case
  when lower(e.nombre) like '%mentalista%' then cats.magia_id
  when lower(e.nombre) like '%dato curioso%' then cats.magia_id
  when lower(e.nombre) like '%caribbean gamic%' then cats.comicon_id
  when lower(e.nombre) like '%super otaku%' then cats.comicon_id
  when lower(e.nombre) like '%relaciones%' then cats.charla_id
  when lower(e.nombre) like '%karmaval%' then cats.experiencia_id
  else e.categoria
end
from cats
where
  lower(e.nombre) like '%mentalista%'
  or lower(e.nombre) like '%dato curioso%'
  or lower(e.nombre) like '%caribbean gamic%'
  or lower(e.nombre) like '%super otaku%'
  or lower(e.nombre) like '%relaciones%'
  or lower(e.nombre) like '%karmaval%';
