console.log('🚀 Inició cargarEspeciales.js');
import { supabase } from '../shared/supabaseClient.js';
import { renderizarEspeciales } from './renderEspeciales.js';
import { mostrarCargando, mostrarError } from '../js/mensajesUI.js';

const contenedorAlmuerzos = document.getElementById('contenedorAlmuerzos');
const contenedorHappy = document.getElementById('contenedorHappy');

async function cargarEspecialesDelDia() {
  const hoy = new Date().getDay();

  if (contenedorAlmuerzos) {
    mostrarCargando(contenedorAlmuerzos, 'Cargando especiales...', '⏳');
  }
  if (contenedorHappy) {
    mostrarCargando(contenedorHappy, 'Cargando especiales...', '⏳');
  }

  const { data: especiales, error } = await supabase
    .from('especialesDia')
    .select('id, nombre, descripcion, precio, tipo, diasemana, imagen, activo, idcomercio')
    .eq('activo', true)
    .eq('diasemana', hoy);

  if (error) {
    console.error('🛑 Error cargando especiales:', error.message);
    if (contenedorAlmuerzos) {
      mostrarError(contenedorAlmuerzos, 'No pudimos cargar los especiales.', '⚠️');
    }
    if (contenedorHappy) {
      mostrarError(contenedorHappy, 'No pudimos cargar los especiales.', '⚠️');
    }
    return;
  }

  const agrupados = {};

  for (const especial of especiales) {
    const comercioId = especial.idcomercio;

    if (!agrupados[comercioId]) {
      let comercio = null;
      try {
        const { data: comercioData, error: comercioErr } = await supabase
          .from('Comercios')
          .select('id,nombre,nombreSucursal,municipio,logo,categoria,telefono,latitud,longitud')
          .eq('id', comercioId)
          .maybeSingle();
        if (comercioErr) {
          console.warn('No se pudo cargar comercio de especial:', comercioId, comercioErr?.message || comercioErr);
        } else {
          comercio = comercioData;
        }
      } catch (err) {
        console.warn('No se pudo cargar comercio de especial:', comercioId, err?.message || err);
      }

      const categorias = [];
      if (comercio?.categoria) categorias.push(comercio.categoria);

      // Logo: ahora se almacena la URL en Comercios.logo. Si no está, intentamos fallback a imagenesComercios.
      let logoUrl = null;
      if (comercio?.logo) {
        logoUrl = comercio.logo.startsWith('http')
          ? comercio.logo
          : `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${comercio.logo}`;
      } else {
        const { data: logoData } = await supabase
          .from('imagenesComercios')
          .select('imagen')
          .eq('idComercio', comercioId)
          .eq('logo', true)
          .maybeSingle();
        if (logoData?.imagen) {
          logoUrl = `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${logoData.imagen}`;
        }
      }

      agrupados[comercioId] = {
        comercio: {
          id: comercio?.id ?? comercioId,
          nombre: comercio?.nombre || comercio?.nombreSucursal || 'Comercio',
          municipio: comercio?.municipio || '',
          latitud: comercio?.latitud != null ? Number(comercio.latitud) : null,
          longitud: comercio?.longitud != null ? Number(comercio.longitud) : null,
          categorias: categorias,
          telefono: comercio?.telefono || '',
          logo: logoUrl,
        },
        especiales: []
      };
    }

    agrupados[comercioId].especiales.push({
      ...especial,
      imagen: especial.imagen || null
    });
  }

  const listaAgrupada = Object.values(agrupados);
  renderizarEspeciales(listaAgrupada);
}

document.addEventListener('DOMContentLoaded', cargarEspecialesDelDia);
