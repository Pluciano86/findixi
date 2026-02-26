// adminLogoComercio.js
import { supabase, idComercio as idComercioImportado } from '../shared/supabaseClient.js';

const rawId =
  idComercioImportado ||
  new URLSearchParams(window.location.search).get('idcomercio') ||
  new URLSearchParams(window.location.search).get('id');
const idComercioNumero = Number(rawId);
const idComercioDB = Number.isFinite(idComercioNumero)
  ? idComercioNumero
  : (() => {
      const parsed = Number.parseInt(rawId, 10);
      return Number.isFinite(parsed) ? parsed : null;
    })();

const BUCKET = 'galeriacomercios';
const PUBLIC_PREFIX = '/storage/v1/object/public/galeriacomercios/';

// 🔁 Variable global para mantener el archivo seleccionado
let archivoLogoSeleccionado = null;

// Esperar a que todo esté listo
document.addEventListener('DOMContentLoaded', () => {
  const inputLogo = document.getElementById('nuevo-logo');
  const preview = document.getElementById('preview-logo');
  const btnEliminar = document.getElementById('btn-eliminar-logo');

  // Mostrar preview si selecciona nuevo logo
  inputLogo?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    archivoLogoSeleccionado = file || null;

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      preview.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Eliminar logo actual
  btnEliminar?.addEventListener('click', async () => {
    if (!Number.isFinite(idComercioDB)) {
      console.warn('ID de comercio inválido. No se puede eliminar el logo.');
      return;
    }

    const { data } = await supabase
      .from('imagenesComercios')
      .select('id, imagen')
      .eq('idComercio', idComercioDB)
      .eq('logo', true)
      .maybeSingle();

    if (data) {
      const storagePath = obtenerRutaStorage(data.imagen);
      if (storagePath) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
      }
      await supabase.from('imagenesComercios').delete().eq('id', data.id);
      await supabase.from('Comercios').update({ logo: null }).eq('id', idComercioDB);
      if (preview) preview.src = '';
      archivoLogoSeleccionado = null;
    }
  });
});

// ✅ Función pública para guardar el logo si aplica
export async function guardarLogoSiAplica() {
  const archivo = archivoLogoSeleccionado;

  if (!archivo) {
    console.log('ℹ️ No se seleccionó un nuevo logo.');
    return;
  }

  if (!Number.isFinite(idComercioDB)) {
    console.error('❌ ID de comercio inválido. No se puede subir el logo.');
    alert('No se pudo identificar el comercio para guardar el logo.');
    return;
  }

  console.log('📦 Archivo:', {
    name: archivo.name,
    type: archivo.type,
    size: archivo.size,
  });

  if (archivo.size === 0 || !archivo.type || !archivo.type.startsWith('image/')) {
    alert('Logo inválido. Selecciona un archivo PNG o JPG válido.');
    return;
  }

  const extension = obtenerExtension(archivo.name);
  const nombreArchivo = generarNombreUnico('logo', extension);
  const path = nombreArchivo;

  console.log('📁 Ruta destino en bucket:', path);

  try {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, archivo, {
        cacheControl: '3600',
        upsert: true,
        contentType: archivo.type || 'image/jpeg',
      });

    if (uploadError) {
      console.error('❌ Error subiendo logo:', uploadError);
      alert(`Error al subir el logo:\n${uploadError.message}`);
      return;
    }

    // Eliminar logos anteriores antes de insertar el nuevo
    await supabase.from('imagenesComercios').delete().eq('idComercio', idComercioDB).eq('logo', true);

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = publicData?.publicUrl || construirPublicUrlFallback(path);

    const { error: insertError } = await supabase.from('imagenesComercios').insert({
      idComercio: idComercioDB,
      imagen: path,
      logo: true,
      portada: false,
    });

    if (insertError) {
      console.error('❌ Error al guardar logo en DB:', insertError);
      alert('Error al guardar el logo en la base de datos');
      return;
    }

    await supabase.from('Comercios').update({ logo: publicUrl }).eq('id', idComercioDB);

    const preview = document.getElementById('preview-logo');
    if (preview) preview.src = publicUrl;
    archivoLogoSeleccionado = null;

    console.log('✅ Logo subido y registrado correctamente:', path);
  } catch (err) {
    console.error('❌ Error inesperado al subir logo:', err);
    alert('Error inesperado al subir el logo');
  }
}

// ✅ Duplicar logo desde comercio principal
export async function duplicarLogoDesdePrincipal(comercioId, comercioPrincipalId) {
  try {
    if (!comercioPrincipalId) {
      alert('Este comercio no está vinculado a un principal.');
      return;
    }

    // Buscar el logo del comercio principal
    const { data: principal, error: errLogo } = await supabase
      .from('Comercios')
      .select('logo')
      .eq('id', comercioPrincipalId)
      .single();

    if (errLogo || !principal?.logo) {
      alert('El comercio principal no tiene logo registrado.');
      return;
    }

    // Actualizar el logo directamente con la URL existente
    const { error: errUpdate } = await supabase
      .from('Comercios')
      .update({ logo: principal.logo })
      .eq('id', comercioId);

    if (errUpdate) throw errUpdate;

    // Eliminar registro previo (si existía)
    await supabase.from('imagenesComercios').delete()
      .eq('idComercio', comercioId)
      .eq('logo', true);

    // Insertar registro nuevo en imagenesComercios
    await supabase.from('imagenesComercios').insert({
      idComercio: comercioId,
      imagen: principal.logo,
      logo: true,
      portada: false,
    });

    // Actualizar preview
    const preview = document.getElementById('preview-logo');
    if (preview) preview.src = principal.logo;

    alert('✅ Logo duplicado exitosamente desde el comercio principal.');
  } catch (err) {
    console.error('Error duplicando logo:', err);
    alert('❌ No se pudo duplicar el logo. Intenta nuevamente.');
  }
}

// ✅ Duplicar logo desde otra sucursal (seleccionable)
document.addEventListener('DOMContentLoaded', async () => {
  const btnDuplicarLogoSucursal = document.getElementById('btnDuplicarLogoSucursal');
  const modal = document.getElementById('modalDuplicarLogo');
  const selectSucursal = document.getElementById('selectSucursalLogo');
  const btnConfirmar = document.getElementById('btnConfirmarDuplicado');
  const btnCancelar = document.getElementById('btnCancelarDuplicado');

  if (!btnDuplicarLogoSucursal) return;

  btnDuplicarLogoSucursal.addEventListener('click', async () => {
    // Mostrar el modal
    modal.classList.remove('hidden');
    selectSucursal.innerHTML = `<option value="">Cargando...</option>`;

    // Obtener sucursales relacionadas
    const { data: relaciones, error } = await supabase
      .from('ComercioSucursales')
      .select('comercio_id, sucursal_id');

    if (error || !relaciones?.length) {
      selectSucursal.innerHTML = `<option value="">No hay sucursales relacionadas</option>`;
      return;
    }

    // Buscar comercios relacionados
    const ids = new Set();
    relaciones.forEach(rel => {
      if (rel.comercio_id === idComercioDB) ids.add(rel.sucursal_id);
      if (rel.sucursal_id === idComercioDB) ids.add(rel.comercio_id);
    });

    if (!ids.size) {
      selectSucursal.innerHTML = `<option value="">No hay sucursales relacionadas</option>`;
      return;
    }

    const { data: sucursales } = await supabase
      .from('Comercios')
      .select('id, nombreSucursal, nombre')
      .in('id', Array.from(ids));

    if (!sucursales?.length) {
      selectSucursal.innerHTML = `<option value="">No hay sucursales disponibles</option>`;
      return;
    }

    selectSucursal.innerHTML = `<option value="">Selecciona una sucursal...</option>`;
    sucursales.forEach(s => {
      const nombre = s.nombreSucursal || s.nombre;
      const option = document.createElement('option');
      option.value = s.id;
      option.textContent = nombre;
      selectSucursal.appendChild(option);
    });
  });

  // Cancelar duplicado
  btnCancelar.addEventListener('click', () => {
    modal.classList.add('hidden');
    selectSucursal.value = '';
  });

  // Confirmar duplicado
  btnConfirmar.addEventListener('click', async () => {
    const sucursalId = Number(selectSucursal.value);
    if (!sucursalId) {
      alert('Selecciona una sucursal válida.');
      return;
    }

    const { data, error } = await supabase
      .from('Comercios')
      .select('logo')
      .eq('id', sucursalId)
      .maybeSingle();

    if (error || !data?.logo) {
      alert('La sucursal seleccionada no tiene logo registrado.');
      return;
    }

    const logoUrl = data.logo;

    // Insertar en imágenes y actualizar comercio actual
    await supabase.from('imagenesComercios').insert({
      idComercio: idComercioDB,
      imagen: logoUrl,
      logo: true,
      portada: false,
    });

    await supabase.from('Comercios').update({ logo: logoUrl }).eq('id', idComercioDB);

    const preview = document.getElementById('preview-logo');
    if (preview) preview.src = logoUrl;

    alert('✅ Logo duplicado correctamente.');
    modal.classList.add('hidden');
  });
});

function obtenerRutaStorage(valor) {
  if (!valor) return null;
  const decoded = decodeURIComponent(valor);
  if (/^https?:\/\//i.test(decoded)) {
    const indice = decoded.indexOf(PUBLIC_PREFIX);
    if (indice === -1) return null;
    return decoded.slice(indice + PUBLIC_PREFIX.length);
  }
  return normalizarStoragePath(decoded);
}

function construirPublicUrlFallback(path) {
  if (!path) return '';
  const limpio = normalizarStoragePath(path);
  return `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/${BUCKET}/${limpio}`;
}

function normalizarStoragePath(path) {
  return path.replace(/^public\//i, '').replace(/^galeriacomercios\//i, '');
}

function generarNombreUnico(prefijo, extension) {
  const base =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefijo}_${Date.now()}_${base}.${extension}`;
}

function obtenerExtension(nombreArchivo = '') {
  const partes = String(nombreArchivo).split('.');
  if (partes.length <= 1) return 'jpg';
  return partes.pop().toLowerCase() || 'jpg';
}
