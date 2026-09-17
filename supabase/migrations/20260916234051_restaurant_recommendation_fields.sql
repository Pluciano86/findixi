alter table public.comercio_restaurante_experience
 add column presupuesto_min_persona numeric(10,2),
 add column presupuesto_max_persona numeric(10,2),
 add column presupuesto_moneda text,
 add column presupuesto_incluye_impuestos boolean,
 add column presupuesto_incluye_propina boolean,
 add column presupuesto_notas text,
 add column opciones_vegetarianas boolean,
 add column opciones_veganas boolean,
 add column opciones_sin_gluten boolean,
 add column manejo_alergenos_notas text,
 add column acceso_silla_ruedas boolean,
 add column bano_accesible boolean,
 add column acepta_grupos boolean,
 add column tamano_max_grupo integer,
 add column grupos_notas text,
 add column nivel_ruido_habitual text,
 add column requiere_confirmar_datos boolean not null default true,
 add column verificado_en timestamptz,
 add column revisar_antes_de timestamptz,
 add constraint restaurante_presupuesto_valido check (
   (presupuesto_min_persona is null or presupuesto_min_persona >= 0)
   and (presupuesto_max_persona is null or presupuesto_max_persona >= 0)
   and (presupuesto_min_persona is null or presupuesto_max_persona is null
        or presupuesto_max_persona >= presupuesto_min_persona)
   and ((presupuesto_min_persona is null and presupuesto_max_persona is null)
        or presupuesto_moneda is not null)),
 add constraint restaurante_moneda_valida check (presupuesto_moneda ~ '^[A-Z]{3}$'),
 add constraint restaurante_grupo_valido check (tamano_max_grupo > 0 and (acepta_grupos is distinct from false or tamano_max_grupo is null)),
 add constraint restaurante_ruido_valido check (nivel_ruido_habitual in ('tranquilo','moderado','animado','variable')),
 add constraint restaurante_revision_valida check (revisar_antes_de is null or verificado_en is null or revisar_antes_de >= verificado_en);
comment on column public.comercio_restaurante_experience.presupuesto_min_persona is 'Estimación documentada por persona, no precio de un plato. No calcular desde el producto más barato. Fuente y fecha en fuentes.';
comment on column public.comercio_restaurante_experience.opciones_sin_gluten is 'Oferta declarada, no garantía de ausencia de contaminación cruzada ni de seguridad para alergias.';
comment on column public.comercio_restaurante_experience.verificado_en is 'Fecha de revisión de información gastronómica, no verificación de propiedad o membresía.';
comment on column public.comercio_restaurante_experience.requiere_confirmar_datos is 'Por defecto true. Resolver pendientes y procedencia antes de recomendar afirmaciones específicas.';
