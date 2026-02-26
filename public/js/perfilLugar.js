import { supabase } from '../shared/supabaseClient.js';
import { requireAuth } from './authGuard.js';
import { calcularTiemposParaLista } from './calcularTiemposParaLista.js';
import { mostrarCercanosComida } from './cercanosComida.js';
import { mostrarPlayasCercanas } from './playasCercanas.js';
import { mostrarLugaresCercanos } from './lugaresCercanos.js';
import { cargarGaleriaLugar } from './galeriaLugar.js';
import { renderHorariosLugar } from './horariosLugar.js';

const params = new URLSearchParams(window.location.search);
const idLugar = params.get('id');

const loader = document.getElementById('loader');
const nombreEl = document.getElementById('nombreLugar');
const categoriasEl = document.getElementById('categoriaLugar');
const precioEl = document.getElementById('precioEntrada');
const direccionEl = document.getElementById('textoDireccionLugar');
const tiempoEl = document.getElementById('tiempoVehiculo');
const btnFavorito = document.getElementById('btnFavorito');
const estadoHorarioIcono = document.querySelector('#estadoHorarioContainer i');
const estadoHorarioTexto = document.querySelector('#estadoHorarioContainer p');

let usuarioId = null;
let lugarFavorito = false;

function mostrarLoader() {
  loader?.classList.remove('hidden');
  loader?.classList.add('flex');
}

function ocultarLoader() {
  loader?.classList.add('hidden');
  loader?.classList.remove('flex');
}

function actualizarDescripcion(nombre, descripcion) {
  const descripcionEl = document.getElementById('descripcionTexto');
  const toggleBtn = document.getElementById('toggleDescripcion');
  if (!descripcionEl || !toggleBtn) return;

  const texto = (descripcion || '').trim() || 'Descripción no disponible.';
  descripcionEl.innerHTML = `
    <span class="text-base leading-relaxed">
      <span class="font-semibold">${nombre}</span>
      <span class="font-light"> ${texto.replace(/\n/g, '<br>')}</span>
    </span>
  `;

  let expandido = false;
  toggleBtn.addEventListener('click', () => {
    expandido = !expandido;
    descripcionEl.classList.toggle('line-clamp-5', !expandido);
    toggleBtn.textContent = expandido ? 'Ocultar información' : 'Ver toda la información';
  });
}

async function obtenerCoordenadasUsuario() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function aplicarColoresLugar(colorPrimario, colorSecundario) {
  if (!colorPrimario && !colorSecundario) return;
  const root = document.documentElement;
  if (colorPrimario) root.style.setProperty('--lugar-color-primario', colorPrimario);
  if (colorSecundario) root.style.setProperty('--lugar-color-secundario', colorSecundario);
}

async function sincronizarFavoritoLugar(lugarId) {
  if (!usuarioId) {
    lugarFavorito = false;
    return;
  }
  const { data, error } = await supabase
    .from('favoritosLugares')
    .select('id')
    .eq('idusuario', usuarioId)
    .eq('idlugar', lugarId)
    .maybeSingle();
  if (error) {
    console.error('Error verificando favorito:', error);
    return;
  }
  lugarFavorito = !!data;
}

async function inicializarFavorito(lugarId) {
  if (!btnFavorito || !lugarId) return;
  const icono = btnFavorito.querySelector('i');
  const texto = btnFavorito.querySelector('span');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      usuarioId = user.id;
      await sincronizarFavoritoLugar(lugarId);
    }
  } catch (error) {
    console.warn('⚠️ No se pudo obtener el usuario actual:', error?.message);
  }
  actualizarFavoritoUI(icono, texto);

  btnFavorito.addEventListener('click', async () => {
    if (!usuarioId) {
      try {
        const authUser = await requireAuth('favoritePlace');
        if (!authUser?.id) return;
        usuarioId = authUser.id;
        await sincronizarFavoritoLugar(lugarId);
        actualizarFavoritoUI(icono, texto);
      } catch {
        return;
      }
    }

    if (lugarFavorito) {
      console.log('Eliminando de favoritosLugares');
      const { error } = await supabase
        .from('favoritosLugares')
        .delete()
        .eq('idusuario', usuarioId)
        .eq('idlugar', lugarId);
      if (!error) {
        lugarFavorito = false;
        actualizarFavoritoUI(icono, texto);
      } else {
        console.error('❌ Error eliminando favorito:', error);
      }
    } else {
      console.log('Insertando en favoritosLugares');
      const { error } = await supabase
        .from('favoritosLugares')
        .insert([{ idusuario: usuarioId, idlugar: lugarId }]);
      if (!error) {
        lugarFavorito = true;
        actualizarFavoritoUI(icono, texto);
      } else {
        console.error('❌ Error añadiendo favorito:', error);
        alert('Hubo un problema al añadir este lugar a favoritos.');
      }
    }
  });
}

function actualizarFavoritoUI(icono, texto) {
  if (!icono || !texto) return;
  if (lugarFavorito) {
    console.log('Animando ícono de favoritos en lugar...');
    icono.className = 'fas fa-heart text-xl text-red-500 animate-bounce transition-all duration-300 ease-in-out';
    texto.textContent = 'En favoritos';
  } else {
    icono.className = 'far fa-heart text-xl transition-all duration-300 ease-in-out';
    texto.textContent = 'Añadir a favoritos';
  }
}

async function cargarCategoriasLugar(idLugar) {
  const { data, error } = await supabase
    .from('lugarCategoria')
    .select(`
      categoria:categoriaLugares (
        nombre
      )
    `)
    .eq('idLugar', idLugar);

  if (error) {
    console.error('Error cargando categorías del lugar:', error);
    return [];
  }

  return (data || [])
    .map((item) => item.categoria?.nombre)
    .filter(Boolean);
}

function renderCategorias(categorias = []) {
  if (!categoriasEl) return;
  categoriasEl.classList.remove('hidden');

  if (!categorias.length) {
    categoriasEl.textContent = '';
    categoriasEl.classList.add('hidden');
    return;
  }

  categoriasEl.textContent = categorias.join(', ');
}

async function cargarPerfilLugar() {
  if (!idLugar) {
    console.error('No se recibió un ID de lugar.');
    return;
  }

  mostrarLoader();

  try {
    const { data: lugar, error } = await supabase
  .from('LugaresTuristicos')
  .select(`
  id,
  nombre,
  municipio,
  direccion,
  descripcion,
  telefono,
  facebook,
  instagram,
  tiktok,
  web,
  imagen,
  latitud,
  longitud,
  abiertoSiempre,
  gratis,
  precioEntrada,
  activo
`)
  .eq('id', idLugar)
  .single();

    if (error || !lugar) {
      console.error('Error cargando lugar:', error);
      const descripcionEl = document.getElementById('descripcionTexto');
      if (descripcionEl) {
        descripcionEl.textContent = 'No se pudo cargar la información de este lugar.';
      }
      return;
    }

    aplicarColoresLugar(lugar.colorPrimario, lugar.colorSecundario);
    if (lugar.nombre) {
      document.title = `${lugar.nombre} | EnPe Erre`;
    }

    nombreEl.textContent = lugar.nombre || 'Lugar sin nombre';

    const categorias = await cargarCategoriasLugar(lugar.id);
    renderCategorias(categorias);

    if (precioEl) {
      precioEl.innerHTML = '';
      precioEl.className = 'hidden';

      const esGratis = lugar.gratis === true ||
        lugar.gratis === 'true' ||
        lugar.gratis === 1 ||
        lugar.gratis === '1';

      if (esGratis) {
        precioEl.className = 'flex items-center justify-center gap-2 text-base text-green-500';
        precioEl.innerHTML = `<i class="fas fa-ticket text-green-500"></i><span>Entrada Gratis</span>`;
      } else if (lugar.precioEntrada !== null && lugar.precioEntrada !== undefined && `${lugar.precioEntrada}`.trim() !== '') {
        const monto = Number(lugar.precioEntrada);
        const precioFormat = Number.isFinite(monto)
          ? monto.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
          : `$${String(lugar.precioEntrada).replace(/^[^0-9]+/, '')}`;
        precioEl.className = 'flex items-center justify-center gap-2 text-2xl text-green-500';
        precioEl.innerHTML = `<i class="fas fa-ticket text-green-500"></i><span>Entrada: ${precioFormat}</span>`;
      }
    }

    const direccion = lugar.direccion?.trim();
    direccionEl.textContent = direccion || 'Dirección no disponible';

    const coordsUsuario = await obtenerCoordenadasUsuario();
    const tieneCoordenadas =
      Number.isFinite(Number(lugar.latitud)) && Number.isFinite(Number(lugar.longitud));

    if (coordsUsuario && tieneCoordenadas) {
      const [conTiempo] = await calcularTiemposParaLista(
        [{
          id: lugar.id,
          latitud: Number(lugar.latitud),
          longitud: Number(lugar.longitud)
        }],
        coordsUsuario
      );

      if (conTiempo?.tiempoTexto) {
        tiempoEl.innerHTML = `<i class="fas fa-car"></i> ${conTiempo.tiempoTexto}`;
      } else {
        tiempoEl.innerHTML = '<i class="fas fa-car"></i> Distancia no disponible';
      }
    } else {
      tiempoEl.innerHTML = '<i class="fas fa-car"></i> Distancia no disponible';
    }

    if (tieneCoordenadas) {
      const lat = Number(lugar.latitud);
      const lon = Number(lugar.longitud);
      document.getElementById('btnGoogleMaps').href = `https://www.google.com/maps?q=${lat},${lon}`;
      document.getElementById('btnWaze').href = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
    } else {
      document.getElementById('btnGoogleMaps').href = '#';
      document.getElementById('btnWaze').href = '#';
    }

    actualizarDescripcion(lugar.nombre || 'Lugar', lugar.descripcion);

    await cargarGaleriaLugar(lugar.id);
    await renderHorariosLugar(lugar.id, lugar.nombre || 'Lugar');

    if (!lugar.activo) {
      if (estadoHorarioIcono) {
        estadoHorarioIcono.className = 'fa-regular fa-clock text-red-500 text-2xl';
      }
      if (estadoHorarioTexto) {
        estadoHorarioTexto.className = 'text-sm text-red-600 font-medium';
        estadoHorarioTexto.textContent = 'No disponible temporalmente';
      }
    }

    await inicializarFavorito(lugar.id);

    document.getElementById('nombreCercanosComida').textContent = lugar.nombre || '';
    document.getElementById('nombreCercanosLugares').textContent = lugar.nombre || '';
    document.getElementById('nombreCercanosPlayas').textContent = lugar.nombre || '';

    const origen = {
      id: lugar.id,
      nombre: lugar.nombre,
      municipio: lugar.municipio,
      latitud: Number(lugar.latitud),
      longitud: Number(lugar.longitud),
    };

    mostrarCercanosComida(origen);
    mostrarPlayasCercanas(origen);
    mostrarLugaresCercanos(origen);
  } catch (error) {
    console.error('Error general cargando el perfil del lugar:', error);
    const descripcionEl = document.getElementById('descripcionTexto');
    if (descripcionEl) {
      descripcionEl.textContent = 'Tuvimos un inconveniente obteniendo la información del lugar.';
    }
  } finally {
    ocultarLoader();
  }
}

document.addEventListener('DOMContentLoaded', cargarPerfilLugar);
