-- Extiende catálogo de planes con disponibilidad y promociones.
alter table if exists public.planes
  add column if not exists disponibilidad text not null default 'disponible',
  add column if not exists oferta_activa boolean not null default false,
  add column if not exists oferta_tipo text not null default 'precio_especial',
  add column if not exists oferta_gratis boolean not null default false,
  add column if not exists precio_oferta numeric(10, 2),
  add column if not exists oferta_hasta date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planes_disponibilidad_check'
  ) then
    alter table public.planes
      add constraint planes_disponibilidad_check
      check (disponibilidad in ('disponible', 'proximamente', 'no_disponible'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'planes_oferta_tipo_check'
  ) then
    alter table public.planes
      add constraint planes_oferta_tipo_check
      check (oferta_tipo in ('precio_especial', 'gratis_limitado'));
  end if;
end $$;

update public.planes
set
  disponibilidad = coalesce(nullif(disponibilidad, ''), 'disponible'),
  oferta_activa = coalesce(oferta_activa, false),
  oferta_tipo = coalesce(nullif(oferta_tipo, ''), 'precio_especial'),
  oferta_gratis = coalesce(oferta_gratis, false)
where true;
