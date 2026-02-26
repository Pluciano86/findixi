// cercanosPlaya.js
import { supabase } from '../shared/supabaseClient.js';
import { mostrarCercanosComida } from './cercanosComida.js';
import { mostrarPlayasCercanas } from './playasCercanas.js';
import { mostrarLugaresCercanos } from './lugaresCercanos.js';

const params = new URLSearchParams(window.location.search);
const idPlaya = params.get('id');

function ocultarSecciones() {
  ['cercanosComidaContainer', 'cercanosPlayasContainer', 'cercanosLugaresContainer']
    .forEach((id) => document.getElementById(id)?.classList.add('hidden'));
}

async function obtenerPlayaBase() {
  if (!idPlaya) return { data: null, error: null };

  return supabase
    .from('playas')
    .select('id, nombre, municipio, latitud, longitud')
    .eq('id', idPlaya)
    .maybeSingle();
}

async function cargarCercanos() {
  const { data: playa, error } = await obtenerPlayaBase();

  if (error) {
    console.error('❌ Error al obtener la playa base:', error);
  }

  if (
    !playa ||
    !Number.isFinite(Number(playa.latitud)) ||
    !Number.isFinite(Number(playa.longitud))
  ) {
    console.warn('⚠️ No se encontró la playa base o no tiene coordenadas válidas.');
    ocultarSecciones();
    return;
  }

  document.getElementById('nombreCercanosComida')?.replaceChildren(playa.nombre);
  document.getElementById('nombreCercanosPlayas')?.replaceChildren(playa.nombre);
  document.getElementById('nombreCercanosLugares')?.replaceChildren(playa.nombre);

  const origen = {
  id: playa.id, // usa el id real de la playa
  nombre: playa.nombre,
  municipio: playa.municipio,
  latitud: Number(playa.latitud),
  longitud: Number(playa.longitud),
};

  await Promise.allSettled([
    mostrarCercanosComida(origen),
    mostrarPlayasCercanas(origen),
    mostrarLugaresCercanos(origen),
  ]);
}

cargarCercanos();
