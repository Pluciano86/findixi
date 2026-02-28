import { supabase } from '../shared/supabaseClient.js';
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

const iconoEl = document.querySelector('#estadoHorarioContainer i');
const textoEl = document.querySelector('#estadoHorarioContainer p');
const subtituloEl = document.createElement('p');
subtituloEl.className = 'text-xs text-gray-500 font-light';
textoEl.insertAdjacentElement('afterend', subtituloEl);

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

  const hoyHorario = horariosValidos.find((h) => h.diaSemana === diaSemana);
  const estado = evaluarHorarioActual(horariosValidos, diaSemana, horaActual);
  const abierto = estado.abierto;
  const cierre = estado.cierreHoy;

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
      const proximo = obtenerProximoDiaAbierto(horariosValidos, diaSemana);
      if (proximo) {
        const diaTexto = getDiasSemana()[proximo.diaSemana] || '';
        const cuando = proximo.esManana ? t('perfilComercio.manana') : diaTexto;
        subtituloEl.innerHTML = `${t('perfilComercio.abreDiaLabel', { dia: cuando })}<br><span class="text-sm">${formato12Horas(proximo.apertura)}</span>`;
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
