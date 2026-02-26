
import { supabase } from '../shared/supabaseClient.js';
import { obtenerImagenEspecial } from '../../especiales/renderImagenesEspecial.js';

const hoy = new Date().getDay();
const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const idComercio = new URLSearchParams(window.location.search).get('id');

const btnAlmuerzo = document.getElementById('btnVerAlmuerzo');
const btnHappyHour = document.getElementById('btnVerHappyHour');
const contenedor = document.getElementById('contenedorEspeciales');

document.querySelector('#contenedorEspeciales h3').textContent = `Especiales para hoy ${dias[hoy]}`;

async function cargarEspeciales(tipo) {
  const { data, error } = await supabase
    .from('especialesDia')
    .select('*')
    .eq('idcomercio', idComercio)
    .eq('tipo', tipo)
    .eq('diasemana', hoy);

  if (error) return console.error(`Error cargando ${tipo}:`, error);
  return data || [];
}

function crearTarjeta(especial, urlImagen) {
  const div = document.createElement('div');
  div.className = 'bg-white rounded shadow p-4 flex gap-4 items-start mb-4';

  div.innerHTML = `
    <img src="${urlImagen}" alt="Imagen especial" class="w-24 h-24 rounded object-cover" />
    <div class="flex flex-col justify-between flex-1">
      <h4 class="font-bold text-xl">${especial.nombre}</h4>
      <p class="text-sm text-gray-600">${especial.descripcion || ''}</p>
      <p class="text-black font-bold text-xl mt-1">$${especial.precio?.toFixed(2) || ''}</p>
    </div>
  `;
  return div;
}

async function mostrarEspeciales(tipo) {
  contenedor.querySelectorAll('.tarjetas-especiales').forEach(e => e.remove());

  const especiales = await cargarEspeciales(tipo);
  if (especiales.length === 0) return;

  const lista = document.createElement('div');
  lista.className = 'tarjetas-especiales';
  for (const e of especiales) {
    const url = await obtenerImagenEspecial(e.id);
    const tarjeta = crearTarjeta(e, url);
    lista.appendChild(tarjeta);
  }
  contenedor.appendChild(lista);
}

btnAlmuerzo.addEventListener('click', () => mostrarEspeciales('almuerzo'));
btnHappyHour.addEventListener('click', () => mostrarEspeciales('happyhour'));

// Mostrar botones si hay especiales
Promise.all([cargarEspeciales('almuerzo'), cargarEspeciales('happyhour')]).then(([almuerzos, happy]) => {
  if (almuerzos.length) btnAlmuerzo.classList.remove('hidden');
  if (happy.length) btnHappyHour.classList.remove('hidden');
});
