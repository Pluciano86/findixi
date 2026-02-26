// adminLogoComercio.js
import { supabase } from '../shared/supabaseClient.js';

function getPublicBase() {
  return '/';
}

export async function guardarLogoSiAplica() {
  const input = document.getElementById('nuevo-logo');
  if (!input || !input.files || input.files.length === 0) {
    console.log('📁 No hay nuevo logo para subir');
    return;
  }

  const file = input.files[0];
  const idComercio = new URLSearchParams(window.location.search).get('id');

  const nombre = document.getElementById('nombre')?.value.trim();
  const municipio = document.getElementById('municipio')?.value;

  if (!nombre || !municipio || !file) {
    alert('Faltan datos para subir el logo');
    return;
  }

  // 🧽 Limpiar el nombre para usarlo como carpeta
  const nombreFolder = limpiarTexto(nombre.split(' ')[0].toUpperCase());
  const municipioNombre = await obtenerNombreMunicipio(municipio);
  const categoriaID = window.categoriasSeleccionadas?.[0];

  const categoriaNombre = await obtenerNombreCategoria(categoriaID);
  const path = `${categoriaNombre}/${municipioNombre}/${nombreFolder}/logo_${Date.now()}.jpg`;

  console.log('🛣️ Ruta del logo:', path);

  const { error: uploadError } = await supabase.storage
    .from('galeriacomercios')
    .upload(path, file, { upsert: true });

  if (uploadError) {
    console.error('❌ Error subiendo logo:', uploadError);
    alert('Error al subir el logo');
    return;
  }

  // Actualizar en tabla imagenesComercios
  await supabase.from('imagenesComercios')
    .delete()
    .eq('idComercio', idComercio)
    .eq('logo', true);

  await supabase.from('imagenesComercios').insert([{
    idComercio,
    imagen: path,
    logo: true,
    portada: false,
    orden: 0
  }]);

  console.log('✅ Logo actualizado en DB');
}

// Limpia texto para usar en rutas
function limpiarTexto(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toUpperCase();
}

// Obtiene el nombre del municipio por ID
async function obtenerNombreMunicipio(id) {
  const { data } = await supabase.from('Municipios').select('nombre').eq('id', id).maybeSingle();
  return limpiarTexto(data?.nombre || 'DESCONOCIDO');
}

// Obtiene el nombre de la categoría por ID
async function obtenerNombreCategoria(id) {
  const { data } = await supabase.from('Categorias').select('nombre').eq('id', id).maybeSingle();
  return limpiarTexto(data?.nombre || 'CATEGORIA');
}
