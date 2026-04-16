# Reemplazo menu comercio 7

Orden recomendado:
0. Ejecutar migración `supabase/migrations/20260416130500_add_productos_precio_texto.sql`.
1. Ejecutar `supabase/imports/comercio_7_menu_delete_only.sql` (solo borrar).
2. Ejecutar `supabase/imports/comercio_7_menu_reemplazo.sql` (insertar menu nuevo).

Archivo principal:
- `supabase/imports/comercio_7_menu_reemplazo.sql`

Datos fuente:
- `supabase/imports/comercio_7_menu_reemplazo.csv`

## Que hace el SQL
1. Borra todos los `productos` asociados a `menus` del comercio `id=7`.
2. Borra todos los `menus` del comercio `id=7`.
3. Inserta 9 secciones nuevas.
4. Inserta 64 productos nuevos.

## Como ejecutarlo
1. Abre Supabase SQL Editor del proyecto.
2. Pega el contenido de `comercio_7_menu_reemplazo.sql`.
3. Ejecuta.

## Nota de precio por peso
- `Rabo de langosta con mofongo`
- `Chillo entero con tostones`

Se cargan con `precio = 0` y `precio_texto = 'Precio según peso'`.
Si no existe la columna `precio_texto`, el script sigue funcionando y guarda solo el precio numérico.
