# Fase 2 - Expo Public (arranque)

## Objetivo
Iniciar `apps/mobile-public` en paralelo a web, con Expo Router + TypeScript, consumiendo `packages/shared` sin tocar HTML ni publish dirs de Netlify.

## Estructura creada
- `apps/mobile-public/app/_layout.tsx`
- `apps/mobile-public/app/(tabs)/_layout.tsx`
- `apps/mobile-public/app/(tabs)/index.tsx`
- `apps/mobile-public/app/(tabs)/comercios.tsx`
- `apps/mobile-public/app/(tabs)/cuenta.tsx`
- `apps/mobile-public/app/comercio/[id].tsx`
- `apps/mobile-public/src/features/comercios/api.ts`
- `apps/mobile-public/src/features/comercios/types.ts`
- `apps/mobile-public/src/lib/supabase.ts`
- `apps/mobile-public/src/lib/storage.ts`
- `apps/mobile-public/src/lib/favorites.ts`
- `apps/mobile-public/src/lib/location.ts`
- `apps/mobile-public/src/lib/env.ts`
- `apps/mobile-public/src/components/ScreenState.tsx`

## Integracion con shared (real)
Se usa `@findixi/shared` en pantallas reales:
- `PLANES_PRELIMINARES` y `formatoPrecio` en Home.
- `resolverPlanComercio`, `formatearTelefonoDisplay`, `formatearTelefonoHref`, `calcularDistanciaHaversineKm`, `calcularTiempoEnVehiculo` en Listado.
- `resolverPlanComercio`, `formatearMonedaUSD`, `formatearTelefonoDisplay`, `formatearTelefonoHref`, `calcularDistanciaHaversineKm`, `calcularTiempoEnVehiculo` en Detalle.

## Supabase y modo read-first
- Cliente en `src/lib/supabase.ts`.
- Consulta read-only para listado y detalle en `src/features/comercios/api.ts`.
- Login en `Cuenta` es opcional.
- Si faltan variables de entorno, la app mantiene estado controlado y muestra advertencia.

## Storage/session adapter
- Adapter cross-platform en `src/lib/storage.ts`.
- Native: `SecureStore` con fallback a `AsyncStorage`.
- Web: `localStorage`.
- Se usa para sesion Supabase y favoritos locales (`src/lib/favorites.ts`).

## Geolocalizacion (happy path)
- `src/lib/location.ts` pide permiso foreground.
- Listado y Detalle pueden calcular distancia/tiempo cuando hay ubicacion.

## Como correr (local)
1. Ir al proyecto Expo:
   - `cd apps/mobile-public`
2. Crear variables de entorno:
   - `cp .env.example .env`
   - completar `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Instalar dependencias:
   - `npm install`
4. Levantar app:
   - `npm run start`
   - iOS: `npm run ios`
   - Android: `npm run android`

## QA minimo (Fase 2)
- [ ] Home abre y muestra planes.
- [ ] Listado carga comercios desde Supabase.
- [ ] Tap en comercio abre detalle.
- [ ] Boton de ubicacion calcula distancia en listado.
- [ ] Cuenta muestra estado de sesion.
- [ ] Sin cambios funcionales en web (`public/comercio/admin`).

## Pendiente para Business (fase futura)
- Crear `apps/mobile-business` con mismo baseline de router/config.
- Reusar `packages/shared` + package de UI compartida si se define.
- Agregar auth/roles y flujos write para comercio.
