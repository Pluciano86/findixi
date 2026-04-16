-- Permite precios variables en productos (ej. "Precio según peso")
alter table if exists public.productos
  add column if not exists precio_texto text;
