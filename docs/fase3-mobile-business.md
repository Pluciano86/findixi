# Fase 3 - Expo Business App (Findixi Business)

Objetivo: arrancar `apps/mobile-business` en paralelo a web y `mobile-public`, sin tocar `public/comercio/admin` ni romper staging actual.

## Estado de arranque (hecho)

Se creó la base de `apps/mobile-business` con:

1. Proyecto Expo Router compatible con SDK 54.
2. Configuración segura de env + Supabase:
   - `src/config/env.ts`
   - `src/lib/supabase.ts`
3. Uso de `@findixi/shared` desde el día 1:
   - `resolverPlanComercio`
   - `formatearTelefonoDisplay`
   - `formatearMonedaUSD`
   - `DEFAULT_APP_BASE_URLS`
4. Pantallas MVP iniciales:
   - `/` Dashboard
   - `/login`
   - `/pedidos`
   - `/perfil`
5. QA técnico base:
   - `health:check`
   - `route:check`
   - `qa:smoke`

## Bloques propuestos Fase 3

### Bloque 3.0 - Bootstrap (completado)
- Estructura de app lista.
- Login con Supabase.
- Lectura de perfil de comercio vinculado por usuario.

### Bloque 3.1 - Datos reales de negocio
- Integrar pedidos reales del comercio autenticado.
- Integrar edición básica de datos de perfil (read/write controlado).
- Agregar estados de carga/errores equivalentes a web comercio.

### Bloque 3.2 - Paridad funcional con portal comercio
- Replicar módulos prioritarios del portal comercio en móvil:
  1. Horarios
  2. Amenidades
  3. Categorías/subcategorías
  4. Menú y especiales (por fases)

### Bloque 3.3 - QA y freeze business
- Matriz QA manual por flujo de negocio.
- Gating técnico equivalente a `mobile-public`.
- Cierre con acta de freeze de Fase 3.

## Cómo correr local

Desde `apps/mobile-business`:

```bash
npm install
cp .env.example .env
# completar EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY
npm run qa:smoke
npm run start
```

## Definition of Done de arranque Fase 3

1. `mobile-business` inicia en Expo Router.
2. Login autentica con Supabase.
3. Dashboard y Perfil cargan datos de comercio vinculado cuando existe.
4. `qa:smoke` pasa.
5. Sin impacto en `public`, `comercio` y `admin`.
