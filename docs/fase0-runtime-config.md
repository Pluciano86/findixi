# Fase 0 - Runtime Config (Dominios y URLs)

## Objetivo
Eliminar hardcodes legacy de dominios en flujos criticos y concentrar URLs base en un solo modulo de config por app.

## Archivos de config
- Fuente base: `shared/runtimeConfig.js`
- Copias runtime por app (compatibles con deploy por carpeta):
  - `public/shared/runtimeConfig.js`
  - `comercio/shared/runtimeConfig.js`
  - `admin/shared/runtimeConfig.js`

## Valores por defecto (staging)
- Public web: `https://test.findixi.com`
- Comercio web: `https://comercio.findixi.com`
- Admin web: `https://administ.findixi.com`

## Variables de entorno soportadas
- `FINDIXI_PUBLIC_BASE_URL`
- `FINDIXI_COMERCIO_BASE_URL`
- `FINDIXI_COMERCIO_LOGIN_BASE_URL`
- `FINDIXI_ADMIN_BASE_URL`
- Alias opcionales:
  - `PUBLIC_BASE_URL`
  - `COMERCIO_BASE_URL`
  - `COMERCIO_LOGIN_BASE_URL`
  - `ADMIN_BASE_URL`

## Flujos actualizados
- `admin/js/botonAdminMenu.js`
- `admin/js/botonEspeciales.js`
- `public/js/registroComercio.js`
- `public/js/perfil.js`
- `public/js/cuentaUsuario.js`

## Notas
- En local (`localhost/127.0.0.1`) la config usa rutas por carpeta:
  - `/public`
  - `/comercio`
  - `/admin`
- Esto evita romper Live Server o staging mientras se mantiene separacion por app.
