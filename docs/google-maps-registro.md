# Google Maps en Registro de Comercio

## Variables de entorno
- `GOOGLE_MAPS_BROWSER_KEY`: API key del navegador para Google Maps (no hardcode en frontend).
- `GOOGLE_MAPS_ALLOWED_ORIGINS`: lista separada por comas para filtrar orígenes en `/.netlify/functions/maps-browser-config`.

## Desarrollo local
- Para que `/.netlify/functions/maps-browser-config` responda localmente, ejecutar con `netlify dev`.
- Si trabajas con Live Server (`:5500`) sin Netlify Functions:
  - Copia `public/shared/localMapsConfig.example.js` como `public/shared/localMapsConfig.js` y coloca tu key.
  - `public/shared/localMapsConfig.js` está en `.gitignore` para no subirlo.
- Alternativa rápida (sin archivo):
  - En consola del navegador:
    - `localStorage.setItem('GOOGLE_MAPS_BROWSER_KEY', 'TU_KEY')`
    - recargar página.

## Dónde se usa
- Vista: `public/registroComercio.html` + `public/js/registroComercio.js`.
- Endpoint de config: `netlify/functions/maps-browser-config.js`.
- El script de Google Maps se carga en modo lazy solo cuando el usuario abre “Marcar ubicación en el mapa”.

## Restricciones recomendadas en Google Cloud
- **Application restrictions**:
  - `HTTP referrers (web sites)` y agregar únicamente dominios autorizados.
  - Ejemplos:
    - `https://findixi.com/*`
    - `https://www.findixi.com/*`
    - `http://localhost:5500/*`
    - `http://127.0.0.1:5500/*`
- **API restrictions**:
  - `Maps JavaScript API`
  - `Places API`
  - No habilitar APIs adicionales si no son necesarias.

## Control de costos
- Configurar presupuesto y alertas en Google Cloud Billing.
- Ajustar cuotas en APIs si quieres límite duro por día.
- Mantener carga lazy del mapa para minimizar `map loads`.

## Flujo UX implementado
- Al abrir panel:
  - Si ya hay lat/lon válidas: centra y muestra pin.
  - Si no hay lat/lon: intenta geolocalización automática.
- Botón “Usar mi ubicación actual”: reintento de geolocalización.
- Input “Buscar dirección”: Places Autocomplete + selección con geometría.
- Pin draggable + click en mapa para precisión.
- Inputs `latitud/longitud` sincronizados en ambos sentidos.
