// adminFeriadosComercio.js
import { supabase, idComercio as idComercioImportado } from '../shared/supabaseClient.js';

const idComercio =
  idComercioImportado ||
  new URLSearchParams(window.location.search).get('idcomercio') ||
  new URLSearchParams(window.location.search).get('id');

document.addEventListener('DOMContentLoaded', async () => {
  await cargarFeriadosComercio();
  document.getElementById('agregarFeriado')?.addEventListener('click', agregarNuevoFeriado);
});

async function cargarFeriadosComercio() {
  const container = document.getElementById('feriadosContainer');
  if (!container) return;

  // Traer feriados desde la tabla Horarios (columna feriado tipo date)
  const { data, error } = await supabase
    .from('Horarios')
    .select('id, feriado')
    .eq('idComercio', idComercio)
    .not('feriado', 'is', null);

  if (error) {
    console.error('Error cargando feriados:', error);
    container.innerHTML = '<p class="text-red-600">Error al cargar feriados</p>';
    return;
  }

  // Mostrar los feriados existentes
  if (data && data.length > 0) {
    container.innerHTML = data
      .map(
        (f) => `
      <div class="flex items-center gap-4 my-2">
        <input type="date" class="border rounded p-1" value="${f.feriado}" data-id="${f.id}">
        <button class="text-red-600 eliminarFeriado" data-id="${f.id}">Eliminar</button>
      </div>
    `
      )
      .join('');
  } else {
    container.innerHTML = '<p class="text-gray-400">No hay feriados registrados.</p>';
  }

  // Asociar eventos de eliminación
  document.querySelectorAll('.eliminarFeriado').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('¿Eliminar este feriado?')) {
        const { error: delError } = await supabase
          .from('Horarios')
          .update({ feriado: null })
          .eq('id', id);
        if (delError) {
          console.error('Error al eliminar feriado:', delError);
          alert('Hubo un error al eliminar el feriado.');
        } else {
          await cargarFeriadosComercio();
        }
      }
    });
  });
}

async function agregarNuevoFeriado() {
  const fecha = prompt('Ingrese la fecha del feriado (YYYY-MM-DD):');
  if (!fecha || isNaN(Date.parse(fecha))) {
    alert('Fecha inválida.');
    return;
  }

  // Insertar nuevo feriado en la tabla Horarios
  const { error } = await supabase
    .from('Horarios')
    .insert([{ idComercio, feriado: fecha }]);

  if (error) {
    console.error('Error al añadir feriado:', error);
    alert('Hubo un error al añadir el feriado.');
    return;
  }

  await cargarFeriadosComercio();
}

export { cargarFeriadosComercio, agregarNuevoFeriado };
