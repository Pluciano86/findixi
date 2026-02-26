-- Clover integration schema
-- Date: 2026-02-04

-- Conexiones OAuth por comercio
create table if not exists public.clover_conexiones (
  id bigserial primary key,
  idComercio bigint not null references public."Comercios"(id) on delete cascade,
  clover_merchant_id text not null,
  access_token text not null,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_imported_at timestamptz,
  unique (idComercio)
);

create index if not exists clover_conexiones_merchant_idx on public.clover_conexiones (clover_merchant_id);

-- Menús vinculados a categorías Clover
alter table if exists public.menus
  add column if not exists clover_category_id text,
  add column if not exists clover_merchant_id text;

create unique index if not exists menus_clover_unique
  on public.menus (clover_category_id, clover_merchant_id)
  where clover_category_id is not null and clover_merchant_id is not null;

-- Productos vinculados a items Clover
alter table if exists public.productos
  add column if not exists clover_item_id text,
  add column if not exists clover_merchant_id text,
  add column if not exists disponible_clover boolean default true;

create unique index if not exists productos_clover_unique
  on public.productos (clover_item_id, clover_merchant_id)
  where clover_item_id is not null and clover_merchant_id is not null;

-- Grupos de opciones (modifier groups)
create table if not exists public.producto_opcion_grupos (
  id bigserial primary key,
  idProducto bigint not null references public.productos(id) on delete cascade,
  clover_modifier_group_id text not null,
  clover_merchant_id text,
  nombre text,
  orden integer default 0,
  requerido boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idProducto, clover_modifier_group_id)
);

-- Items dentro de cada grupo de opciones (modifiers)
create table if not exists public.producto_opcion_items (
  id bigserial primary key,
  idGrupo bigint not null references public.producto_opcion_grupos(id) on delete cascade,
  clover_modifier_id text not null,
  nombre text,
  precio_extra numeric(10,2) default 0,
  activo boolean default true,
  orden integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idGrupo, clover_modifier_id)
);

create index if not exists producto_opcion_items_grp_idx on public.producto_opcion_items (idGrupo);

-- Trigger updated_at helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists t_clover_conexiones_updated on public.clover_conexiones;
create trigger t_clover_conexiones_updated
before update on public.clover_conexiones
for each row execute function public.set_updated_at();

drop trigger if exists t_prod_opt_grupos_updated on public.producto_opcion_grupos;
create trigger t_prod_opt_grupos_updated
before update on public.producto_opcion_grupos
for each row execute function public.set_updated_at();

drop trigger if exists t_prod_opt_items_updated on public.producto_opcion_items;
create trigger t_prod_opt_items_updated
before update on public.producto_opcion_items
for each row execute function public.set_updated_at();
