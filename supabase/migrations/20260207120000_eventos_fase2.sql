begin;

-- Phase 2: remove legacy link from eventoFechas -> eventos
alter table public."eventoFechas"
  drop constraint if exists "eventoFechas_idevento_fkey";

alter table public."eventoFechas"
  drop column if exists idevento;

-- NOTE: keep these columns for now to avoid breaking code/trigger.
-- When ready, you can drop them in a later migration:
-- alter table public.eventos drop column municipio_id;
-- alter table public.eventos drop column lugar;
-- alter table public.eventos drop column direccion;

commit;
