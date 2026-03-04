# Bloque 2.5 - Closeout Gate (Fase 2)

Objetivo: no cerrar Fase 2 hasta que exista evidencia completa de QA manual + decision final.

## Comandos

Desde raiz del repo:

```bash
npm --prefix apps/mobile-public run qa:release-gate
npm --prefix apps/mobile-public run qa:report:validate
```

Atajo final:

```bash
npm --prefix apps/mobile-public run qa:close-gate
```

## Reglas del validador de reporte

`qa:report:validate` usa el reporte mas reciente `docs/qa-reports/mobile-public-parity-YYYY-MM-DD.md` y exige:

1. Gates tecnicos marcados:
   - `qa:smoke`
   - `qa:parity`
2. Decision marcada:
   - exactamente una opcion entre PASS/FAIL.
3. Si FAIL esta marcada, el comando falla.
4. No puede haber checkboxes pendientes en `Functional matrix`.

## Definition of Done (Bloque 2.5)

1. `qa:close-gate` pasa en verde.
2. Reporte del dia queda marcado `PASS Bloque 2.4`.
3. Fase 2 se considera lista para freeze.

Siguiente paso:
- ver [Bloque 2.6 Freeze Readiness](/Users/pedroluciano/Desktop/Findixi/Findixi-App/docs/bloque2-6-freeze-readiness.md)
