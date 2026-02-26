-- Tabla de traducciones cacheadas para eventos

create table if not exists public.eventos_traducciones (
  id bigint generated always as identity primary key,
  idevento bigint not null references public.eventos(id) on delete cascade,
  lang text not null,
  nombre text,
  descripcion text,
  lugar text,
  direccion text,
  costo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventos_traducciones_lang_check check (char_length(lang) > 0)
);

-- Evitar duplicados por evento/idioma
create unique index if not exists eventos_traducciones_id_lang_key
  on public.eventos_traducciones (idevento, lang);

create index if not exists eventos_traducciones_id_lang_idx
  on public.eventos_traducciones (idevento, lang);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_eventos_traducciones_set_updated_at on public.eventos_traducciones;
create trigger trg_eventos_traducciones_set_updated_at
before update on public.eventos_traducciones
for each row execute function public.set_updated_at();

-- RLS: solo lectura para anon/authenticated
alter table public.eventos_traducciones enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'eventos_traducciones'
      and policyname = 'Allow select anon'
  ) then
    create policy "Allow select anon" on public.eventos_traducciones
      for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'eventos_traducciones'
      and policyname = 'Allow select authenticated'
  ) then
    create policy "Allow select authenticated" on public.eventos_traducciones
      for select to authenticated using (true);
  end if;
end $$;
