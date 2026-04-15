-- Orden manual de categorías para index (primeras 6 visibles por defecto)
alter table public."Categorias"
  add column if not exists orden integer;

-- Inicializa orden para filas existentes si viene nulo o inválido.
with ranked as (
  select
    id,
    row_number() over (
      order by
        case when orden is null or orden <= 0 then 2147483647 else orden end,
        id
    ) as nuevo_orden
  from public."Categorias"
)
update public."Categorias" c
set orden = ranked.nuevo_orden
from ranked
where c.id = ranked.id
  and (c.orden is null or c.orden <= 0);

alter table public."Categorias"
  alter column orden set default 9999;

update public."Categorias"
set orden = 9999
where orden is null or orden <= 0;

alter table public."Categorias"
  alter column orden set not null;

alter table public."Categorias"
  drop constraint if exists categorias_orden_check;

alter table public."Categorias"
  add constraint categorias_orden_check
  check (orden > 0);

create index if not exists categorias_orden_idx
  on public."Categorias" (orden, id);
