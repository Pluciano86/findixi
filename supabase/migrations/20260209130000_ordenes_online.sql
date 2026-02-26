-- Online orders (Clover)
-- Date: 2026-02-09

create table if not exists public.ordenes (
  id bigserial primary key,
  idComercio bigint not null references public."Comercios"(id) on delete cascade,
  clover_merchant_id text,
  clover_order_id text,
  checkout_session_id text,
  checkout_url text,
  total numeric(10,2) not null default 0,
  status text not null default 'pending',
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ordenes_idempotency_key_idx
  on public.ordenes (idempotency_key)
  where idempotency_key is not null;

create index if not exists ordenes_comercio_idx on public.ordenes (idComercio);
create index if not exists ordenes_clover_order_idx on public.ordenes (clover_order_id);

create table if not exists public.orden_items (
  id bigserial primary key,
  idOrden bigint not null references public.ordenes(id) on delete cascade,
  idProducto bigint not null references public.productos(id) on delete restrict,
  clover_item_id text,
  qty integer not null default 1,
  price_snapshot numeric(10,2) not null default 0,
  modifiers jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orden_items_orden_idx on public.orden_items (idOrden);

drop trigger if exists t_ordenes_updated on public.ordenes;
create trigger t_ordenes_updated
before update on public.ordenes
for each row execute function public.set_updated_at();
