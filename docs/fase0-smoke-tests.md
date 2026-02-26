# Fase 0 - Smoke Tests (12 rutas clave)

## Regla global de validacion
- Abrir cada ruta en staging.
- Validar funcionalidad principal de la pantalla.
- Validar consola limpia:
  - Sin errores rojos.
  - Sin 404 de modulos JS.
  - Sin errores de inicializacion de Supabase o funciones.

## Public - `test.findixi.com`
1. `https://test.findixi.com/`
- Validar: header/footer, categorias, areas, banners, popups base.

2. `https://test.findixi.com/listadoComercios.html`
- Validar: listado carga, filtros responden, ordenamiento, paginacion/ver mas.

3. `https://test.findixi.com/perfilComercio.html?id=<ID_VALIDO>`
- Validar: perfil carga, logo/galeria/horarios/redes, favoritos y secciones cercanos.

4. `https://test.findixi.com/logearse.html`
- Validar: login email/password, OAuth visible, redireccion post login.

## Comercio - `comercio.findixi.com`
5. `https://comercio.findixi.com/login.html`
- Validar: auth comercio, manejo de errores y retorno a panel.

6. `https://comercio.findixi.com/index.html?id=<ID_VALIDO>`
- Validar: dashboard carga, perfil usuario, tarjetas y acciones de comercios.

7. `https://comercio.findixi.com/editarPerfilComercio.html?id=<ID_VALIDO>`
- Validar: lectura y guardado de campos, horarios, estados de plan/verificacion.

8. `https://comercio.findixi.com/adminMenuComercio.html?id=<ID_VALIDO>`
- Validar: menu secciones/productos, guardado, previews y assets.

## Admin - `administ.findixi.com`
9. `https://administ.findixi.com/login.html`
- Validar: auth admin y redireccion al panel.

10. `https://administ.findixi.com/adminComercios.html`
- Validar: listado comercios, filtros, acciones de gestion.

11. `https://administ.findixi.com/crearComercio.html`
- Validar: formulario completo, categorias/subcategorias, guardado inicial.

12. `https://administ.findixi.com/editarComercio.html?id=<ID_VALIDO>`
- Validar: carga completa de datos, logo/galeria/horario/amenidades/categorias, guardar cambios.

## Datos de prueba sugeridos
- `<ID_VALIDO>`: comercio activo con logo, portada, horarios y menu.
- Usuario commerce con permisos sobre ese comercio.
- Usuario admin con permisos de crear/editar/listar.
