-- Clover tax rates sync
-- Date: 2026-02-09

create table if not exists public.clover_tax_rates (
  id bigserial primary key,
  idComercio bigint not null references public."Comercios"(id) on delete cascade,
  clover_tax_rate_id text not null,
  nombre text,
  rate bigint,
  is_default boolean default false,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idComercio, clover_tax_rate_id)
);

create index if not exists clover_tax_rates_comercio_idx on public.clover_tax_rates (idComercio);

create table if not exists public.producto_tax_rates (
  id bigserial primary key,
  idProducto bigint not null references public.productos(id) on delete cascade,
  idTaxRate bigint not null references public.clover_tax_rates(id) on delete cascade,
  unique (idProducto, idTaxRate)
);

create index if not exists producto_tax_rates_producto_idx on public.producto_tax_rates (idProducto);

drop trigger if exists t_clover_tax_rates_updated on public.clover_tax_rates;
create trigger t_clover_tax_rates_updated
before update on public.clover_tax_rates
for each row execute function public.set_updated_at();
