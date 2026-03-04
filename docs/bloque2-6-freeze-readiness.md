# Bloque 2.6 - Freeze Readiness

Objetivo: validar que `apps/mobile-public` quede lista para freeze de Fase 2 sin secretos hardcodeados ni drift de configuración crítica.

## Comandos

Desde raíz del repo:

```bash
npm --prefix apps/mobile-public run qa:freeze:check
```

Gate completo de Fase 2:

```bash
npm --prefix apps/mobile-public run qa:phase2-gate
```

## Qué valida `qa:freeze:check`

1. `src/config/env.ts` sigue centralizando `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. `src/lib/supabase.ts` consume `config/env` y no lee `process.env` directo.
3. No hay JWT-like tokens hardcodeados dentro de `apps/mobile-public`.
4. Scripts QA críticos presentes:
   - `health-check`
   - `i18n-check`
   - `route-check`
   - `parity-check`
   - `qa-report-validate`

## Definition of Done (Bloque 2.6)

1. `qa:freeze:check` en verde.
2. `qa:phase2-gate` en verde una vez el reporte QA del día esté en PASS.
3. Fase 2 queda lista para freeze operativo.
