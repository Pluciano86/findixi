import { supabase } from '../shared/supabaseClient.js';

const MODAL_ROOT_ID = 'adminModalRoot';
const idComercio = new URLSearchParams(window.location.search).get('id');
const comercioId = Number.parseInt(idComercio, 10);

let comercioTieneSucursales = false;
let relaciones = [];
let relacionComoSucursal = null;
let sucursales = [];
let catalogoComercios = null;

function obtenerModalRoot() {
  return document.getElementById(MODAL_ROOT_ID) || document.body;
}

async function asegurarComercioPrincipal() {
  if (comercioTieneSucursales) return true;
  const deseaActivar = confirm('Este comercio aún no administra sucursales. ¿Deseas habilitarlo como comercio principal?');
  if (!deseaActivar) return false;

  const { error } = await supabase
    .from('Comercios')
    .update({ tieneSucursales: true })
    .eq('id', comercioId);

  if (error) {
    console.error('Error actualizando tieneSucursales:', error);
    alert('No se pudo habilitar el manejo de sucursales. Intenta nuevamente.');
    return false;
  }

  comercioTieneSucursales = true;
  return true;
}

async function sincronizarGrupoConSucursal(sucursalId) {
  if (!Number.isFinite(sucursalId)) return;

  const sucursalesObjetivo = new Set([sucursalId]);

  const { data: relacionesConSeleccionada, error: errorSeleccionada } = await supabase
    .from('ComercioSucursales')
    .select('comercio_id')
    .eq('sucursal_id', sucursalId);

  if (errorSeleccionada) {
    console.error('Error verificando relaciones para la sucursal seleccionada:', errorSeleccionada);
  } else if (Array.isArray(relacionesConSeleccionada)) {
    const comerciosGrupo = new Set(
      relacionesConSeleccionada.map(rel => rel.comercio_id).filter(Number.isFinite)
    );

    if (comerciosGrupo.size) {
      const consultas = Array.from(comerciosGrupo).map(id =>
        supabase
          .from('ComercioSucursales')
          .select('sucursal_id')
          .eq('comercio_id', id)
      );

      const respuestas = await Promise.all(consultas);
      respuestas.forEach(({ data, error }) => {
        if (error) {
          console.error('Error obteniendo sucursales del grupo:', error);
          return;
        }
        (data || []).forEach(reg => sucursalesObjetivo.add(reg.sucursal_id));
      });
    }
  }

  const { data: sucursalesDelSeleccionado, error: errorSeleccionadoPrincipal } = await supabase
    .from('ComercioSucursales')
    .select('sucursal_id')
    .eq('comercio_id', sucursalId);

  if (errorSeleccionadoPrincipal) {
    console.error('Error obteniendo sucursales dependientes del seleccionado:', errorSeleccionadoPrincipal);
  } else {
    (sucursalesDelSeleccionado || []).forEach(reg => sucursalesObjetivo.add(reg.sucursal_id));
  }

  const { data: existentesActuales, error: errorActuales } = await supabase
    .from('ComercioSucursales')
    .select('sucursal_id')
    .eq('comercio_id', comercioId);

  if (errorActuales) {
    console.error('Error verificando relaciones existentes del comercio:', errorActuales);
    return;
  }

  const existentesSet = new Set((existentesActuales || []).map(reg => reg.sucursal_id));
  const registros = Array.from(sucursalesObjetivo)
    .filter(sid => Number.isFinite(sid) && sid !== comercioId && !existentesSet.has(sid))
    .map(sid => ({ comercio_id: comercioId, sucursal_id: sid }));

  if (registros.length) {
    const { error: errorInsert } = await supabase
      .from('ComercioSucursales')
      .insert(registros);

    if (errorInsert) {
      console.error('Error insertando relaciones sincronizadas:', errorInsert);
      throw errorInsert;
    }
  }
}

async function cargarCatalogoComercios() {
  if (catalogoComercios) return catalogoComercios;
  const { data, error } = await supabase
    .from('Comercios')
    .select('id, nombre, nombreSucursal')
    .order('nombre');

  if (error) {
    console.error('Error cargando comercios para sucursales:', error);
    catalogoComercios = [];
  } else {
    catalogoComercios = data || [];
  }
  return catalogoComercios;
}

function obtenerNombreComercio(id) {
  if (!catalogoComercios) return `ID ${id}`;
  const match = catalogoComercios.find(c => c.id === id);
  if (!match) return `ID ${id}`;
  return match.nombreSucursal || match.nombre || `ID ${id}`;
}

async function cargarRelaciones() {
  if (!Number.isFinite(comercioId)) return;

  const [{ data: dataPrincipal, error: errorPrincipal }, { data: dataComoSucursal, error: errorComoSucursal }] =
    await Promise.all([
      supabase
        .from('ComercioSucursales')
        .select('id, comercio_id, sucursal_id')
        .eq('comercio_id', comercioId),
      supabase
        .from('ComercioSucursales')
        .select('id, comercio_id, sucursal_id')
        .eq('sucursal_id', comercioId)
    ]);

  if (errorPrincipal) {
    console.error('Error cargando sucursales del comercio:', errorPrincipal);
    relaciones = [];
  } else {
    relaciones = Array.isArray(dataPrincipal) ? dataPrincipal : [];
  }

  if (errorComoSucursal) {
    console.error('Error verificando relación como sucursal:', errorComoSucursal);
    relacionComoSucursal = null;
  } else {
    relacionComoSucursal = Array.isArray(dataComoSucursal) && dataComoSucursal.length
      ? dataComoSucursal[0]
      : null;
  }

  const relacionesComoPrincipal = relaciones.filter(rel => rel.sucursal_id !== comercioId);

  if (relacionesComoPrincipal.length) {
    const ids = Array.from(
      new Set(relacionesComoPrincipal.map(rel => rel.sucursal_id).filter(Number.isFinite))
    );

    let mapaNombres = new Map();
    if (ids.length) {
      const { data: comerciosSucursal, error: errorComercios } = await supabase
        .from('Comercios')
        .select('id, nombre, nombreSucursal')
        .in('id', ids);

      if (errorComercios) {
        console.error('Error obteniendo nombres de sucursales:', errorComercios);
      } else {
        (comerciosSucursal || []).forEach(c => {
          mapaNombres.set(c.id, c.nombreSucursal || c.nombre || `ID ${c.id}`);
          if (!catalogoComercios?.some(existing => existing.id === c.id)) {
            catalogoComercios?.push(c);
          }
        });
      }
    }

    sucursales = relacionesComoPrincipal.map(rel => ({
      id: rel.id,
      idSucursal: rel.sucursal_id,
      nombre: mapaNombres.get(rel.sucursal_id) || obtenerNombreComercio(rel.sucursal_id)
    }));
  } else {
    sucursales = [];
  }

  await cargarCatalogoComercios();
  renderizarSucursales();
}

function renderizarSucursales() {
  const infoPrincipal = document.getElementById('infoComercioPrincipal');
  const contenedorRelacionadas = document.getElementById('sucursalesRelacionadas');
  const lista = document.getElementById('listaSucursalesRelacionadas');
  const mensaje = document.getElementById('mensajeSucursales');

  if (!infoPrincipal || !lista || !contenedorRelacionadas || !mensaje) return;

  lista.innerHTML = '';

  if (!comercioTieneSucursales) {
    infoPrincipal.innerHTML = `
      <p class="text-sm text-gray-600">
        Este comercio no está vinculado como sucursal de otro comercio. No hay sucursales registradas.
      </p>
    `;
    contenedorRelacionadas.classList.add('hidden');
    mensaje.classList.add('hidden');
    return;
  }

  contenedorRelacionadas.classList.remove('hidden');

  if (relacionComoSucursal && Number.isFinite(relacionComoSucursal.comercio_id)) {
    const nombrePrincipal = obtenerNombreComercio(relacionComoSucursal.comercio_id);
    infoPrincipal.innerHTML = `
      <p class="text-sm text-gray-700">
        Este comercio es una sucursal de <strong>${nombrePrincipal}</strong>.
      </p>
    `;
  } else {
    infoPrincipal.innerHTML = '';
  }

  if (sucursales.length === 0) {
    mensaje.textContent = 'Este comercio está marcado con sucursales, pero aún no tiene relaciones registradas.';
    mensaje.classList.remove('hidden');
    return;
  }

  mensaje.classList.add('hidden');

  sucursales.forEach(rel => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between gap-3 border border-gray-200 rounded px-3 py-2 bg-white';
    item.innerHTML = `
      <p class="font-medium text-gray-800">${rel.nombre}</p>
      <button type="button" class="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700" data-action="remover-sucursal" data-id="${rel.id}">
        Eliminar
      </button>
    `;
    lista.appendChild(item);
  });

  lista.querySelectorAll('[data-action="remover-sucursal"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const relId = Number.parseInt(btn.dataset.id, 10);
      await removerRelacion(relId);
    });
  });
}

async function removerRelacion(relId) {
  const confirmacion = confirm('¿Deseas eliminar esta relación de sucursal?');
  if (!confirmacion) return;

  const { error } = await supabase
    .from('ComercioSucursales')
    .delete()
    .eq('id', relId);

  if (error) {
    console.error('Error eliminando relación de sucursales:', error);
    alert('No se pudo eliminar la relación. Intenta nuevamente.');
    return;
  }

  await cargarSucursalesRelacionadas();

  if (comercioTieneSucursales && sucursales.length === 0) {
    const { error: errorDesactivar } = await supabase
      .from('Comercios')
      .update({ tieneSucursales: false })
      .eq('id', comercioId);

    if (errorDesactivar) {
      console.error('Error desactivando manejo de sucursales:', errorDesactivar);
    } else {
      comercioTieneSucursales = false;
      renderizarSucursales();
    }
  }
}

export async function abrirModalSucursales({ relation = null, mode = 'agregar-sucursal' } = {}) {
  if (!Number.isFinite(comercioId)) {
    alert('No se pudo identificar el comercio actual.');
    return;
  }

  await cargarCatalogoComercios();

  const esEdicion = Boolean(relation);
  const esGestionPrincipal = mode === 'editar-principal' || (relation && relation.sucursal_id === comercioId);
  const titulo = esGestionPrincipal
    ? 'Asignar comercio principal'
    : esEdicion
    ? 'Editar relación de sucursal'
    : 'Añadir sucursal';

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4';

  overlay.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl max-w-xl w-full overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-800">${titulo}</h2>
        <button type="button" class="text-gray-500 hover:text-gray-700" data-modal-close>
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="p-4 space-y-4">
        <div class="space-y-1" data-block="principal">
          <label class="block text-sm font-medium text-gray-700" for="selectPrincipal">Comercio principal</label>
          <div class="relative">
            <input type="search" id="buscarPrincipal" placeholder="Buscar..." class="w-full border rounded px-3 py-2 pr-10 text-sm" />
            <i class="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          </div>
          <select id="selectPrincipal" class="w-full border rounded px-3 py-2 text-sm mt-2"></select>
        </div>
        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-700" for="selectSucursal">Comercio sucursal</label>
          <div class="relative">
            <input type="search" id="buscarSucursal" placeholder="Buscar..." class="w-full border rounded px-3 py-2 pr-10 text-sm" />
            <i class="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          </div>
          <select id="selectSucursal" class="w-full border rounded px-3 py-2 text-sm mt-2"></select>
        </div>
        <div class="text-sm text-gray-500 hidden" data-feedback></div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800" data-modal-close>Cancelar</button>
          <button type="button" data-guardar-relacion class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Guardar</button>
        </div>
      </div>
    </div>
  `;

  obtenerModalRoot().appendChild(overlay);

  overlay.addEventListener('click', (event) => {
    if (event.target.dataset.modalClose !== undefined || event.target === overlay) {
      overlay.remove();
    }
  });

  const feedback = overlay.querySelector('[data-feedback]');
  const bloquePrincipal = overlay.querySelector('[data-block="principal"]');
  const selectPrincipal = overlay.querySelector('#selectPrincipal');
  const selectSucursal = overlay.querySelector('#selectSucursal');
  const buscarPrincipal = overlay.querySelector('#buscarPrincipal');
  const buscarSucursal = overlay.querySelector('#buscarSucursal');

  function poblarSelect(select, filtro = '', excluirId = null) {
    const texto = filtro.trim().toLowerCase();
    select.innerHTML = '';

    catalogoComercios
      .filter(c => (excluirId ? c.id !== excluirId : true))
      .filter(c => (texto ? c.nombre.toLowerCase().includes(texto) : true))
      .forEach(c => {
        const option = document.createElement('option');
        option.value = String(c.id);
        option.textContent = c.nombre;
        select.appendChild(option);
      });
  }

  const valorPrincipalInicial = esGestionPrincipal
    ? relation?.comercio_id || null
    : esEdicion
    ? relation?.comercio_id
    : comercioId;

  const valorSucursalInicial = esGestionPrincipal
    ? comercioId
    : esEdicion
    ? relation?.sucursal_id
    : null;

  poblarSelect(selectPrincipal, '', comercioId);
  poblarSelect(selectSucursal, '', comercioId);

  if (valorPrincipalInicial && catalogoComercios.some(c => c.id === valorPrincipalInicial)) {
    selectPrincipal.value = String(valorPrincipalInicial);
  }

  if (valorSucursalInicial && catalogoComercios.some(c => c.id === valorSucursalInicial)) {
    selectSucursal.value = String(valorSucursalInicial);
  } else if (!esGestionPrincipal) {
    selectSucursal.selectedIndex = -1;
  }

  if (esGestionPrincipal) {
    selectSucursal.value = String(comercioId);
    selectSucursal.disabled = true;
    if (buscarSucursal) buscarSucursal.disabled = true;
  }

  // ✅ Ajuste para cuando el comercio actual ya es principal
if (!esGestionPrincipal) {
  if (comercioTieneSucursales && !relacionComoSucursal) {
    // Si el comercio ya es principal, ocultamos el campo "comercio principal"
    bloquePrincipal?.classList.add('hidden');
    selectPrincipal.value = String(comercioId);
    selectPrincipal.disabled = true;
    if (buscarPrincipal) buscarPrincipal.disabled = true;
  } else {
    // Caso normal (aún no tiene sucursales o se está editando una relación)
    bloquePrincipal?.classList.remove('hidden');
    selectPrincipal.disabled = false;
    if (buscarPrincipal) buscarPrincipal.disabled = false;
  }
} else {
  // Si estamos gestionando la relación como sucursal
  selectPrincipal.disabled = relacionComoSucursal && relation;
  if (buscarPrincipal) buscarPrincipal.disabled = selectPrincipal.disabled;
}
  buscarPrincipal?.addEventListener('input', () => {
    poblarSelect(selectPrincipal, buscarPrincipal.value, comercioId);
  });

  buscarSucursal?.addEventListener('input', () => {
    poblarSelect(selectSucursal, buscarSucursal.value, comercioId);
  });

  overlay.querySelector('[data-guardar-relacion]').addEventListener('click', async () => {
    feedback.classList.add('hidden');
    feedback.textContent = '';

    const principalId = esGestionPrincipal
      ? Number.parseInt(selectPrincipal.value, 10)
      : comercioId;
    const sucursalId = esGestionPrincipal
      ? comercioId
      : Number.parseInt(selectSucursal.value, 10);

    if (!Number.isFinite(sucursalId)) {
      feedback.classList.remove('hidden');
      feedback.classList.add('text-red-600');
      feedback.textContent = 'Selecciona un comercio sucursal válido.';
      return;
    }

    if (principalId === sucursalId) {
      feedback.classList.remove('hidden');
      feedback.classList.add('text-red-600');
      feedback.textContent = 'El comercio principal y la sucursal deben ser distintos.';
      return;
    }

    try {
      if (!esEdicion) {
        const existente = relaciones.find(rel =>
          rel.comercio_id === principalId &&
          rel.sucursal_id === sucursalId
        );

        if (existente) {
          feedback.classList.remove('hidden');
          feedback.classList.add('text-red-600');
          feedback.textContent = 'Esta relación ya existe.';
          return;
        }

        await sincronizarGrupoConSucursal(sucursalId);

        if (principalId !== comercioId) {
          comercioTieneSucursales = true;
        }
      } else {
        const { error } = await supabase
          .from('ComercioSucursales')
          .update({
            comercio_id: principalId,
            sucursal_id: sucursalId
          })
          .eq('id', relation.id);

        if (error) throw error;

        await sincronizarGrupoConSucursal(sucursalId);
      }

      overlay.remove();
      await cargarSucursalesRelacionadas();
    } catch (err) {
      console.error('Error guardando relación de sucursales:', err);
      feedback.classList.remove('hidden');
      feedback.classList.add('text-red-600');
      feedback.textContent = 'No se pudo guardar la relación. Intenta nuevamente.';
    }
  });
}

async function inicializarSucursales() {
  if (!Number.isFinite(comercioId)) return;
  const addBtn = document.getElementById('btnAddSucursal');
  if (!addBtn) return;

  await cargarSucursalesRelacionadas();
  addBtn.addEventListener('click', async () => {
    const activado = await asegurarComercioPrincipal();
    if (!activado) return;
    await cargarSucursalesRelacionadas();
    abrirModalSucursales({
      mode: relacionComoSucursal ? 'editar-principal' : 'agregar-sucursal'
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  inicializarSucursales();
});

async function cargarEstadoComercio() {
  if (!Number.isFinite(comercioId)) return;
  const { data, error } = await supabase
    .from('Comercios')
    .select('tieneSucursales')
    .eq('id', comercioId)
    .maybeSingle();

  if (error) {
    console.error('Error consultando tieneSucursales:', error);
    comercioTieneSucursales = false;
    return;
  }

  comercioTieneSucursales = Boolean(data?.tieneSucursales);
}

export async function cargarSucursalesRelacionadas() {
  if (!Number.isFinite(comercioId)) return;
  await cargarEstadoComercio();

  if (!comercioTieneSucursales) {
    relacionComoSucursal = null;
    sucursales = [];
    renderizarSucursales();
    return;
  }

  await cargarRelaciones();
}
