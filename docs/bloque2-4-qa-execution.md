# Bloque 2.4 - Ejecucion QA de Cierre (Public App)

Objetivo: cerrar la paridad web/mobile con evidencia reproducible (gates tecnicos + reporte manual por dispositivo).

## 1) Gates tecnicos

Desde raiz del repo:

```bash
npm --prefix apps/mobile-public run qa:release-gate
```

Incluye:
1. `qa:smoke` (health, i18n, typecheck, route-check)
2. `qa:parity` (layout stack, pantallas criticas con `PublicAppChrome`, footer legal links)

## 2) Crear reporte de QA del dia

```bash
npm --prefix apps/mobile-public run qa:report:new
```

Genera:
- `docs/qa-reports/mobile-public-parity-YYYY-MM-DD.md`

## 3) Ejecutar pruebas manuales en dispositivo

Completar el reporte generado con:
1. Datos de dispositivo/red/comando Expo.
2. Checklist funcional por flujo.
3. Findings (si hay).
4. Decision final PASS/FAIL.

## Definition of Done (Bloque 2.4)

1. `qa:release-gate` en verde.
2. Reporte del dia creado y completado.
3. Decision final documentada con PASS o FAIL y blockers.
