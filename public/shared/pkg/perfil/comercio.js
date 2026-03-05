function normalizarHora(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const hhmm = value.slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  return hhmm;
}

export function minutosDesdeMedianoche(horaStr) {
  const hhmm = normalizarHora(horaStr);
  if (!hhmm) return null;
  const [hora, minuto] = hhmm.split(':').map(Number);
  if (!Number.isFinite(hora) || !Number.isFinite(minuto)) return null;
  return hora * 60 + minuto;
}

export function formato12Horas(horaStr) {
  const hhmm = normalizarHora(horaStr);
  if (!hhmm) return '--:--';
  const [hora, minutos] = hhmm.split(':').map(Number);
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const hora12 = hora % 12 === 0 ? 12 : hora % 12;
  return `${hora12}:${String(minutos).padStart(2, '0')} ${ampm}`;
}

export function evaluarHorarioActual(horarios = [], diaActual, horaActual) {
  const horaMin = minutosDesdeMedianoche(horaActual);
  if (!Array.isArray(horarios) || horarios.length === 0 || horaMin == null) {
    return {
      abierto: false,
      cierreHoy: null,
      horarioHoy: null,
      horarioAyer: null,
    };
  }

  const horarioHoy = horarios.find((entry) => Number(entry?.diaSemana) === Number(diaActual)) || null;
  const horarioAyer = horarios.find((entry) => Number(entry?.diaSemana) === Number((diaActual + 6) % 7)) || null;

  let abierto = false;
  let cierreHoy = null;

  if (horarioHoy && !horarioHoy.cerrado && horarioHoy.apertura && horarioHoy.cierre) {
    const apertura = minutosDesdeMedianoche(horarioHoy.apertura);
    const cierre = minutosDesdeMedianoche(horarioHoy.cierre);

    if (apertura != null && cierre != null) {
      if (apertura < cierre) {
        abierto = horaMin >= apertura && horaMin < cierre;
      } else {
        abierto = horaMin >= apertura || horaMin < cierre;
      }
      if (abierto) cierreHoy = horarioHoy.cierre;
    }
  }

  if (!abierto && horarioAyer && !horarioAyer.cerrado && horarioAyer.apertura && horarioAyer.cierre) {
    const aperturaAyer = minutosDesdeMedianoche(horarioAyer.apertura);
    const cierreAyer = minutosDesdeMedianoche(horarioAyer.cierre);

    if (aperturaAyer != null && cierreAyer != null && aperturaAyer > cierreAyer && horaMin < cierreAyer) {
      abierto = true;
      cierreHoy = horarioAyer.cierre;
    }
  }

  return {
    abierto,
    cierreHoy,
    horarioHoy,
    horarioAyer,
  };
}

export function obtenerProximoDiaAbierto(horarios = [], diaActual) {
  if (!Array.isArray(horarios) || horarios.length === 0) return null;

  for (let offset = 1; offset <= 7; offset += 1) {
    const diaSiguiente = (diaActual + offset) % 7;
    const horario = horarios.find((entry) => Number(entry?.diaSemana) === Number(diaSiguiente));
    if (!horario || horario.cerrado || !horario.apertura || !horario.cierre) continue;

    return {
      diaSemana: diaSiguiente,
      apertura: horario.apertura,
      cierre: horario.cierre,
      esManana: offset === 1,
    };
  }

  return null;
}

export function obtenerMensajeHorario(options = {}) {
  const {
    horarios = [],
    now = new Date(),
    labels = {
      abiertoAhora: 'Abierto Ahora',
      cerradoAhora: 'Cerrado Ahora',
      horarioNoDisponible: 'Horario no disponible',
      abreHoy: 'Abre hoy a {hora}',
      abreDia: 'Abre {dia} a {hora}',
      manana: 'manana',
      cierraALas: 'Cierra a las {hora}',
    },
    diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'],
  } = options;

  if (!Array.isArray(horarios) || horarios.length === 0) {
    return {
      abierto: false,
      titulo: labels.horarioNoDisponible,
      subtitulo: '',
      cierreHoy: null,
      diaActual: now.getDay(),
    };
  }

  const diaActual = now.getDay();
  const horaActual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const horaActualMin = minutosDesdeMedianoche(horaActual);

  const estado = evaluarHorarioActual(horarios, diaActual, horaActual);

  if (estado.abierto) {
    let subtitulo = '';
    const cierreMin = minutosDesdeMedianoche(estado.cierreHoy);

    if (cierreMin != null && horaActualMin != null) {
      const diff = cierreMin >= horaActualMin ? cierreMin - horaActualMin : 1440 - horaActualMin + cierreMin;
      if (diff <= 120) {
        subtitulo = String(labels.cierraALas || '')
          .replace('{hora}', formato12Horas(estado.cierreHoy));
      }
    }

    return {
      abierto: true,
      titulo: labels.abiertoAhora,
      subtitulo,
      cierreHoy: estado.cierreHoy,
      diaActual,
    };
  }

  const horarioHoy = horarios.find((entry) => Number(entry?.diaSemana) === Number(diaActual));
  if (horarioHoy && !horarioHoy.cerrado && horarioHoy.apertura) {
    const aperturaHoyMin = minutosDesdeMedianoche(horarioHoy.apertura);
    if (aperturaHoyMin != null && horaActualMin != null && horaActualMin < aperturaHoyMin) {
      return {
        abierto: false,
        titulo: labels.cerradoAhora,
        subtitulo: String(labels.abreHoy || '').replace('{hora}', formato12Horas(horarioHoy.apertura)),
        cierreHoy: null,
        diaActual,
      };
    }
  }

  const proximo = obtenerProximoDiaAbierto(horarios, diaActual);
  if (proximo) {
    const diaTexto = proximo.esManana ? labels.manana : diasSemana[proximo.diaSemana] || labels.manana;
    return {
      abierto: false,
      titulo: labels.cerradoAhora,
      subtitulo: String(labels.abreDia || '')
        .replace('{dia}', String(diaTexto || ''))
        .replace('{hora}', formato12Horas(proximo.apertura)),
      cierreHoy: null,
      diaActual,
    };
  }

  return {
    abierto: false,
    titulo: labels.cerradoAhora,
    subtitulo: '',
    cierreHoy: null,
    diaActual,
  };
}
