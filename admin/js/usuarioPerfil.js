import { supabase } from '../shared/supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const idUsuario = params.get('id');

const fotoEl = document.getElementById('user-foto');
const nombreEl = document.getElementById('user-nombre');
const emailEl = document.getElementById('user-email');
const municipioEl = document.getElementById('user-municipio');
const creadoEl = document.getElementById('user-creado');
const comerciosListEl = document.getElementById('comercios-list');
const favoritosListEl = document.getElementById('favoritos-list');
const comerciosCard = document.getElementById('comercios-card');
const btnAsignar = document.getElementById('btnAsignarComercio');
const modalComercios = document.getElementById('modalComercios');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelarAsignacion = document.getElementById('btnCancelarAsignacion');
const btnConfirmarAsignacion = document.getElementById('btnConfirmarAsignacion');
const listaComerciosEl = document.getElementById('listaComercios');
const searchComercioEl = document.getElementById('searchComercio');
const estadoComerciosEl = document.getElementById('estadoComercios');
const accordions = document.querySelectorAll('.accordion-btn');
const favComerciosEl = document.getElementById('fav-comercios');
const favPlayasEl = document.getElementById('fav-playas');
const favLugaresEl = document.getElementById('fav-lugares');
const btnEditarUsuario = document.getElementById('btnEditarUsuario');
const modalEditarUsuario = document.getElementById('modalEditarUsuario');
const btnCerrarEditar = document.getElementById('btnCerrarEditar');
const btnCancelarEditar = document.getElementById('btnCancelarEditar');
const btnGuardarEditar = document.getElementById('btnGuardarEditar');
const editNombre = document.getElementById('editNombre');
const editApellido = document.getElementById('editApellido');
const editEmail = document.getElementById('editEmail');
const editTelefono = document.getElementById('editTelefono');
const editMunicipio = document.getElementById('editMunicipio');
const editImagen = document.getElementById('editImagen');
const toggleMembresiaUp = document.getElementById('toggleMembresiaUp');

const PLACEHOLDER_FOTO = 'https://placehold.co/120x120?text=User';
const PLACEHOLDER_LOGO = 'https://placehold.co/64x64?text=Logo';
const LOGO_UP = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/Logo%20UP_FondoOscuro.png';
const PLACEHOLDER_LOGO_SMALL = 'https://placehold.co/60x60?text=Logo';
let comerciosActivos = [];
let comercioSeleccionado = null;
let usuarioPerfil = null;

if (!idUsuario) {
  console.error('ID de usuario no proporcionado');
  if (nombreEl) nombreEl.textContent = 'Usuario no encontrado';
  if (comerciosListEl) comerciosListEl.innerHTML = '<li class="px-4 py-2 text-red-500">Falta el parámetro id en la URL</li>';
  if (favoritosListEl) favoritosListEl.innerHTML = '<li class="px-4 py-2 text-red-500">Falta el parámetro id en la URL</li>';
  throw new Error('ID de usuario requerido');
}

console.log('ID recibido:', idUsuario);

function renderLista(target, items, emptyMsg) {
  if (!target) return;
  target.innerHTML = '';
  if (!items || !items.length) {
    target.innerHTML = `<li class="px-4 py-2 text-gray-500">${emptyMsg}</li>`;
    return;
  }
  items.forEach(item => target.appendChild(item));
}

async function cargarUsuario() {
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id,
      nombre,
      apellido,
      telefono,
      email,
      imagen,
      membresiaUp,
      creado_en,
      municipio,
      Municipios(nombre),
      UsuarioComercios(
        idComercio,
        Comercios:Comercios!fk_usuario_comercio_comercio (id, nombre, logo)
      )
    `)
    .eq('id', idUsuario)
    .maybeSingle();

  if (error) {
    console.error('Error cargando usuario:', JSON.stringify(error, null, 2));
    renderLista(comerciosListEl, null, 'Error cargando usuario');
    renderLista(favoritosListEl, null, 'Error cargando usuario');
    return;
  }

  if (!data) {
    console.warn('Usuario no encontrado');
    if (nombreEl) nombreEl.textContent = 'Usuario no encontrado';
    renderLista(comerciosListEl, null, 'Ningún comercio asignado');
    renderLista(favoritosListEl, null, 'Sin favoritos');
    return;
  }

  console.log('Usuario cargado:', data);

  if (fotoEl) fotoEl.src = data.imagen || PLACEHOLDER_FOTO;
  if (data.membresiaUp && fotoEl) {
    const wrapper = fotoEl.parentElement;
    if (wrapper) {
      wrapper.classList.add('relative');
      const existing = wrapper.querySelector('.badge-up');
      if (existing) existing.remove();
      const badge = document.createElement('img');
      badge.src = LOGO_UP;
      badge.alt = 'Membresía Up';
      badge.className = 'badge-up absolute -top-2 -right-2 h-10 w-auto drop-shadow-lg';
      wrapper.appendChild(badge);
    }
  } else if (fotoEl?.parentElement) {
    const wrapper = fotoEl.parentElement;
    const existing = wrapper.querySelector('.badge-up');
    if (existing) existing.remove();
  }
  if (toggleMembresiaUp) toggleMembresiaUp.checked = data.membresiaUp === true;
  if (nombreEl) {
    const nombreCompleto = `${data.nombre || ''} ${data.apellido || ''}`.trim() || 'Sin nombre';
    nombreEl.textContent = nombreCompleto;
  }
  if (emailEl) emailEl.textContent = data.email || 'Sin email';
  if (municipioEl) municipioEl.textContent = data.Municipios?.nombre || data.municipio || 'Sin municipio';
  if (creadoEl) {
    creadoEl.textContent = data.creado_en
      ? `Creado: ${new Date(data.creado_en).toLocaleDateString('es-PR')}`
      : 'Creado: --';
  }

  const comercios = data.UsuarioComercios?.map(rel => rel.Comercios).filter(Boolean) || [];
  if (comercios.length === 0 && comerciosCard) {
    comerciosCard.classList.add('hidden');
  } else {
    if (comerciosCard) comerciosCard.classList.remove('hidden');
    renderLista(comerciosListEl, comercios.map(crearItemComercio), 'Ningún comercio asignado');
  }

  usuarioPerfil = data;
  // Previsualización modal
  const fotoModal = document.getElementById('editFotoPreview');
  if (fotoModal) fotoModal.src = data.imagen || PLACEHOLDER_FOTO;

  await cargarFavoritos();
}

async function cargarFavoritos() {
  // Comercios favoritos
  const { data: favCom, error: errCom } = await supabase
    .from('favoritosusuarios')
    .select(`
      idcomercio,
      Comercios (id, nombre, municipio, logo)
    `)
    .eq('idusuario', idUsuario);

  if (!errCom && favComerciosEl) {
    const items = favCom?.map(f => f.Comercios).filter(Boolean) || [];
    favComerciosEl.innerHTML = items.length
      ? items.map(renderFavoritoCard).join('')
      : '<p class="text-sm text-white/60">Sin favoritos</p>';
  }

  // Playas favoritas
  const { data: favPlayas, error: errPl } = await supabase
    .from('favoritosPlayas')
    .select(`
      idplaya,
      Playas (id, nombre)
    `)
    .eq('idusuario', idUsuario);
  if (!errPl && favPlayasEl) {
    const items = favPlayas?.map(f => f.Playas).filter(Boolean) || [];
    favPlayasEl.innerHTML = items.length
      ? items.map(renderFavoritoCard).join('')
      : '<p class="text-sm text-white/60">Sin favoritos</p>';
  }

  // Lugares favoritos
  const { data: favLug, error: errLug } = await supabase
    .from('favoritosLugares')
    .select(`
      idlugar,
      Lugares (id, nombre)
    `)
    .eq('idusuario', idUsuario);
  if (!errLug && favLugaresEl) {
    const items = favLug?.map(f => f.Lugares).filter(Boolean) || [];
    favLugaresEl.innerHTML = items.length
      ? items.map(renderFavoritoCard).join('')
      : '<p class="text-sm text-white/60">Sin favoritos</p>';
  }
}

function renderFavoritoCard(item = {}) {
  const nombre = item.nombre || 'Favorito';
  const muni = item.municipio || '';
  const logo = item.logo
    ? (item.logo.startsWith('http')
        ? item.logo
        : `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${item.logo}`)
    : PLACEHOLDER_LOGO_SMALL;
  return `
    <div class="flex items-center gap-3 p-3 rounded-xl bg-white/10 border border-white/10">
      <img src="${logo}" alt="${nombre}" class="w-12 h-12 rounded-full object-cover border border-white/10 bg-white">
      <div class="flex-1">
        <p class="text-sm font-semibold text-white">${nombre}</p>
        ${muni ? `<p class="text-xs text-white/70">${muni}</p>` : ''}
      </div>
    </div>
  `;
}

function crearItemComercio(comercio) {
  const li = document.createElement('div');
  li.className = 'flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-white/10 border border-white/10 shadow-sm';

  const left = document.createElement('div');
  left.className = 'flex items-center gap-3';

  const logo = document.createElement('img');
  logo.src = comercio.logo
    ? (comercio.logo.startsWith('http')
        ? comercio.logo
        : `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${comercio.logo}`)
    : PLACEHOLDER_LOGO;
  logo.alt = comercio.nombre || 'Logo';
  logo.className = 'w-12 h-12 rounded object-cover border border-white/10 bg-white';

  const nombre = document.createElement('p');
  nombre.className = 'text-sm font-semibold text-white';
  nombre.textContent = comercio.nombre || 'Comercio';

  left.appendChild(logo);
  left.appendChild(nombre);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'text-red-300 text-sm hover:text-red-200 underline';
  btn.textContent = 'Eliminar';
  btn.onclick = () => eliminarAsignacion(comercio.id);

  li.appendChild(left);
  li.appendChild(btn);
  return li;
}

async function eliminarAsignacion(idComercio) {
  const confirmar = confirm('¿Seguro que quieres eliminar esta asignación?');
  if (!confirmar) return;
  const { error } = await supabase
    .from('UsuarioComercios')
    .delete()
    .eq('idUsuario', idUsuario)
    .eq('idComercio', idComercio);
  if (error) {
    console.error('Error eliminando asignación:', error);
    alert('No se pudo eliminar la asignación');
    return;
  }
  await cargarUsuario();
}

cargarUsuario();

function toggleModal(show = false) {
  if (!modalComercios) return;
  modalComercios.classList.toggle('hidden', !show);
  modalComercios.classList.toggle('flex', show);
  if (show) {
    comercioSeleccionado = null;
    if (searchComercioEl) searchComercioEl.value = '';
    renderListaComercios(comerciosActivos);
  }
}

function renderListaComercios(data = []) {
  if (!listaComerciosEl) return;
  listaComerciosEl.innerHTML = '';
  const texto = (searchComercioEl?.value || '').trim().toLowerCase();
  const filtrados = data.filter(c => c.nombre.toLowerCase().includes(texto));

  if (!filtrados.length) {
    listaComerciosEl.innerHTML = '<div class="p-3 text-sm text-gray-500 text-center">No se encontraron comercios activos.</div>';
    return;
  }

  filtrados.forEach(c => {
    const row = document.createElement('label');
    row.className = 'flex items-center gap-3 px-3 py-2 hover:bg-white cursor-pointer';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'comercioSelect';
    radio.value = c.id;
    radio.className = 'accent-blue-600';
    radio.onchange = () => (comercioSeleccionado = c.id);
    const nombre = document.createElement('span');
    nombre.textContent = c.nombre;
    nombre.className = 'text-sm text-gray-800';
    row.appendChild(radio);
    row.appendChild(nombre);
    listaComerciosEl.appendChild(row);
  });
}

async function cargarComerciosActivos() {
  const { data, error } = await supabase
    .from('Comercios')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error cargando comercios activos:', error);
    if (estadoComerciosEl) {
      estadoComerciosEl.textContent = 'Error cargando comercios';
      estadoComerciosEl.classList.remove('hidden');
    }
    return;
  }
  comerciosActivos = data || [];
  renderListaComercios(comerciosActivos);
}

async function asignarComercio() {
  if (!comercioSeleccionado) {
    alert('Selecciona un comercio');
    return;
  }
  const payload = {
    idUsuario,
    idComercio: comercioSeleccionado,
    rol: 'admin'
  };

  const { error } = await supabase
    .from('UsuarioComercios')
    .upsert(payload, { onConflict: 'idUsuario,idComercio' });

  if (error) {
    console.error('Error asignando comercio:', error);
    alert('No se pudo asignar el comercio');
    return;
  }

  alert('Comercio asignado correctamente');
  toggleModal(false);
  await cargarUsuario();
}

btnAsignar?.addEventListener('click', () => toggleModal(true));
btnCerrarModal?.addEventListener('click', () => toggleModal(false));
btnCancelarAsignacion?.addEventListener('click', () => toggleModal(false));
btnConfirmarAsignacion?.addEventListener('click', asignarComercio);
searchComercioEl?.addEventListener('input', () => renderListaComercios(comerciosActivos));

document.addEventListener('DOMContentLoaded', cargarComerciosActivos);

accordions.forEach(btn => {
  btn.addEventListener('click', () => {
    const panelId = btn.getAttribute('data-panel');
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const chevron = btn.querySelector('i');
    const isHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    chevron?.classList.toggle('rotate-180', isHidden);
  });
});

async function cargarMunicipiosSelect() {
  if (!editMunicipio) return;
  const { data, error } = await supabase.from('Municipios').select('nombre').order('nombre');
  if (error) {
    console.warn('No se pudieron cargar municipios', error);
    return;
  }
  editMunicipio.innerHTML = '<option value="">Seleccione</option>';
  data?.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.nombre;
    opt.textContent = m.nombre;
    editMunicipio.appendChild(opt);
  });
}

function abrirModalEditar() {
  if (!usuarioPerfil) return;
  modalEditarUsuario?.classList.remove('hidden');
  modalEditarUsuario?.classList.add('flex');
  editNombre.value = usuarioPerfil.nombre || '';
  editApellido.value = usuarioPerfil.apellido || '';
  editEmail.value = usuarioPerfil.email || '';
  editTelefono.value = usuarioPerfil.telefono || '';
  editMunicipio.value = usuarioPerfil.municipio || '';
  editImagen.value = usuarioPerfil.imagen || '';
  const fotoModal = document.getElementById('editFotoPreview');
  if (fotoModal) fotoModal.src = usuarioPerfil.imagen || PLACEHOLDER_FOTO;
}

function cerrarModalEditar() {
  modalEditarUsuario?.classList.add('hidden');
  modalEditarUsuario?.classList.remove('flex');
}

async function guardarEdicion() {
  if (!usuarioPerfil) return;
  const membresiaUpNueva = !!toggleMembresiaUp?.checked;
  const confirmar = confirm(`¿Guardar cambios? La membresía quedará ${membresiaUpNueva ? 'ACTIVADA' : 'DESACTIVADA'}.`);
  if (!confirmar) return;
  const payload = {
    nombre: editNombre.value.trim(),
    apellido: editApellido.value.trim(),
    email: editEmail.value.trim(),
    telefono: editTelefono.value.trim(),
    municipio: editMunicipio.value || null,
    imagen: editImagen.value.trim() || null,
    membresiaUp: membresiaUpNueva,
  };

  const { error } = await supabase.from('usuarios').update(payload).eq('id', idUsuario);
  if (error) {
    alert('No se pudo actualizar el usuario');
    console.error(error);
    return;
  }
  usuarioPerfil.membresiaUp = membresiaUpNueva;
  await cargarUsuario();
  cerrarModalEditar();
}

btnEditarUsuario?.addEventListener('click', () => {
  abrirModalEditar();
});
btnCerrarEditar?.addEventListener('click', cerrarModalEditar);
btnCancelarEditar?.addEventListener('click', cerrarModalEditar);
btnGuardarEditar?.addEventListener('click', guardarEdicion);

document.addEventListener('DOMContentLoaded', cargarMunicipiosSelect);

async function toggleMembresiaHandler() {
  if (!usuarioPerfil) return;
  const nuevoValor = !!toggleMembresiaUp.checked;
  const confirmar = confirm(`¿Confirmas ${nuevoValor ? 'activar' : 'desactivar'} la Membresía Up?`);
  if (!confirmar) {
    toggleMembresiaUp.checked = usuarioPerfil.membresiaUp === true;
    return;
  }
  const { error } = await supabase.from('usuarios').update({ membresiaUp: nuevoValor }).eq('id', idUsuario);
  if (error) {
    alert('No se pudo actualizar la membresía');
    console.error(error);
    toggleMembresiaUp.checked = usuarioPerfil.membresiaUp === true;
    return;
  }
  usuarioPerfil.membresiaUp = nuevoValor;
  await cargarUsuario();
}

toggleMembresiaUp?.addEventListener('change', toggleMembresiaHandler);
