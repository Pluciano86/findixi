// adminGuardarCambios.js
import { supabase, idComercio as idComercioImportado } from '../shared/supabaseClient.js';
import { guardarLogoSiAplica } from './adminLogoComercio.js';
import { guardarAmenidadesSeleccionadas } from './adminAmenidadesComercio.js';

const idComercio =
  idComercioImportado ||
  new URLSearchParams(window.location.search).get('id');

function normalizarIds(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((id) => Number(id))
    .filter((id) => !Number.isNaN(id));
}

async function sincronizarRelacionesComercio(id, categoriasIds, subcategoriasIds) {
  const categoriaIds = normalizarIds(categoriasIds);
  const subcategoriaIds = normalizarIds(subcategoriasIds);

  const [eliminarCategorias, eliminarSubcategorias] = await Promise.all([
    supabase.from('ComercioCategorias').delete().eq('idComercio', id),
    supabase.from('ComercioSubcategorias').delete().eq('idComercio', id),
  ]);

  if (eliminarCategorias.error) throw eliminarCategorias.error;
  if (eliminarSubcategorias.error) throw eliminarSubcategorias.error;

  if (categoriaIds.length) {
    const { error } = await supabase.from('ComercioCategorias').insert(
      categoriaIds.map((categoriaId) => ({
        idComercio: id,
        idCategoria: categoriaId,
      }))
    );
    if (error) throw error;
  }

  if (subcategoriaIds.length) {
    const { error } = await supabase.from('ComercioSubcategorias').insert(
      subcategoriaIds.map((subcategoriaId) => ({
        idComercio: id,
        idSubcategoria: subcategoriaId,
      }))
    );
    if (error) throw error;
  }
}

document.getElementById('btn-guardar')?.addEventListener('click', async (e) => {
  e.preventDefault();
  console.log('👉 Guardar Cambios presionado');

  const nombre = document.getElementById('nombre')?.value.trim();
  const direccion = document.getElementById('direccion')?.value.trim();
  const telefono = document.getElementById('telefono')?.value.trim();
  const whatsapp = document.getElementById('whatsapp')?.value.trim();
  const descripcion = document.getElementById('descripcion')?.value.trim();
  const municipio = document.getElementById('municipio')?.value;
  const facebook = document.getElementById('facebook')?.value.trim();
  const instagram = document.getElementById('instagram')?.value.trim();
  const tiktok = document.getElementById('tiktok')?.value.trim();
  const webpage = document.getElementById('webpage')?.value.trim();
  const colorPrimario = document.getElementById('colorPrimario')?.value.trim();
  const colorSecundario = document.getElementById('colorSecundario')?.value.trim();
  const idMunicipio = parseInt(municipio || '', 10);

  if (!idMunicipio || Number.isNaN(idMunicipio)) {
    alert('Selecciona un municipio válido antes de guardar.');
    return;
  }

  // ✅ Primero subimos el logo si hay uno nuevo
  console.log('📤 Verificando si hay logo nuevo...');
  await guardarLogoSiAplica();
  console.log('✅ Logo procesado');

  const categoriasSeleccionadas = normalizarIds(window.categoriasSeleccionadas);
  const subcategoriasSeleccionadas = normalizarIds(window.subcategoriasSeleccionadas);

  console.log('📝 Datos a actualizar:', {
    nombre,
    direccion,
    telefono,
    whatsapp,
    descripcion,
    municipio: idMunicipio,
    facebook,
    instagram,
    tiktok,
    webpage,
    colorPrimario,
    colorSecundario,
    categoriasSeleccionadas,
    subcategoriasSeleccionadas,
  });

  try {
    const { error: errorUpdate } = await supabase
      .from('Comercios')
      .update({
        nombre,
        direccion,
        telefono,
        whatsapp,
        descripcion,
        idMunicipio,
        facebook,
        instagram,
        tiktok,
        webpage,
        colorPrimario,
        colorSecundario,
        latitud: document.getElementById('latitud')?.value,
        longitud: document.getElementById('longitud')?.value,
        categoria: categoriasSeleccionadas.length ? null : 'Sin categoría',
        subCategorias: subcategoriasSeleccionadas.length ? null : 'Sin subcategoría',
      })
      .eq('id', idComercio);

    if (errorUpdate) {
      throw errorUpdate;
    }

    await sincronizarRelacionesComercio(idComercio, categoriasSeleccionadas, subcategoriasSeleccionadas);
  } catch (error) {
    const errorText = String(error?.message || '');
    if (errorText.toLowerCase().includes('propiedad pendiente de verificacion')) {
      alert('❌ Propiedad pendiente de verificación: no puedes cambiar nombre, teléfono, dirección ni coordenadas.');
    } else if (errorText.toLowerCase().includes('cambios bloqueados')) {
      alert('❌ Nombre, coordenadas y logo requieren solicitud manual de aprobación Findixi.');
    } else {
      alert('❌ Error al actualizar la información básica');
    }
    console.error('🚫 Error actualizando comercio:', error);
    return;
  }

  console.log('📦 Categorías:', categoriasSeleccionadas);
  console.log('📦 Subcategorías:', subcategoriasSeleccionadas);

  console.log('✅ Información básica actualizada');

  // 3. Guardar horarios regulares
  console.log('🕘 Guardando horarios...');
  await guardarHorarios();
  console.log('✅ Horarios actualizados');

  // 4. Guardar amenidades seleccionadas
  console.log('🎯 Guardando amenidades seleccionadas...');
  await guardarAmenidadesSeleccionadas();
  console.log('✅ Amenidades actualizadas');

  alert('✅ Comercio actualizado correctamente');
});

// Función auxiliar para guardar horarios regulares
async function guardarHorarios() {
  const contenedor = document.getElementById('horariosContainer');
  if (!contenedor) return;
  if (!idComercio) {
    console.error('❌ idComercio no definido. No se pueden guardar horarios.');
    alert('No se encontró el ID del comercio para guardar horarios.');
    return;
  }

  const diasSemana = Array.from(contenedor.children);
  const nuevosHorarios = diasSemana
    .map((row) => {
      const diaReal = Number(row.dataset.diaReal ?? row.dataset.diase ?? row.dataset.day);
      if (!Number.isFinite(diaReal) || diaReal < 0 || diaReal > 6) return null;
      const apertura = row.querySelector('.apertura')?.value || null;
      const cierre = row.querySelector('.cierre')?.value || null;
      const cerrado = row.querySelector('.cerrado')?.checked || false;

      // Si falta apertura o cierre y no está marcado cerrado, lo tratamos como cerrado para evitar datos inválidos
      const aperturaValida = apertura && apertura.length >= 4;
      const cierreValida = cierre && cierre.length >= 4;
      const esCerrado = cerrado || !aperturaValida || !cierreValida;

      return {
        idComercio,
        diaSemana: diaReal,
        apertura: esCerrado ? null : apertura,
        cierre: esCerrado ? null : cierre,
        cerrado: esCerrado
      };
    })
    .filter(Boolean);

  console.log('📅 Horarios a guardar:', nuevosHorarios);

  try {
    const { error, data } = await supabase
      .from('Horarios')
      .upsert(nuevosHorarios, { onConflict: 'idComercio,diaSemana' });

    if (error) {
      console.error('❌ Error guardando horarios:', error);
      alert('Hubo un problema al guardar los horarios');
    } else {
      console.log('✅ Horarios guardados', data);
    }
  } catch (err) {
    console.error('❌ Excepción guardando horarios:', err);
    alert('Hubo un problema al guardar los horarios');
  }
}
