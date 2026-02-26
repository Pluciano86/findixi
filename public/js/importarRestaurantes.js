import fetch from 'node-fetch';
import readline from 'readline';
import { supabase } from '../shared/supabaseClient.js';

const GOOGLE_API_KEY = 'AIzaSyBxfWTx5kMwy_2UcOnKhILbnLkbU4VMaBI';
const location = '17.9854,-66.6141';
const radius = 5000;
const type = 'restaurant';

function convertirHora(texto) {
  if (!texto || !texto.includes(':')) return null;
  try {
    const [hora, meridiano] = texto.trim().split(' ');
    let [h, m] = hora.split(':');
    h = parseInt(h);
    if (meridiano === 'PM' && h < 12) h += 12;
    if (meridiano === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m || '00'}:00`;
  } catch (e) {
    return null;
  }
}

function parsearHorarios(weekday_text) {
  const dias = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const horarios = [];

  for (let i = 0; i < dias.length; i++) {
    const dia = dias[i];
    const linea = weekday_text.find(texto => texto.startsWith(dia));
    const partes = linea?.split(': ')[1];
    if (!partes || !partes.includes('–')) {
      horarios.push({ diaSemana: i, cerrado: true, apertura: null, cierre: null });
      continue;
    }
    const horas = partes.split(' – ');
    horarios.push({
      diaSemana: i,
      cerrado: false,
      apertura: convertirHora(horas[0]),
      cierre: convertirHora(horas[1])
    });
  }

  return horarios;
}

async function buscarRestaurantes() {
  const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=${radius}&type=${type}&key=${GOOGLE_API_KEY}`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();

  if (searchData.status !== 'OK') {
    console.error('Error en Nearby Search:', searchData.status);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  for (const lugar of searchData.results) {
    const nombre = lugar.name;
    const direccion = lugar.vicinity || '';
    const latitud = lugar.geometry.location.lat;
    const longitud = lugar.geometry.location.lng;

    const { data: existente } = await supabase
      .from('Comercios')
      .select('id')
      .eq('nombre', nombre)
      .maybeSingle();

    if (existente) {
      console.log(`🟡 Ya existe: ${nombre}`);
      continue;
    }

    await new Promise(resolve => {
      rl.question(`¿Insertar "${nombre}" - ${direccion}? (s/n): `, async (respuesta) => {
        if (respuesta.toLowerCase() === 's') {
          const place_id = lugar.place_id;
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=opening_hours&key=${GOOGLE_API_KEY}`;
          const detailsRes = await fetch(detailsUrl);
          const detailsData = await detailsRes.json();

          let horariosParsed = [];
          if (detailsData?.result?.opening_hours?.weekday_text) {
            horariosParsed = parsearHorarios(detailsData.result.opening_hours.weekday_text);
          } else {
            horariosParsed = [...Array(7)].map((_, i) => ({
              diaSemana: i,
              cerrado: true,
              apertura: null,
              cierre: null
            }));
          }

          const { data, error } = await supabase
            .from('Comercios')
            .insert([{
              nombre,
              direccion,
              latitud,
              longitud,
              idCategoria: 2,
              idSubcategoria: null,
              activo: false
            }])
            .select();

          if (error) {
            console.error(`❌ Error insertando ${nombre}: `, error.message);
            resolve();
            return;
          }

          const insertado = data?.[0];
          const idComercio = insertado?.id;

          const horariosFinal = horariosParsed.map(h => ({
            idComercio,
            diaSemana: h.diaSemana,
            apertura: h.apertura,
            cierre: h.cierre,
            cerrado: h.cerrado,
            feriado: null
          }));

          const { error: errorHorario } = await supabase.from('horarios').insert(horariosFinal);
          if (errorHorario) {
            console.error(`❌ Error insertando horarios para ${nombre}: `, errorHorario.message);
          } else {
            console.log(`✅ Insertado: ${nombre} con horarios`);
          }
        }
        resolve();
      });
    });
  }

  rl.close();
}

buscarRestaurantes();
