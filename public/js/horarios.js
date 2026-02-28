import { supabase } from '../shared/supabaseClient.js';
import { formatearHorario } from '../shared/utils.js';
import {
  evaluarHorarioActual,
  formato12Horas,
  minutosDesdeMedianoche,
  obtenerProximoDiaAbierto,
} from '../shared/pkg/perfil/comercio.js';
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
const tituloHorario = document.getElementById('tituloHorario');
const estadoHorario = document.getElementById('estadoHorario');
const tablaHorarios = document.getElementById('tablaHorarios');

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

  const now = new Date();
  const diaActual = now.getDay();
  const horaActual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const resultado = evaluarHorarioActual(horariosValidos, diaActual, horaActual);
  const abierto = resultado.abierto;
  const cierreHoy = resultado.cierreHoy;

  let mensajeEstado = '';
  const hoyHorario = horariosValidos.find(h => h.diaSemana === diaActual);
  if (!abierto && hoyHorario && !hoyHorario.cerrado && hoyHorario.apertura && horaActual < hoyHorario.apertura.slice(0, 5)) {
    mensajeEstado = t('perfilComercio.abreHoy', { hora: formato12Horas(hoyHorario.apertura.slice(0, 5)) });
  } else if (!abierto) {
    const proximo = obtenerProximoDiaAbierto(horariosValidos, diaActual);
    if (proximo) {
      const diaTexto = getDiasSemana()[proximo.diaSemana] || '';
      const cuando = proximo.esManana ? t('perfilComercio.manana') : diaTexto;
      mensajeEstado = t('perfilComercio.abreDia', { dia: cuando, hora: formato12Horas(proximo.apertura) });
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
