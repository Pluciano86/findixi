# Fase 1 - Migracion a `packages/shared` (incremental)

## Alcance aplicado
- Sin cambios de HTML ni navegacion.
- Sin cambios de UI.
- Extraccion de logica pura a `packages/shared`.
- Consumo progresivo en `public`, luego `comercio` y `admin`.

## Estructura creada
- `packages/shared/package.json`
- `packages/shared/src/index.js`
- `packages/shared/src/config/domains.js`
- `packages/shared/src/types/index.js`
- `packages/shared/src/rules/planes.js`
- `packages/shared/src/utils/formatters.js`
- `packages/shared/src/utils/distance.js`

## Canonical source elegido
1. Reglas de planes:
- Canonico: `packages/shared/src/rules/planes.js`

2. Formateadores puros:
- Canonico: `packages/shared/src/utils/formatters.js`
- Incluye telefono, horario y moneda.

3. Distancia pura:
- Canonico: `packages/shared/src/utils/distance.js`
- Incluye haversine y tiempo estimado por distancia.

4. Constantes de dominio sin `window`:
- Canonico: `packages/shared/src/config/domains.js`

## Estrategia de deploy sin romper staging
Como cada app publica su propio folder (`public/`, `comercio/`, `admin/`), se sincroniza el paquete a rutas deployables:
- `public/shared/pkg/*`
- `comercio/shared/pkg/*`
- `admin/shared/pkg/*`

Script:
- `npm run sync:shared`
- Implementado en `tools/sync-shared-package.mjs`

## Integracion progresiva aplicada
### Public
- `public/shared/planes.js` -> re-export a `./pkg/rules/planes.js`
- `public/js/distanciaLugar.js` -> usa `../shared/pkg/utils/distance.js`
- `public/js/calcularTiemposParaLista.js` -> usa `../shared/pkg/utils/distance.js`

### Comercio
- `comercio/shared/planes.js` -> re-export a `./pkg/rules/planes.js`

### Admin
- `admin/shared/planes.js` -> re-export a `./pkg/rules/planes.js`

## Resultado esperado
- Unica fuente de verdad para logica pura en `packages/shared`.
- Reduccion del drift entre apps para planes y utilidades puras.
- Sin cambios visuales y sin tocar navegacion.
