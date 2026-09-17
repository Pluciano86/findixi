create table public.comercio_restaurante_experience (
 comercio_id bigint primary key references public."Comercios"(id) on delete restrict,
 estado text not null default 'borrador' check (estado in ('borrador','revisado')),
 tipos_cocina text[],
 especialidades text[],
 sirve_desayuno boolean,
 sirve_almuerzo boolean,
 sirve_cena boolean,
 menu_infantil boolean,
 sillas_altas boolean,
 cambiador boolean,
 acepta_mascotas boolean,
 zona_mascotas text,
 acepta_reservaciones boolean,
 requiere_reservacion boolean,
 canal_reservacion text check (canal_reservacion in ('telefono','web','telefono_y_web','presencial')),
 telefono_reservacion text,
 url_reservacion text,
 ambiente text[],
 ambiente_notas text,
 musica_en_vivo_notas text,
 accesibilidad_notas text,
 opciones_dietarias_notas text,
 fuentes jsonb not null default '{}'::jsonb check (jsonb_typeof(fuentes)='object'),
 pendientes jsonb not null default '{}'::jsonb check (jsonb_typeof(pendientes)='object'),
 actualizado_en timestamptz not null default now()
);
comment on table public.comercio_restaurante_experience is 'Ficha interna piloto de restaurantes. NULL significa desconocido. No habilita recomendaciones públicas ni modifica membresías. Menús y precios se consultan desde menus/productos por comercio_id.';
alter table public.comercio_restaurante_experience enable row level security;
revoke all on public.comercio_restaurante_experience from public, anon, authenticated;
grant select, insert, update, delete on public.comercio_restaurante_experience to service_role;
