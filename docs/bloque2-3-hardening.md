# Bloque 2.3 - Hardening de Paridad (Public App)

Objetivo: evitar regresiones silenciosas en `apps/mobile-public` cuando se siga iterando en UI/JS, sin tocar `public/comercio/admin`.

## Qué se reforzó

1. `route:check` ahora valida dos cosas:
   - referencias de navegación (`router.push/replace`, `pathname`) resuelven a rutas reales.
   - las rutas críticas de producto existen físicamente en `app/`.

2. Rutas críticas obligatorias:
   - `/`
   - `/comercios`
   - `/comercio/[id]`
   - `/cercademi`
   - `/playas`
   - `/playa/[id]`
   - `/eventos`
   - `/especiales`
   - `/login`
   - `/usuario`
   - `/pedidos`
   - `/menu/[id]`
   - `/privacy-policy`
   - `/terms-of-service`

## Comando de validación

Desde `apps/mobile-public`:

```bash
npm run qa:smoke
```

## Definition of Done (Bloque 2.3)

1. `qa:smoke` pasa en local.
2. `route:check` reporta:
   - sin rutas no resueltas.
   - rutas críticas presentes.
3. Si alguien borra o renombra accidentalmente una pantalla crítica, el check falla inmediatamente.
