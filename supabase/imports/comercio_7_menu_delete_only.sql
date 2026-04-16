-- Paso 1: eliminar toda la data de menu del comercio id=7
-- Incluye: menus, productos y traducciones relacionadas.
-- No toca data de otros comercios.

begin;

do $$
declare
  v_id_comercio constant bigint := 7;
  v_menu_comercio_col text;
  v_producto_menu_col text;
  v_orden_item_prod_col text;
  v_menu_ids bigint[] := '{}'::bigint[];
  v_producto_ids bigint[] := '{}'::bigint[];
  v_menus_count bigint := 0;
  v_productos_count bigint := 0;
  v_has_orden_items boolean := false;
  v_orden_items_refs bigint := 0;
begin
  -- Compatibilidad de columnas (camelCase/lowercase)
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

  -- IDs actuales del comercio 7
  execute format(
    'select coalesce(array_agg(id), ''{}''::bigint[]) from public.menus where %s = $1',
    v_menu_comercio_col
  ) into v_menu_ids using v_id_comercio;

  v_menus_count := coalesce(array_length(v_menu_ids, 1), 0);

  if v_menus_count > 0 then
    execute format(
      'select coalesce(array_agg(id), ''{}''::bigint[]) from public.productos where %s = any($1)',
      v_producto_menu_col
    ) into v_producto_ids using v_menu_ids;
  end if;

  v_productos_count := coalesce(array_length(v_producto_ids, 1), 0);

  -- Guardrail: si hay ordenes históricas amarradas por FK restrict, aborta con mensaje claro.
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'orden_items'
  ) into v_has_orden_items;

  if v_has_orden_items and v_productos_count > 0 then
    select case
      when exists (
        select 1
        from information_schema.columns
        where table_schema = 'public' and table_name = 'orden_items' and column_name = 'idProducto'
      ) then '"idProducto"'
      when exists (
        select 1
        from information_schema.columns
        where table_schema = 'public' and table_name = 'orden_items' and column_name = 'idproducto'
      ) then 'idproducto'
      else null
    end into v_orden_item_prod_col;

    if v_orden_item_prod_col is not null then
      execute format(
        'select count(*) from public.orden_items where %s = any($1)',
        v_orden_item_prod_col
      ) into v_orden_items_refs using v_producto_ids;
    end if;

    if v_orden_items_refs > 0 then
      raise exception 'No se puede borrar menu/productos de comercio %: existen % filas en orden_items referenciando esos productos.',
        v_id_comercio, v_orden_items_refs;
    end if;
  end if;

  -- 1) Borrar traducciones (si existen tablas)
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'productos_traducciones'
  ) and v_productos_count > 0 then
    delete from public.productos_traducciones
    where idproducto = any(v_producto_ids);
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'menus_traducciones'
  ) and v_menus_count > 0 then
    delete from public.menus_traducciones
    where idmenu = any(v_menu_ids);
  end if;

  -- 2) Borrar productos
  if v_menus_count > 0 then
    execute format(
      'delete from public.productos where %s = any($1)',
      v_producto_menu_col
    ) using v_menu_ids;
  end if;

  -- 3) Borrar menus
  execute format(
    'delete from public.menus where %s = $1',
    v_menu_comercio_col
  ) using v_id_comercio;

  raise notice 'Eliminacion completada para comercio %: % menus, % productos.',
    v_id_comercio, v_menus_count, v_productos_count;
end $$;

commit;
