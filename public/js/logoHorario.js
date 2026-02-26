import { supabase } from '../shared/supabaseClient.js';
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

const iconoEl = document.querySelector('#estadoHorarioContainer i');
const textoEl = document.querySelector('#estadoHorarioContainer p');
const subtituloEl = document.createElement('p');
subtituloEl.className = 'text-xs text-gray-500 font-light';
textoEl.insertAdjacentElement('afterend', subtituloEl);

function formato12Horas(horaStr) {
  if (!horaStr) return '--:--';
  const [h, m] = horaStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function minutosDesdeMedianoche(horaStr) {
  if (!horaStr) return null;
  const [hora, minuto] = horaStr.split(':').map(Number);
  return hora * 60 + minuto;
}

function obtenerProximoDiaAbierto(horarios, diaActual) {
  for (let i = 1; i <= 7; i++) {
    const diaSiguiente = (diaActual + i) % 7;
    const horario = horarios.find(h => h.diaSemana === diaSiguiente);
    if (horario && !horario.cerrado) {
      const diasSemana = getDiasSemana();
      return {
        dia: diasSemana[diaSiguiente],
        apertura: formato12Horas(horario.apertura?.slice(0, 5)),
        esManana: i === 1
      };
    }
  }
  return null;
}

async function verificarHorario() {
  const hoy = new Date();
  const diaSemana = hoy.getDay();
  const horaActual = hoy.toTimeString().slice(0, 5);
  const horaMinutos = minutosDesdeMedianoche(horaActual);

  const { data: horarios } = await supabase
    .from('Horarios')
    .select('diaSemana, apertura, cierre, cerrado')
    .eq('idComercio', idComercio);

  const horariosValidos = (horarios || []).filter(
    (h) =>
      h &&
      h.diaSemana !== null &&
      h.diaSemana !== undefined &&
      h.diaSemana >= 0 &&
      h.diaSemana <= 6
  );

  if (!Array.isArray(horariosValidos) || !horariosValidos.length || horaMinutos === null) {
    textoEl.textContent = t('perfilComercio.horarioNoDisponible');
    subtituloEl.textContent = '';
    iconoEl.className = 'fa-regular fa-clock text-gray-400 text-4xl';
    return;
  }

  const hoyHorario = horariosValidos.find(h => h.diaSemana === diaSemana);
  const ayerHorario = horariosValidos.find(h => h.diaSemana === (diaSemana + 6) % 7); // día anterior

  let abierto = false;
  let cierre = null;

  if (hoyHorario && !hoyHorario.cerrado && hoyHorario.apertura && hoyHorario.cierre) {
    const aperturaMin = minutosDesdeMedianoche(hoyHorario.apertura.slice(0, 5));
    const cierreMin = minutosDesdeMedianoche(hoyHorario.cierre.slice(0, 5));

    if (aperturaMin < cierreMin) {
      abierto = horaMinutos >= aperturaMin && horaMinutos < cierreMin;
    } else {
      abierto = horaMinutos >= aperturaMin || horaMinutos < cierreMin;
    }

    if (abierto) cierre = hoyHorario.cierre;
  }

  // Verifica si sigue abierto desde ayer (pasó medianoche)
  if (!abierto && ayerHorario && !ayerHorario.cerrado && ayerHorario.apertura && ayerHorario.cierre) {
    const aperturaMin = minutosDesdeMedianoche(ayerHorario.apertura.slice(0, 5));
    const cierreMin = minutosDesdeMedianoche(ayerHorario.cierre.slice(0, 5));

    if (aperturaMin > cierreMin && horaMinutos < cierreMin) {
      abierto = true;
      cierre = ayerHorario.cierre;
    }
  }

  // Resultado visual
  if (abierto) {
    iconoEl.className = 'fa-regular fa-clock text-green-500 text-4xl slow-spin';
    iconoEl.style.webkitTextStroke = '1.2px currentColor';
    textoEl.textContent = t('perfilComercio.abiertoAhora');
    textoEl.className = 'text-sm text-green-600 font-light';

    const minutosCierre = minutosDesdeMedianoche(cierre);
    const diferencia = (minutosCierre >= horaMinutos)
      ? minutosCierre - horaMinutos
      : 1440 - horaMinutos + minutosCierre; // por si cruza medianoche

    if (diferencia <= 120) {
      subtituloEl.innerHTML = `${t('perfilComercio.cierraALasLabel')}<br><span class="text-sm">${formato12Horas(cierre)}</span>`;
    } else {
      subtituloEl.textContent = '';
    }
  } else {
    iconoEl.className = 'fa-regular fa-clock text-red-500 text-4xl';
    iconoEl.style.webkitTextStroke = '1.2px currentColor';
    textoEl.textContent = t('perfilComercio.cerradoAhora');
    textoEl.className = 'text-sm text-red-600 font-medium';

    // ¿Abre más tarde hoy?
    if (hoyHorario && !hoyHorario.cerrado && hoyHorario.apertura && horaMinutos < minutosDesdeMedianoche(hoyHorario.apertura.slice(0, 5))) {
      subtituloEl.innerHTML = `${t('perfilComercio.abreHoyLabel')}<br><span class="text-sm ">${formato12Horas(hoyHorario.apertura.slice(0, 5))}</span>`;
    } else {
      const proximo = obtenerProximoDiaAbierto(horarios, diaSemana);
      if (proximo) {
        const cuando = proximo.esManana ? t('perfilComercio.manana') : proximo.dia;
        subtituloEl.innerHTML = `${t('perfilComercio.abreDiaLabel', { dia: cuando })}<br><span class="text-sm">${proximo.apertura}</span>`;
      } else {
        subtituloEl.textContent = '';
      }
    }
  }
}

window.refreshLogoHorario = verificarHorario;
window.addEventListener('lang:changed', verificarHorario);

verificarHorario();
setInterval(verificarHorario, 30000);
