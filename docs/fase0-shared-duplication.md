# Fase 0 - Shared Duplicado (Diagnostico y Fuente de Verdad)

## Estado actual
Hoy existen modulos `shared` duplicados por app para soportar deploys separados (`public`, `comercio`, `admin`).

## Duplicados detectados
1. `*/shared/supabaseClient.js`
- `public/shared/supabaseClient.js` y `comercio/shared/supabaseClient.js` estan alineados.
- `admin/shared/supabaseClient.js` agrega `idComercio` desde query string.
- `shared/supabaseClient.js` (root) no incluye `idComercio`.

2. `*/shared/utils.js`
- `public/shared/utils.js` tiene helpers adicionales de telefono.
- `shared/utils.js` (root) incluye `buildStorageUrl` (no presente en admin/comercio).
- `admin/shared/utils.js` y `comercio/shared/utils.js` tienen subset.

3. `*/shared/planes.js`
- `admin/shared/planes.js`, `comercio/shared/planes.js` y `public/shared/planes.js` estan alineados.
- `shared/planes.js` (root) esta atrasado respecto a reglas de verificacion de propiedad.

4. Runtime config nuevo
- `shared/runtimeConfig.js` creado como base.
- Copiado en `public/shared/runtimeConfig.js`, `comercio/shared/runtimeConfig.js`, `admin/shared/runtimeConfig.js` para no romper deploy por carpeta.

## Fuente de verdad definida para Fase 1
1. Regla de planes: `public/shared/planes.js` (replicar luego a `packages/shared/rules/planes`).
2. Utils generales: `public/shared/utils.js` como base + merge de `shared/utils.js`.
3. Supabase client: `public/shared/supabaseClient.js` como base; quitar `idComercio` del cliente y moverlo a helpers por feature.
4. Runtime domains: `shared/runtimeConfig.js` como plantilla canonica.

## Decisiones de Fase 0
- No se unifica logica todavia para evitar regresiones.
- Solo se documenta el estado y se define la ruta de convergencia para Fase 1.
