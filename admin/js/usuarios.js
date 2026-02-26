import { supabase } from '../shared/supabaseClient.js';
import { resolvePath } from '../shared/pathResolver.js';

const tablaUsuarios = document.getElementById('tabla-usuarios');
const tablaMobile = document.getElementById('tabla-mobile');
const filtroNombre = document.getElementById('search-nombre');
const filtroMunicipio = document.getElementById('search-municipio');
const filtroTipo = document.getElementById('search-tipo');

const PLACEHOLDER_FOTO = 'https://placehold.co/80x80?text=User';

let usuariosOriginales = [];
let comerciosModal = [];
let comerciosSeleccionados = new Set();

const modalCrear = document.getElementById('modalCrearUsuario');
const btnNuevoUsuario = document.getElementById('btnNuevoUsuario');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelarCrear = document.getElementById('btnCancelarCrear');
const btnConfirmarCrear = document.getElementById('btnConfirmarCrear');
const inputNombre = document.getElementById('nuevoNombre');
const inputEmail = document.getElementById('nuevoEmail');
const inputPassword = document.getElementById('nuevoPassword');
const btnTogglePassword = document.getElementById('togglePassword');
const checkForcePassword = document.getElementById('forcePasswordChange');
const inputBuscarComercio = document.getElementById('buscarComercioModal');
const listaComerciosModal = document.getElementById('listaComerciosModal');
const contadorComercios = document.getElementById('contadorComercios');
const crearUsuarioError = document.getElementById('crearUsuarioError');

function formatearFecha(iso) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-PR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function determinarTipo(usuario) {
  if (!usuario.comercios?.length) return 'Regular';
  const roles = usuario.comercios.map(c => (c.rol || '').toLowerCase());
  if (roles.includes('colaborador') || roles.includes('colaborador de comercio')) {
    return 'Colaborador de Comercio';
  }
  return 'Admin Comercio';
}

function obtenerBadges(usuario) {
  const badges = [];
  const tipo = determinarTipo(usuario);

  if (usuario.membresiaUp) {
    badges.push({
      tipo: 'up',
      logo: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/Logo%20UP_FondoOscuro.png'
    });
  }

  if (tipo === 'Admin Comercio') {
    badges.push({
      tipo: 'admin',
      texto: 'Admin',
      emoji: '🧑‍💼',
      clase: 'bg-cyan-500/15 text-cyan-100 border border-cyan-400/40'
    });
  } else if (tipo.includes('colaborador')) {
    badges.push({
      tipo: 'editor',
      texto: 'Editor',
      emoji: '✏️',
      clase: 'bg-amber-400/15 text-amber-100 border border-amber-300/40'
    });
  }

  return badges;
}

function renderizarBadges(badges) {
  if (!badges?.length) return '';
  return badges
    .map((b) => {
      if (b.tipo === 'up') {
        return `<img src="${b.logo}" alt="Membresía Up" class="h-6 w-auto drop-shadow-md inline-block align-middle">`;
      }
      return `<span class="px-2 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${b.clase}">
        ${b.emoji || ''} ${b.texto || ''}
      </span>`;
    })
    .join('');
}

function renderizarBadgesCorner(badges) {
  if (!badges?.length) return '';
  return badges
    .map((b) => {
      if (b.tipo === 'up') {
        return `<img src="${b.logo}" alt="Membresía Up" class="h-9 w-auto drop-shadow-xl">`;
      }
      return `<span class="px-3 py-1 rounded-full text-[12px] font-semibold inline-flex items-center gap-1 ${b.clase}">
        ${b.emoji || ''} ${b.texto || ''}
      </span>`;
    })
    .join('');
}

function crearFila(usuario) {
  const fila = document.createElement('tr');
  fila.className = 'hover:bg-gray-50';

  const tipo = determinarTipo(usuario);
  const foto = usuario.imagen || PLACEHOLDER_FOTO;
  const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Sin nombre';

  const perfilUrl = resolvePath(`usuarioPerfil.html?id=${usuario.id}`);

  const badgesHtml = renderizarBadges(obtenerBadges(usuario));

  fila.innerHTML = `
    <td class="px-4 py-3">
      <img src="${foto}" alt="Foto" class="w-12 h-12 rounded-full object-cover border" />
    </td>
    <td class="px-4 py-3 font-medium text-gray-800">${nombreCompleto}</td>
    <td class="px-4 py-3 text-gray-600">${usuario.municipio || '—'}</td>
    <td class="px-4 py-3 text-gray-600">–</td>
    <td class="px-4 py-3">
      <div class="flex flex-wrap gap-1">${badgesHtml}</div>
    </td>
    <td class="px-4 py-3 text-gray-600">${formatearFecha(usuario.creado_en)}</td>
    <td class="px-4 py-3 text-center">
      <div class="flex items-center justify-center gap-2">
        <a href="${perfilUrl}" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-cyan-500 hover:bg-cyan-600 text-white rounded">
          <i class="fas fa-eye"></i>
          Ver
        </a>
        <a href="${resolvePath(`usuarioEditar.html?id=${usuario.id}`)}" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded">
          <i class="fas fa-pen"></i>
          Editar
        </a>
        <button data-id="${usuario.id}" class="btn-eliminar inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded">
          <i class="fas fa-trash"></i>
          Eliminar
        </button>
      </div>
    </td>
  `;

  return fila;
}

function crearTarjeta(usuario) {
  const tarjeta = document.createElement('div');
  tarjeta.className = 'relative bg-white/5 backdrop-blur-xl border border-white/10 text-white rounded-2xl shadow p-4 flex items-center gap-4';

  const badgesData = obtenerBadges(usuario);
  const badgesCorner = renderizarBadgesCorner(badgesData);
  const foto = usuario.imagen || PLACEHOLDER_FOTO;
  const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Sin nombre';

  const perfilUrl = resolvePath(`usuarioPerfil.html?id=${usuario.id}`);

  tarjeta.innerHTML = `
    <div class="absolute top-2 right-2 flex gap-2">${badgesCorner}</div>
    <img src="${foto}" alt="Foto" class="w-16 h-16 rounded-full object-cover border border-white/10" />
    <div class="flex-1">
      <h3 class="text-lg font-semibold text-white">${nombreCompleto}</h3>
      <p class="text-sm text-gray-300">${usuario.municipio || '—'}</p>
      <p class="text-sm text-gray-300 mt-1">${formatearFecha(usuario.creado_en)}</p>
      <div class="flex gap-2 mt-3 flex-wrap">
        <a href="${perfilUrl}" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-cyan-500 hover:bg-cyan-600 text-white rounded">
          <i class="fas fa-eye"></i>
          Ver
        </a>
        <a href="${resolvePath(`usuarioEditar.html?id=${usuario.id}`)}" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded">
          <i class="fas fa-pen"></i>
          Editar
        </a>
        <button data-id="${usuario.id}" class="btn-eliminar inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded">
          <i class="fas fa-trash"></i>
          Eliminar
        </button>
      </div>
    </div>
  `;

  return tarjeta;
}

function mostrarError(mensaje) {
  tablaUsuarios.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-red-500">${mensaje}</td></tr>`;
  tablaMobile.innerHTML = `<p class="text-red-500 text-center">${mensaje}</p>`;
}

async function eliminarUsuario(id, nombre = '') {
  const confirmar = confirm(`¿Eliminar al usuario ${nombre || id}?`);
  if (!confirmar) return;
  const { error } = await supabase.from('usuarios').delete().eq('id', id);
  if (error) {
    alert('No se pudo eliminar el usuario');
    return;
  }
  await cargarUsuarios();
}

function renderizarUsuarios(lista) {
  if (!lista.length) {
    tablaUsuarios.innerHTML = '<tr><td colspan="7" class="px-4 py-6 text-center text-gray-500">No se encontraron usuarios</td></tr>';
    tablaMobile.innerHTML = '<p class="text-gray-500 text-center">No se encontraron usuarios</p>';
    return;
  }

  tablaUsuarios.innerHTML = '';
  tablaMobile.innerHTML = '';

  lista.forEach(usuario => {
    tablaUsuarios.appendChild(crearFila(usuario));
    tablaMobile.appendChild(crearTarjeta(usuario));
  });

  // Bind eliminar botones
  document.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const nombre = btn.getAttribute('data-nombre');
      eliminarUsuario(id, nombre);
    });
  });
}

function aplicarFiltros() {
  const texto = (filtroNombre?.value || '').trim().toLowerCase();
  const municipioSeleccionado = filtroMunicipio?.value || '';
  const tipoSeleccionado = filtroTipo?.value || '';

  const filtrados = usuariosOriginales.filter(usuario => {
    const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.toLowerCase();
    const email = (usuario.email || '').toLowerCase();
    const coincideNombre = !texto || nombreCompleto.includes(texto) || email.includes(texto);

    const coincideMunicipio = !municipioSeleccionado || usuario.municipio === municipioSeleccionado;

    const tipo = determinarTipo(usuario).toLowerCase();
    let coincideTipo = true;
    if (tipoSeleccionado === 'up') coincideTipo = usuario.membresiaUp === true;
    else if (tipoSeleccionado === 'regulares') coincideTipo = !usuario.membresiaUp && tipo.includes('regular');
    else if (tipoSeleccionado === 'admins-comercio') coincideTipo = tipo.includes('admin');
    else if (tipoSeleccionado === 'colaboradores-comercio') coincideTipo = tipo.includes('colaborador');

    return coincideNombre && coincideMunicipio && coincideTipo;
  });

  renderizarUsuarios(filtrados);
}

function inicializarFiltros() {
  [filtroNombre, filtroMunicipio, filtroTipo].forEach(control => {
    if (!control) return;
    control.addEventListener('input', aplicarFiltros);
    control.addEventListener('change', aplicarFiltros);
  });
}

function toggleModalCrear(show = false) {
  if (!modalCrear) return;
  modalCrear.classList.toggle('hidden', !show);
  modalCrear.classList.toggle('flex', show);
  if (!show) resetModalCrear();
}

function resetModalCrear() {
  [inputNombre, inputEmail, inputPassword, inputBuscarComercio].forEach(inp => {
    if (inp) inp.value = '';
  });
  if (checkForcePassword) checkForcePassword.checked = false;
  comerciosSeleccionados = new Set();
  actualizarContadorComercios();
  renderizarListaComercios();
  mostrarErrorCrear('');
}

function mostrarErrorCrear(mensaje = '') {
  if (!crearUsuarioError) return;
  if (!mensaje) {
    crearUsuarioError.classList.add('hidden');
    crearUsuarioError.textContent = '';
  } else {
    crearUsuarioError.classList.remove('hidden');
    crearUsuarioError.textContent = mensaje;
  }
}

function actualizarContadorComercios() {
  if (contadorComercios) contadorComercios.textContent = `Seleccionados: ${comerciosSeleccionados.size}`;
}

function normalizarTexto(str = '') {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function renderizarListaComercios(filtro = '') {
  if (!listaComerciosModal) return;
  const term = normalizarTexto(filtro.trim());
  listaComerciosModal.innerHTML = '';

  const listaFiltrada = comerciosModal.filter(c =>
    normalizarTexto(c.nombre).includes(term)
  );

  if (!listaFiltrada.length) {
    listaComerciosModal.innerHTML = '<p class="p-3 text-sm text-gray-500">No hay comercios que coincidan</p>';
    actualizarContadorComercios();
    return;
  }

  listaFiltrada.forEach(comercio => {
    const label = document.createElement('label');
    label.className = 'flex items-center justify-between px-3 py-2 hover:bg-gray-50';

    const left = document.createElement('div');
    left.className = 'flex items-center gap-2';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = comercio.id;
    checkbox.checked = comerciosSeleccionados.has(comercio.id);
    checkbox.className = 'h-4 w-4';
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) comerciosSeleccionados.add(comercio.id);
      else comerciosSeleccionados.delete(comercio.id);
      actualizarContadorComercios();
    });

    const nombre = document.createElement('span');
    nombre.className = 'text-sm text-gray-800';
    nombre.textContent = comercio.nombre;

    left.appendChild(checkbox);
    left.appendChild(nombre);
    label.appendChild(left);

    listaComerciosModal.appendChild(label);
  });

  actualizarContadorComercios();
}

async function cargarComerciosModal() {
  if (!listaComerciosModal) return;
  const { data, error } = await supabase
    .from('Comercios')
    .select('id, nombre')
    .order('nombre');

  if (error) {
    console.error('Error cargando comercios:', error);
    mostrarErrorCrear('No se pudieron cargar los comercios');
    return;
  }

  comerciosModal = data || [];
  renderizarListaComercios(inputBuscarComercio?.value || '');
}

function validarFormularioCrear() {
  const nombre = (inputNombre?.value || '').trim();
  const email = (inputEmail?.value || '').trim();
  const password = inputPassword?.value || '';

  if (!nombre) return 'El nombre es obligatorio';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Email inválido';
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
  return '';
}

async function crearUsuario() {
  const errorValidacion = validarFormularioCrear();
  if (errorValidacion) {
    mostrarErrorCrear(errorValidacion);
    return;
  }
  mostrarErrorCrear('');

  if (!btnConfirmarCrear) return;
  const textoOriginal = btnConfirmarCrear.textContent;
  btnConfirmarCrear.disabled = true;
  btnConfirmarCrear.textContent = 'Creando...';

  const payload = {
    nombre: (inputNombre?.value || '').trim(),
    email: (inputEmail?.value || '').trim(),
    password: inputPassword?.value || '',
    comercios: Array.from(comerciosSeleccionados),
    force_password_change: checkForcePassword?.checked || false
  };

  const { data, error } = await supabase.functions.invoke('crear_usuario_comercio', {
    body: payload
  });

  btnConfirmarCrear.disabled = false;
  btnConfirmarCrear.textContent = textoOriginal;

  if (error) {
    console.error('Error creando usuario:', error);
    mostrarErrorCrear(error.message || 'No se pudo crear el usuario');
    return;
  }

  if (data?.ok) {
    toggleModalCrear(false);
    alert('Usuario creado');
    await cargarUsuarios();
    return;
  }

  mostrarErrorCrear(data?.message || 'No se pudo crear el usuario');
}

async function cargarMunicipios() {
  if (!filtroMunicipio) return;
  const { data, error } = await supabase
    .from('Municipios')
    .select('id, nombre')
    .order('nombre');

  if (error) {
    console.error('Error cargando municipios:', error);
    return;
  }

  data.forEach(municipio => {
    const opcion = document.createElement('option');
    opcion.value = municipio.nombre;
    opcion.textContent = municipio.nombre;
    filtroMunicipio.appendChild(opcion);
  });
}

async function cargarUsuarios() {
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id,
      nombre,
      apellido,
      membresiaUp,
      email,
      imagen,
      creado_en,
      Municipios:Municipios(nombre),
      UsuarioComercios:UsuarioComercios(
        rol,
        Comercios:Comercios!fk_usuario_comercio_comercio(nombre)
      )
    `);

  if (error) {
    console.error('Error cargando usuarios:', error);
    mostrarError('Error cargando usuarios');
    return;
  }

  usuariosOriginales = (data || []).map(usuario => ({
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    membresiaUp: usuario.membresiaUp === true,
    email: usuario.email,
    imagen: usuario.imagen,
    creado_en: usuario.creado_en,
    municipio: usuario.Municipios?.nombre || '—',
    comercios: usuario.UsuarioComercios?.map(uc => ({
      rol: uc.rol,
      nombre: uc.Comercios?.nombre
    })) || []
  }));

  renderizarUsuarios(usuariosOriginales);
}

async function init() {
  await cargarMunicipios();
  await cargarUsuarios();
  inicializarFiltros();
  await cargarComerciosModal();

  if (btnNuevoUsuario) btnNuevoUsuario.addEventListener('click', () => toggleModalCrear(true));
  [btnCerrarModal, btnCancelarCrear].forEach(btn => {
    if (btn) btn.addEventListener('click', () => toggleModalCrear(false));
  });
  if (inputBuscarComercio) {
    inputBuscarComercio.addEventListener('input', (e) => renderizarListaComercios(e.target.value || ''));
  }
  if (btnConfirmarCrear) btnConfirmarCrear.addEventListener('click', crearUsuario);
  if (btnTogglePassword && inputPassword) {
    btnTogglePassword.addEventListener('click', () => {
      const isHidden = inputPassword.type === 'password';
      inputPassword.type = isHidden ? 'text' : 'password';
      btnTogglePassword.innerHTML = isHidden
        ? '<i class="fa-regular fa-eye-slash" aria-hidden="true"></i>'
        : '<i class="fa-regular fa-eye" aria-hidden="true"></i>';
    });
  }
}

init();
