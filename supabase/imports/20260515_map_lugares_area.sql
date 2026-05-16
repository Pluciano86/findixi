begin;

-- Backfill de idMunicipio + idArea + area en LugaresTuristicos
-- usando el nombre del municipio (normalizado) contra tabla Municipios.
with muni_ref as (
  select
    m.id as municipio_id,
    m.nombre as municipio_nombre,
    m."idArea" as area_id,
    trim(
      regexp_replace(
        translate(lower(coalesce(m.nombre, '')), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9 ]',
        '',
        'g'
      )
    ) as muni_norm
  from public."Municipios" m
),
lugar_ref as (
  select
    l.id as lugar_id,
    trim(
      regexp_replace(
        translate(lower(coalesce(l.municipio, '')), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9 ]',
        '',
        'g'
      )
    ) as muni_norm
  from public."LugaresTuristicos" l
),
matchs as (
  select
    lr.lugar_id,
    mr.municipio_id,
    mr.municipio_nombre,
    mr.area_id
  from lugar_ref lr
  join muni_ref mr on mr.muni_norm = lr.muni_norm
  where lr.muni_norm <> ''
)
update public."LugaresTuristicos" l
set
  "idMunicipio" = m.municipio_id,
  "idArea" = m.area_id,
  municipio = m.municipio_nombre,
  area = a.nombre
from matchs m
left join public."Area" a on a."idArea" = m.area_id
where l.id = m.lugar_id;

commit;

-- Validación rápida
select
  count(*) as total_lugares,
  count(*) filter (where "idMunicipio" is not null) as con_id_municipio,
  count(*) filter (where "idArea" is not null) as con_id_area
from public."LugaresTuristicos";

