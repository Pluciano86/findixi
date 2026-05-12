begin;

-- ============================================================
-- Normalizador básico reusable (sin depender de extensiones)
-- ============================================================
create or replace function public.normalize_evento_text(input text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      lower(
        translate(
          coalesce(input, ''),
          'ÁÀÂÄÃáàâäãÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑñÇç',
          'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc'
        )
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

-- ============================================================
-- Catálogo de localidades reutilizables para eventos
-- ============================================================
create table if not exists public.evento_localidades (
  id bigint generated always as identity primary key,
  nombre text not null,
  nombre_normalizado text not null,
  municipio_id bigint not null references public."Municipios"(id),
  place_id text,
  latitud double precision,
  longitud double precision,
  direccion_formateada text,
  fuente_geocoding text,
  estado_geocoding text not null default 'pendiente'
    check (estado_geocoding in ('pendiente', 'resuelto', 'fallido', 'manual')),
  confianza smallint
    check (confianza is null or (confianza >= 0 and confianza <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index if not exists evento_localidades_municipio_nombre_norm_uniq
  on public.evento_localidades (municipio_id, nombre_normalizado);

create unique index if not exists evento_localidades_place_id_uniq
  on public.evento_localidades (place_id)
  where place_id is not null and btrim(place_id) <> '';

create index if not exists evento_localidades_estado_idx
  on public.evento_localidades (estado_geocoding);

create index if not exists evento_localidades_geo_idx
  on public.evento_localidades (latitud, longitud);

create or replace function public.set_evento_localidad_defaults()
returns trigger
language plpgsql
as $$
begin
  new.nombre := btrim(coalesce(new.nombre, ''));
  if new.nombre = '' then
    raise exception using errcode = '23514', message = 'evento_localidades.nombre es requerido';
  end if;

  new.nombre_normalizado := public.normalize_evento_text(new.nombre);
  if new.nombre_normalizado = '' then
    raise exception using errcode = '23514', message = 'evento_localidades.nombre_normalizado no puede quedar vacío';
  end if;

  new.place_id := nullif(btrim(coalesce(new.place_id, '')), '');
  new.direccion_formateada := nullif(btrim(coalesce(new.direccion_formateada, '')), '');
  new.fuente_geocoding := nullif(btrim(coalesce(new.fuente_geocoding, '')), '');
  new.updated_at := now();
  new.last_seen_at := coalesce(new.last_seen_at, now());

  return new;
end;
$$;

drop trigger if exists trg_evento_localidades_defaults on public.evento_localidades;
create trigger trg_evento_localidades_defaults
before insert or update on public.evento_localidades
for each row execute function public.set_evento_localidad_defaults();

-- ============================================================
-- Relación opcional de evento-localidad en eventos_municipios
-- ============================================================
alter table public.eventos_municipios
  add column if not exists localidad_id bigint references public.evento_localidades(id) on delete set null;

create index if not exists eventos_municipios_localidad_id_idx
  on public.eventos_municipios (localidad_id);

-- ============================================================
-- Fuentes de boletería por evento (múltiples logos por tarjeta)
-- ============================================================
create table if not exists public.eventos_boleterias (
  id bigint generated always as identity primary key,
  evento_id bigint not null references public.eventos(id) on delete cascade,
  source text not null
    check (source in ('ticketera', 'pietix', 'prticket')),
  source_display text,
  logo_key text,
  url_evento text not null,
  url_evento_normalizada text not null,
  prioridad smallint not null default 100,
  activo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists eventos_boleterias_evento_source_url_uniq
  on public.eventos_boleterias (evento_id, source, url_evento_normalizada);

create index if not exists eventos_boleterias_evento_idx
  on public.eventos_boleterias (evento_id);

create index if not exists eventos_boleterias_source_idx
  on public.eventos_boleterias (source);

create or replace function public.set_evento_boleteria_defaults()
returns trigger
language plpgsql
as $$
begin
  new.source := lower(btrim(coalesce(new.source, '')));
  new.source_display := nullif(btrim(coalesce(new.source_display, '')), '');
  new.logo_key := nullif(btrim(coalesce(new.logo_key, '')), '');
  new.url_evento := btrim(coalesce(new.url_evento, ''));

  if new.url_evento = '' then
    raise exception using errcode = '23514', message = 'eventos_boleterias.url_evento es requerido';
  end if;

  new.url_evento_normalizada := lower(new.url_evento);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_eventos_boleterias_defaults on public.eventos_boleterias;
create trigger trg_eventos_boleterias_defaults
before insert or update on public.eventos_boleterias
for each row execute function public.set_evento_boleteria_defaults();

-- ============================================================
-- RLS: lectura pública, escritura restringida (service_role)
-- ============================================================
alter table public.evento_localidades enable row level security;
alter table public.eventos_boleterias enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'evento_localidades'
      and policyname = 'Allow select evento_localidades anon'
  ) then
    create policy "Allow select evento_localidades anon"
      on public.evento_localidades
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'evento_localidades'
      and policyname = 'Allow select evento_localidades authenticated'
  ) then
    create policy "Allow select evento_localidades authenticated"
      on public.evento_localidades
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'eventos_boleterias'
      and policyname = 'Allow select eventos_boleterias anon'
  ) then
    create policy "Allow select eventos_boleterias anon"
      on public.eventos_boleterias
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'eventos_boleterias'
      and policyname = 'Allow select eventos_boleterias authenticated'
  ) then
    create policy "Allow select eventos_boleterias authenticated"
      on public.eventos_boleterias
      for select
      to authenticated
      using (true);
  end if;
end $$;

commit;
