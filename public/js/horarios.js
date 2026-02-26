import { supabase } from '../shared/supabaseClient.js';
import { formatearHorario } from '../shared/utils.js';
import { t } from './i18n.js';

const idComercio = new URLSearchParams(window.location.search).get('id');
const getDiasSemana = () => ([
  t('days.sunday'),
  t('days.monday'),
  t('days.tuesday'),
  t('days.wednesday'),
  t('days.thursday'),
  t('days.friday'),
  t('days.saturday'),
]);
const hoy = new Date();
const diaActual = hoy.getDay();
const horaActual = hoy.toTimeString().slice(0, 5);

const tituloHorario = document.getElementById('tituloHorario');
const estadoHorario = document.getElementById('estadoHorario');
const tablaHorarios = document.getElementById('tablaHorarios');

function formato12Horas(horaStr) {
  if (!horaStr) return '--:--';
  const [hora, minutos] = horaStr.split(':').map(Number);
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const hora12 = hora % 12 === 0 ? 12 : hora % 12;
  return `${hora12}:${minutos.toString().padStart(2, '0')} ${ampm}`;
}

function obtenerProximoDiaAbierto(horarios, diaActual) {
  for (let i = 1; i <= 7; i++) {
    const diaSiguiente = (diaActual + i) % 7;
    const diaHorario = horarios.find(h => h.diaSemana === diaSiguiente);
    if (diaHorario && !diaHorario.cerrado && diaHorario.apertura && diaHorario.cierre) {
      const diasSemana = getDiasSemana();
      return {
        nombre: diasSemana[diaSiguiente],
        apertura: formato12Horas(diaHorario.apertura?.slice(0, 5)),
        esManana: i === 1
      };
    }
  }
  return null;
}

function minutosDesdeMedianoche(horaStr) {
  if (!horaStr) return null;
  const [hora, minuto] = horaStr.split(':').map(Number);
  return hora * 60 + minuto;
}

function estaAbierto(horarios, diaActual, horaActual) {
  if (!Array.isArray(horarios) || !horarios.length) return { abierto: false };
  const horaMin = minutosDesdeMedianoche(horaActual);
  const hoy = horarios.find(h => h.diaSemana === diaActual);
  const ayer = horarios.find(h => h.diaSemana === (diaActual + 6) % 7);

  if (hoy && !hoy.cerrado && hoy.apertura && hoy.cierre && horaMin !== null) {
    const apertura = minutosDesdeMedianoche(hoy.apertura.slice(0, 5));
    const cierre = minutosDesdeMedianoche(hoy.cierre.slice(0, 5));
    if (apertura === null || cierre === null) return { abierto: false };
    if (apertura < cierre) {
      if (horaMin >= apertura && horaMin < cierre) return { abierto: true, cierreHoy: hoy.cierre };
    } else {
      if (horaMin >= apertura || horaMin < cierre) return { abierto: true, cierreHoy: hoy.cierre };
    }
  }

  if (ayer && !ayer.cerrado && ayer.apertura && ayer.cierre && horaMin !== null) {
    const apertura = minutosDesdeMedianoche(ayer.apertura.slice(0, 5));
    const cierre = minutosDesdeMedianoche(ayer.cierre.slice(0, 5));
    if (apertura === null || cierre === null) return { abierto: false };
    if (apertura > cierre && horaMin < cierre) {
      return { abierto: true, cierreHoy: ayer.cierre };
    }
  }

  return { abierto: false };
}

async function cargarHorarios() {
  const { data: comercio } = await supabase.from('Comercios').select('nombre').eq('id', idComercio).maybeSingle();
  const { data: horarios, error } = await supabase
    .from('Horarios')
    .select('diaSemana, apertura, cierre, cerrado')
    .eq('idComercio', idComercio)
    .order('diaSemana', { ascending: true });

  if (!horarios || error) {
    console.error('No se pudieron cargar horarios', error);
    return;
  }

  tituloHorario.textContent = t('perfilComercio.horarioDe', { nombre: comercio?.nombre || '' });

  const horariosValidos = horarios.filter(
    (h) =>
      h &&
      h.diaSemana !== null &&
      h.diaSemana !== undefined &&
      h.diaSemana >= 0 &&
      h.diaSemana <= 6
  );

  if (!horariosValidos.length) {
    tituloHorario.textContent = t('perfilComercio.horarioDe', { nombre: comercio?.nombre || '' });
    estadoHorario.innerHTML = `
      <p class="font-semibold text-2xl text-gray-500">${t('perfilComercio.horarioNoDisponible')}</p>
      <p class="text-sm font-normal text-gray-600"></p>
    `;
    tablaHorarios.innerHTML = '';
    return;
  }

  const resultado = estaAbierto(horariosValidos, diaActual, horaActual);
  const abierto = resultado.abierto;
  const cierreHoy = resultado.cierreHoy;

  let mensajeEstado = '';
  const hoyHorario = horariosValidos.find(h => h.diaSemana === diaActual);
  if (!abierto && hoyHorario && !hoyHorario.cerrado && hoyHorario.apertura && horaActual < hoyHorario.apertura.slice(0, 5)) {
    mensajeEstado = t('perfilComercio.abreHoy', { hora: formato12Horas(hoyHorario.apertura.slice(0, 5)) });
  } else if (!abierto) {
    const proximo = obtenerProximoDiaAbierto(horariosValidos, diaActual);
    if (proximo) {
      const cuando = proximo.esManana ? t('perfilComercio.manana') : proximo.nombre;
      mensajeEstado = t('perfilComercio.abreDia', { dia: cuando, hora: proximo.apertura });
    }
  }

  const cierreEnMenosDe2Horas =
    abierto &&
    cierreHoy &&
    minutosDesdeMedianoche(cierreHoy) !== null &&
    minutosDesdeMedianoche(horaActual) !== null &&
    (minutosDesdeMedianoche(cierreHoy) - minutosDesdeMedianoche(horaActual) <= 120);

  if (cierreEnMenosDe2Horas) {
    mensajeEstado += (mensajeEstado ? ' • ' : '') + t('perfilComercio.cierraALas', { hora: formato12Horas(cierreHoy) });
  }

  estadoHorario.innerHTML = `
    <p class="font-semibold text-2xl ${abierto ? 'text-green-600' : 'text-red-600'}">
      ${abierto ? t('perfilComercio.abiertoAhora') : t('perfilComercio.cerradoAhora')}
    </p>
    <p class="text-sm font-normal text-gray-600">
      ${mensajeEstado}
    </p>
  `;

  tablaHorarios.innerHTML = horariosValidos
    .map(h => {
      const esHoy = h.diaSemana === diaActual;
      const dia = getDiasSemana()[h.diaSemana];
      const cerrado = h.cerrado;
      const horarioTexto =
        h.apertura && h.cierre
          ? formatearHorario(h.apertura, h.cierre, h.cerrado)
          : t('perfilComercio.noDisponible');

      const color = esHoy ? (cerrado ? 'text-white bg-red-500' : (abierto ? 'text-white bg-green-500' : 'text-white bg-red-500')) : 'text-gray-700';
      const peso = esHoy ? 'font-[500]' : 'font-[400]';

      return `
        <div class="grid grid-cols-4 items-center text-[18px] ${color} ${peso} mb-2 rounded px-2 py-1">
          <div class="text-left">${dia}:</div>
          ${cerrado
            ? `<div class="col-span-3 text-center">${t('perfilComercio.cerrado')}</div>`
            : `
              <div class="col-span-3 text-center sm:text-left">${horarioTexto}</div>
            `
          }
        </div>
      `;
    })
    .join('');
}

window.refreshHorarios = cargarHorarios;
window.addEventListener('lang:changed', cargarHorarios);

cargarHorarios();
setInterval(cargarHorarios, 30000); // Actualiza cada 30 segundos
