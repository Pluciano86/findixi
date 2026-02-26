import { idComercio as idComercioImportado } from '../shared/supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const idQuery =
  params.get('id') ||
  params.get('idcomercio') ||
  params.get('idComercio') ||
  params.get('comercioId');
const idFinal = idComercioImportado || idQuery;

const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const BASE_COMERCIO = isLocal ? `${location.origin}/comercio` : 'https://comercio.enpe-erre.com';

const btnAdminMenu = document.getElementById('btnAdminMenu');

if (btnAdminMenu) {
  if (!idFinal) {
    console.error('ID comercio faltante');
    btnAdminMenu.href = '#';
    btnAdminMenu.addEventListener('click', (e) => {
      e.preventDefault();
      alert('No se encontró el ID del comercio.');
    });
  } else {
    const urlFinal = `${BASE_COMERCIO}/adminMenuComercio.html?id=${encodeURIComponent(idFinal)}`;
    btnAdminMenu.href = urlFinal;
    console.log({ host: location.hostname, BASE_COMERCIO, idFinal, urlFinal });
    btnAdminMenu.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.assign(urlFinal);
    });
  }
}
