import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/supabaseClient.js';
import { FONTS_MENU } from './js/fontsMenu.js';
import { resolverPlanComercio } from '../shared/planes.js';

function getPublicBase() {
  return '/';
}

const idComercio = new URLSearchParams(window.location.search).get('id');
const nombreEl = document.getElementById('nombreComercio');
const logoEl = document.getElementById('logoComercio');
const seccionesEl = document.getElementById('seccionesMenu');
const btnAgregarSeccion = document.getElementById('btnAgregarSeccion');
const modal = document.getElementById('modalSeccion');
const inputTitulo = document.getElementById('inputTitulo');
const menuNoTraducirTitulo = document.getElementById('menuNoTraducirTitulo');
const inputSubtitulo = document.getElementById('inputSubtitulo');
const menuDescripcion = document.getElementById('menuDescripcion');
const inputOrden = document.getElementById('inputOrden');
const inputActivo = document.getElementById('inputActivo');
const btnCancelarSeccion = document.getElementById('btnCancelarSeccion');
const btnGuardarSeccion = document.getElementById('btnGuardarSeccion');
const linkLogo = document.getElementById('linkPerfilDelLogo');
const inputBuscarFuente = document.getElementById('inputBuscarFuente');
const filtroCategoriaFuente = document.getElementById('filtroCategoriaFuente');
const fontBodySelect = document.getElementById('fontBodySelect');
const fontTitleSelect = document.getElementById('fontTitleSelect');
const fontNombreSelect = document.getElementById('fontNombreSelect');
const fontMenuWordSelect = document.getElementById('fontMenuWordSelect');
const fontSeccionDescSelect = document.getElementById('fontSeccionDescSelect');
const fontBodySize = document.getElementById('fontBodySize');
const fontTitleSize = document.getElementById('fontTitleSize');
const nombreFontSize = document.getElementById('nombreFontSize');
const menuFontSize = document.getElementById('menuFontSize');
const fontSeccionDescSize = document.getElementById('fontSeccionDescSize');
const colorSeccionDesc = document.getElementById('colorSeccionDesc');
const previewFontBody = document.getElementById('previewFontBody');
const previewFontTitle = document.getElementById('previewFontTitle');
const previewFontNombre = document.getElementById('previewFontNombre');
const previewFontMenuWord = document.getElementById('previewFontMenuWord');
const colorNombre = document.getElementById('colorNombre');
const colorMenuWord = document.getElementById('colorMenuWord');
const colorTexto = document.getElementById('colorTexto');
const colorTitulo = document.getElementById('colorTitulo');
const colorPrecio = document.getElementById('colorPrecio');
const colorBoton = document.getElementById('colorBoton');
const colorBotonTexto = document.getElementById('colorBotonTexto');
const overlayOscuro = document.getElementById('overlayOscuro');
const backgroundColor = document.getElementById('backgroundColor');
const textoMenu = document.getElementById('textoMenu');
const pdfUrl = document.getElementById('pdfUrl');
const compartirSucursales = document.getElementById('compartirSucursales');
const listaSucursales = document.getElementById('listaSucursales');
const colorBotonPdf = document.getElementById('colorBotonPdf');
const opacidadBotonPdf = document.getElementById('opacidadBotonPdf');
const inputPortada = document.getElementById('inputPortada');
const btnQuitarPortada = document.getElementById('btnQuitarPortada');
const previewPortada = document.getElementById('previewPortada');
const inputBackgroundImg = document.getElementById('inputBackgroundImg');
const btnQuitarBackground = document.getElementById('btnQuitarBackground');
const previewBackground = document.getElementById('previewBackground');
const btnGuardarTema = document.getElementById('btnGuardarTema');
const previewHeader = document.getElementById('previewHeader');
const previewHeaderBg = document.getElementById('previewHeaderBg');
const previewHeaderOverlay = document.getElementById('previewHeaderOverlay');
const previewTituloDemo = document.getElementById('previewTituloDemo');
const previewItemCard = document.getElementById('previewItemCard');
const previewItemOverlay = document.getElementById('previewItemOverlay');
const previewItemNombre = document.getElementById('previewItemNombre');
const previewItemTexto = document.getElementById('previewItemTexto');
const previewItemPrecio = document.getElementById('previewItemPrecio');
const previewNombreComercio = document.getElementById('previewNombreComercio');
const previewMenuWord = document.getElementById('previewMenuWord');
const itemBgColor = document.getElementById('itemBgColor');
const itemOverlay = document.getElementById('itemOverlay');
const hideNombre = document.getElementById('hideNombre');
const hideMenuWord = document.getElementById('hideMenuWord');
const itemAlignLeft = document.getElementById('itemAlignLeft');
const itemAlignCenter = document.getElementById('itemAlignCenter');
const nombreStrokeWidth = document.getElementById('nombreStrokeWidth');
const nombreStrokeColor = document.getElementById('nombreStrokeColor');
const nombreShadow = document.getElementById('nombreShadow');
const nombreShadowColor = document.getElementById('nombreShadowColor');
const menuStrokeWidth = document.getElementById('menuStrokeWidth');
const menuStrokeColor = document.getElementById('menuStrokeColor');
const menuShadow = document.getElementById('menuShadow');
const menuShadowColor = document.getElementById('menuShadowColor');
const titulosStrokeWidth = document.getElementById('titulosStrokeWidth');
const titulosStrokeColor = document.getElementById('titulosStrokeColor');
const titulosShadow = document.getElementById('titulosShadow');
const botonStrokeWidth = document.getElementById('botonStrokeWidth');
const botonStrokeColor = document.getElementById('botonStrokeColor');
const botonShadow = document.getElementById('botonShadow');
const cloverBar = document.getElementById('cloverBar');
const planBadge = document.getElementById('planBadge');
const btnCambiarPlan = document.getElementById('btnCambiarPlan');

let editandoId = null;
let linkFuente = null;
let productoEditandoId = null;
let idMenuActivo = null;
let portadaUrl = '';
let portadaPath = '';
let backgroundUrl = '';
let backgroundPath = '';
let temaActual = {};
let tieneSucursales = false;
let tema;
let planInfo = null;
let planPermiteMenu = true;
let planPermiteOrdenes = true;
const COVER_BUCKET = 'galeriacomercios';
const COVER_PREFIX = 'menus/portada';
const BACKGROUND_PREFIX = 'menus/background';
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
const CLOVER_LOGO_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/CloverLogo.png';
const toastEl = document.getElementById('toast');
const isDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const fuentesSeleccionadas = {
  body: null,
  title: null,
  nombre: null,
  menu: null,
  secciondesc: null,
};
const DEFAULT_TEMA = {
  colortexto: '#1f2937',
  colortitulo: '#111827',
  colorprecio: '#2563eb',
  colorboton: '#2563eb',
  colorbotontexto: '#ffffff',
  colorComercio: '#111827',
  colorMenu: '#111827',
  overlayoscuro: 40,
  pdfurl: '',
  colorBotonPDF: 'rgba(37, 99, 235, 0.8)',
  portadaimagen: '',
  backgroundimagen: '',
  backgroundcolor: '#ffffff',
  textomenu: 'Menú',
  ocultar_nombre: false,
  ocultar_menu: false,
  fontbodyfamily: null,
  fontbodyurl: null,
  fonttitlefamily: null,
  fonttitleurl: null,
  fontnombrefamily: null,
  fontnombreurl: null,
  fontmenuwordfamily: null,
  fontmenuwordurl: null,
  fontbody_size: 16,
  fonttitle_size: 18,
  nombre_font_size: 28,
  menu_font_size: 20,
  seccion_desc_font_family: null,
  seccion_desc_font_url: null,
  seccion_desc_font_size: 14,
  seccion_desc_color: '#ffffff',
  item_bg_color: '#ffffff',
  item_overlay: 0,
  productoAlign: 'left',
  nombre_shadow: '',
  nombre_shadow_color: '#00000080',
  nombre_stroke_width: 0,
  nombre_stroke_color: '#000000',
  menu_shadow: '',
  menu_shadow_color: '#00000080',
  menu_stroke_width: 0,
  menu_stroke_color: '#000000',
  titulos_shadow: '',
  titulos_stroke_width: 0,
  titulos_stroke_color: '#000000',
  boton_shadow: '',
  boton_stroke_width: 0,
  boton_stroke_color: '#000000',
};

function renderPlanBadge(info) {
  if (planBadge) {
    planBadge.textContent = `${info.nombre} (Nivel ${info.nivel})`;
  }
  if (btnCambiarPlan && idComercio) {
    btnCambiarPlan.href = `./paquetes.html?id=${idComercio}`;
  }
}

function mostrarOverlayPlan({ titulo, mensaje }) {
  const existente = document.getElementById('planOverlay');
  if (existente) return;
  const overlay = document.createElement('div');
  overlay.id = 'planOverlay';
  overlay.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center space-y-3">
      <h2 class="text-xl font-semibold text-gray-900">${titulo}</h2>
      <p class="text-sm text-gray-600">${mensaje}</p>
      <a href="./paquetes.html?id=${idComercio}" class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
        Cambiar Plan
      </a>
    </div>
  `;
  document.body.appendChild(overlay);
}

function bloquearMenuPorPlan() {
  mostrarOverlayPlan({
    titulo: 'Menú disponible en Findixi Plus',
    mensaje: 'Actualiza tu plan para administrar menú, secciones y productos.',
  });
}

function bloquearCloverPorPlan() {
  if (!cloverBar) return;
  cloverBar.innerHTML = `
    <div class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm">
      Órdenes Clover disponibles en Premium
    </div>
  `;
}

function bloquearCloverPorVerificacion() {
  if (!cloverBar) return;
  cloverBar.innerHTML = `
    <div class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-sm border border-amber-200">
      Propiedad pendiente de verificación: Clover/órdenes bloqueados temporalmente.
    </div>
  `;
}

function comercioVerificado(comercio = {}) {
  const estadoPropiedad = String(comercio?.estado_propiedad || '').toLowerCase();
  const estadoVerificacion = String(comercio?.estado_verificacion || '').toLowerCase();
  const propietarioVerificado = comercio?.propietario_verificado === true;
  const verificacionOk = ['otp_verificado', 'sms_verificado', 'messenger_verificado', 'manual_aprobado'].includes(
    estadoVerificacion
  );
  return estadoPropiedad === 'verificado' && (propietarioVerificado || verificacionOk);
}

async function cargarPlanComercio() {
  if (!idComercio) return null;
  const { data, error } = await supabase
    .from('Comercios')
    .select('plan_id, plan_nivel, plan_nombre, permite_menu, permite_ordenes, estado_propiedad, estado_verificacion, propietario_verificado')
    .eq('id', idComercio)
    .maybeSingle();

  if (error) {
    console.warn('No se pudo cargar plan del comercio:', error?.message || error);
    return null;
  }

  planInfo = resolverPlanComercio(data || {});
  planPermiteMenu = planInfo.permite_menu;
  planPermiteOrdenes = planInfo.permite_ordenes;
  renderPlanBadge(planInfo);
  const verificado = comercioVerificado(data || {});

  if (!planPermiteMenu) {
    if (verificado) {
      bloquearMenuPorPlan();
    } else {
      mostrarOverlayPlan({
        titulo: 'Propiedad pendiente de verificación',
        mensaje: 'Completa la verificación del comercio para habilitar menú, especiales y visibilidad completa.',
      });
    }
  }
  if (!planPermiteOrdenes) {
    if (verificado) {
      bloquearCloverPorPlan();
    } else {
      bloquearCloverPorVerificacion();
    }
  }
  return planInfo;
}

let draggingSeccion = null;
let guardandoOrden = false;

function colorConAlpha(color, alpha) {
  const a = Math.min(Math.max(alpha, 0), 1);
  if (!color) return `rgba(0,0,0,${a})`;
  if (color.startsWith('rgb')) {
    const parts = color.replace(/rgba?\\(|\\)/g, '').split(',').map((v) => v.trim());
    const [r = 0, g = 0, b = 0] = parts;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  // hex #rrggbb
  const hex = color.replace('#', '');
  const bigint = parseInt(hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function parseColorToHexAndAlpha(color, defaultHex = '#2563eb', defaultAlpha = 0.8) {
  if (!color) return { hex: defaultHex, alpha: defaultAlpha };
  if (color.startsWith('rgb')) {
    const parts = color.replace(/rgba?\\(|\\)/g, '').split(',').map((v) => v.trim());
    const [r = 0, g = 0, b = 0, a = defaultAlpha] = parts;
    const hex = `#${[r, g, b]
      .map((n) => {
        const num = parseInt(n, 10);
        const clamped = Number.isFinite(num) ? Math.min(Math.max(num, 0), 255) : 0;
        return clamped.toString(16).padStart(2, '0');
      })
      .join('')}`;
    const alpha = Number.parseFloat(a) || defaultAlpha;
    return { hex, alpha: Math.min(Math.max(alpha, 0), 1) };
  }
  const hex = color.startsWith('#') ? color : `#${color}`;
  return { hex, alpha: defaultAlpha };
}

function buildRgba(hexColor, alpha) {
  const hex = hexColor.replace('#', '');
  const bigint = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const a = Math.min(Math.max(alpha, 0), 1);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function setLoading(button, isLoading, texto = 'Guardando...') {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = texto;
    button.disabled = true;
    button.classList.add('opacity-60', 'cursor-not-allowed');
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
    button.classList.remove('opacity-60', 'cursor-not-allowed');
  }
}

function showToast(mensaje, tipo = 'info') {
  if (!toastEl) return;
  toastEl.textContent = mensaje;
  const color = tipo === 'error' ? 'bg-red-600' : tipo === 'success' ? 'bg-green-600' : 'bg-black/80';
  toastEl.className = `fixed top-4 right-4 px-4 py-3 rounded shadow-lg text-white z-50 transition-opacity duration-300 ${color}`;
  toastEl.classList.remove('hidden');
  toastEl.style.opacity = '1';
  setTimeout(() => {
    toastEl.style.opacity = '0';
    setTimeout(() => toastEl.classList.add('hidden'), 300);
  }, 2500);
}

function ensureFontLink(id, url) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('link');
    el.rel = 'stylesheet';
    el.id = id;
    document.head.appendChild(el);
  }
  el.href = url;
}

function aplicarFuentePorRol(rol, fuente) {
  if (!fuente?.url || !fuente.name) return;
  ensureFontLink(`fuente-${rol}`, fuente.url);
  fuentesSeleccionadas[rol] = fuente;

  if (rol === 'body') {
    if (previewItemTexto) previewItemTexto.style.fontFamily = `'${fuente.name}', 'Kanit', sans-serif`;
    if (previewItemNombre) previewItemNombre.style.fontFamily = `'${fuente.name}', 'Kanit', sans-serif`;
    if (previewItemPrecio) previewItemPrecio.style.fontFamily = `'${fuente.name}', 'Kanit', sans-serif`;
  }
  if (rol === 'title') {
    if (previewTituloDemo) previewTituloDemo.style.fontFamily = `'${fuente.name}', 'Kanit', sans-serif`;
  }
  if (rol === 'nombre') {
    if (previewNombreComercio) previewNombreComercio.style.fontFamily = `'${fuente.name}', 'Kanit', sans-serif`;
  }
  if (rol === 'menu') {
    if (previewMenuWord) previewMenuWord.style.fontFamily = `'${fuente.name}', 'Kanit', sans-serif`;
  }
}

function renderFontOptions() {
  const texto = inputBuscarFuente?.value?.trim().toLowerCase() || '';
  const filtroCat = filtroCategoriaFuente?.value || 'all';
  const fuentes = FONTS_MENU.filter((f) => {
    const matchTexto = f.name.toLowerCase().includes(texto);
    const matchCat = filtroCat === 'all' || f.category === filtroCat;
    return matchTexto && matchCat;
  });

  const selects = [
    { el: fontBodySelect, rol: 'body', preview: previewFontBody },
    { el: fontTitleSelect, rol: 'title', preview: previewFontTitle },
    { el: fontNombreSelect, rol: 'nombre', preview: previewFontNombre },
    { el: fontMenuWordSelect, rol: 'menu', preview: previewFontMenuWord },
    { el: fontSeccionDescSelect, rol: 'secciondesc', preview: null },
  ];

  selects.forEach(({ el, rol, preview }) => {
    if (!el) return;
    const current = fuentesSeleccionadas[rol]?.name || '';
    el.innerHTML = '';
    fuentes.forEach((fuente) => {
      // precargar fuente para que se vea en el dropdown
      const slug = fuente.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      ensureFontLink(`fuente-preview-${slug}`, fuente.url);
      const opt = document.createElement('option');
      opt.value = fuente.name;
      opt.textContent = `${fuente.name} (${fuente.category})`;
      opt.dataset.url = fuente.url;
      opt.style.fontFamily = `'${fuente.name}', 'Kanit', sans-serif`;
      opt.style.setProperty('--option-font-family', `'${fuente.name}', 'Kanit', sans-serif`);
      if (fuente.name === current) opt.selected = true;
      el.appendChild(opt);
    });
    el.onchange = () => {
      const selected = fuentes.find((f) => f.name === el.value);
      if (selected) {
        aplicarFuentePorRol(rol, selected);
        if (preview) preview.style.fontFamily = `'${selected.name}', 'Kanit', sans-serif`;
        el.style.fontFamily = `'${selected.name}', 'Kanit', sans-serif`;
      }
    };
    // refrescar preview si ya hay selección
    if (preview && current) preview.style.fontFamily = `'${current}', 'Kanit', sans-serif`;
    if (current) el.style.fontFamily = `'${current}', 'Kanit', sans-serif`;
  });
  aplicarTemaEnPreview(leerTemaDesdeInputs());
}

async function cargarFuenteGuardada() {
  if (!idComercio) return;
    const { data, error } = await supabase
      .from('menu_tema')
      .select('colortexto,colortitulo,colorprecio,colorboton,colorbotontexto,"colorComercio","colorMenu","productoAlign",overlayoscuro,pdfurl,"colorBotonPDF",portadaimagen,backgroundimagen,backgroundcolor,textomenu,ocultar_nombre,ocultar_menu,fontbodyfamily,fontbodyurl,fontbody_size,fonttitlefamily,fonttitleurl,fonttitle_size,fontnombrefamily,fontnombreurl,nombre_font_size,fontmenuwordfamily,fontmenuwordurl,menu_font_size,nombre_shadow,nombre_stroke_width,nombre_stroke_color,menu_shadow,menu_stroke_width,menu_stroke_color,titulos_shadow,titulos_stroke_width,titulos_stroke_color,boton_shadow,boton_stroke_width,boton_stroke_color,item_bg_color,item_overlay,seccion_desc_font_family,seccion_desc_font_url,seccion_desc_font_size,seccion_desc_color')
      .eq('idcomercio', idComercio)
      .maybeSingle();

  if (error) {
    console.warn('No se pudo cargar la fuente guardada:', error);
    return;
  }

  // Cargar resto de tema
  temaActual = data || {};
  rellenarInputsTema(temaActual);
  if (isDev) console.log('[adminMenu] Tema cargado:', { idComercio, tema: temaActual });
}

function getPublicCoverUrl(path) {
  if (!path) return '';
  const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}

function cacheBust(url) {
  if (!url) return '';
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}cb=${Date.now()}`;
}

function sanitizeOffsets(str = '') {
  return str.replace(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g, '').trim();
}

function parseShadowParts(shadowStr, fallbackColor) {
  const trimmed = shadowStr?.trim() || '';
  if (!trimmed) return { offsets: '', color: fallbackColor };
  const colorMatches = trimmed.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g);
  const color = colorMatches?.[colorMatches.length - 1] || fallbackColor;
  const offsets = sanitizeOffsets(trimmed);
  return { offsets, color };
}

function aplicarTemaEnPreview(tema) {
  const t = { ...DEFAULT_TEMA, ...tema };
  const colorComercioVal = t.colorComercio || t.colortitulo;
  const colorMenuVal = t.colorMenu || t.colortitulo;
  if (previewNombreComercio) {
    previewNombreComercio.textContent = nombreEl?.textContent || 'Nombre Comercio';
    previewNombreComercio.style.color = colorComercioVal;
    previewNombreComercio.style.display = t.ocultar_nombre ? 'none' : 'block';
  }
  if (previewMenuWord) {
    previewMenuWord.textContent = t.textomenu || 'Menú';
    previewMenuWord.style.color = colorMenuVal;
    previewMenuWord.style.display = t.ocultar_menu ? 'none' : 'block';
  }

  const applyStroke = (el, width, color, shadow) => {
    if (!el) return;
    const w = Number(width) || 0;
    const c = color || '#000';
    const supportsStroke = 'webkitTextStroke' in el.style;
    if (supportsStroke) {
      el.style.webkitTextStroke = w > 0 ? `${w}px ${c}` : '';
      el.style.paintOrder = 'stroke fill';
      el.style.textShadow = shadow || '';
    } else {
      const shadows = [];
      if (w > 0) {
        const dirs = [
          [w, 0],
          [-w, 0],
          [0, w],
          [0, -w],
          [w, w],
          [-w, w],
          [w, -w],
          [-w, -w],
        ];
        dirs.forEach(([x, y]) => shadows.push(`${x}px ${y}px 0 ${c}`));
      }
      if (shadow) shadows.push(shadow);
      el.style.webkitTextStroke = '';
      el.style.textShadow = shadows.join(', ');
    }
  };

  // Colores base
  if (previewTituloDemo) {
    previewTituloDemo.style.color = t.colorbotontexto || t.colortitulo;
    previewTituloDemo.style.backgroundColor = t.colorboton;
    previewTituloDemo.textContent = 'Aperitivos';
  }
  if (previewItemNombre) previewItemNombre.style.color = t.colortitulo;
  if (previewItemTexto) previewItemTexto.style.color = t.colortexto;
  if (previewItemPrecio) previewItemPrecio.style.color = t.colorprecio;
  const align = (t.productoAlign || 'left').toLowerCase();
  const itemTextWrapper = previewItemNombre?.parentElement;
  if (itemTextWrapper) {
    itemTextWrapper.style.textAlign = align === 'center' ? 'center' : 'left';
    itemTextWrapper.style.alignItems = align === 'center' ? 'center' : 'flex-start';
    itemTextWrapper.style.width = '100%';
  }

  // Tamaños
  if (previewNombreComercio && t.nombre_font_size) {
    previewNombreComercio.style.fontSize = `${t.nombre_font_size}px`;
    previewNombreComercio.style.marginBottom = '8px';
  }
  if (previewMenuWord && t.menu_font_size) previewMenuWord.style.fontSize = `${t.menu_font_size}px`;
  if (previewTituloDemo && t.fonttitle_size) previewTituloDemo.style.fontSize = `${t.fonttitle_size}px`;
  if (previewTituloDemo && t.fonttitle_size) previewTituloDemo.style.fontSize = `${t.fonttitle_size}px`;
  if (previewItemNombre && t.fontbody_size) previewItemNombre.style.fontSize = `${t.fontbody_size}px`;
  if (previewItemTexto && t.fontbody_size) previewItemTexto.style.fontSize = `${t.fontbody_size}px`;
  if (previewItemPrecio && t.fontbody_size) previewItemPrecio.style.fontSize = `${t.fontbody_size}px`;

  // Stroke y sombras
  const nombreShadowStr = `${sanitizeOffsets(nombreShadow?.value || '')} ${nombreShadowColor?.value || DEFAULT_TEMA.nombre_shadow_color}`.trim();
  const menuShadowStr = `${sanitizeOffsets(menuShadow?.value || '')} ${menuShadowColor?.value || DEFAULT_TEMA.menu_shadow_color}`.trim();
  applyStroke(previewNombreComercio, t.nombre_stroke_width, t.nombre_stroke_color, nombreShadowStr);
  applyStroke(previewMenuWord, t.menu_stroke_width, t.menu_stroke_color, menuShadowStr);
  applyStroke(previewTituloDemo, t.titulos_stroke_width, t.titulos_stroke_color, t.titulos_shadow);
  if (previewTituloDemo) {
    const borderWidth = Number(t.boton_stroke_width) || 0;
    previewTituloDemo.style.border = borderWidth > 0 ? `${borderWidth}px solid ${t.boton_stroke_color || '#000'}` : 'none';
    previewTituloDemo.style.boxShadow = t.boton_shadow || '';
  }

  // Background header (usa backgroundimagen/color)
  const fondo = t.backgroundimagen;
  const fondoUrl = fondo?.startsWith('http') ? fondo : getPublicCoverUrl(fondo);
  if (previewHeaderBg) {
    if (fondoUrl) {
      previewHeaderBg.src = fondoUrl;
      previewHeaderBg.classList.remove('hidden');
    } else {
      previewHeaderBg.src = '';
      previewHeaderBg.classList.add('hidden');
    }
  }
  if (previewHeader) {
    previewHeader.style.backgroundColor = fondoUrl ? 'transparent' : (t.backgroundcolor || '#ffffff');
  }
  if (previewHeaderOverlay) {
    const alpha = Math.min(Math.max(Number(t.overlayoscuro) || 0, 0), 80) / 100;
    previewHeaderOverlay.style.backgroundColor = `rgba(0,0,0,${alpha})`;
  }

  // Fondo item + overlay
  if (previewItemCard) {
    const alphaItem = 1 - Math.min(Math.max(Number(t.item_overlay) || 0, 0), 80) / 100;
    previewItemCard.style.backgroundColor = colorConAlpha(t.item_bg_color || '#ffffff', alphaItem);
  }
  if (previewItemOverlay) {
    previewItemOverlay.style.backgroundColor = 'rgba(0,0,0,0)';
  }
}

function rellenarInputsTema(tema) {
  const t = { ...DEFAULT_TEMA, ...tema };
  if (colorTexto) colorTexto.value = t.colortexto;
  if (colorTitulo) colorTitulo.value = t.colortitulo;
  if (colorPrecio) colorPrecio.value = t.colorprecio;
  if (colorBoton) colorBoton.value = t.colorboton;
  if (colorBotonTexto) colorBotonTexto.value = t.colorbotontexto;
  const colorComercioVal = t.colorComercio || DEFAULT_TEMA.colorComercio;
  const colorMenuVal = t.colorMenu || DEFAULT_TEMA.colorMenu;
  if (colorNombre) colorNombre.value = colorComercioVal;
  if (colorMenuWord) colorMenuWord.value = colorMenuVal;
  if (overlayOscuro) overlayOscuro.value = t.overlayoscuro;
  if (pdfUrl) pdfUrl.value = t.pdfurl || '';
  const { hex: pdfHex, alpha: pdfAlpha } = parseColorToHexAndAlpha(t.colorBotonPDF, '#2563eb', 0.8);
  if (colorBotonPdf) colorBotonPdf.value = pdfHex;
  if (opacidadBotonPdf) opacidadBotonPdf.value = Math.round(pdfAlpha * 100);
  if (backgroundColor) backgroundColor.value = t.backgroundcolor || '#ffffff';
  if (textoMenu) textoMenu.value = t.textomenu || 'Menú';
  const nombreShadowParts = parseShadowParts(t.nombre_shadow, DEFAULT_TEMA.nombre_shadow_color);
  if (nombreShadow) nombreShadow.value = nombreShadowParts.offsets || '';
  if (nombreShadowColor) nombreShadowColor.value = nombreShadowParts.color || DEFAULT_TEMA.nombre_shadow_color;
  const menuShadowParts = parseShadowParts(t.menu_shadow, DEFAULT_TEMA.menu_shadow_color);
  if (menuShadow) menuShadow.value = menuShadowParts.offsets || '';
  if (menuShadowColor) menuShadowColor.value = menuShadowParts.color || DEFAULT_TEMA.menu_shadow_color;
  if (itemBgColor) itemBgColor.value = t.item_bg_color || DEFAULT_TEMA.item_bg_color;
  if (itemOverlay) itemOverlay.value = t.item_overlay ?? DEFAULT_TEMA.item_overlay;
  const alignVal = (t.productoAlign || DEFAULT_TEMA.productoAlign || 'left').toLowerCase();
  if (itemAlignLeft && itemAlignCenter) {
    itemAlignCenter.checked = alignVal === 'center';
    itemAlignLeft.checked = !itemAlignCenter.checked;
  }
  if (hideNombre) hideNombre.checked = !!t.ocultar_nombre;
  if (hideMenuWord) hideMenuWord.checked = !!t.ocultar_menu;

  portadaUrl = t.portadaimagen || '';
  const portadaPublic = portadaUrl?.startsWith('http') ? portadaUrl : getPublicCoverUrl(portadaUrl);
  if (previewPortada) {
    if (portadaPublic) {
      previewPortada.src = cacheBust(portadaPublic);
      previewPortada.classList.remove('hidden');
    } else {
      previewPortada.src = '';
      previewPortada.classList.add('hidden');
    }
  }

  backgroundUrl = t.backgroundimagen || '';
  const bgPublic = backgroundUrl?.startsWith('http') ? backgroundUrl : getPublicCoverUrl(backgroundUrl);
  if (previewBackground) {
    if (bgPublic) {
      previewBackground.src = cacheBust(bgPublic);
      previewBackground.classList.remove('hidden');
    } else {
      previewBackground.src = '';
      previewBackground.classList.add('hidden');
    }
  }

  fuentesSeleccionadas.body =
    (t.fontbodyfamily && { name: t.fontbodyfamily, url: t.fontbodyurl }) || fuentesSeleccionadas.body;
  fuentesSeleccionadas.title =
    (t.fonttitlefamily && { name: t.fonttitlefamily, url: t.fonttitleurl }) || fuentesSeleccionadas.title;
  fuentesSeleccionadas.nombre =
    (t.fontnombrefamily && { name: t.fontnombrefamily, url: t.fontnombreurl }) || fuentesSeleccionadas.nombre;
  fuentesSeleccionadas.menu =
    (t.fontmenuwordfamily && { name: t.fontmenuwordfamily, url: t.fontmenuwordurl }) || fuentesSeleccionadas.menu;
  fuentesSeleccionadas.secciondesc =
    (t.seccion_desc_font_family && { name: t.seccion_desc_font_family, url: t.seccion_desc_font_url }) ||
    fuentesSeleccionadas.secciondesc;
  renderFontOptions();
  aplicarFuentePorRol('body', fuentesSeleccionadas.body);
  aplicarFuentePorRol('title', fuentesSeleccionadas.title);
  aplicarFuentePorRol('nombre', fuentesSeleccionadas.nombre);
  aplicarFuentePorRol('menu', fuentesSeleccionadas.menu);
  aplicarFuentePorRol('secciondesc', fuentesSeleccionadas.secciondesc);

  if (fontBodySize) fontBodySize.value = t.fontbody_size ?? DEFAULT_TEMA.fontbody_size;
  if (fontTitleSize) fontTitleSize.value = t.fonttitle_size ?? DEFAULT_TEMA.fonttitle_size;
  if (nombreFontSize) nombreFontSize.value = t.nombre_font_size ?? DEFAULT_TEMA.nombre_font_size;
  if (menuFontSize) menuFontSize.value = t.menu_font_size ?? DEFAULT_TEMA.menu_font_size;
  if (fontSeccionDescSize) fontSeccionDescSize.value = t.seccion_desc_font_size ?? DEFAULT_TEMA.seccion_desc_font_size;
  if (colorSeccionDesc) colorSeccionDesc.value = t.seccion_desc_color ?? DEFAULT_TEMA.seccion_desc_color;

  if (nombreStrokeWidth) nombreStrokeWidth.value = t.nombre_stroke_width ?? 0;
  if (nombreStrokeColor) nombreStrokeColor.value = t.nombre_stroke_color ?? '#000000';
  if (nombreShadow) nombreShadow.value = t.nombre_shadow ?? '';
  if (menuStrokeWidth) menuStrokeWidth.value = t.menu_stroke_width ?? 0;
  if (menuStrokeColor) menuStrokeColor.value = t.menu_stroke_color ?? '#000000';
  if (menuShadow) menuShadow.value = t.menu_shadow ?? '';
  if (titulosStrokeWidth) titulosStrokeWidth.value = t.titulos_stroke_width ?? 0;
  if (titulosStrokeColor) titulosStrokeColor.value = t.titulos_stroke_color ?? '#000000';
  if (titulosShadow) titulosShadow.value = t.titulos_shadow ?? '';
  if (botonStrokeWidth) botonStrokeWidth.value = t.boton_stroke_width ?? 0;
  if (botonStrokeColor) botonStrokeColor.value = t.boton_stroke_color ?? '#000000';
  if (botonShadow) botonShadow.value = t.boton_shadow ?? '';

  aplicarTemaEnPreview(t);
}

function leerTemaDesdeInputs() {
  const nombreOffsets = sanitizeOffsets(nombreShadow?.value || '');
  const menuOffsets = sanitizeOffsets(menuShadow?.value || '');
  return {
    colortexto: colorTexto?.value || DEFAULT_TEMA.colortexto,
    colortitulo: colorTitulo?.value || DEFAULT_TEMA.colortitulo,
    colorprecio: colorPrecio?.value || DEFAULT_TEMA.colorprecio,
    colorboton: colorBoton?.value || DEFAULT_TEMA.colorboton,
    colorbotontexto: colorBotonTexto?.value || DEFAULT_TEMA.colorbotontexto,
    colorComercio: colorNombre?.value || DEFAULT_TEMA.colorComercio,
    colorMenu: colorMenuWord?.value || DEFAULT_TEMA.colorMenu,
    overlayoscuro: Number(overlayOscuro?.value || DEFAULT_TEMA.overlayoscuro),
    pdfurl: pdfUrl?.value?.trim() || '',
    colorBotonPDF: buildRgba(colorBotonPdf?.value || '#2563eb', (Number(opacidadBotonPdf?.value ?? 80) / 100) || 0.8),
    portadaimagen: portadaUrl || '',
    backgroundimagen: backgroundUrl || '',
    backgroundcolor: backgroundColor?.value || DEFAULT_TEMA.backgroundcolor,
    textomenu: textoMenu?.value?.trim() || DEFAULT_TEMA.textomenu,
    ocultar_nombre: !!hideNombre?.checked,
    ocultar_menu: !!hideMenuWord?.checked,
    fontbodyfamily: fuentesSeleccionadas.body?.name || temaActual.fontbodyfamily || null,
    fontbodyurl: fuentesSeleccionadas.body?.url || temaActual.fontbodyurl || null,
    fontbody_size: Number(fontBodySize?.value) || DEFAULT_TEMA.fontbody_size,
    fonttitlefamily: fuentesSeleccionadas.title?.name || temaActual.fonttitlefamily || null,
    fonttitleurl: fuentesSeleccionadas.title?.url || temaActual.fonttitleurl || null,
    fonttitle_size: Number(fontTitleSize?.value) || DEFAULT_TEMA.fonttitle_size,
    fontnombrefamily: fuentesSeleccionadas.nombre?.name || temaActual.fontnombrefamily || null,
    fontnombreurl: fuentesSeleccionadas.nombre?.url || temaActual.fontnombreurl || null,
    nombre_font_size: Number(nombreFontSize?.value) || DEFAULT_TEMA.nombre_font_size,
    fontmenuwordfamily: fuentesSeleccionadas.menu?.name || temaActual.fontmenuwordfamily || null,
    fontmenuwordurl: fuentesSeleccionadas.menu?.url || temaActual.fontmenuwordurl || null,
    menu_font_size: Number(menuFontSize?.value) || DEFAULT_TEMA.menu_font_size,
    nombre_shadow: `${nombreOffsets} ${nombreShadowColor?.value || DEFAULT_TEMA.nombre_shadow_color}`.trim(),
    nombre_stroke_width: Number(nombreStrokeWidth?.value || DEFAULT_TEMA.nombre_stroke_width),
    nombre_stroke_color: nombreStrokeColor?.value || DEFAULT_TEMA.nombre_stroke_color,
    menu_shadow: `${menuOffsets} ${menuShadowColor?.value || DEFAULT_TEMA.menu_shadow_color}`.trim(),
    menu_stroke_width: Number(menuStrokeWidth?.value || DEFAULT_TEMA.menu_stroke_width),
    menu_stroke_color: menuStrokeColor?.value || DEFAULT_TEMA.menu_stroke_color,
    titulos_shadow: titulosShadow?.value || DEFAULT_TEMA.titulos_shadow,
    titulos_stroke_width: Number(titulosStrokeWidth?.value || DEFAULT_TEMA.titulos_stroke_width),
    titulos_stroke_color: titulosStrokeColor?.value || DEFAULT_TEMA.titulos_stroke_color,
    boton_shadow: botonShadow?.value || DEFAULT_TEMA.boton_shadow,
    boton_stroke_width: Number(botonStrokeWidth?.value || DEFAULT_TEMA.boton_stroke_width),
    boton_stroke_color: botonStrokeColor?.value || DEFAULT_TEMA.boton_stroke_color,
    item_bg_color: itemBgColor?.value || DEFAULT_TEMA.item_bg_color,
    item_overlay: Number(itemOverlay?.value || DEFAULT_TEMA.item_overlay),
    productoAlign: itemAlignCenter?.checked ? 'center' : 'left',
    seccion_desc_font_family: fuentesSeleccionadas.secciondesc?.name || temaActual.seccion_desc_font_family || null,
    seccion_desc_font_url: fuentesSeleccionadas.secciondesc?.url || temaActual.seccion_desc_font_url || null,
    seccion_desc_font_size: Number(fontSeccionDescSize?.value) || DEFAULT_TEMA.seccion_desc_font_size,
    seccion_desc_color: colorSeccionDesc?.value || DEFAULT_TEMA.seccion_desc_color,
  };
}

async function cargarTema() {
  if (!idComercio) return;
  try {
    const { data, error } = await supabase
      .from('menu_tema')
      .select('colortexto,colortitulo,colorprecio,colorboton,colorbotontexto,"colorComercio","colorMenu","productoAlign",overlayoscuro,pdfurl,"colorBotonPDF",portadaimagen,backgroundimagen,backgroundcolor,textomenu,ocultar_nombre,ocultar_menu,fontbodyfamily,fontbodyurl,fontbody_size,fonttitlefamily,fonttitleurl,fonttitle_size,fontnombrefamily,fontnombreurl,nombre_font_size,fontmenuwordfamily,fontmenuwordurl,menu_font_size,nombre_shadow,nombre_stroke_width,nombre_stroke_color,menu_shadow,menu_stroke_width,menu_stroke_color,titulos_shadow,titulos_stroke_width,titulos_stroke_color,boton_shadow,boton_stroke_width,boton_stroke_color,item_bg_color,item_overlay,seccion_desc_font_family,seccion_desc_font_url,seccion_desc_font_size,seccion_desc_color')
      .eq('idcomercio', idComercio)
      .maybeSingle();

    if (error) {
      console.warn('No se pudo cargar tema:', error);
    }

    temaActual = data || {};
  } catch (err) {
    console.warn('Error inesperado al cargar tema, usando defaults', err);
    temaActual = { ...DEFAULT_TEMA };
  }
  rellenarInputsTema(temaActual);
  if (isDev) console.log('[adminMenu] Tema cargado', { idComercio, tema: temaActual, pdf: !!temaActual.pdfurl, portada: !!temaActual.portadaimagen, background: !!temaActual.backgroundimagen });
}

async function uploadAsset(file, prefix, nameBase) {
  const ext = file.name.split('.').pop();
  const path = `${prefix}/${idComercio}/${nameBase}.${ext}`;
  const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '0',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data?.publicUrl || '' };
}

async function guardarTema() {
  if (!idComercio) return;
  setLoading(btnGuardarTema, true);
  const tema = leerTemaDesdeInputs();
  const payload = {
    idcomercio: parseInt(idComercio, 10),
    ...tema,
  };

  if (isDev) console.log('[adminMenu] Payload a guardar:', {
    ...payload,
    log_shadows: {
      nombre_shadow: payload.nombre_shadow,
      menu_shadow: payload.menu_shadow,
      nombre_stroke_width: payload.nombre_stroke_width,
      nombre_stroke_color: payload.nombre_stroke_color,
      menu_stroke_width: payload.menu_stroke_width,
      menu_stroke_color: payload.menu_stroke_color,
    },
  });

  const { error } = await supabase
    .from('menu_tema')
    .upsert(payload, { onConflict: 'idcomercio', defaultToNull: false })
    .select()
    .single();
  if (error) {
    console.error('Error guardando diseño:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      raw: error,
    });
    alert('No se pudo guardar el diseño');
    setLoading(btnGuardarTema, false);
    return;
  }

  // Replicar a sucursales seleccionadas
  if (tieneSucursales && listaSucursales) {
    const seleccionados = Array.from(
      listaSucursales.querySelectorAll('input[type="checkbox"]:checked')
    )
      .map((cb) => parseInt(cb.value, 10))
      .filter((id) => Number.isFinite(id));

    if (seleccionados.length > 0) {
      const payloadSucursales = seleccionados.map((id) => ({
        ...tema,
        idcomercio: id,
      }));
      const { error: errSuc } = await supabase
        .from('menu_tema')
        .upsert(payloadSucursales, { onConflict: 'idcomercio', defaultToNull: false });
      if (errSuc) {
        console.warn('No se pudo replicar a sucursales:', errSuc);
        alert('Diseño guardado. No se pudo replicar en algunas sucursales.');
      } else if (isDev) {
        console.log('[adminMenu] Tema replicado en sucursales', payloadSucursales.map((p) => p.idcomercio));
        alert('Diseño guardado y replicado en sucursales seleccionadas.');
      }
    }
  }

  await cargarFuenteGuardada();
  await cargarTema();
  aplicarTemaEnPreview(temaActual);

  alert('Diseño guardado correctamente.');
  if (isDev) console.log('[adminMenu] Diseño guardado', { idComercio, tema: temaActual });
  setLoading(btnGuardarTema, false);
}

async function cargarDatos() {
  if (!idComercio) return alert('ID de comercio no encontrado en la URL');

  await cargarPlanComercio();

  const { data: comercio, error } = await supabase
    .from('Comercios')
    .select('id, nombre, tieneSucursales')
    .eq('id', idComercio)
    .single();

  if (error || !comercio) {
    console.error('Error al cargar comercio', error);
    return alert('Comercio no encontrado');
  }

  nombreEl.textContent = comercio.nombre;
  linkLogo.href = `${getPublicBase()}perfilComercio.html?id=${idComercio}`;
  tieneSucursales = comercio.tieneSucursales === true;
  if (tieneSucursales) {
    await cargarSucursalesRelacionadas();
  } else if (compartirSucursales) {
    compartirSucursales.classList.add('hidden');
  }

  const { data: logoData } = await supabase
    .from('imagenesComercios')
    .select('imagen')
    .eq('idComercio', parseInt(idComercio, 10))
    .eq('logo', true)
    .maybeSingle();

  if (logoData?.imagen) {
    logoEl.src = `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${logoData.imagen}`;
  }

  await cargarSecciones();
  await cargarFuenteGuardada();
  await cargarTema();
  renderFontOptions();
  await refreshCloverBar();
}

async function cargarSucursalesRelacionadas() {
  if (!listaSucursales || !compartirSucursales) return;
  listaSucursales.innerHTML = '';
  compartirSucursales.classList.add('hidden');

  const { data: relaciones, error } = await supabase
    .from('ComercioSucursales')
    .select('comercio_id, sucursal_id')
    .or(`comercio_id.eq.${idComercio},sucursal_id.eq.${idComercio}`);

  if (error) {
    console.warn('No se pudieron cargar sucursales relacionadas:', error);
    return;
  }

  const idsRelacionados = (relaciones || []).flatMap((r) => [r.comercio_id, r.sucursal_id]);
  const idsUnicos = [...new Set(idsRelacionados.filter((id) => id !== parseInt(idComercio, 10)))];
  if (idsUnicos.length === 0) return;

  const { data: sucursales, error: errSuc } = await supabase
    .from('Comercios')
    .select('id, nombre, nombreSucursal')
    .in('id', idsUnicos);

  if (errSuc) {
    console.warn('No se pudieron obtener detalles de sucursales:', errSuc);
    return;
  }

  if (!sucursales || sucursales.length === 0) return;

  sucursales.forEach((sucursal) => {
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = sucursal.id;
    checkbox.className = 'accent-blue-600';

    const span = document.createElement('span');
    span.textContent = sucursal.nombreSucursal || sucursal.nombre || `Sucursal ${sucursal.id}`;

    label.appendChild(checkbox);
    label.appendChild(span);
    listaSucursales.appendChild(label);
  });

  compartirSucursales.classList.remove('hidden');
}

function crearProductoCard(idSeccion, producto) {
  const contenedor = document.createElement('div');
  contenedor.className = 'bg-white border rounded p-3 flex justify-between gap-3 hover:shadow-sm transition cursor-pointer';
  contenedor.addEventListener('click', (e) => {
    e.stopPropagation();
    window.abrirEditarProducto(idSeccion, producto);
  });

  const info = document.createElement('div');
  info.className = 'flex gap-3 items-start';

  if (producto?.imagen) {
    const img = document.createElement('img');
    img.src = `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${producto.imagen}`;
    img.alt = producto.nombre || 'Producto';
    img.className = 'w-14 h-14 object-cover rounded';
    info.appendChild(img);
  }

  const texto = document.createElement('div');
  texto.className = 'space-y-1 text-left';

  const nombre = document.createElement('p');
  nombre.className = 'text-sm font-semibold text-gray-900';
  nombre.textContent = producto?.nombre || 'Sin nombre';

  const descripcion = document.createElement('p');
  descripcion.className = 'text-xs text-gray-600';
  descripcion.textContent = producto?.descripcion || 'Sin descripción';

  texto.appendChild(nombre);
  texto.appendChild(descripcion);
  info.appendChild(texto);

  const acciones = document.createElement('div');
  acciones.className = 'flex flex-col items-end gap-2';

  const precio = document.createElement('p');
  precio.className = 'text-sm font-semibold text-blue-600';
  const precioNumber = Number.parseFloat(producto?.precio);
  precio.textContent = Number.isFinite(precioNumber) ? `$${precioNumber.toFixed(2)}` : '';

  const eliminar = document.createElement('button');
  eliminar.type = 'button';
  eliminar.className = 'text-xs text-red-600 hover:text-red-700 underline';
  eliminar.textContent = 'Eliminar';
  eliminar.addEventListener('click', (e) => {
    e.stopPropagation();
    window.eliminarProducto(producto.id, producto.nombre, producto.imagen ?? '');
  });

  acciones.appendChild(precio);
  acciones.appendChild(eliminar);

  contenedor.appendChild(info);
  contenedor.appendChild(acciones);

  return contenedor;
}

function handleDragStart(event, wrapper) {
  draggingSeccion = wrapper;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', wrapper.dataset.idSeccion);
  wrapper.classList.add('opacity-60', 'ring-2', 'ring-blue-200');
}

function handleDragOver(event) {
  event.preventDefault();
  if (!draggingSeccion) return;
  const target = event.currentTarget;
  if (target === draggingSeccion) return;
  const rect = target.getBoundingClientRect();
  const shouldInsertAfter = event.clientY - rect.top > rect.height / 2;
  if (shouldInsertAfter) {
    target.after(draggingSeccion);
  } else {
    target.before(draggingSeccion);
  }
}

function handleDragEnd() {
  if (draggingSeccion) {
    draggingSeccion.classList.remove('opacity-60', 'ring-2', 'ring-blue-200');
  }
  draggingSeccion = null;
}

async function guardarNuevoOrdenSecciones() {
  if (guardandoOrden) return;
  const items = Array.from(seccionesEl?.querySelectorAll('[data-id-seccion]') || []);
  if (items.length === 0) return;

  const updates = items
    .map((item, idx) => ({
      id: parseInt(item.dataset.idSeccion, 10),
      orden: idx + 1,
    }))
    .filter((i) => Number.isFinite(i.id));

  // Refrescar numeración en la UI inmediatamente
  updates.forEach(({ id, orden }) => {
    const item = seccionesEl.querySelector(`[data-id-seccion="${id}"]`);
    const ordenLabel = item?.querySelector('[data-orden-label]');
    if (ordenLabel) ordenLabel.textContent = `#${orden}`;
    const infoOrden = item?.querySelector('[data-info-orden]');
    if (infoOrden) infoOrden.textContent = `${infoOrden.dataset.productos || 0} productos`;
  });

  guardandoOrden = true;
  try {
    const resultados = await Promise.all(
      updates.map(({ id, orden }) => supabase.from('menus').update({ orden }).eq('id', id))
    );
    const fallo = resultados.find((r) => r.error)?.error;
    if (fallo) throw fallo;
    if (isDev) console.log('[adminMenu] Orden de secciones actualizado', updates);
    showToast('Orden actualizado', 'success');
  } catch (err) {
    console.error('Error actualizando orden de secciones:', err);
    showToast('No se pudo actualizar el orden. Intenta de nuevo.', 'error');
  } finally {
    guardandoOrden = false;
    await cargarSecciones();
  }
}

function crearSeccionAccordion(seccion, productos = [], expandir = false) {
  const totalProductos = productos?.length || 0;
  const wrapper = document.createElement('article');
  wrapper.className = 'border border-gray-200 rounded-lg shadow-sm overflow-hidden bg-white cursor-grab';
  wrapper.dataset.idSeccion = seccion.id;
  const bodyId = `seccion-body-${seccion.id}`;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'w-full flex justify-between items-center px-4 py-3 text-left hover:bg-gray-50 transition';
  toggle.setAttribute('aria-expanded', expandir ? 'true' : 'false');
  toggle.setAttribute('aria-controls', bodyId);

  const izquierda = document.createElement('div');
  izquierda.className = 'flex flex-col';

  const titulo = document.createElement('span');
  titulo.className = 'text-base font-semibold text-gray-900';
  titulo.textContent = seccion.titulo;

  const subtituloTexto = (seccion.subtitulo || '').trim();
  if (subtituloTexto) {
    const subtitulo = document.createElement('span');
    subtitulo.className = 'text-sm text-gray-600 leading-tight';
    subtitulo.textContent = subtituloTexto;
    izquierda.appendChild(subtitulo);
  }

  const meta = document.createElement('span');
  meta.className = 'text-xs text-gray-500';
  meta.dataset.infoOrden = 'true';
  meta.dataset.productos = totalProductos;
  meta.textContent = `${totalProductos} producto${totalProductos === 1 ? '' : 's'}`;

  izquierda.appendChild(titulo);
  izquierda.appendChild(meta);

  const derecha = document.createElement('div');
  derecha.className = 'flex items-center gap-3';

  const estado = document.createElement('span');
  estado.className = `text-xs px-2 py-1 rounded-full ${seccion.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`;
  estado.textContent = seccion.activo ? 'Activa' : 'Inactiva';

  const handle = document.createElement('div');
  handle.className = 'flex items-center gap-2 text-gray-400 hover:text-gray-600 cursor-grab drag-handle select-none px-2 py-1 rounded hover:bg-gray-100';
  handle.title = 'Arrastra para reordenar';
  handle.setAttribute('aria-label', 'Arrastrar para reordenar sección');
  handle.setAttribute('draggable', 'true');

  const iconoGrip = document.createElement('i');
  iconoGrip.className = 'fa-solid fa-grip-vertical text-lg';

  const ordenBadge = document.createElement('span');
  ordenBadge.className = 'text-xs font-semibold text-gray-700 px-2 py-1 bg-gray-100 rounded';
  ordenBadge.dataset.ordenLabel = 'true';
  ordenBadge.textContent = `#${seccion.orden}`;

  handle.appendChild(iconoGrip);
  handle.appendChild(ordenBadge);

  const chevron = document.createElement('i');
  chevron.className = 'fa-solid fa-chevron-down text-gray-500 transition-transform duration-200';

  derecha.appendChild(estado);
  derecha.appendChild(handle);
  derecha.appendChild(chevron);

  toggle.appendChild(izquierda);
  toggle.appendChild(derecha);

  const body = document.createElement('div');
  body.className = 'border-t border-gray-200 bg-gray-50 hidden';
  body.id = bodyId;

  const contenido = document.createElement('div');
  contenido.className = 'p-4 space-y-3';

  const acciones = document.createElement('div');
  acciones.className = 'flex items-center justify-between gap-2 flex-wrap';

  const copy = document.createElement('p');
  copy.className = 'text-sm text-gray-600';
  copy.textContent = 'Abre la sección para editar productos o ajustes. Arrastra el grip para reordenar.';

  const botones = document.createElement('div');
  botones.className = 'flex gap-2';

  const btnEditarSeccion = document.createElement('button');
  btnEditarSeccion.type = 'button';
  btnEditarSeccion.className = 'px-3 py-2 rounded border border-gray-300 text-sm hover:bg-gray-100';
  btnEditarSeccion.textContent = 'Editar sección';
  btnEditarSeccion.addEventListener('click', (e) => {
    e.stopPropagation();
    window.editarSeccion(
      seccion.id,
      seccion.titulo,
      seccion.orden,
      seccion.activo,
      seccion.subtitulo || '',
      seccion.descripcion || '',
      seccion.no_traducir || false
    );
  });

  const btnAgregarProducto = document.createElement('button');
  btnAgregarProducto.type = 'button';
  btnAgregarProducto.className = 'px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700';
  btnAgregarProducto.textContent = '+ Producto';
  btnAgregarProducto.addEventListener('click', (e) => {
    e.stopPropagation();
    window.abrirEditarProducto(seccion.id);
  });

  botones.appendChild(btnEditarSeccion);
  botones.appendChild(btnAgregarProducto);
  acciones.appendChild(copy);
  acciones.appendChild(botones);

  const listaProductos = document.createElement('div');
  listaProductos.className = 'space-y-2';

  if (!productos || productos.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'text-sm text-gray-500 bg-white border rounded p-3 flex items-center justify-between';
    vacio.textContent = 'Aún no hay productos en esta sección.';
    const ctaProd = document.createElement('button');
    ctaProd.type = 'button';
    ctaProd.className = 'ml-2 bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700';
    ctaProd.textContent = '+ Producto';
    ctaProd.addEventListener('click', (e) => {
      e.stopPropagation();
      window.abrirEditarProducto(seccion.id);
    });
    vacio.appendChild(ctaProd);
    listaProductos.appendChild(vacio);
  } else {
    productos.forEach((producto) => {
      listaProductos.appendChild(crearProductoCard(seccion.id, producto));
    });
  }

  contenido.appendChild(acciones);
  contenido.appendChild(listaProductos);
  body.appendChild(contenido);

  toggle.addEventListener('click', () => {
    const estabaOculto = body.classList.contains('hidden');
    body.classList.toggle('hidden');
    chevron.classList.toggle('rotate-180', estabaOculto);
    toggle.setAttribute('aria-expanded', estabaOculto ? 'true' : 'false');
  });

  handle.addEventListener('click', (e) => e.stopPropagation());
  handle.addEventListener('dragstart', (e) => handleDragStart(e, wrapper));
  handle.addEventListener('dragend', handleDragEnd);
  wrapper.addEventListener('dragover', handleDragOver);
  wrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    handleDragEnd();
    guardarNuevoOrdenSecciones();
  });

  if (expandir) {
    body.classList.remove('hidden');
    chevron.classList.add('rotate-180');
  }

  wrapper.appendChild(toggle);
  wrapper.appendChild(body);
  return wrapper;
}

async function cargarSecciones() {
  const { data, error } = await supabase
    .from('menus')
    .select('id, titulo, descripcion, subtitulo, orden, activo, idComercio, no_traducir')
    .eq('idComercio', idComercio)
    .order('orden', { ascending: true });

  if (error) {
    console.error('Error cargando secciones:', error);
    return alert('Error cargando secciones');
  }

  seccionesEl.innerHTML = '';
  if (!data || data.length === 0) {
    seccionesEl.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'border border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-600 bg-gray-50';
    empty.innerHTML = `
      <p class="font-semibold text-gray-700 mb-2">Aún no hay secciones creadas.</p>
      <p class="mb-4">Crea tu primera sección para añadir productos.</p>
    `;
    const cta = document.createElement('button');
    cta.className = 'bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700';
    cta.textContent = '+ Nueva Sección';
    cta.onclick = () => btnAgregarSeccion?.click();
    empty.appendChild(cta);
    seccionesEl.appendChild(empty);
    return;
  }

  let primera = true;
  for (const seccion of data) {
    const { data: productos } = await supabase
      .from('productos')
      .select('id, nombre, descripcion, precio, imagen, orden, activo, no_traducir_nombre, idMenu')
      .eq('idMenu', seccion.id)
      .order('orden', { ascending: true });

    const card = crearSeccionAccordion(seccion, productos || [], false);
    seccionesEl.appendChild(card);
    primera = false;
  }
}

window.editarSeccion = (id, titulo, orden, activo, subtitulo = '', descripcion = '', noTraducirTitulo = false) => {
  editandoId = id;
  inputTitulo.value = titulo;
  if (inputSubtitulo) inputSubtitulo.value = subtitulo || '';
  if (menuDescripcion) menuDescripcion.value = descripcion || '';
  if (menuNoTraducirTitulo) menuNoTraducirTitulo.checked = !!noTraducirTitulo;
  inputOrden.value = orden;
  inputActivo.checked = activo;
  modal.classList.remove('hidden');
};

btnAgregarSeccion.onclick = () => {
  editandoId = null;
  inputTitulo.value = '';
  if (inputSubtitulo) inputSubtitulo.value = '';
  if (menuDescripcion) menuDescripcion.value = '';
  if (menuNoTraducirTitulo) menuNoTraducirTitulo.checked = false;
  inputOrden.value = 1;
  inputActivo.checked = true;
  modal.classList.remove('hidden');
};

btnCancelarSeccion.onclick = () => {
  modal.classList.add('hidden');
};

btnGuardarSeccion.onclick = async () => {
  const nueva = {
    titulo: inputTitulo.value.trim(),
    subtitulo: inputSubtitulo?.value.trim() || '',
    descripcion: menuDescripcion?.value.trim() || '',
    no_traducir: menuNoTraducirTitulo?.checked || false,
    orden: parseInt(inputOrden.value),
    activo: inputActivo.checked,
    idComercio: parseInt(idComercio),
  };

  if (!nueva.titulo) return alert('El título es requerido');

  try {
    if (editandoId) {
      const { error } = await supabase.from('menus').update(nueva).eq('id', editandoId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('menus').insert(nueva);
      if (error) throw error;
    }
  } catch (err) {
    console.error('❌ Error guardando sección:', err);
    return alert('Error al guardar la sección del menú');
  }

  modal.classList.add('hidden');
  await cargarSecciones();
};

// --------- Clover Integration (MVP-B) ----------

async function obtenerConexionClover() {
  const { data, error } = await supabase
    .from('clover_conexiones')
    .select('idComercio, clover_merchant_id, access_token')
    .eq('idComercio', idComercio)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function contarProductosImportados() {
  const { count, error } = await supabase
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq('idComercio', idComercio);

  if (!error) return count ?? 0;

  const msg = (error?.message || '').toLowerCase();
  const missingIdComercio = msg.includes('idcomercio') && msg.includes('does not exist');
  if (!missingIdComercio) throw error;

  const { data: menus, error: menusErr } = await supabase
    .from('menus')
    .select('id')
    .eq('idComercio', idComercio);
  if (menusErr) throw menusErr;

  const menuIds = (menus || []).map((m) => m.id).filter(Boolean);
  if (!menuIds.length) return 0;

  const { count: prodCount, error: prodErr } = await supabase
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .in('idMenu', menuIds);
  if (prodErr) throw prodErr;
  return prodCount ?? 0;
}

function renderCloverBar(state) {
  if (!cloverBar) return;
  const connected = state?.connected === true;

  cloverBar.innerHTML = `
    <div class="w-[90%] max-w-3xl min-w-[260px] mx-auto bg-white border rounded-2xl shadow-sm px-3 py-2 overflow-hidden">
      <div class="flex items-center justify-between gap-2 flex-nowrap whitespace-nowrap">
        <div class="flex items-center gap-2 flex-nowrap min-w-0">
          <img src="${CLOVER_LOGO_URL}" alt="Clover" class="h-8 max-h-[32px] w-auto object-contain max-w-[108px] shrink-0" />
        </div>
        <div class="flex items-center gap-2 flex-nowrap min-w-0">
          ${connected
            ? `
              <button type="button" class="bg-[#218800] text-white px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap cursor-not-allowed" disabled>
                <i class="fas fa-check-square mr-2"></i><span class="truncate max-w-[110px] sm:max-w-none inline-block align-bottom">Conectado</span>
              </button>
              <button data-clover-action="sync" type="button" class="bg-[#b6fa70] text-[#218800] px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap">
                <i class="fas fa-sync mr-2"></i><span class="truncate max-w-[110px] sm:max-w-none inline-block align-bottom">Sincronizar</span>
              </button>
            `
            : `<button data-clover-action="connect" type="button" class="bg-[#808c7c] text-white px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap">
                <span class="truncate max-w-[150px] sm:max-w-none inline-block align-bottom">Conectar con Clover</span>
              </button>`
          }
        </div>
      </div>
    </div>
  `;

  const connectBtn = cloverBar.querySelector('[data-clover-action="connect"]');
  if (connectBtn) {
    connectBtn.addEventListener('click', iniciarOauthClover);
  }

  const syncBtn = cloverBar.querySelector('[data-clover-action="sync"]');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      const originalHtml = syncBtn.innerHTML;
      syncBtn.disabled = true;
      syncBtn.classList.add('opacity-70', 'cursor-not-allowed');
      syncBtn.innerHTML = "<i class=\"fas fa-spinner fa-spin mr-2\"></i>Sincronizando...";
      try {
        const ok = await lanzarImportacionClover();
        if (ok) {
          await refreshCloverBar();
          return;
        }
      } catch (err) {
        const message = err?.message || JSON.stringify(err);
        alert(message);
      }
      syncBtn.disabled = false;
      syncBtn.classList.remove('opacity-70', 'cursor-not-allowed');
      syncBtn.innerHTML = originalHtml;
    });
  }
}

async function refreshCloverBar() {
  if (!cloverBar) return;
  if (!planPermiteOrdenes) {
    bloquearCloverPorPlan();
    return;
  }
  try {
    const conn = await obtenerConexionClover();
    const accessToken = (conn?.access_token || "").trim();
    const merchantId = (conn?.clover_merchant_id || "").trim();
    const isConnected = accessToken.length > 0 && merchantId.length > 0;
    if (!isConnected) {
      renderCloverBar({ connected: false });
      return;
    }
    renderCloverBar({ connected: true });
  } catch (err) {
    console.error('[Clover] estado error', err);
    const rawMessage = err?.message ?? '';
    const fallback = rawMessage ? '' : (err && typeof err === 'object' ? JSON.stringify(err) : '');
    const candidate = (rawMessage || fallback || '').trim();
    const isEmptyBody = candidate === '{"message":""}';
    if (!candidate || isEmptyBody) {
      console.warn('[Clover] estado error vacío', err);
    } else {
      alert(candidate);
    }
    renderCloverBar({ connected: false });
  }
}

async function lanzarImportacionClover() {
  if (!idComercio) {
    alert('ID de comercio no encontrado en la URL');
    return false;
  }
  if (!planPermiteOrdenes) {
    alert('Las órdenes Clover están disponibles solo en Findixi Premium.');
    return false;
  }
  try {
    const url = `${FUNCTIONS_BASE}/clover-import-menu?idComercio=${idComercio}`;
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      alert('Debes iniciar sesión para importar desde Clover.');
      window.location.href = "/comercio/login.html";
      return false;
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const json = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      if (resp.status === 401 && json?.needs_reconnect) {
        alert('La conexión con Clover expiró. Debes reconectar tu cuenta.');
        iniciarOauthClover();
        return false;
      }
      const message = json?.details?.message || json?.error || `No se pudo importar desde Clover (status ${resp.status})`;
      console.error('[Clover] import error', { status: resp.status, body: json });
      throw new Error(message);
    }

    if ((json?.menus ?? 0) === 0) {
      alert('Este comercio no tiene menús en Clover todavía.');
      return false;
    }

    const taxUrl = `${FUNCTIONS_BASE}/clover-sync-tax-rates?idComercio=${idComercio}`;
    try {
      const taxResp = await fetch(taxUrl, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!taxResp.ok) {
        const taxJson = await taxResp.json().catch(() => ({}));
        console.warn('[Clover] tax sync error', { status: taxResp.status, body: taxJson });
      }
    } catch (taxErr) {
      console.warn('[Clover] tax sync catch', taxErr);
    }

    alert(`Importación completada.\nSecciones: ${json.menus ?? 0}\nProductos: ${json.productos ?? 0}\nOpciones: ${json.opciones ?? 0}`);
    await cargarSecciones();
    return true;
  } catch (err) {
    const message = err?.message || JSON.stringify(err);
    console.error('[Clover] import catch', err);
    alert(message);
    return false;
  }
}

function iniciarOauthClover() {
  if (!idComercio) return alert('ID de comercio no encontrado');
  if (!planPermiteOrdenes) {
    alert('Las órdenes Clover están disponibles solo en Findixi Premium.');
    return;
  }
  const url = `${FUNCTIONS_BASE}/clover-oauth-start?idComercio=${idComercio}`;
  window.location.href = url;
}

// Producto
const modalProducto = document.getElementById('modalProducto');
const inputNombreProducto = document.getElementById('inputNombreProducto');
const inputDescripcionProducto = document.getElementById('inputDescripcionProducto');
const inputPrecioProducto = document.getElementById('inputPrecioProducto');
const inputOrdenProducto = document.getElementById('inputOrdenProducto');
const inputImagenProducto = document.getElementById('inputImagenProducto');
const previewImagenProducto = document.getElementById('previewImagenProducto');
const productoNoTraducirNombre = document.getElementById('productoNoTraducirNombre');
const btnCancelarProducto = document.getElementById('btnCancelarProducto');
const btnGuardarProducto = document.getElementById('btnGuardarProducto');
let productoImagenActual = '';

window.abrirEditarProducto = (idMenu, producto = null) => {
  idMenuActivo = idMenu;
  productoEditandoId = producto?.id || null;
  inputNombreProducto.value = producto?.nombre || '';
  inputDescripcionProducto.value = producto?.descripcion || '';
  inputPrecioProducto.value = producto?.precio || '';
  inputOrdenProducto.value = producto?.orden || 1;
  if (productoNoTraducirNombre) productoNoTraducirNombre.checked = !!producto?.no_traducir_nombre;
  inputImagenProducto.value = ''; // nunca prellena file input
  productoImagenActual = producto?.imagen || '';
  if (producto?.imagen) {
    previewImagenProducto.src = `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${producto.imagen}`;
    previewImagenProducto.classList.remove('hidden');
  } else {
    previewImagenProducto.src = '';
    previewImagenProducto.classList.add('hidden');
  }
  modalProducto.classList.remove('hidden');
};

window.abrirNuevoProducto = (idMenu) => {
  productoEditandoId = null;
  idMenuActivo = idMenu;
  inputNombreProducto.value = '';
  inputDescripcionProducto.value = '';
  inputPrecioProducto.value = '';
  inputOrdenProducto.value = 1;
  if (productoNoTraducirNombre) productoNoTraducirNombre.checked = false;
  previewImagenProducto.src = '';
  previewImagenProducto.classList.add('hidden');
  inputImagenProducto.value = '';
  productoImagenActual = '';
  modalProducto.classList.remove('hidden');

  // 🧼 Limpiar preview de imagen
  const preview = document.getElementById('previewImagenProducto');
  if (preview) {
    preview.src = '';
    preview.classList.add('hidden');
  }
};

window.eliminarProducto = async (idProducto, nombreProducto, rutaImagen = '') => {
  const confirmar = confirm(`¿Estás seguro de que deseas eliminar "${nombreProducto}"?`);
  if (!confirmar) return;

  // Elimina imagen si existe
  if (rutaImagen) {
    const { error: errorBorrado } = await supabase.storage
      .from('galeriacomercios')
      .remove([rutaImagen]);

    if (errorBorrado) {
      console.warn('No se pudo eliminar imagen:', errorBorrado);
    }
  }

  // Elimina producto
  const { error } = await supabase.from('productos').delete().eq('id', idProducto);
  if (error) {
    alert('Error al eliminar producto');
    console.error(error);
  } else {
    alert(`"${nombreProducto}" fue eliminado exitosamente.`);
    await cargarSecciones();
  }
};

btnCancelarProducto.onclick = () => {
  modalProducto.classList.add('hidden');
};

btnGuardarProducto.onclick = async () => {
  if (!idMenuActivo) {
    return alert('Selecciona una sección antes de guardar el producto.');
  }
  const nuevo = {
    nombre: inputNombreProducto.value.trim(),
    descripcion: inputDescripcionProducto.value.trim(),
    precio: parseFloat(inputPrecioProducto.value),
    orden: parseInt(inputOrdenProducto.value) || 1,
    activo: true,
    idMenu: parseInt(idMenuActivo, 10),
    no_traducir_nombre: productoNoTraducirNombre?.checked || false
  };

  if (!nuevo.nombre || isNaN(nuevo.precio)) {
    return alert('Nombre y precio son requeridos');
  }

  let productoId = productoEditandoId;

  try {
    if (productoId) {
      const { error } = await supabase.from('productos').update(nuevo).eq('id', productoId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('productos').insert(nuevo).select().single();
      if (error) throw error;
      productoId = data.id;
    }
  } catch (err) {
    console.error('Error guardando producto:', err);
    return alert('Error al guardar producto');
  }

  // Subir imagen
  const archivo = inputImagenProducto.files[0];
  if (archivo && productoId) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(archivo.type)) {
      alert('Formato de imagen no permitido. Usa JPG, PNG o WEBP.');
      return;
    }
    if (archivo.size > maxSize) {
      alert('La imagen supera los 5MB. Por favor sube una más liviana.');
      return;
    }

    const ext = archivo.name.split('.').pop();
    const nombreArchivo = `productos/${idComercio}/producto-${productoId}.${ext}`;

    if (productoImagenActual && productoImagenActual !== nombreArchivo) {
      await supabase.storage.from('galeriacomercios').remove([productoImagenActual]).catch(() => {});
    }

    const { error: errorSubida } = await supabase.storage
      .from('galeriacomercios')
      .upload(nombreArchivo, archivo, {
        upsert: true,
        contentType: archivo.type,
        cacheControl: '0'
      });

    if (errorSubida) {
      console.error('🛑 Error subiendo imagen:', errorSubida);
      alert('No se pudo subir la imagen del producto. Intenta de nuevo.');
      return;
    } else {
      await supabase
        .from('productos')
        .update({ imagen: nombreArchivo })
        .eq('id', productoId);
      productoImagenActual = nombreArchivo;
    }
  }

  modalProducto.classList.add('hidden');
  await cargarSecciones();
};

document.addEventListener('DOMContentLoaded', cargarDatos);

// Mostrar preview al seleccionar nueva imagen
inputImagenProducto.addEventListener('change', () => {
  const archivo = inputImagenProducto.files[0];
  const preview = document.getElementById('previewImagenProducto');

  if (archivo) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(archivo);
  }
});

if (inputBuscarFuente) {
  inputBuscarFuente.addEventListener('input', (e) => {
    renderFontOptions();
  });
}

filtroCategoriaFuente?.addEventListener('change', () => renderFontOptions());

colorTexto?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
colorTitulo?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
colorPrecio?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
colorBoton?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
colorBotonTexto?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
colorNombre?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
colorMenuWord?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
overlayOscuro?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
pdfUrl?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
colorBotonPdf?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
opacidadBotonPdf?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
backgroundColor?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
textoMenu?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
hideNombre?.addEventListener('change', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
hideMenuWord?.addEventListener('change', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
itemBgColor?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
itemOverlay?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
itemAlignLeft?.addEventListener('change', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
itemAlignCenter?.addEventListener('change', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
fontBodySize?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
fontTitleSize?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
nombreFontSize?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
menuFontSize?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
nombreStrokeWidth?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
nombreStrokeColor?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
nombreShadow?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
nombreShadowColor?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
menuStrokeWidth?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
menuStrokeColor?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
menuShadow?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
menuShadowColor?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
titulosStrokeWidth?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
titulosStrokeColor?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
titulosShadow?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
botonStrokeWidth?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
botonStrokeColor?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));
botonShadow?.addEventListener('input', () => aplicarTemaEnPreview(leerTemaDesdeInputs()));

inputPortada?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const { path, publicUrl } = await uploadAsset(file, COVER_PREFIX, 'portada');
    portadaPath = path || '';
    portadaUrl = publicUrl || '';
    temaActual.portadaimagen = path || '';
    if (publicUrl && previewPortada) {
      const bust = `${publicUrl}?t=${Date.now()}`;
      previewPortada.src = bust;
      previewPortada.classList.remove('hidden');
    }
    aplicarTemaEnPreview(leerTemaDesdeInputs());
  } catch (err) {
    console.error('Error subiendo portada:', err);
    alert('No se pudo subir la portada');
  }
});

btnQuitarPortada?.addEventListener('click', () => {
  portadaUrl = '';
  if (previewPortada) {
    previewPortada.src = '';
    previewPortada.classList.add('hidden');
  }
  aplicarTemaEnPreview(leerTemaDesdeInputs());
});

inputBackgroundImg?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const { path, publicUrl } = await uploadAsset(file, BACKGROUND_PREFIX, 'background');
    backgroundPath = path || '';
    backgroundUrl = publicUrl || '';
    temaActual.backgroundimagen = path || '';
    if (publicUrl && previewBackground) {
      const bust = `${publicUrl}?t=${Date.now()}`;
      previewBackground.src = bust;
      previewBackground.classList.remove('hidden');
    }
    aplicarTemaEnPreview(leerTemaDesdeInputs());
  } catch (err) {
    console.error('Error subiendo background:', err);
    alert('No se pudo subir el background');
  }
});

btnQuitarBackground?.addEventListener('click', () => {
  backgroundUrl = '';
  backgroundPath = '';
  if (previewBackground) {
    previewBackground.src = '';
    previewBackground.classList.add('hidden');
  }
  aplicarTemaEnPreview(leerTemaDesdeInputs());
});

btnGuardarTema?.addEventListener('click', guardarTema);
