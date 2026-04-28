import { supabase } from '../shared/supabaseClient.js';
import { resolverPlanComercio } from '../shared/planes.js';

const btnLogout = document.getElementById('btnLogout');
const userNombre = document.getElementById('userNombre');
const userEmail = document.getElementById('userEmail');
const userAvatar = document.getElementById('userAvatar');
const userRol = document.getElementById('userRol');
const comerciosLista = document.getElementById('comerciosLista');
const comerciosVacio = document.getElementById('comerciosVacio');
const modalColab = document.getElementById('modalColab');
const modalCerrar = document.getElementById('modalCerrar');
const modalCancelar = document.getElementById('modalCancelar');
const formColab = document.getElementById('formColab');
const modalComercioNombre = document.getElementById('modalComercioNombre');
const modalComercioId = document.getElementById('modalComercioId');
const modalRol = document.getElementById('modalRol');
const modalRolTexto = document.getElementById('modalRolTexto');
const inputColabEmail = document.getElementById('inputColabEmail');
const colabSuggestions = document.getElementById('colabSuggestions');
let colabSearchTimer;
const COMERCIOS_SELECT_BASE =
  'id, nombre, logo, plan_id, plan_nivel, plan_nombre, permite_menu, permite_especiales, permite_ordenes, estado_propiedad, estado_verificacion, propietario_verificado, logo_aprobado, portada_aprobada';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getIdComercio(row = {}) {
  return toNumber(row.idComercio ?? row.idcomercio ?? row.id_comercio ?? row.comercio_id ?? null);
}

function parseStorageAsignaciones() {
  try {
    const raw = localStorage.getItem('comercio_asignaciones');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        idComercio: getIdComercio(item),
        rol: item?.rol || '',
      }))
      .filter((item) => Number.isFinite(item.idComercio));
  } catch (_error) {
    return [];
  }
}

function isMissingColumnError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('column') && msg.includes('does not exist');
}

async function fetchComerciosByIds(ids = []) {
  if (!ids.length) return { data: [], error: null };

  const attempts = [
    `${COMERCIOS_SELECT_BASE}, categoria, idCategoria, tipo_perfil, tiendaFisica, tiendaOnline`,
    `${COMERCIOS_SELECT_BASE}, categoria, idCategoria, tipo_perfil`,
    `${COMERCIOS_SELECT_BASE}, categoria, idCategoria`,
    `${COMERCIOS_SELECT_BASE}, categoria`,
    COMERCIOS_SELECT_BASE,
  ];

  let lastError = null;
  for (const selectExpr of attempts) {
    const { data, error } = await supabase.from('Comercios').select(selectExpr).in('id', ids);
    if (!error) return { data: Array.isArray(data) ? data : [], error: null };
    lastError = error;
    if (!isMissingColumnError(error)) break;
  }

  return { data: [], error: lastError };
}


async function fetchUsuarioComerciosByUser(userId) {
  const attempts = [
    { selectCol: 'idComercio', filterCol: 'idUsuario' },
    { selectCol: 'idcomercio', filterCol: 'idUsuario' },
    { selectCol: 'idComercio', filterCol: 'idusuario' },
    { selectCol: 'idcomercio', filterCol: 'idusuario' },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from('UsuarioComercios')
      .select(`${attempt.selectCol}, rol`)
      .eq(attempt.filterCol, userId);

    if (!error) {
      const rows = Array.isArray(data) ? data : [];
      return rows
        .map((row) => ({
          idComercio: getIdComercio(row),
          rol: row?.rol || '',
        }))
        .filter((row) => Number.isFinite(row.idComercio));
    }

    lastError = error;
    if (!isMissingColumnError(error)) break;
  }

  throw lastError || new Error('No se pudieron cargar asignaciones.');
}


async function fetchIntentosByComercioIds(ids = [], fechaIso = '') {
  if (!ids.length) return [];

  const attempts = ['idComercio', 'idcomercio'];
  let lastError = null;

  for (const col of attempts) {
    let query = supabase
      .from('basic_click_intents')
      .select(`${col}, created_at`)
      .in(col, ids);

    if (fechaIso) {
      query = query.gte('created_at', fechaIso);
    }

    const { data, error } = await query;

    if (!error) {
      const rows = Array.isArray(data) ? data : [];
      return rows.map((row) => ({
        idComercio: getIdComercio(row),
        created_at: row?.created_at || null,
      }));
    }

    lastError = error;
    if (!isMissingColumnError(error)) break;
  }

  if (lastError && lastError.code !== '42P01') {
    console.warn('No se pudieron cargar métricas de interés:', lastError.message || lastError);
  }
  return [];
}

async function fetchFavoritosByComercioIds(ids = []) {
  const map = {};
  if (!ids.length) return map;

  const attempts = ['idcomercio', 'idComercio'];
  for (const col of attempts) {
    const { data, error } = await supabase.from('favoritosusuarios').select(col).in(col, ids);
    if (error) {
      if (isMissingColumnError(error)) continue;
      return map;
    }

    (Array.isArray(data) ? data : []).forEach((row) => {
      const id = getIdComercio(row);
      if (!Number.isFinite(id)) return;
      map[id] = (map[id] || 0) + 1;
    });
    return map;
  }

  return map;
}

async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    window.location.href = './login.html';
    return null;
  }
  return data.user;
}

async function cargarPerfil(user) {
  const fallbackNombre =
    String(
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split('@')?.[0] ||
      'Usuario'
    ).trim() || 'Usuario';
  if (userNombre) userNombre.textContent = fallbackNombre;
  if (userEmail) userEmail.textContent = user?.email || '—';
  if (userAvatar) userAvatar.src = 'https://placehold.co/120x120?text=User';

  const { data, error } = await supabase
    .from('usuarios')
    .select('nombre, apellido, email, imagen, municipio')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('No se pudo cargar perfil desde tabla usuarios:', error.message || error);
    return;
  }
  if (!data) {
    console.warn('No existe fila en tabla usuarios para auth.uid:', user.id);
    return;
  }

  const nombreCompleto = `${data.nombre || ''} ${data.apellido || ''}`.trim() || 'Sin nombre';
  userNombre.textContent = nombreCompleto;
  userEmail.textContent = data.email || user.email || '—';
  userAvatar.src = data.imagen
    ? (data.imagen.startsWith('http')
        ? data.imagen
        : `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${data.imagen}`)
    : 'https://placehold.co/120x120?text=User';
}

async function cargarComercios(user) {
  if (!comerciosLista) return;
  comerciosLista.innerHTML = '';
  comerciosVacio?.classList.add('hidden');

  let relacionesLista = [];
  try {
    relacionesLista = await fetchUsuarioComerciosByUser(user.id);
  } catch (errRel) {
    console.error('Error cargando asignaciones', errRel);
  }

  if (!relacionesLista.length) {
    const fallbackAsignaciones = parseStorageAsignaciones();
    if (fallbackAsignaciones.length) {
      console.info('[dashboardComercio] Usando asignaciones de localStorage como respaldo.');
      relacionesLista = fallbackAsignaciones;
    }
  }

  const idsRelacionados = new Set(relacionesLista.map((r) => getIdComercio(r)).filter(Boolean));

  const { data: comerciosOwner, error: errOwner } = await supabase
    .from('Comercios')
    .select('id')
    .eq('owner_user_id', user.id);

  if (errOwner) {
    console.warn('No se pudieron cargar comercios por owner_user_id:', errOwner.message || errOwner);
  }

  (Array.isArray(comerciosOwner) ? comerciosOwner : []).forEach((c) => {
    if (!c?.id) return;
    if (!idsRelacionados.has(c.id)) {
      idsRelacionados.add(c.id);
      relacionesLista.push({ idComercio: c.id, rol: 'comercio_admin' });
    }
  });

  const ids = [...idsRelacionados];
  if (!ids.length) {
    comerciosVacio?.classList.remove('hidden');
    return;
  }

  // Asignar rol principal (primera asignación)
  const rolPrincipal = relacionesLista?.[0]?.rol;
  if (userRol) userRol.textContent = rolPrincipal ? rolPrincipal.replace('comercio_', '').replace('_', ' ').toUpperCase() : 'USUARIO';

  const { data: comercios, error: errCom } = await fetchComerciosByIds(ids);

  if (errCom || !comercios?.length) {
    comerciosVacio?.classList.remove('hidden');
    return;
  }

  const metricasIntentoMap = {};
  const fecha30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const fecha7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [intentosData, favoritosMap] = await Promise.all([
    fetchIntentosByComercioIds(ids, fecha30Dias.toISOString()),
    fetchFavoritosByComercioIds(ids),
  ]);
  if (Array.isArray(intentosData)) {
    intentosData.forEach((evento) => {
      const comercioId = getIdComercio(evento);
      if (!Number.isFinite(comercioId)) return;
      if (!metricasIntentoMap[comercioId]) {
        metricasIntentoMap[comercioId] = { total30d: 0, total7d: 0 };
      }
      metricasIntentoMap[comercioId].total30d += 1;
      if (evento.created_at && new Date(evento.created_at) >= fecha7Dias) {
        metricasIntentoMap[comercioId].total7d += 1;
      }
    });
  }

  comercios.forEach((c) => {
    const card = document.createElement('div');
    const planInfo = resolverPlanComercio(c);
    const brandingReady = c.logo_aprobado === true && c.portada_aprobada === true;
    card.className = 'bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col gap-4 cursor-pointer hover:border-[#219ebc] transition';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => {
      window.location.href = `./editarPerfilComercio.html?id=${c.id}`;
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.href = `./editarPerfilComercio.html?id=${c.id}`;
      }
    });

    const metrica = metricasIntentoMap[c.id] || { total30d: 0, total7d: 0 };
    const favoritos = Number(favoritosMap[c.id] || 0);

    const topWrap = document.createElement('div');
    topWrap.className = 'flex items-center gap-3 rounded-xl border border-slate-200 p-3 sm:p-4';

    const logo = document.createElement('img');
    logo.className = 'w-16 h-16 rounded-full object-cover border border-gray-200 bg-white';
    logo.src = c.logo
      ? (c.logo.startsWith('http')
          ? c.logo
          : `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${c.logo}`)
      : 'https://placehold.co/140x140?text=Logo';
    logo.alt = c.nombre || 'Logo';

    const topMeta = document.createElement('div');
    topMeta.className = 'min-w-0 flex-1';
    topMeta.innerHTML = `
      <h4 class="text-lg sm:text-xl font-semibold text-slate-900 truncate">${c.nombre || 'Comercio sin nombre'}</h4>
      <p class="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">${planInfo.nombre}</p>
    `;

    const topArrow = document.createElement('span');
    topArrow.className = 'text-slate-400 text-xl';
    topArrow.textContent = '›';

    topWrap.appendChild(logo);
    topWrap.appendChild(topMeta);
    topWrap.appendChild(topArrow);

    const statsRow = document.createElement('div');
    statsRow.className = 'grid grid-cols-2 gap-2';
    statsRow.innerHTML = `
      <div class="rounded-xl border border-orange-200 bg-orange-50 p-3 text-center">
        <p class="text-[11px] uppercase tracking-wide text-slate-700 font-semibold">Favoritos</p>
        <p class="text-3xl sm:text-4xl font-bold text-slate-900 leading-none mt-1">${favoritos}</p>
        <p class="text-[11px] text-slate-600 mt-1">Usuarios</p>
      </div>
      <div class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
        <p class="text-[11px] uppercase tracking-wide text-slate-700 font-semibold">Ultimos 30 dias</p>
        <p class="text-3xl sm:text-4xl font-bold text-slate-900 leading-none mt-1">${metrica.total30d}</p>
        <p class="text-[11px] text-slate-600 mt-1">Visitas</p>
      </div>
    `;

    const weekHint = document.createElement('p');
    weekHint.className = 'text-xs text-slate-500 text-center';
    weekHint.textContent = `Ultimos 7 dias: ${metrica.total7d}`;

    let brandingBox = null;
    if (!brandingReady) {
      brandingBox = document.createElement('div');
      brandingBox.className = 'w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center';
      brandingBox.innerHTML = `
        <p class="text-xs font-semibold text-amber-800 uppercase tracking-wide">Branding pendiente</p>
        <p class="text-xs text-amber-800 mt-1">Logo y portada deben estar aprobados para publicar.</p>
      `;
    }

    card.appendChild(topWrap);
    card.appendChild(statsRow);
    card.appendChild(weekHint);
    if (brandingBox) card.appendChild(brandingBox);
    comerciosLista.appendChild(card);
  });
}

function verColaboradores(comercioId) {
  // Placeholder de navegación/listado; enlazar a la vista real de colaboradores si existe.
  console.log('Ver colaboradores de comercio', comercioId);
  alert('Listado de colaboradores próximamente.');
}

function abrirModalColab(comercio, rol) {
  if (!modalColab) return;
  modalColab.classList.remove('hidden');
  modalColab.classList.add('flex');
  modalComercioId.value = comercio.id || '';
  modalComercioNombre.textContent = comercio.nombre || 'Comercio';
  modalRol.value = rol;
  modalRolTexto.textContent = rol === 'admin' ? 'Administrador' : 'Editor';
  inputColabEmail.value = '';
  inputColabEmail.focus();
  limpiarSugerencias();
}

function cerrarModalColab() {
  if (!modalColab) return;
  modalColab.classList.add('hidden');
  modalColab.classList.remove('flex');
  formColab?.reset();
  limpiarSugerencias();
}

modalCerrar?.addEventListener('click', cerrarModalColab);
modalCancelar?.addEventListener('click', cerrarModalColab);
modalColab?.addEventListener('click', (e) => {
  if (e.target === modalColab) cerrarModalColab();
});

formColab?.addEventListener('submit', (e) => {
  e.preventDefault();
  enviarInvitacion();
});

async function enviarInvitacion() {
  const emailInvitado = inputColabEmail.value.trim().toLowerCase();
  if (!emailInvitado) return;
  try {
    const idComercio = Number(modalComercioId.value);
    if (!idComercio) {
      console.error('idComercio inválido', modalComercioId.value);
      alert('No se pudo identificar el comercio.');
      return;
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) {
      console.error('Error obteniendo usuario auth', userErr);
      alert('No hay sesión activa. Intenta de nuevo.');
      return;
    }

    const { data: usr, error: usrErr } = await supabase
      .from('usuarios')
      .select('id,email')
      .ilike('email', emailInvitado)
      .maybeSingle();

    if (usrErr || !usr) {
      console.error('Email no existe en usuarios', usrErr);
      alert('Ese email no existe en usuarios (debe registrarse primero).');
      return;
    }

    const rolSeleccionado = modalRol.value === 'admin' ? 'comercio_admin' : 'comercio_editor';

    const { error } = await supabase.from('Mensajes').insert({
      id_comercio: idComercio,
      creado_por: user.id,
      destino_usuario: usr.id,
      destino_email: usr.email,
      rol: rolSeleccionado,
      tipo: 'invitacion_colaborador',
      payload: {
        comercio_id: idComercio,
        rol: rolSeleccionado,
      },
      estado: 'pendiente',
    });
    if (error) throw error;
    alert('Invitación enviada');
  } catch (err) {
    console.error('Error enviando invitación', err);
    alert('No se pudo enviar la invitación. Intenta de nuevo.');
  } finally {
    cerrarModalColab();
  }
}

function limpiarSugerencias() {
  if (!colabSuggestions) return;
  colabSuggestions.innerHTML = '';
  colabSuggestions.classList.add('hidden');
}

async function buscarColaboradores(term) {
  if (!term || term.length < 2) {
    limpiarSugerencias();
    return;
  }
  const { data, error } = await supabase
    .from('usuarios')
    .select('email, nombre, apellido')
    .ilike('email', `%${term}%`)
    .limit(5);

  if (error || !Array.isArray(data)) {
    limpiarSugerencias();
    return;
  }

  colabSuggestions.innerHTML = '';
  if (!data.length) {
    const empty = document.createElement('div');
    empty.className = 'px-3 py-2 text-sm text-gray-500';
    empty.textContent = 'Sin resultados';
    colabSuggestions.appendChild(empty);
  } else {
    data.forEach((u) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'w-full text-left px-3 py-2 text-sm hover:bg-gray-100';
      const nombre = `${u.nombre || ''} ${u.apellido || ''}`.trim();
      item.innerHTML = `<span class="font-semibold">${u.email}</span>${nombre ? ` · <span class="text-gray-600">${nombre}</span>` : ''}`;
      item.addEventListener('click', () => {
        inputColabEmail.value = u.email;
        limpiarSugerencias();
      });
      colabSuggestions.appendChild(item);
    });
  }
  colabSuggestions.classList.remove('hidden');
}

inputColabEmail?.addEventListener('input', (e) => {
  const term = e.target.value.trim();
  if (colabSearchTimer) clearTimeout(colabSearchTimer);
  colabSearchTimer = setTimeout(() => buscarColaboradores(term), 200);
});

document.addEventListener('click', (e) => {
  if (!colabSuggestions || colabSuggestions.classList.contains('hidden')) return;
  if (modalColab && modalColab.contains(e.target) && (e.target === inputColabEmail || colabSuggestions.contains(e.target))) return;
  limpiarSugerencias();
});

btnLogout?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = './login.html';
});

async function initDashboardComercio() {
  const user = await getUser();
  if (!user) return;
  await cargarPerfil(user);
  await cargarComercios(user);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void initDashboardComercio();
  }, { once: true });
} else {
  void initDashboardComercio();
}
