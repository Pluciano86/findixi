begin;

-- ============================================================
-- 1) Catálogo de boleterías (con logo_url)
-- ============================================================
create table if not exists public.boleterias_catalogo (
  id smallint generated always as identity primary key,
  source text not null unique
    check (source in ('ticketera', 'pietix', 'prticket')),
  nombre text not null,
  logo_url text not null,
  sitio_url text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_boleterias_catalogo_defaults()
returns trigger
language plpgsql
as $$
begin
  new.source := lower(btrim(coalesce(new.source, '')));
  new.nombre := btrim(coalesce(new.nombre, ''));
  new.logo_url := btrim(coalesce(new.logo_url, ''));
  new.sitio_url := nullif(btrim(coalesce(new.sitio_url, '')), '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_boleterias_catalogo_defaults on public.boleterias_catalogo;
create trigger trg_boleterias_catalogo_defaults
before insert or update on public.boleterias_catalogo
for each row execute function public.set_boleterias_catalogo_defaults();

insert into public.boleterias_catalogo (source, nombre, logo_url, sitio_url, activo)
values
  ('ticketera', 'Ticketera', 'https://www.ticketera.com/favicon.ico', 'https://www.ticketera.com', true),
  ('pietix', 'PieTix', 'https://pietix.com/favicon.ico', 'https://pietix.com', true),
  ('prticket', 'PRticket', 'https://boletos.prticket.com/favicon.ico', 'https://boletos.prticket.com', true)
on conflict (source) do update
set
  nombre = excluded.nombre,
  logo_url = excluded.logo_url,
  sitio_url = excluded.sitio_url,
  activo = excluded.activo,
  updated_at = now();

-- RLS solo lectura pública
alter table public.boleterias_catalogo enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'boleterias_catalogo'
      and policyname = 'Allow select boleterias_catalogo anon'
  ) then
    create policy "Allow select boleterias_catalogo anon"
      on public.boleterias_catalogo
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'boleterias_catalogo'
      and policyname = 'Allow select boleterias_catalogo authenticated'
  ) then
    create policy "Allow select boleterias_catalogo authenticated"
      on public.boleterias_catalogo
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- ============================================================
-- 2) Helper: inferir source desde URL de boletos
-- ============================================================
create or replace function public.infer_boleteria_source(input_url text)
returns text
language sql
immutable
as $$
  select case
    when input_url is null or btrim(input_url) = '' then null
    when lower(input_url) like '%ticketera.com%' then 'ticketera'
    when lower(input_url) like '%pietix.com%' then 'pietix'
    when lower(input_url) like '%prticket.com%' then 'prticket'
    else null
  end;
$$;

-- ============================================================
-- 3) Backfill evento_localidades desde eventos_municipios
-- ============================================================
insert into public.evento_localidades (
  nombre,
  nombre_normalizado,
  municipio_id,
  direccion_formateada,
  fuente_geocoding,
  estado_geocoding,
  metadata,
  last_seen_at
)
select distinct
  btrim(em.lugar) as nombre,
  public.normalize_evento_text(em.lugar) as nombre_normalizado,
  em.municipio_id,
  nullif(btrim(coalesce(em.direccion, '')), '') as direccion_formateada,
  'legacy_eventos_municipios' as fuente_geocoding,
  'pendiente' as estado_geocoding,
  jsonb_build_object('seed', 'eventos_municipios_backfill') as metadata,
  now() as last_seen_at
from public.eventos_municipios em
where em.municipio_id is not null
  and btrim(coalesce(em.lugar, '')) <> ''
on conflict (municipio_id, nombre_normalizado) do update
set
  direccion_formateada = coalesce(public.evento_localidades.direccion_formateada, excluded.direccion_formateada),
  updated_at = now(),
  last_seen_at = now();

-- Enlazar eventos_municipios.localidad_id
update public.eventos_municipios em
set localidad_id = el.id
from public.evento_localidades el
where em.localidad_id is null
  and em.municipio_id = el.municipio_id
  and public.normalize_evento_text(em.lugar) = el.nombre_normalizado;

-- ============================================================
-- 4) Backfill eventos_boleterias desde links existentes
-- ============================================================

-- 4.1 Global link en eventos
insert into public.eventos_boleterias (
  evento_id,
  source,
  source_display,
  logo_key,
  url_evento,
  url_evento_normalizada,
  prioridad,
  activo,
  metadata
)
select
  d.evento_id,
  d.source,
  d.source_display,
  d.logo_key,
  d.url_evento,
  d.url_evento_normalizada,
  d.prioridad,
  d.activo,
  d.metadata
from (
  select distinct on (base.evento_id, base.source, base.url_evento_normalizada)
    base.evento_id,
    base.source,
    base.source_display,
    base.logo_key,
    base.url_evento,
    base.url_evento_normalizada,
    base.prioridad,
    base.activo,
    base.metadata
  from (
    select
      e.id as evento_id,
      src.source,
      bc.nombre as source_display,
      src.source as logo_key,
      btrim(e.enlaceboletos) as url_evento,
      lower(btrim(e.enlaceboletos)) as url_evento_normalizada,
      10 as prioridad,
      true as activo,
      jsonb_build_object('seed', 'eventos.enlaceboletos') as metadata
    from public.eventos e
    cross join lateral (select public.infer_boleteria_source(e.enlaceboletos) as source) src
    left join public.boleterias_catalogo bc on bc.source = src.source
    where btrim(coalesce(e.enlaceboletos, '')) <> ''
      and src.source is not null
  ) base
  order by base.evento_id, base.source, base.url_evento_normalizada, base.prioridad asc
) d
on conflict (evento_id, source, url_evento_normalizada) do update
set
  source_display = coalesce(excluded.source_display, public.eventos_boleterias.source_display),
  logo_key = excluded.logo_key,
  activo = true,
  updated_at = now();

-- 4.2 Links por localidad en eventos_municipios
insert into public.eventos_boleterias (
  evento_id,
  source,
  source_display,
  logo_key,
  url_evento,
  url_evento_normalizada,
  prioridad,
  activo,
  metadata
)
select
  d.evento_id,
  d.source,
  d.source_display,
  d.logo_key,
  d.url_evento,
  d.url_evento_normalizada,
  d.prioridad,
  d.activo,
  d.metadata
from (
  select distinct on (base.evento_id, base.source, base.url_evento_normalizada)
    base.evento_id,
    base.source,
    base.source_display,
    base.logo_key,
    base.url_evento,
    base.url_evento_normalizada,
    base.prioridad,
    base.activo,
    base.metadata
  from (
    select
      em.event_id as evento_id,
      src.source,
      bc.nombre as source_display,
      src.source as logo_key,
      btrim(em.enlaceboletos) as url_evento,
      lower(btrim(em.enlaceboletos)) as url_evento_normalizada,
      20 as prioridad,
      true as activo,
      jsonb_build_object(
        'seed', 'eventos_municipios.enlaceboletos',
        'localidad_id', em.localidad_id
      ) as metadata
    from public.eventos_municipios em
    cross join lateral (select public.infer_boleteria_source(em.enlaceboletos) as source) src
    left join public.boleterias_catalogo bc on bc.source = src.source
    where btrim(coalesce(em.enlaceboletos, '')) <> ''
      and src.source is not null
  ) base
  order by base.evento_id, base.source, base.url_evento_normalizada, base.prioridad asc
) d
on conflict (evento_id, source, url_evento_normalizada) do update
set
  source_display = coalesce(excluded.source_display, public.eventos_boleterias.source_display),
  logo_key = excluded.logo_key,
  activo = true,
  updated_at = now();

commit;
