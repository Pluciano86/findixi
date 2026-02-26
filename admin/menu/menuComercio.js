// menu/menuComercio.js
import { supabase } from '../shared/supabaseClient.js';

const idComercio = new URLSearchParams(window.location.search).get('id');
const nombreEl = document.getElementById('nombreComercio');
const logoEl = document.getElementById('logoComercio');
const seccionesEl = document.getElementById('seccionesMenu');
const btnVolver = document.getElementById('btnVolver');

async function cargarDatos() {
  const { data: comercio, error: errorComercio } = await supabase
    .from('Comercios')
    .select('id, nombre, colorPrimario, colorSecundario')
    .eq('id', idComercio)
    .single();

  if (errorComercio || !comercio) return alert('Error cargando comercio');

  nombreEl.textContent = comercio.nombre;
  document.body.style.setProperty('--colorPrimario', comercio.colorPrimario || '#23b4e9');
  document.body.style.setProperty('--colorSecundario', comercio.colorSecundario || '#f5f5f5');

  const { data: logoData } = await supabase
    .from('imagenesComercios')
    .select('imagen')
    .eq('idComercio', idComercio)
    .eq('logo', true)
    .maybeSingle();

  if (logoData?.imagen) {
    logoEl.src = `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${logoData.imagen}`;
  }

  const { data: menus, error: errorMenus } = await supabase
    .from('menus')
    .select('id, titulo, orden')
    .eq('idComercio', idComercio)
    .eq('activo', true)
    .order('orden', { ascending: true });

  if (errorMenus) return alert('Error cargando menú');

  seccionesEl.innerHTML = '';
  let seccionActiva = null;

  for (const menu of menus) {
    const wrapper = document.createElement('div');
    wrapper.className = 'w-[90%] mx-auto';

    const btn = document.createElement('button');
    btn.className = 'w-full bg-[var(--colorPrimario)] text-white text-xl px-4 py-2 rounded mb-2 shadow font-medium hover:opacity-90 transition text-center';
    btn.textContent = menu.titulo;

    const productosContenedor = document.createElement('div');
    productosContenedor.className = 'hidden mt-2 space-y-2';

    btn.onclick = async () => {
      if (seccionActiva === productosContenedor) {
        productosContenedor.classList.add('hidden');
        seccionActiva = null;
        return;
      }
      if (seccionActiva) seccionActiva.classList.add('hidden');
      seccionActiva = productosContenedor;
      productosContenedor.innerHTML = '<p class="text-sm text-gray-500">Cargando...</p>';
      productosContenedor.classList.remove('hidden');

      const { data: productos, error } = await supabase
        .from('productos')
        .select('*')
        .eq('idMenu', menu.id)
        .eq('activo', true)
        .order('orden', { ascending: true });

      if (error) {
        productosContenedor.innerHTML = '<p class="text-red-500">Error cargando productos</p>';
        return;
      }

      productosContenedor.innerHTML = `
        <h2 class="text-center text-xl font-bold text-gray-800 mb-4">${menu.titulo}</h2>
      `;

      for (const p of productos) {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-lg shadow p-4 mb-2 flex gap-4';

        const imagenHTML = p.imagen
          ? `
            <div class="w-24 h-24 flex-shrink-0">
             <img src="https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${p.imagen}" 
                   alt="${p.nombre}" class="w-full h-full object-cover rounded cursor-pointer"
                   onclick="ampliarImagen('${p.imagen}')">
            </div>
          `
          : '';

        div.innerHTML = `
          ${imagenHTML}
          <div class="flex flex-col justify-between">
            <div>
              <h3 class="text-xl font-semibold text-gray-800">${p.nombre}</h3>
              <p class="text-base leading-5 font-light text-gray-600">${p.descripcion || ''}</p>
            </div>
            <div class="text-[var(--colorPrimario)] font-bold text-xl mt-2">$${p.precio.toFixed(2)}</div>
          </div>
        `;

        productosContenedor.appendChild(div);
      }
    };

    wrapper.appendChild(btn);
    wrapper.appendChild(productosContenedor);
    seccionesEl.appendChild(wrapper);
  }

  const linkPerfil = document.getElementById('linkPerfilComercio');
  linkPerfil.textContent = comercio.nombre;
  linkPerfil.href = `/perfilComercio.html?id=${idComercio}`;

  const logoLink = document.getElementById('logoLinkPerfil');
  if (logoLink) {
    logoLink.href = `/perfilComercio.html?id=${idComercio}`;
  }
}

window.ampliarImagen = function (nombreImagen) {
  const modal = document.getElementById('modalImagen');
  const img = document.getElementById('imgAmpliada');
  img.src = `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${nombreImagen}`;
  modal.classList.remove('hidden');
  modal.onclick = () => modal.classList.add('hidden');
};

btnVolver.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

document.addEventListener('DOMContentLoaded', cargarDatos);