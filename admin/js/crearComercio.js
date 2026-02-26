// crearComercio.js
import { supabase } from '../shared/supabaseClient.js';
import { resolvePath } from '../shared/pathResolver.js';

const municipioSelect = document.getElementById('municipio');
const categoriaSelect = document.getElementById('categoria');
const subcategoriaSelect = document.getElementById('subcategoria');
const crearBtn = document.getElementById('crearBtn');
let categoriasDisponibles = [];
let subcategoriasDisponibles = [];
let subcategoriasCargadas = false;

export async function cargarMunicipios() {
  const { data, error } = await supabase
    .from('Municipios')
    .select('id, nombre')
    .order('nombre');

  if (error) return console.error('❌ Error cargando municipios:', error);

  data.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.nombre;
    municipioSelect.appendChild(opt);
  });
}

export async function cargarCategorias() {
  if (categoriasDisponibles.length === 0) {
    const { data, error } = await supabase
      .from('Categorias')
      .select('id, nombre')
      .order('nombre');

    if (error) {
      console.error('❌ Error cargando categorías:', error);
      return;
    }

    categoriasDisponibles = data || [];
  }

  categoriaSelect.innerHTML = '<option value="">Seleccionar Categoría</option>';
  categoriasDisponibles.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.nombre;
    categoriaSelect.appendChild(opt);
  });
}

export async function cargarSubcategorias() {
  const idCategoria = parseInt(categoriaSelect.value);
  subcategoriaSelect.innerHTML = '<option value="">Seleccionar Subcategoría</option>';
  if (isNaN(idCategoria)) {
    return;
  }

  if (!subcategoriasCargadas) {
    const { data, error } = await supabase
      .from('subCategoria')
      .select('id, nombre, idCategoria')
      .order('nombre');

    if (error) {
      console.error('❌ Error cargando subcategorías:', error);
      return;
    }

    subcategoriasDisponibles = data || [];
    subcategoriasCargadas = true;
  }

  subcategoriasDisponibles
    .filter((sub) => String(sub.idCategoria) === String(idCategoria))
    .forEach((sub) => {
      const opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = sub.nombre;
      subcategoriaSelect.appendChild(opt);
    });
}

categoriaSelect.addEventListener('change', cargarSubcategorias);

crearBtn.addEventListener('click', async () => {
  const nombre = document.getElementById('nombre').value.trim();
  const telefono = document.getElementById('telefono').value.trim();
  const direccion = document.getElementById('direccion').value.trim();
  const idMunicipio = parseInt(municipioSelect.value);
  const idCategoria = parseInt(categoriaSelect.value);
  const idSubcategoria = parseInt(subcategoriaSelect.value);
  const latitud = parseFloat(document.getElementById('latitud').value);
  const longitud = parseFloat(document.getElementById('longitud').value);

  if (!nombre || !direccion || isNaN(idMunicipio) || isNaN(idCategoria)) {
    alert('Faltan campos obligatorios.');
    return;
  }

  const { data: municipioData, error: municipioError } = await supabase
  .from('Municipios')
  .select('idArea, nombre')
  .eq('id', idMunicipio)
  .single();

if (municipioError || !municipioData?.idArea) {
  alert('❌ Error obteniendo el área del municipio.');
  console.error(municipioError);
  return;
}

const idArea = municipioData.idArea;
const nombreMunicipio = municipioData.nombre;

const { data: areaData, error: areaError } = await supabase
  .from('Area')
  .select('nombre')
  .eq('idArea', idArea)
  .single();

if (areaError || !areaData?.nombre) {
  alert('❌ Error obteniendo el nombre del área.');
  console.error(areaError);
  return;
}

const nombreArea = areaData.nombre;

  const categoriaIds = Number.isNaN(idCategoria) ? [] : [idCategoria];
  const subcategoriaIds = Number.isNaN(idSubcategoria) ? [] : [idSubcategoria];
  const categoriaTexto =
    categoriaIds.length && categoriaSelect.selectedOptions.length
      ? categoriaSelect.selectedOptions[0].textContent.trim()
      : null;
  const subcategoriaTexto =
    subcategoriaIds.length && subcategoriaSelect.selectedOptions.length
      ? subcategoriaSelect.selectedOptions[0].textContent.trim()
      : null;

  let nuevoComercioId = null;
  crearBtn.disabled = true;

  try {
    const { data: comercioInsertado, error: insertError } = await supabase
      .from('Comercios')
      .insert({
        nombre,
        telefono: telefono || null,
        direccion,
        idMunicipio,
        municipio: nombreMunicipio,
        latitud,
        longitud,
        idArea,
        area: nombreArea,
        categoria: categoriaTexto,
        subCategorias: subcategoriaTexto,
        activo: false,
      })
      .select('id')
      .single();

    if (insertError || !comercioInsertado?.id) {
      throw insertError || new Error('No se pudo obtener el ID del comercio recién creado.');
    }

    nuevoComercioId = comercioInsertado.id;

    if (categoriaIds.length) {
      const { error: errorCategoriasRelacion } = await supabase.from('ComercioCategorias').insert(
        categoriaIds.map((categoriaId) => ({
          idComercio: nuevoComercioId,
          idCategoria: categoriaId,
        }))
      );
      if (errorCategoriasRelacion) {
        throw errorCategoriasRelacion;
      }
    }

    if (subcategoriaIds.length) {
      const { error: errorSubcategoriasRelacion } = await supabase.from('ComercioSubcategorias').insert(
        subcategoriaIds.map((subcategoriaId) => ({
          idComercio: nuevoComercioId,
          idSubcategoria: subcategoriaId,
        }))
      );
      if (errorSubcategoriasRelacion) {
        throw errorSubcategoriasRelacion;
      }
    }

    alert('✅ Comercio creado exitosamente');
    location.href = resolvePath('adminComercios.html');
  } catch (error) {
    console.error('❌ Error creando comercio:', error);
    if (nuevoComercioId) {
      try {
        await supabase.from('Comercios').delete().eq('id', nuevoComercioId);
      } catch (rollbackError) {
        console.error('⚠️ Error intentando revertir el comercio creado:', rollbackError);
      }
    }
    alert('❌ Error creando comercio');
  } finally {
    crearBtn.disabled = false;
  }
});

cargarMunicipios();
cargarCategorias();
