# Mobile Public QA Report - 2026-03-04

## Context
- Commit: `82923fcb7f24`
- Tester:
- Device:
- OS:
- Network mode: LAN / Tunnel / Hotspot
- Expo command:

## Technical gates
- [x] `npm --prefix apps/mobile-public run qa:smoke`
- [x] `npm --prefix apps/mobile-public run qa:parity`

## Functional matrix
1. Home (`/`)
- [ ] Header/footer visible + hide on scroll behavior
- [ ] Banners/carruseles/video load and interactions work

2. Comercios (`/comercios`)
- [ ] Filtros/switch/busqueda/orden por cercania
- [ ] Tap tarjeta abre perfil; tap telefono llama

3. Perfil comercio (`/comercio/[id]`)
- [ ] Horario/favorito/amenidades/maps-waze/menu
- [ ] CTA GPS abre selector y redireccion externa

4. Cerca de mi (`/cercademi`)
- [ ] Geolocalizacion + mapa + tarjetas
- [ ] Pin usuario visible y encima de marcadores

5. Playas (`/playas` + `/playa/[id]`)
- [ ] Filtros + clima/iconos + distancia en una linea
- [ ] Perfil playa y cercanos sin regresiones

6. Eventos y Especiales (`/eventos`, `/especiales`)
- [ ] Tarjetas, fecha/hora y multilocalidad correctas

7. Login/Usuario/Pedidos (`/login`, `/usuario`, `/pedidos`)
- [ ] Login email/password y opcional Google
- [ ] Perfil + favoritos + pedidos operativos

8. Legal (`/privacy-policy`, `/terms-of-service`)
- [ ] Abren y respetan idioma seleccionado

## Findings
- None / Describe:

## Decision
- [ ] PASS Bloque 2.4
- [ ] FAIL Bloque 2.4 (detallar blockers arriba)
