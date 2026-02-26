import { supabase } from '../shared/supabaseClient.js';
import { resolverPlanComercio } from '../shared/planes.js';

const idComercio = new URLSearchParams(window.location.search).get('id');
const especialesBox = document.getElementById('especialesBox');
const tituloEspecialesBox = document.getElementById('tituloEspecialesBox');
const btnToggleAlmuerzo = document.getElementById('btnToggleAlmuerzo');
const btnToggleHappy = document.getElementById('btnToggleHappy');
const almuerzoCard = document.getElementById('almuerzoCard');
const happyCard = document.getElementById('happyCard');
const ESPECIAL_PLACEHOLDER = 'https://via.placeholder.com/120x120.png?text=Especial';

btnToggleAlmuerzo?.addEventListener('click', () => {
  almuerzoCard.classList.toggle('hidden');
  if (!happyCard.classList.contains('hidden')) happyCard.classList.add('hidden');
});

btnToggleHappy?.addEventListener('click', () => {
  happyCard.classList.toggle('hidden');
  if (!almuerzoCard.classList.contains('hidden')) almuerzoCard.classList.add('hidden');
});

async function obtenerImagenDeEspecial(idEspecial) {
  const { data, error } = await supabase
    .from('imgEspeciales')
    .select('imagen')
    .eq('idEspecial', idEspecial)
    .maybeSingle();

  if (error || !data?.imagen) return null;
  return supabase.storage.from('galeriacomercios').getPublicUrl(data.imagen).data.publicUrl;
}

async function obtenerPlanComercio() {
  const { data, error } = await supabase
    .from('Comercios')
    .select(
      'plan_id, plan_nivel, plan_nombre, permite_especiales, estado_propiedad, estado_verificacion, propietario_verificado'
    )
    .eq('id', idComercio)
    .maybeSingle();
  if (error) {
    console.warn('No se pudo cargar plan del comercio:', error?.message || error);
    return null;
  }
  return resolverPlanComercio(data || {});
}

async function cargarEspecialesComercio() {
  const planInfo = await obtenerPlanComercio();
  if (planInfo && !planInfo.permite_especiales) {
    especialesBox?.classList.add('hidden');
    return;
  }

  const hoy = new Date();
  const hora = hoy.getHours();
  const dia = hoy.getDay();

  const { data: especiales, error } = await supabase
    .from('especialesDia')
    .select('*')
    .eq('idcomercio', idComercio)
    .eq('diasemana', dia)
    .eq('activo', true);

  if (error || !especiales) return;

  let tieneAlmuerzo = false;
  let tieneHappyHour = false;

  const listaAlmuerzo = [];
  const listaHappy = [];

  for (const especial of especiales) {
    let url = null;
    if (especial.imagen) {
      url = `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${encodeURIComponent(especial.imagen)}`;
    } else {
      url = await obtenerImagenDeEspecial(especial.id);
    }
    const imgSrc = url || ESPECIAL_PLACEHOLDER;
    console.log(`🖼️ Imagen para ${especial.nombre} (${especial.tipo}):`, url);

    const card = `
      <div class="flex gap-4 items-start bg-white shadow p-4 rounded-lg mb-2">
        <img src="${imgSrc}" alt="Imagen Especial" class="w-24 h-24 object-cover rounded-md" loading="lazy">
        <div>
          <p class="font-semibold text-left text-md">${especial.nombre}</p>
          <p class="text-sm text-left text-gray-600 mb-1">${especial.descripcion || ''}</p>
          <p class="font-bold text-left text-green-600">$${especial.precio?.toFixed(2)}</p>
        </div>
      </div>`;

    if (especial.tipo === 'almuerzo' && hora >= 6 && hora < 16) {
      listaAlmuerzo.push(card);
      tieneAlmuerzo = true;
    }

    if (especial.tipo === 'happyhour') {
      listaHappy.push(card);
      tieneHappyHour = true;
    }
  }

  if (tieneAlmuerzo || tieneHappyHour) {
    especialesBox.classList.remove('hidden');
    tituloEspecialesBox.textContent = `Especiales para hoy ${hoy.toLocaleDateString('es-PR', { weekday: 'long' })}`;

    if (tieneAlmuerzo) {
      btnToggleAlmuerzo.classList.remove('hidden');
      almuerzoCard.innerHTML = `
        <h3 class="text-lg font-bold text-blue-500 mb-2 text-center">Especial de Almuerzo</h3>
        ${listaAlmuerzo.join('')}
      `;
    }

    if (tieneHappyHour) {
      btnToggleHappy.classList.remove('hidden');
      happyCard.innerHTML = `
        <h3 class="text-lg font-bold text-pink-500 mb-2 text-center">Happy Hour</h3>
        ${listaHappy.join('')}
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', cargarEspecialesComercio);
