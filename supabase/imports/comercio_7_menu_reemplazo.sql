-- Reemplazo completo de menu para comercio id=7
-- Este script borra todas las secciones/productos actuales del comercio 7
-- y luego inserta los datos nuevos definidos abajo.

begin;

do $$
declare
  v_menu_comercio_col text;
  v_producto_menu_col text;
  v_has_precio_texto boolean := false;
  v_precio_nullable boolean;
  v_precio_expr text;
begin
  -- Compatibilidad por si las columnas estan en camelCase o lowercase.
  select case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'menus' and column_name = 'idComercio'
    ) then '"idComercio"'
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'menus' and column_name = 'idcomercio'
    ) then 'idcomercio'
    else null
  end into v_menu_comercio_col;

  if v_menu_comercio_col is null then
    raise exception 'No existe columna idComercio/idcomercio en public.menus';
  end if;

  select case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'productos' and column_name = 'idMenu'
    ) then '"idMenu"'
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'productos' and column_name = 'idmenu'
    ) then 'idmenu'
    else null
  end into v_producto_menu_col;

  if v_producto_menu_col is null then
    raise exception 'No existe columna idMenu/idmenu en public.productos';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'productos'
      and column_name = 'precio_texto'
  ) into v_has_precio_texto;

  select coalesce((
    select is_nullable = 'YES'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'productos'
      and column_name = 'precio'
    limit 1
  ), true) into v_precio_nullable;

  create temporary table tmp_menu_seed (
    seccion_orden int primary key,
    seccion_titulo text not null
  ) on commit drop;

  insert into tmp_menu_seed (seccion_orden, seccion_titulo)
  values
    (1, 'Aperitivos'),
    (2, 'Empanadillas'),
    (3, 'Tostones rellenos'),
    (4, 'Menu de ninos'),
    (5, 'Mofongo'),
    (6, 'Ensaldas'),
    (7, 'Asopaos'),
    (8, 'Recomendaciones del Chef'),
    (9, 'Acompanantes adicionales');

  create temporary table tmp_producto_seed (
    seccion_orden int not null,
    producto_orden int not null,
    producto_nombre text not null,
    producto_descripcion text,
    producto_precio numeric(10,2),
    producto_precio_texto text,
    primary key (seccion_orden, producto_orden)
  ) on commit drop;

  insert into tmp_producto_seed (
    seccion_orden,
    producto_orden,
    producto_nombre,
    producto_descripcion,
    producto_precio,
    producto_precio_texto
  )
  values
    (1, 1, 'Sopa del dia', null, 6.99, null),
    (1, 2, 'Sampler criollo', null, 25, null),
    (1, 3, 'Chorizo al vino', null, 12, null),
    (1, 4, 'Queso frito', null, 10, null),
    (1, 5, 'Sorullitos', null, 10, null),
    (1, 6, 'Tuna tartar', null, 25, null),
    (1, 7, 'Jalea tabla', null, 25, null),
    (1, 8, 'Tabla cortes frios', null, 20, null),
    (1, 9, 'Honey garlic wings', null, 12, null),
    (1, 10, 'Parmesan garlic wings', null, 12, null),
    (1, 11, 'Deditos de pescado con tostones', null, 20, null),
    (1, 12, 'Setas rellenas de manchego y prosciutto', null, 15, null),
    (1, 13, 'Kan kan strips guacamole tostones', null, 25, null),

    (2, 1, 'Pollo', null, 5, null),
    (2, 2, 'Camarones', null, 7, null),
    (2, 3, 'Pulpo', null, 7, null),
    (2, 4, 'Langosta', null, 8, null),
    (2, 5, 'Churrasco', null, 7, null),
    (2, 6, 'Pescado', null, 7, null),
    (2, 7, 'Jueyes', null, 7, null),
    (2, 8, 'Carrucho', null, 10, null),

    (3, 1, 'Pollo', null, 15, null),
    (3, 2, 'Churrasco', null, 20, null),
    (3, 3, 'Camarones', null, 20, null),
    (3, 4, 'Pulpo', null, 20, null),
    (3, 5, 'Carrucho', null, 25, null),

    (4, 1, 'Cheeseburger papas fritas', null, 9, null),
    (4, 2, 'Tenders fritas o arroz habichuelas', null, 9, null),
    (4, 3, 'Deditos de pescado papas fritas o arroz haichuelas', null, 9, null),

    (5, 1, 'Churrasco', null, 29.99, null),
    (5, 2, 'Pulpo', null, 29.99, null),
    (5, 3, 'Camarones', null, 29.99, null),
    (5, 4, 'Langosta', null, 55, null),
    (5, 5, 'Carrucho', null, 29.99, null),
    (5, 6, 'Pollo', null, 20, null),
    (5, 7, 'Mixto', null, 45, null),

    (6, 1, 'Carrucho', null, 29.99, null),
    (6, 2, 'Camarones', null, 29.99, null),
    (6, 3, 'Pulpo', null, 29.99, null),
    (6, 4, 'Langosta', null, 55, null),
    (6, 5, 'Mixta', null, 45, null),

    (7, 1, 'Pollo', null, 20, null),
    (7, 2, 'Camarones', null, 29.99, null),
    (7, 3, '8 potencias', null, 45, null),
    (7, 4, 'Langosta', null, 55, null),

    (8, 1, 'Pechuga rellena de amarillo y chorizo con arroz con cilantro', null, 25, null),
    (8, 2, 'Pechuga rellena de manchego y prosciutto con arroz con cebolla', null, 30, null),
    (8, 3, 'Bistec encebollado de filete mignon con arroz blanco y habichuelas', null, 29.99, null),
    (8, 4, 'Dorado relleno de camarones con papa y batata salteada', null, 40, null),
    (8, 5, 'Salmon en crema de alcaparra con papa y batata salteada', null, 29.99, null),
    (8, 6, 'Churrasco chimichurri con arroz mamposteao jibaro', null, 29.99, null),
    (8, 7, 'Rabo de langosta con mofongo', null, 0, 'Precio según peso'),
    (8, 8, 'Chillo entero con tostones', null, 0, 'Precio según peso'),
    (8, 9, 'Chicharrones de pollo con tostones', null, 15, null),
    (8, 10, 'Carne frita con tostones', null, 15, null),

    (9, 1, 'Arroz con habichuelas', null, 5, null),
    (9, 2, 'Arroz mamposteao', null, 7, null),
    (9, 3, 'Arroz con cebolla', null, 5, null),
    (9, 4, 'Mofongo', null, 6, null),
    (9, 5, 'Arroz cilantro', null, 5, null),
    (9, 6, 'Amarillos', null, 5, null),
    (9, 7, 'Truffle fries', null, 6, null),
    (9, 8, 'Tostones', null, 5, null),
    (9, 9, 'Ensalda verde', null, 5, null);

  execute format(
    'delete from public.productos p using public.menus m where p.%s = m.id and m.%s = $1',
    v_producto_menu_col,
    v_menu_comercio_col
  ) using 7;

  execute format(
    'delete from public.menus where %s = $1',
    v_menu_comercio_col
  ) using 7;

  create temporary table tmp_menu_map (
    seccion_orden int primary key,
    id_menu bigint not null
  ) on commit drop;

  execute format($f$
    with ins as (
      insert into public.menus (%s, titulo, subtitulo, descripcion, orden, activo)
      select
        $1,
        seccion_titulo,
        null,
        null,
        seccion_orden,
        true
      from tmp_menu_seed
      order by seccion_orden
      returning id, orden
    )
    insert into tmp_menu_map (seccion_orden, id_menu)
    select orden, id from ins
  $f$, v_menu_comercio_col) using 7;

  v_precio_expr := case
    when v_precio_nullable then 'p.producto_precio'
    else 'coalesce(p.producto_precio, 0)'
  end;

  if v_has_precio_texto then
    execute format($f$
      insert into public.productos (nombre, descripcion, precio, precio_texto, orden, activo, %s)
      select
        p.producto_nombre,
        nullif(trim(coalesce(p.producto_descripcion, '')), ''),
        %s,
        nullif(trim(coalesce(p.producto_precio_texto, '')), ''),
        p.producto_orden,
        true,
        mm.id_menu
      from tmp_producto_seed p
      join tmp_menu_map mm on mm.seccion_orden = p.seccion_orden
      order by p.seccion_orden, p.producto_orden
    $f$, v_producto_menu_col, v_precio_expr);
  else
    execute format($f$
      insert into public.productos (nombre, descripcion, precio, orden, activo, %s)
      select
        p.producto_nombre,
        nullif(trim(coalesce(p.producto_descripcion, '')), ''),
        %s,
        p.producto_orden,
        true,
        mm.id_menu
      from tmp_producto_seed p
      join tmp_menu_map mm on mm.seccion_orden = p.seccion_orden
      order by p.seccion_orden, p.producto_orden
    $f$, v_producto_menu_col, v_precio_expr);
  end if;

  raise notice 'Menu comercio 7 reemplazado correctamente: % secciones, % productos',
    (select count(*) from tmp_menu_seed),
    (select count(*) from tmp_producto_seed);
end $$;

commit;
