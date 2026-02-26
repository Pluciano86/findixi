#!/bin/bash
# Script para iniciar Netlify Dev y abrir en navegador

# Abrir Netlify en segundo plano
npx netlify dev &

# Espera unos segundos para que Netlify arranque
sleep 3

# Abre el navegador en el perfil de prueba (ajusta URL si es otra)
open "http://localhost:8888/perfilComercio.html?id=8"