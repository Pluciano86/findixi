import { supabase } from '../shared/supabaseClient.js';
import { formatearHorario } from '../shared/utils.js';

const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function minutosDesdeMedianoche(horaStr) {
  if (!horaStr) return null;
  const [hora, minuto] = horaStr.split(':').map(Number);
  if (Number.isNaN(hora) || Number.isNaN(minuto)) return null;
  return hora * 60 + minuto;
}

function formato12Horas(horaStr) {
  if (!horaStr) return '--:--';
  const [hora, minutos] = horaStr.split(':').map(Number);
  if (Number.isNaN(hora) || Number.isNaN(minutos)) return '--:--';
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const hora12 = hora % 12 === 0 ? 12 : hora % 12;
  return `${hora12}:${minutos.toString().padStart(2, '0')} ${ampm}`;
}

function obtenerProximoDiaAbierto(horarios, diaActual) {
  for (let i = 1; i <= 7; i++) {
    const diaSiguiente = (diaActual + i) % 7;
    const horario = horarios.find(h => h.diaSemana === diaSiguiente && !h.cerrado && !h.cerradoTemporalmente);
    if (horario) {
      return {
        dia: diasSemana[diaSiguiente],
        apertura: formato12Horas(horario.apertura?.slice(0, 5)),
        esManana: i === 1
      };
    }
  }
  return null;
}

function prepararEstadoActual(horarios) {
  const hoy = new Date();
  const diaActual = hoy.getDay();
  const horaActual = hoy.toTimeString().slice(0, 5);
  const minutosActuales = minutosDesdeMedianoche(horaActual);

  const hoyHorario = horarios.find(h => h.diaSemana === diaActual);
  const ayerHorario = horarios.find(h => h.diaSemana === (diaActual + 6) % 7);

  let abierto = false;
  let cierre = null;

  const estaDisponible = (horario) => horario && !horario.cerrado && !horario.cerradoTemporalmente && !horario.abiertoSiempre;

  if (hoyHorario) {
    if (hoyHorario.abiertoSiempre && !hoyHorario.cerradoTemporalmente) {
      abierto = true;
    } else if (estaDisponible(hoyHorario)) {
      const aperturaMin = minutosDesdeMedianoche(hoyHorario.apertura.slice(0, 5));
      const cierreMin = minutosDesdeMedianoche(hoyHorario.cierre.slice(0, 5));
      if (aperturaMin !== null && cierreMin !== null) {
        if (aperturaMin < cierreMin) {
          abierto = minutosActuales >= aperturaMin && minutosActuales < cierreMin;
        } else {
          abierto = minutosActuales >= aperturaMin || minutosActuales < cierreMin;
        }
        if (abierto) cierre = hoyHorario.cierre;
      }
    }
  }

  if (!abierto && estaDisponible(ayerHorario)) {
    const aperturaMin = minutosDesdeMedianoche(ayerHorario.apertura.slice(0, 5));
    const cierreMin = minutosDesdeMedianoche(ayerHorario.cierre.slice(0, 5));
    if (aperturaMin !== null && cierreMin !== null && aperturaMin > cierreMin && minutosActuales < cierreMin) {
      abierto = true;
      cierre = ayerHorario.cierre;
    }
  }

  return { abierto, cierre, diaActual, horaActual };
}

export async function renderHorariosLugar(idLugar, nombreLugar = '') {
  const tituloHorario = document.getElementById('tituloHorario');
  const estadoHorario = document.getElementById('estadoHorario');
  const tablaHorarios = document.getElementById('tablaHorarios');
  const iconoEstado = document.querySelector('#estadoHorarioContainer i');
  const textoEstado = document.querySelector('#estadoHorarioContainer p');

  if (tituloHorario) {
    tituloHorario.textContent = `Horario de ${nombreLugar}`;
  }

  const { data: horarios, error } = await supabase
    .from('horariosLugares')
    .select('diaSemana, apertura, cierre, cerrado, abiertoSiempre, cerradoTemporalmente')
    .eq('idLugar', idLugar)
    .order('diaSemana', { ascending: true });

  if (error || !horarios || horarios.length === 0) {
    if (estadoHorario) {
      estadoHorario.innerHTML = `<p class="text-base text-gray-500">Horario no disponible.</p>`;
    }
    if (iconoEstado && textoEstado) {
      iconoEstado.className = 'fa-regular fa-clock text-gray-400 text-4xl';
    textoEstado.className = 'text-sm text-gray-500 font-medium text-center';
      textoEstado.textContent = 'Horario no disponible';
    }
    if (tablaHorarios) tablaHorarios.innerHTML = '';
    return;
  }

  const { abierto, cierre, diaActual, horaActual } = prepararEstadoActual(horarios);

  let mensajeEstado = '';
  const hoyHorario = horarios.find(h => h.diaSemana === diaActual);

  if (abierto && cierre) {
    const minutosRestantes = minutosDesdeMedianoche(cierre) - minutosDesdeMedianoche(horaActual);
    if (minutosRestantes <= 0) {
      mensajeEstado = `Cierra a las ${formato12Horas(cierre)}`;
    } else if (minutosRestantes <= 120) {
      mensajeEstado = `Cierra a las ${formato12Horas(cierre)}`;
    }
  } else if (hoyHorario && !hoyHorario.cerrado && !hoyHorario.cerradoTemporalmente && hoyHorario.apertura) {
    const aperturaMin = minutosDesdeMedianoche(hoyHorario.apertura.slice(0, 5));
    if (aperturaMin !== null && minutosDesdeMedianoche(horaActual) < aperturaMin) {
      mensajeEstado = `Abre hoy a las ${formato12Horas(hoyHorario.apertura.slice(0, 5))}`;
    } else {
      const proximo = obtenerProximoDiaAbierto(horarios, diaActual);
      if (proximo) {
        const cuando = proximo.esManana ? 'mañana' : proximo.dia;
        mensajeEstado = `Abre ${cuando} a las ${proximo.apertura}`;
      }
    }
  }

  if (estadoHorario) {
    estadoHorario.innerHTML = `
      <p class="text-xl font-semibold ${abierto ? 'text-green-600' : 'text-red-600'}">
        ${abierto ? 'Abierto Ahora' : 'Cerrado Ahora'}
      </p>
      ${mensajeEstado ? `<p class="text-sm text-gray-600 mt-1">${mensajeEstado}</p>` : ''}
    `;
  }

  if (iconoEstado && textoEstado) {
    if (abierto) {
      iconoEstado.className = 'fa-regular fa-clock text-green-500 text-2xl slow-spin';
      textoEstado.className = 'text-sm text-green-600 font-medium text-center';
      textoEstado.textContent = 'Abierto Ahora';
    } else {
      iconoEstado.className = 'fa-regular fa-clock text-red-500 text-2xl';
      textoEstado.className = 'text-sm text-red-600 font-medium text-center';
      textoEstado.textContent = 'Cerrado Ahora';
    }
  }

  if (tablaHorarios) {
    tablaHorarios.innerHTML = horarios
      .filter((h) => h.diaSemana !== null && h.diaSemana !== undefined)
      .map((h) => {
        const esHoy = h.diaSemana === diaActual;
        const cerrado = h.cerrado || h.cerradoTemporalmente;
        const abiertoSiempre = h.abiertoSiempre && !h.cerradoTemporalmente;
        const horarioTexto = abiertoSiempre
          ? 'Abierto las 24 horas'
          : formatearHorario(h.apertura, h.cierre, cerrado);

        const baseClases = esHoy
          ? `text-white ${abierto ? 'bg-green-500' : 'bg-red-500'}`
          : 'text-gray-700';

        return `
          <div class="grid grid-cols-4 items-center text-[18px] ${baseClases} ${esHoy ? 'font-[500]' : 'font-[400]'} mb-2 rounded px-2 py-1">
            <div class="text-left">${diasSemana[h.diaSemana]}:</div>
            <div class="col-span-3 text-center sm:text-left">
              ${cerrado ? 'Cerrado' : horarioTexto}
            </div>
          </div>
        `;
      })
      .join('');
  }
}
