# CSVs comercio 7

Archivos:
- `comercio_7_menus.csv` (9 secciones)
- `comercio_7_productos.csv` (64 productos, ya mapeado con `idMenu` 299-307)
  columnas: `idMenu,orden,nombre,descripcion,precio,precio_texto,activo,no_traducir_nombre`
- `comercio_7_productos_precio_variable.csv` (2 productos con `precio_texto = "Precio según peso"`)
- `comercio_7_productos_por_seccion.csv` (respaldo del formato anterior por sección)

Nota:
- Estos CSV son para el reemplazo total del menu de `idComercio=7`.
- Para soportar `precio_texto`, aplica la migración:
  `supabase/migrations/20260416130500_add_productos_precio_texto.sql`
- Paso 1 (borrar): `comercio_7_menu_delete_only.sql`
- Paso 2 (reinsertar): `comercio_7_menu_reemplazo.sql`
