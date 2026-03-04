# Bloque 2.1 - QA Paridad Web vs Mobile (Public)

Objetivo: validar que `apps/mobile-public` mantenga paridad funcional con `public` en flujos críticos, sin tocar `public/comercio/admin`.

## Smoke técnico (automático)

Desde `apps/mobile-public`:

```bash
npm run qa:smoke
```

Incluye:
1. `health:check` (env, lockfiles, babel, node_modules, npm tree)
2. `i18n:check` (claves `t('...')` definidas + detección de textos hardcodeados no bloqueante)
3. `typecheck` (TypeScript)
4. `route:check` (rutas `router.push/replace` y `pathname: '/...'` resuelven a pantallas reales)

## Matriz QA manual (Expo)

1. Home (`/`)
- Validar header/footer visibles, idioma cambia labels, carruseles cargan, video playa reproduce.
- Validar tap en tarjetas/banners abre destino correcto.

2. Listado Comercios (`/comercios`)
- Validar filtros, búsqueda, switches y orden por cercanía.
- Validar tarjetas: teléfono marca, tap de tarjeta abre perfil.

3. Perfil Comercio (`/comercio/[id]`)
- Validar favorito, horario, distancia, mapas/waze, amenidades y menú.
- Validar “Abrir GPS/Ir mediante GPS” abre selector y navegación externa.

4. Cerca de mí (`/cercademi`)
- Validar ubicación, mapa, centrado de usuario, tarjetas y CTA de ruta.
- Validar que tap teléfono solo llame y no navegue al perfil.

5. Playas (`/playas` + `/playa/[id]`)
- Validar filtros, clima/iconos, distancia en una línea, perfiles y cercanos.

6. Eventos (`/eventos`) y Especiales (`/especiales`)
- Validar fecha/hora, múltiples fechas/localidades y links.

7. Login + Usuario + Pedidos
- Login email/password + Google (si aplica en dispositivo).
- Perfil usuario y pedidos cargan; navegación desde footer funciona.

8. Legal
- `/privacy-policy` y `/terms-of-service` cargan y reflejan idioma activo.

## Criterio de cierre Bloque 2.1

Se considera cerrado cuando:
1. `npm run qa:smoke` pasa sin errores.
2. Matriz QA manual pasa en los 8 flujos anteriores.
3. No hay regresiones visuales/funcionales reportadas en staging app.
