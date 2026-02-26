begin;

alter table public.eventos
  add column if not exists boletos_por_localidad boolean default false;

alter table public.eventos_municipios
  add column if not exists enlaceboletos text;

commit;
