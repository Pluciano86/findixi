import { supabase } from '../shared/supabaseClient.js';

// === Referencias a elementos del DOM ===
const btnFavoritos = document.getElementById('btnFavoritos');
const modalFavoritos = document.getElementById('modalFavoritos');
const favoritosList = document.getElementById('favoritos-list');
const buscadorFavoritos = document.getElementById('buscadorFavoritos');
const filtroMunicipio = document.getElementById('filtroMunicipio');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroOrden = document.getElementById('filtroOrden');

// === Estado global ===
let usuarioActual = null;
let listaFavoritos = [];
let listaFiltrada = [];

// === Función: Cargar perfil del usuario actual ===
async function cargarPerfilUsuario() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    console.error('Error obteniendo usuario:', error);
    return;
  }

  usuarioActual = user;

  // Cargar datos adicionales del usuario (si tienes tabla "usuarios")
  const { data, error: errUsuario } = await supabase
    .from('usuarios')
    .select('nombre, apellido, imagen, municipio, creado_en')
    .eq('id', user.id)
    .maybeSingle();

  if (errUsuario) console.warn('No se pudo cargar información extendida del usuario:', errUsuario);

  document.getElementById('nombreUsuario').textContent = `${data?.nombre || user.email}`;
  document.getElementById('emailUsuario').textContent = user.email;
  document.getElementById('municipioUsuario').textContent = data?.municipio || '—';
  document.getElementById('fotoPerfil').src = data?.imagen || 'https://placehold.co/100x100?text=User';
  document.getElementById('fechaRegistro').textContent = data?.creado_en
    ? `Activo desde ${new Date(data.creado_en).toLocaleDateString('es-PR')}`
    : '';
}

// === Función: Cargar comercios favoritos ===
async function cargarFavoritos() {
  if (!usuarioActual) return;

  // 1️⃣ Traer los favoritos del usuario con los datos básicos del comercio
  const { data: favoritos, error } = await supabase
    .from('favoritosusuarios')
    .select(`
      id,
      creado_en,
      Comercios:Comercios(
        id,
        nombre,
        telefono,
        municipio,
        activo,
        imagenesComercios(imagen, portada)
      )
    `)
    .eq('idusuario', usuarioActual.id)
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('Error cargando favoritos:', error);
    favoritosList.innerHTML = '<p class="text-center text-red-500">Error cargando favoritos.</p>';
    return;
  }

  // 2️⃣ Para cada comercio, traer sus categorías desde ComercioCategorias → Categorias
  const comerciosIds = favoritos.map(f => f.Comercios?.id).filter(Boolean);
  let categoriasPorComercio = {};

  if (comerciosIds.length > 0) {
    const { data: relaciones, error: errCat } = await supabase
      .from('ComercioCategorias')
      .select(`
        idComercio,
        Categorias:Categorias(nombre)
      `)
      .in('idComercio', comerciosIds);

    if (!errCat && relaciones) {
      relaciones.forEach(r => {
        if (!categoriasPorComercio[r.idComercio]) categoriasPorComercio[r.idComercio] = [];
        categoriasPorComercio[r.idComercio].push(r.Categorias?.nombre);
      });
    }
  }

  // 3️⃣ Unir las categorías al resultado principal
  listaFavoritos = (favoritos || []).map(f => ({
    ...f,
    Comercios: {
      ...f.Comercios,
      categorias: categoriasPorComercio[f.Comercios?.id] || []
    }
  })).filter(f => f.Comercios?.activo);

  listaFiltrada = [...listaFavoritos];

  mostrarFavoritos();
  cargarFiltros();
}

// === Función: Mostrar favoritos en tarjetas ===
function mostrarFavoritos() {
  favoritosList.innerHTML = '';

  if (!listaFiltrada.length) {
    favoritosList.innerHTML = '<p class="text-center text-gray-500 mt-6">No tienes comercios favoritos todavía.</p>';
    return;
  }

  listaFiltrada.forEach(fav => {
    const c = fav.Comercios;
    const portada = c.imagenesComercios?.find(img => img.portada)?.imagen
      || 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/lugarnodisponible.jpg';

    const card = document.createElement('div');
    card.className = 'bg-white border rounded-xl shadow hover:shadow-md transition overflow-hidden';
    card.innerHTML = `
      <div class="relative w-full h-40">
        <img src="${portada}" alt="${c.nombre}" class="w-full h-full object-cover">
      </div>
      <div class="p-3 text-left">
        <h3 class="font-semibold text-lg">${c.nombre}</h3>
        <p class="text-sm text-gray-500">${c.municipio || 'Municipio'}</p>
        <p class="text-xs text-gray-400">${c.categorias?.join(', ') || ''}</p>
        <a href="perfilComercio.html?id=${c.id}" 
           class="block mt-2 text-sm text-blue-600 font-medium hover:underline">
          Ver Perfil
        </a>
      </div>
    `;
    favoritosList.appendChild(card);
  });
}

// === Función: Cargar opciones de filtros ===
function cargarFiltros() {
  const municipios = [...new Set(listaFavoritos.map(f => f.Comercios?.municipio).filter(Boolean))];
  const categorias = [
    ...new Set(
      listaFavoritos.flatMap(f => f.Comercios?.categorias || [])
    )
  ];

  filtroMunicipio.innerHTML = '<option value="">Municipio</option>';
  municipios.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    filtroMunicipio.appendChild(opt);
  });

  filtroCategoria.innerHTML = '<option value="">Categoría</option>';
  categorias.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    filtroCategoria.appendChild(opt);
  });
}

// === Función: Aplicar filtros y búsqueda ===
function aplicarFiltros() {
  const texto = buscadorFavoritos.value.toLowerCase();
  const muni = filtroMunicipio.value;
  const cat = filtroCategoria.value;
  const orden = filtroOrden.value;

  listaFiltrada = listaFavoritos.filter(f => {
    const c = f.Comercios;
    const coincideTexto = !texto || c.nombre.toLowerCase().includes(texto);
    const coincideMunicipio = !muni || c.municipio === muni;
    const coincideCategoria = !cat || (c.categorias || []).includes(cat);
    return coincideTexto && coincideMunicipio && coincideCategoria;
  });

  // Orden
  if (orden === 'alfabetico') {
    listaFiltrada.sort((a, b) => a.Comercios.nombre.localeCompare(b.Comercios.nombre));
  } else if (orden === 'recientes') {
    listaFiltrada.sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
  }

  mostrarFavoritos();
}

// === Eventos ===
btnFavoritos.addEventListener('click', async () => {
  modalFavoritos.classList.remove('hidden');
  await cargarFavoritos();
});

document.getElementById('btnCerrarFavoritos').addEventListener('click', () => {
  modalFavoritos.classList.add('hidden');
});

[buscadorFavoritos, filtroMunicipio, filtroCategoria, filtroOrden].forEach(el => {
  el?.addEventListener('input', aplicarFiltros);
  el?.addEventListener('change', aplicarFiltros);
});

// === Inicialización ===
cargarPerfilUsuario();