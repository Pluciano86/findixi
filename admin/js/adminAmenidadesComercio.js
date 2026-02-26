// adminAmenidadesComercio.js
import { supabase } from '../shared/supabaseClient.js';

const idComercio = new URLSearchParams(window.location.search).get('id');

let amenidadesDisponibles = [];
let amenidadesSeleccionadas = [];

document.addEventListener('DOMContentLoaded', async () => {
  await cargarAmenidades();

  // Mostrar formulario para nueva amenidad
  document.getElementById('nuevaAmenidadBtn')?.addEventListener('click', () => {
    document.getElementById('nuevaAmenidadForm').classList.remove('hidden');
    document.getElementById('nuevaAmenidadBtn').classList.add('hidden');
  });

  // Guardar nueva amenidad
  document.getElementById('guardarAmenidadBtn')?.addEventListener('click', async () => {
    const nombre = document.getElementById('nuevoNombreAmenidad').value.trim();
    const icono = document.getElementById('nuevoIconoAmenidad').value.trim();

    if (!nombre || !icono) {
      alert('Debes completar nombre e ícono');
      return;
    }

    const { error } = await supabase.from('Amenidades').insert([{ nombre, icono }]);
    if (error) {
      alert('Error al guardar la nueva amenidad');
      console.error(error);
      return;
    }

    document.getElementById('nuevoNombreAmenidad').value = '';
    document.getElementById('nuevoIconoAmenidad').value = '';
    document.getElementById('nuevaAmenidadForm').classList.add('hidden');
    document.getElementById('nuevaAmenidadBtn').classList.remove('hidden');

    await cargarAmenidades();
  });
});

async function cargarAmenidades() {
  const container = document.getElementById('amenidadesContainer');
  if (!container) return;

  const { data: todas, error } = await supabase
    .from('Amenidades')
    .select('*')
    .order('nombre');

  const { data: activas, error: errorActivas } = await supabase
    .from('comercioAmenidades')
    .select('idAmenidad')
    .eq('idComercio', idComercio);

  if (error || errorActivas) {
    console.error('Error cargando amenidades:', error || errorActivas);
    container.innerHTML = '<p class="text-red-600">Error al cargar amenidades</p>';
    return;
  }

  amenidadesDisponibles = todas || [];
  amenidadesSeleccionadas = activas?.map(a => a.idAmenidad) || [];

  container.innerHTML = '';
  amenidadesDisponibles.forEach(a => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 border px-3 py-2 rounded shadow bg-white';

    div.innerHTML = `
      <input type="checkbox" id="amenidad-${a.id}" ${amenidadesSeleccionadas.includes(a.id) ? 'checked' : ''}>
      <i class="${a.icono} text-lg"></i>
      <label for="amenidad-${a.id}" class="font-medium">${a.nombre}</label>
    `;
    container.appendChild(div);
  });
}

// ✅ No usar export aquí en la declaración (solo al final)
async function guardarAmenidadesSeleccionadas() {
  const checks = document.querySelectorAll('#amenidadesContainer input[type="checkbox"]');
  const seleccionadas = Array.from(checks)
    .filter(c => c.checked)
    .map(c => parseInt(c.id.replace('amenidad-', '')));

  await supabase.from('comercioAmenidades').delete().eq('idComercio', idComercio);

  const nuevas = seleccionadas.map(idAmenidad => ({ idComercio, idAmenidad }));
  if (nuevas.length > 0) {
    await supabase.from('comercioAmenidades').insert(nuevas);
  }

  console.log('✅ Amenidades guardadas:', nuevas);
}

// ✅ Exportaciones únicas y correctas
export { cargarAmenidades as cargarAmenidadesComercio, guardarAmenidadesSeleccionadas };