begin;

alter table public.eventos
  add column if not exists source_event_id text,
  add column if not exists image_crop_mode text default 'cover'
    check (image_crop_mode in ('cover', 'contain_blur')),
  add column if not exists image_focus_x double precision,
  add column if not exists image_focus_y double precision,
  add column if not exists image_zoom double precision,
  add column if not exists image_focus_confidence smallint,
  add column if not exists image_focus_source text;

alter table public.eventos
  drop constraint if exists eventos_image_focus_x_chk;
alter table public.eventos
  add constraint eventos_image_focus_x_chk
  check (image_focus_x is null or (image_focus_x >= 0 and image_focus_x <= 1));

alter table public.eventos
  drop constraint if exists eventos_image_focus_y_chk;
alter table public.eventos
  add constraint eventos_image_focus_y_chk
  check (image_focus_y is null or (image_focus_y >= 0 and image_focus_y <= 1));

alter table public.eventos
  drop constraint if exists eventos_image_zoom_chk;
alter table public.eventos
  add constraint eventos_image_zoom_chk
  check (image_zoom is null or (image_zoom >= 1 and image_zoom <= 1.5));

alter table public.eventos
  drop constraint if exists eventos_image_focus_confidence_chk;
alter table public.eventos
  add constraint eventos_image_focus_confidence_chk
  check (image_focus_confidence is null or (image_focus_confidence >= 0 and image_focus_confidence <= 100));

create index if not exists eventos_source_source_event_id_idx
  on public.eventos (source, source_event_id)
  where source_event_id is not null and btrim(source_event_id) <> '';

commit;
