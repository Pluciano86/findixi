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

async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    window.location.href = './login.html';
    return null;
  }
  return data.user;
}

async function cargarPerfil(user) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('nombre, apellido, email, imagen, municipio')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) return;
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

  const { data: relaciones, error: errRel } = await supabase
    .from('UsuarioComercios')
    .select('idComercio, rol')
    .eq('idUsuario', user.id);

  if (errRel) {
    console.error('Error cargando asignaciones', errRel);
  }

  const relacionesLista = Array.isArray(relaciones) ? relaciones : [];
  const idsRelacionados = new Set(relacionesLista.map((r) => r.idComercio).filter(Boolean));

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

  // Obtener conteo de colaboradores por comercio
  const colaboradoresMap = {};
  const { data: colaboradores, error: errCols } = await supabase
    .from('UsuarioComercios')
    .select('idComercio, rol')
    .in('idComercio', ids);

  if (!errCols && Array.isArray(colaboradores)) {
    colaboradores.forEach((col) => {
      const key = col.idComercio;
      if (!colaboradoresMap[key]) colaboradoresMap[key] = { admin: 0, editor: 0 };
      const rol = (col.rol || '').toLowerCase();
      if (rol.includes('admin')) colaboradoresMap[key].admin += 1;
      if (rol.includes('editor')) colaboradoresMap[key].editor += 1;
    });
  }

  // Asignar rol principal (primera asignación)
  const rolPrincipal = relacionesLista?.[0]?.rol;
  if (userRol) userRol.textContent = rolPrincipal ? rolPrincipal.replace('comercio_', '').replace('_', ' ').toUpperCase() : 'USUARIO';

  const { data: comercios, error: errCom } = await supabase
    .from('Comercios')
    .select(
      'id, nombre, logo, plan_id, plan_nivel, plan_nombre, permite_menu, permite_especiales, permite_ordenes, estado_propiedad, estado_verificacion, propietario_verificado, logo_aprobado, portada_aprobada'
    )
    .in('id', ids);

  if (errCom || !comercios?.length) {
    comerciosVacio?.classList.remove('hidden');
    return;
  }

  const metricasIntentoMap = {};
  const fecha30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const fecha7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { data: intentosData, error: errIntentos } = await supabase
    .from('basic_click_intents')
    .select('idComercio, created_at')
    .in('idComercio', ids)
    .gte('created_at', fecha30Dias.toISOString());

  if (errIntentos && errIntentos.code !== '42P01') {
    console.warn('No se pudieron cargar métricas de interés:', errIntentos.message || errIntentos);
  }

  if (!errIntentos && Array.isArray(intentosData)) {
    intentosData.forEach((evento) => {
      const comercioId = Number(evento.idComercio);
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
    const counts = colaboradoresMap[c.id] || { admin: 0, editor: 0 };
    card.className = 'bg-white border border-gray-200 rounded-2xl shadow p-4 sm:p-5 flex flex-col gap-4 sm:gap-5';

    // fila superior
    const filaTop = document.createElement('div');
    filaTop.className = 'flex justify-center';

    const bloqueInfo = document.createElement('div');
    bloqueInfo.className = 'flex flex-col items-center gap-3 sm:gap-4';

    const logoWrap = document.createElement('div');
    logoWrap.className = 'flex flex-col items-center';

    const logo = document.createElement('img');
    logo.className = 'w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border border-gray-200 bg-white';
    logo.src = c.logo
      ? (c.logo.startsWith('http')
          ? c.logo
          : `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${c.logo}`)
      : 'https://placehold.co/140x140?text=Logo';
    logo.alt = c.nombre || 'Logo';

    const logoName = document.createElement('p');
    logoName.className = 'mt-2 text-xl sm:text-2xl font-bold text-gray-900 text-center truncate max-w-[14rem]';
    logoName.textContent = c.nombre || 'Sin nombre';

    logoWrap.appendChild(logo);
    logoWrap.appendChild(logoName);

    bloqueInfo.appendChild(logoWrap);

    const planChip = document.createElement('div');
    planChip.className = 'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700';
    planChip.textContent = `Plan: ${planInfo.nombre}`;
    bloqueInfo.appendChild(planChip);

    const metrica = metricasIntentoMap[c.id] || { total30d: 0, total7d: 0 };
    const interesBox = document.createElement('div');
    interesBox.className = 'w-full rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-center';
    interesBox.innerHTML = `
      <p class="text-xs font-semibold text-blue-700 uppercase tracking-wide">Interés en Findixi</p>
      <p class="text-sm text-gray-800 mt-1">
        Intentaron ver tu perfil <span class="font-bold">${metrica.total30d}</span> veces en 30 días.
      </p>
      <p class="text-xs text-gray-600 mt-0.5">Últimos 7 días: ${metrica.total7d}</p>
    `;
    bloqueInfo.appendChild(interesBox);

    if (!brandingReady) {
      const brandingBox = document.createElement('div');
      brandingBox.className = 'w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center';
      brandingBox.innerHTML = `
        <p class="text-xs font-semibold text-amber-800 uppercase tracking-wide">Branding pendiente</p>
        <p class="text-xs text-amber-800 mt-1">Logo y portada deben estar aprobados para publicar.</p>
      `;
      bloqueInfo.appendChild(brandingBox);
    }

    if (!planInfo.permite_perfil) {
      const ctaInteres = document.createElement('a');
      ctaInteres.href = `./paquetes.html?id=${c.id}`;
      ctaInteres.className =
        'inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#0f172a] text-white text-xs font-semibold hover:bg-[#1e293b]';
      ctaInteres.textContent = 'Activa/completa tu perfil';
      bloqueInfo.appendChild(ctaInteres);
    }

    filaTop.appendChild(bloqueInfo);

    // fila inferior botones principales
    const filaBottom = document.createElement('div');
    filaBottom.className = 'grid grid-cols-1 sm:grid-cols-5 gap-2';

    const btnEditar = document.createElement('a');
    btnEditar.href = `./editarPerfilComercio.html?id=${c.id}`;
    btnEditar.className = 'w-full px-3 py-2 text-sm sm:text-base font-normal leading-snug bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-center flex items-center justify-center';
    btnEditar.textContent = 'Editar Perfil';

    const btnMenu = document.createElement('a');
    btnMenu.href = `./adminMenuComercio.html?id=${c.id}`;
    btnMenu.className = 'w-full px-3 py-2 text-sm sm:text-base font-normal leading-snug bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-center flex items-center justify-center';
    btnMenu.textContent = 'Editar Menú';

    const btnEspeciales = document.createElement('a');
    btnEspeciales.href = `./especiales/adminEspeciales.html?id=${c.id}`;
    btnEspeciales.className = 'w-full px-3 py-2 text-sm sm:text-base font-normal leading-snug bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-center flex items-center justify-center';

    const btnOrdenes = document.createElement('a');
    btnOrdenes.href = `./ordenesPickup.html?id=${c.id}`;
    btnOrdenes.className = 'w-full px-3 py-2 text-sm sm:text-base font-normal leading-snug bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-center flex items-center justify-center';
    btnOrdenes.textContent = 'Órdenes PickUp';

    const filaColab = document.createElement('div');
    filaColab.className = 'grid grid-cols-2 gap-2';

    const baseBtnColab =
      'w-full px-3 py-2 text-sm sm:text-base font-normal leading-snug bg-[#00a7e1] hover:bg-[#0092c5] text-white rounded-lg text-center flex items-center justify-center';

    const btnAgregarAdmin = document.createElement('button');
    btnAgregarAdmin.type = 'button';
    btnAgregarAdmin.className = baseBtnColab;
    btnAgregarAdmin.textContent = `Agregar Admin (${counts.admin})`;
    btnAgregarAdmin.addEventListener('click', () => abrirModalColab(c, 'admin'));

    const btnAgregarEditor = document.createElement('button');
    btnAgregarEditor.type = 'button';
    btnAgregarEditor.className = baseBtnColab;
    btnAgregarEditor.textContent = `Agregar Editor (${counts.editor})`;
    btnAgregarEditor.addEventListener('click', () => abrirModalColab(c, 'editor'));

    filaColab.appendChild(btnAgregarAdmin);
    filaColab.appendChild(btnAgregarEditor);

    const verColab = document.createElement('button');
    verColab.type = 'button';
    verColab.className = 'text-sm text-cyan-700 font-semibold underline-offset-4 hover:underline';
    verColab.textContent = 'Ver todos los colaboradores';
    verColab.addEventListener('click', () => verColaboradores(c.id));
    btnEspeciales.textContent = 'Almuerzos & Happy Hours';

    const bloquearBoton = (btn, texto) => {
      btn.classList.add('opacity-60', 'pointer-events-none');
      if (texto) btn.textContent = texto;
    };

    if (!planInfo.permite_menu) {
      bloquearBoton(btnMenu, 'Menú (Plus)');
    }

    if (!planInfo.permite_especiales) {
      bloquearBoton(btnEspeciales, 'Especiales (Plus)');
    }
    if (!planInfo.permite_ordenes) {
      bloquearBoton(btnOrdenes, 'Órdenes (Premium)');
    }

    const btnPaquetes = document.createElement('a');
    btnPaquetes.href = `./paquetes.html?id=${c.id}`;
    btnPaquetes.className = 'w-full px-3 py-2 text-sm sm:text-base font-normal leading-snug bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-center flex items-center justify-center';
    btnPaquetes.textContent = 'Paquetes';

    filaBottom.appendChild(btnEditar);
    filaBottom.appendChild(btnMenu);
    filaBottom.appendChild(btnEspeciales);
    filaBottom.appendChild(btnOrdenes);
    filaBottom.appendChild(btnPaquetes);

    card.appendChild(filaTop);
    card.appendChild(filaBottom);
    card.appendChild(filaColab);
    card.appendChild(verColab);
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

document.addEventListener('DOMContentLoaded', async () => {
  const user = await getUser();
  if (!user) return;
  await cargarPerfil(user);
  await cargarComercios(user);
});
