import { supabase } from '../shared/supabaseClient.js';
import { formatTiempo } from '../shared/osrmClient.js';
import { formatearTelefonoDisplay, formatearTelefonoHref } from '../shared/utils.js';
import { calcularTiemposParaLista } from './calcularTiemposParaLista.js';
import { mostrarCercanosComida } from './cercanosComida.js';
import { mostrarPlayasCercanas } from './playasCercanas.js';
import { showPopup } from './popups.js';
import { resolverPlanComercio } from '../shared/planes.js';
import { mostrarLugaresCercanos } from './lugaresCercanos.js';

const idComercio = new URLSearchParams(window.location.search).get('id');
let latUsuario = null;
let lonUsuario = null;
let comercioActual = null;
const QR_REDIMIR_URL = 'https://test.enpe-erre.com/redimir-cupon.html';
const CUPON_PLACEHOLDER = 'https://placehold.co/600x400?text=Cup%C3%B3n';
const isLocalEnv = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const LOGIN_URL = isLocalEnv ? '/public/logearse.html' : '/logearse.html';
const UPGRADE_URL = isLocalEnv ? '/public/upgradeUp.html' : '/upgradeUp.html';
let perfilUsuarioCache = null;

const modalMembresiaOverlay = document.getElementById('modalMembresiaUp');
const modalMembresiaCard = document.getElementById('modalMembresiaUpCard');
const modalUpSubmit = document.getElementById('modalUpSubmit');
const modalUpClose = document.getElementById('modalUpClose');
const modalUpCloseIcon = document.getElementById('modalUpCloseIcon');

const ocultarModalMembresia = () => {
  if (!modalMembresiaOverlay || !modalMembresiaCard) return;
  modalMembresiaCard.classList.remove('opacity-100', 'scale-100');
  modalMembresiaCard.classList.add('opacity-0', 'scale-95');
  setTimeout(() => {
    modalMembresiaOverlay.classList.add('hidden');
    modalMembresiaOverlay.classList.remove('flex');
  }, 200);
};

const mostrarModalMembresia = () => {
  if (!modalMembresiaOverlay || !modalMembresiaCard) return;
  modalMembresiaOverlay.classList.remove('hidden');
  modalMembresiaCard.classList.add('opacity-0', 'scale-95');
  modalMembresiaCard.classList.remove('opacity-100', 'scale-100');
  requestAnimationFrame(() => {
    modalMembresiaOverlay.classList.add('flex');
    modalMembresiaCard.classList.remove('opacity-0', 'scale-95');
    modalMembresiaCard.classList.add('opacity-100', 'scale-100');
  });
};

modalUpClose?.addEventListener('click', ocultarModalMembresia);
modalUpCloseIcon?.addEventListener('click', ocultarModalMembresia);
modalMembresiaOverlay?.addEventListener('click', (event) => {
  if (event.target === modalMembresiaOverlay) {
    ocultarModalMembresia();
  }
});
modalUpSubmit?.addEventListener('click', () => {
  window.location.href = UPGRADE_URL;
});

const obtenerUsuarioActual = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      window.location.href = LOGIN_URL;
      return null;
    }
    return data.user;
  } catch (err) {
    console.error('Error obteniendo usuario actual:', err);
    window.location.href = LOGIN_URL;
    return null;
  }
};

const getUserSinRedir = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return data.user;
  } catch (_) {
    return null;
  }
};

const obtenerPerfilUsuario = async (userId) => {
  if (perfilUsuarioCache && perfilUsuarioCache.id === userId) {
    return perfilUsuarioCache;
  }
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, telefono, imagen, membresiaUp')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error obteniendo perfil del usuario:', error);
      return null;
    }
    perfilUsuarioCache = data;
    return data;
  } catch (err) {
    console.error('Error inesperado obteniendo perfil del usuario:', err);
    return null;
  }
};

const asegurarMembresiaUp = async (perfil) => {
  if (perfil?.membresiaUp) return true;
  mostrarModalMembresia();
  return false;
};

const procesarGuardadoCupon = async ({
  cupon,
  btnGuardar,
  acciones,
  estadoRow,
  disponiblesTotal,
  guardadosMap,
  totalesMap
}) => {
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  const user = await getUserSinRedir();
  if (!user) {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar cupón';
    mostrarModalMembresia();
    return;
  }

  let perfil = await obtenerPerfilUsuario(user.id);
  if (!perfil) {
    alert('No pudimos validar tu perfil. Intenta nuevamente.');
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar cupón';
    return;
  }

  const membershipOk = await asegurarMembresiaUp(perfil);
  perfil = perfilUsuarioCache || perfil;

  if (!membershipOk) {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar cupón';
    return;
  }

  try {
    const codigoqr = crypto.randomUUID();
    const qrUrl = `${QR_REDIMIR_URL}?qr=${codigoqr}`;
    console.log('Generando QR para cupón:', cupon.id, codigoqr, qrUrl);
    const telefonoFormateado = perfil.telefono
      ? perfil.telefono.startsWith('+1')
        ? perfil.telefono
        : `+1${perfil.telefono}`
      : null;
    const { error: insertError } = await supabase
      .from('cuponesUsuarios')
      .insert({
        idCupon: cupon.id,
        idUsuario: user.id,
        codigoqr,
        redimido: false,
        fechaGuardado: new Date().toISOString(),
        telefonoUsuario: telefonoFormateado
      });

    if (insertError) {
      if (insertError.code === '23505') {
        alert('Ya guardaste este cupón.');
      } else {
        console.error('❌ Error guardando cupón:', insertError);
        alert('Ocurrió un error al guardar el cupón.');
      }
      btnGuardar.disabled = false;
      btnGuardar.textContent = 'Guardar cupón';
      return;
    }

    guardadosMap.set(cupon.id, { redimido: false, codigoqr });
    totalesMap.set(cupon.id, (totalesMap.get(cupon.id) || 0) + 1);
    btnGuardar.remove();
    const estado = document.createElement('span');
    estado.className = 'inline-flex items-center px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full';
    estado.textContent = 'Ya guardado';
    acciones.appendChild(estado);
    if (estadoRow) {
      const nuevosUsados = totalesMap.get(cupon.id) || 0;
      estadoRow.innerHTML = `<span>Disponibles: ${Math.max(disponiblesTotal - nuevosUsados, 0)} de ${disponiblesTotal}</span>`;
    }
  } catch (error) {
    console.error('🛑 Error inesperado guardando cupón:', error);
    alert('No se pudo guardar el cupón. Intenta nuevamente.');
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar cupón';
  }
};

const formatearFechaLegible = (fecha) => {
  if (!fecha) return '--';
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('es-PR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

async function cargarCuponesComercio(idComercio) {
  const seccion = document.getElementById('seccionCupones');
  const contenedor = document.getElementById('cuponContainer');
  const mensaje = document.getElementById('cuponMensaje');
  const indicador = document.getElementById('cuponIndicador');
  if (!seccion || !contenedor || !mensaje) return;

  contenedor.innerHTML = '';
  mensaje.classList.add('hidden');
  seccion.classList.add('hidden');
  indicador?.classList.add('hidden');

  const ahoraISO = new Date().toISOString();
  console.log('🔎 Buscando cupones del comercio', { idComercio, ahoraISO });

  const { data: cuponesRaw, error } = await supabase
    .from('cupones')
    .select('*')
    .eq('idComercio', idComercio)
    .order('fechainicio', { ascending: false });

if (error) {
  console.error('❌ Error cargando cupones del comercio:', error);
  return;
}

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const cupones = (cuponesRaw || []).filter((cupon) => {
    const activo = cupon.activo !== false;
    const fechaFinValor = cupon.fechaFin || cupon.fechafin || null;
    const vigente = !fechaFinValor ? true : new Date(fechaFinValor).getTime() >= hoy.getTime();
    return activo && vigente;
  });

  console.log('📦 Cupones filtrados:', cupones.length);

  if (!cupones.length) {
    if ((cuponesRaw || []).length) {
      console.warn('⚠️ Se encontraron cupones pero fueron filtrados por activo/fecha.', cuponesRaw);
    } else {
      console.log('ℹ️ No hay cupones en la tabla para este comercio.');
    }
    mensaje.textContent = 'No hay cupones disponibles en este momento.';
    mensaje.classList.remove('hidden');
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  console.log('Cupones del comercio:', cupones);
  console.log('Usuario actual (cupones):', user?.id);

  const cuponIds = cupones.map((c) => c.id);
  const guardadosMap = new Map();
  const totalesMap = new Map();

  if (cuponIds.length) {
    const { data: totalesData, error: totalesError } = await supabase
      .from('cuponesUsuarios')
      .select('idCupon')
      .in('idCupon', cuponIds);

    if (totalesError) {
      console.error('❌ Error obteniendo uso de cupones:', totalesError);
    } else {
      (totalesData || []).forEach((row) => {
        totalesMap.set(row.idCupon, (totalesMap.get(row.idCupon) || 0) + 1);
      });
    }
  }

  if (user && cuponIds.length) {
    const { data: guardadosData, error: guardadosError } = await supabase
      .from('cuponesUsuarios')
      .select('idCupon, codigoqr, redimido, fechaRedimido')
      .eq('idUsuario', user.id)
      .in('idCupon', cuponIds);

    if (guardadosError) {
      console.error('❌ Error consultando cupones guardados del usuario:', guardadosError);
    } else {
      (guardadosData || []).forEach((row) => {
        guardadosMap.set(row.idCupon, row);
      });
    }
  }

  contenedor.innerHTML = '';

  cupones.forEach((cupon, index) => {
    const card = document.createElement('div');
    card.className =
      'border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col justify-between bg-white min-w-[260px] max-w-[260px] h-[420px] snap-center flex-shrink-0';

    const topContent = document.createElement('div');
    topContent.className = 'flex flex-col gap-4 flex-1';
    card.appendChild(topContent);

    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'relative rounded-xl overflow-hidden h-48 md:h-40';
    const img = document.createElement('img');
    img.src = cupon.imagen || CUPON_PLACEHOLDER;
    img.alt = cupon.titulo || 'Cupón';
    img.loading = 'lazy';
    img.className = 'w-full h-full object-cover';
    imgWrapper.appendChild(img);
    topContent.appendChild(imgWrapper);

    const tituloEl = document.createElement('h3');
    tituloEl.className = 'text-lg font-semibold text-[#424242] leading-tight';
    tituloEl.textContent = cupon.titulo || 'Cupón';
    topContent.appendChild(tituloEl);

    if (cupon.descripcion) {
      const descWrapper = document.createElement('div');
      descWrapper.className = 'min-h-[60px] flex items-center';
      const descEl = document.createElement('p');
      descEl.className = 'text-sm text-gray-600 leading-snug line-clamp-3';
      descEl.textContent = cupon.descripcion;
      descWrapper.appendChild(descEl);
      topContent.appendChild(descWrapper);
    }

    if (cupon.descuento != null) {
      const desc = document.createElement('p');
      desc.className = 'text-sm font-medium text-green-600';
      desc.textContent = `Descuento: ${cupon.descuento}%`;
      topContent.appendChild(desc);
    }

    const disponiblesTotal = cupon.cantidadDisponible ?? 0;
    const usados = totalesMap.get(cupon.id) || 0;
    const agotado = disponiblesTotal > 0 && usados >= disponiblesTotal;

    let estadoRow = null;
    if (disponiblesTotal > 0) {
      estadoRow = document.createElement('div');
      estadoRow.className = 'flex items-center justify-between text-xs text-gray-500';
      estadoRow.innerHTML = `<span>Disponibles: ${Math.max(disponiblesTotal - usados, 0)} de ${disponiblesTotal}</span>`;
      topContent.appendChild(estadoRow);
    }

    const footer = document.createElement('div');
    footer.className = 'flex flex-col gap-2 pt-2 border-t border-gray-100 w-full';
    card.appendChild(footer);

    const fechasEl = document.createElement('p');
    fechasEl.className = 'text-xs text-gray-500';
    const fechaFinLegible = formatearFechaLegible(cupon.fechaFin || cupon.fechafin);
    fechasEl.textContent = `Válido hasta el ${fechaFinLegible}`;
    footer.appendChild(fechasEl);

    const acciones = document.createElement('div');
    acciones.className = 'flex flex-col gap-2 w-full';

    const guardado = guardadosMap.get(cupon.id);
    console.log('Guardado encontrado:', cupon.id, guardado);

    if (guardado) {
      const estado = document.createElement('span');
      estado.className = guardado.redimido
        ? 'inline-flex items-center px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full'
        : 'inline-flex items-center px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full';
      estado.textContent = guardado.redimido ? 'Redimido' : 'Ya guardado';
      acciones.appendChild(estado);
    } else if (agotado) {
      const agotadoEl = document.createElement('span');
      agotadoEl.className = 'inline-flex items-center px-3 py-1 bg-red-100 text-red-600 text-xs font-semibold rounded-full';
      agotadoEl.textContent = 'Agotado';
      acciones.appendChild(agotadoEl);
    } else {
      const btnGuardar = document.createElement('button');
      btnGuardar.type = 'button';
      btnGuardar.className = 'px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition w-full';
      btnGuardar.textContent = 'Guardar cupón';
      btnGuardar.addEventListener('click', () =>
        procesarGuardadoCupon({
          cupon,
          btnGuardar,
          acciones,
          estadoRow,
          disponiblesTotal,
          guardadosMap,
          totalesMap
        })
      );
      acciones.appendChild(btnGuardar);
    }

    footer.appendChild(acciones);
    contenedor.appendChild(card);
  });

  if (cupones.length > 1) {
    if (indicador) {
      indicador.textContent = `${cupones.length} cupones disponibles`;
      indicador.classList.remove('hidden');
    }
  } else {
    indicador?.classList.add('hidden');
  }

  seccion.classList.remove('hidden');
}

async function mostrarSucursales(idComercio, nombreComercio) {
  const { data: relaciones, error: errorRelaciones } = await supabase
    .from('ComercioSucursales')
    .select('comercio_id, sucursal_id')
    .or(`comercio_id.eq.${idComercio},sucursal_id.eq.${idComercio}`);

  if (errorRelaciones) {
    console.error('Error consultando relaciones de sucursales:', errorRelaciones);
    return;
  }

  if (!relaciones || relaciones.length === 0) return;

  const idsRelacionados = relaciones.flatMap(r => [r.comercio_id, r.sucursal_id]);
  const idsUnicos = [...new Set(idsRelacionados.filter(id => id !== parseInt(idComercio)))];

  const { data: sucursales, error: errorSucursales } = await supabase
    .from('Comercios')
    .select('id, nombre, nombreSucursal')
    .in('id', idsUnicos);

  if (errorSucursales) {
    console.error('Error consultando sucursales:', errorSucursales);
    return;
  }

  if (!sucursales || sucursales.length === 0) return;

  const contenedor = document.getElementById('listaSucursales');
  const wrapper = document.getElementById('sucursalesContainer');
  if (!contenedor || !wrapper) return;

  sucursales.forEach(sucursal => {
    const btn = document.createElement('button');
    btn.textContent = sucursal.nombreSucursal || sucursal.nombre;
    btn.className = 'px-3 py-2 m-1 bg-red-600 text-white rounded-full text-base font-medium hover:bg-red-700 transition';
    btn.onclick = () => window.location.href = `perfilComercio.html?id=${sucursal.id}`;
    contenedor.appendChild(btn);
  });

  const titulo = document.getElementById('tituloSucursales');
  if (titulo) titulo.textContent = `Otras Sucursales de ${nombreComercio}`;

  wrapper.classList.remove('hidden');
}

export async function obtenerComercioPorID(idComercio) {
  const { data, error } = await supabase
    .from('Comercios')
    .select(`
      *,
      ComercioCategorias ( idCategoria )
    `)
    .eq('id', idComercio)
    .single();

  if (error || !data) {
    console.error('Error cargando comercio:', error);
    return null;
  }

  const planInfo = resolverPlanComercio(data || {});
  if (!planInfo.permite_perfil) {
    showPopup(`
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Perfil en construcción</h3>
      <p class="text-sm text-gray-600">Este comercio aún está en el plan básico de Findixi. Muy pronto podrás ver su perfil completo.</p>
    `);
    setTimeout(() => {
      window.location.href = 'listadoComercios.html';
    }, 1600);
    return null;
  }

  document.getElementById('nombreComercio').textContent = data.nombre;
  if (data.nombreSucursal) {
    document.getElementById('nombreSucursal').textContent = data.nombreSucursal;
  }
  document.getElementById('textoDireccion').textContent = data.direccion;

  // ✅ Mostrar teléfono solo si NO es categoría Jangueo (id 11)
  const esJangueo = data.ComercioCategorias?.some((c) => c.idCategoria === 11);
  const telefonoElemento = document.getElementById('telefonoComercio');

  if (!esJangueo && data.telefono) {
    const telefonoDisplay = formatearTelefonoDisplay(data.telefono);
    const telefonoHref = formatearTelefonoHref(data.telefono);
    telefonoElemento.innerHTML = `<i class="fa-solid fa-phone text-xl"></i> ${telefonoDisplay}`;
    if (telefonoHref) {
      telefonoElemento.href = telefonoHref;
    } else {
      telefonoElemento.removeAttribute('href');
    }
  } else if (telefonoElemento) {
    telefonoElemento.classList.add('hidden');
  }

  document.getElementById('nombreCercanosComida').textContent = data.nombre;

  if (data.whatsapp) document.getElementById('linkWhatsapp')?.setAttribute('href', data.whatsapp);
  if (data.facebook) document.getElementById('linkFacebook')?.setAttribute('href', data.facebook);
  if (data.instagram) document.getElementById('linkInstagram')?.setAttribute('href', data.instagram);
  if (data.tiktok) document.getElementById('linkTikTok')?.setAttribute('href', data.tiktok);
  if (data.webpage) document.getElementById('linkWeb')?.setAttribute('href', data.webpage);
  if (data.email) document.getElementById('linkEmail')?.setAttribute('href', `mailto:${data.email}`);

  const { data: imagenLogo } = await supabase
    .from('imagenesComercios')
    .select('imagen')
    .eq('idComercio', idComercio)
    .eq('logo', true)
    .maybeSingle();

  if (imagenLogo?.imagen) {
    const url = supabase.storage.from('galeriacomercios').getPublicUrl(imagenLogo.imagen).data.publicUrl;
    document.getElementById('logoComercio').src = url;
  }

  if (latUsuario && lonUsuario && data.latitud && data.longitud) {
    const [conTiempo] = await calcularTiemposParaLista([data], {
      lat: latUsuario,
      lon: lonUsuario
    });

    if (conTiempo?.tiempoVehiculo) {
      document.getElementById('tiempoVehiculo').innerHTML = `<i class="fas fa-car"></i> ${conTiempo.tiempoVehiculo}`;
    }

    const googleMapsURL = `https://www.google.com/maps/search/?api=1&query=${data.latitud},${data.longitud}`;
    const wazeURL = `https://waze.com/ul?ll=${data.latitud},${data.longitud}&navigate=yes`;

    document.getElementById('btnGoogleMaps').href = googleMapsURL;
    document.getElementById('btnWaze').href = wazeURL;
  }

  if (data.tieneSucursales) await mostrarSucursales(idComercio, data.nombre);

  await cargarCuponesComercio(idComercio);

  comercioActual = data;
  return data;
}

navigator.geolocation.getCurrentPosition(
  async (pos) => {
    latUsuario = pos.coords.latitude;
    lonUsuario = pos.coords.longitude;
    const comercio = await obtenerComercioPorID(idComercio);
    if (comercio) {
      mostrarCercanosComida(comercio);
      mostrarPlayasCercanas(comercio);
      mostrarLugaresCercanos(comercio);
    }
  },
  async () => {
    console.warn('❗ Usuario no permitió ubicación.');
    const comercio = await obtenerComercioPorID(idComercio);
    if (comercio) {
      mostrarCercanosComida(comercio);
      mostrarPlayasCercanas(comercio);
      mostrarLugaresCercanos(comercio);
    }
  }
);

window.addEventListener('lang:changed', () => {
  if (!comercioActual || comercioActual.minutosCrudos == null) return;
  const tiempo = formatTiempo(comercioActual.minutosCrudos * 60);
  document.getElementById('tiempoVehiculo').innerHTML = `<i class="fas fa-car"></i> ${tiempo}`;
});
