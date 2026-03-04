# Bloque 2.7 - Phase 2 Close

Objetivo: cerrar formalmente Fase 2 con evidencia técnica + manual y acta de freeze generada.

## Comando único de cierre

Desde raíz del repo:

```bash
npm --prefix apps/mobile-public run qa:phase2-close
```

Este comando ejecuta en secuencia:

1. `qa:phase2-gate`
   - `qa:release-gate`
   - `qa:report:validate`
   - `qa:freeze:check`
2. `qa:freeze:report`
   - genera `docs/release-reports/mobile-public-phase2-freeze-YYYY-MM-DD.md`

## Requisitos previos

1. Reporte QA del día (`docs/qa-reports/mobile-public-parity-YYYY-MM-DD.md`) sin pendientes.
2. Decision final marcada:
   - `PASS Bloque 2.4`
   - y `FAIL` desmarcado.

## Definition of Done (Bloque 2.7)

1. `qa:phase2-close` en verde.
2. Acta de freeze creada en `docs/release-reports/`.
3. Fase 2 queda oficialmente cerrada para `mobile-public`.
