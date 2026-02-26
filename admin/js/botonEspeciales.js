import { idComercio as idComercioImportado } from '../shared/supabaseClient.js';
import { getAppBaseUrl } from '../shared/runtimeConfig.js';

const params = new URLSearchParams(window.location.search);
const idQuery =
  params.get('id') ||
  params.get('idcomercio') ||
  params.get('idComercio') ||
  params.get('comercioId');
const idFinal = idComercioImportado || idQuery;

const BASE_COMERCIO = getAppBaseUrl('comercio');

const btnAdministrarEspeciales = document.getElementById('btnAdministrarEspeciales');

if (btnAdministrarEspeciales) {
  if (!idFinal) {
    console.error('ID comercio faltante');
    btnAdministrarEspeciales.href = '#';
    btnAdministrarEspeciales.addEventListener('click', (e) => {
      e.preventDefault();
      alert('No se encontró el ID del comercio.');
    });
  } else {
    const urlFinal = `${BASE_COMERCIO}/especiales/adminEspeciales.html?id=${encodeURIComponent(idFinal)}`;
    btnAdministrarEspeciales.href = urlFinal;
    console.log({ host: location.hostname, BASE_COMERCIO, idFinal, urlFinal });
    btnAdministrarEspeciales.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.assign(urlFinal);
    });
  }
}
