-- Tablas de traducciones para menús y productos

create table if not exists public.menus_traducciones (
  id bigserial primary key,
  idmenu bigint not null,
  lang text not null,
  titulo text null,
  descripcion text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idmenu, lang)
);

create table if not exists public.productos_traducciones (
  id bigserial primary key,
  idproducto bigint not null,
  lang text not null,
  nombre text null,
  descripcion text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idproducto, lang)
);

-- Trigger updated_at compartido
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists t_menus_trad_updated on public.menus_traducciones;
create trigger t_menus_trad_updated
before update on public.menus_traducciones
for each row execute function public.set_updated_at();

drop trigger if exists t_productos_trad_updated on public.productos_traducciones;
create trigger t_productos_trad_updated
before update on public.productos_traducciones
for each row execute function public.set_updated_at();

-- RLS: solo lectura pública (inserciones las hará la función con service role)
alter table public.menus_traducciones enable row level security;
alter table public.productos_traducciones enable row level security;

drop policy if exists "read menus_traducciones" on public.menus_traducciones;
create policy "read menus_traducciones"
on public.menus_traducciones for select
to anon, authenticated
using (true);

drop policy if exists "read productos_traducciones" on public.productos_traducciones;
create policy "read productos_traducciones"
on public.productos_traducciones for select
to anon, authenticated
using (true);
