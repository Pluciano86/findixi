alter table public.comercio_restaurante_experience add column codigo_vestimenta text;
comment on column public.comercio_restaurante_experience.codigo_vestimenta is 'Texto libre con restricciones confirmadas. N/A = no aplica confirmado; NULL = pendiente. No inferir reglas desde el ambiente.';
comment on column public.comercio_restaurante_experience.acepta_mascotas is 'Campo legado del piloto. FE debe consultar comercioAmenidades/Amenidades para Pet Friendly; no usar esta copia como autoridad.';
