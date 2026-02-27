# Mobile Home Web Parity

## Objetivo
Replicar lo mas exacto posible la estructura de `public/index.html` dentro de `apps/mobile-public`, sin tabs nativos y consumiendo data real desde Supabase.

## Resultado
Se implemento Home web-style con esta secuencia visual:
1. Header naranja con logo centrado
2. Carrusel horizontal superior (banners globales)
3. Titulo `Categorias mas Buscadas`
4. Grid 3x2 de categorias (con imagen circular azul)
5. Texto `Ver todas las Categorias...`
6. Card blanca de `Especiales de Almuerzo` / `Happy Hour`
7. Titulo `¡Aqui si, se come Brutal!` + rail de comercios
8. Titulo `¿Nos Fuimos pal Jangueo?` + rail de comercios
9. Titulo `Chequea los proximos Eventos` + rail de eventos
10. Hero `Vamos Pa' la Playa`
11. Titulo `Descubre lo que hay en tu Area` + grid de areas
12. CTA de negocios
13. Footer azul oscuro con 4 iconos (Inicio, Cerca de Mi, Eventos, Perfil)

## Data desde Supabase
`apps/mobile-public/src/features/home/api.ts` carga:
- `banners` (tipo global, activos y dentro de fecha)
- `Categorias`
- `Comercios` + `ComercioCategorias` + `imagenesComercios` para rails de comida/jangueo
- `eventos` (+ sede principal)
- `Area`

## Archivos nuevos
- `apps/mobile-public/src/features/home/types.ts`
- `apps/mobile-public/src/features/home/api.ts`
- `apps/mobile-public/src/components/home/HomeComercioRail.tsx`
- `apps/mobile-public/src/components/home/HomeEventosRail.tsx`
- `apps/mobile-public/src/components/home/HomeAreasGrid.tsx`
- `apps/mobile-public/src/components/home/HomeHeroPlaya.tsx`
- `apps/mobile-public/src/components/home/HomeBusinessCta.tsx`
- `apps/mobile-public/src/components/home/HomeLoadingBlock.tsx`

## Archivos actualizados
- `apps/mobile-public/app/index.tsx`
- `apps/mobile-public/src/components/home/HeaderWebStyle.tsx`
- `apps/mobile-public/src/components/home/FooterWebStyle.tsx`
- `apps/mobile-public/src/components/home/HomeCarousel.tsx`
- `apps/mobile-public/src/components/home/HomeCategoriesGrid.tsx`
- `apps/mobile-public/src/components/home/HomeEspecialesCard.tsx`

## Rutas y navegacion
- Sin `Tabs` nativos (solo `Stack`)
- Home raiz en `app/index.tsx`
- Footer web-style navega a:
  - `/`
  - `/comercios`
  - `/eventos`
  - `/cuenta`

## No afectado
- No se tocaron `public/`, `comercio/`, `admin/`
- No se tocaron publish dirs ni configuracion Netlify
- No se agregaron secretos
- El cliente Supabase mobile sigue centralizado en `src/config/env.ts` + `src/lib/supabase.ts`
