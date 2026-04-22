import { supabase } from '../shared/supabaseClient.js';
import { bindTrackedAnchor } from '../shared/analyticsTracker.js';

const idComercio = Number(new URLSearchParams(window.location.search).get('id'));
const redesContainer = document.getElementById('redesSocialesContainer');

function toCleanText(value) {
  const raw = String(value || '').trim();
  return raw;
}

function normalizeExternalUrl(value) {
  const raw = toCleanText(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || /^mailto:/i.test(raw) || /^tel:/i.test(raw) || /^whatsapp:/i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

function normalizeWhatsapp(value) {
  const raw = toCleanText(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || /^whatsapp:/i.test(raw)) return raw;
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}`;
}

function bindSocialLink(elementId, href, eventName, municipio) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (!href) {
    el.classList.add('hidden');
    el.removeAttribute('href');
    return;
  }

  el.classList.remove('hidden');
  el.setAttribute('href', href);
  el.setAttribute('target', '_blank');
  el.setAttribute('rel', 'noopener noreferrer');

  if (Number.isFinite(idComercio) && idComercio > 0 && eventName) {
    bindTrackedAnchor(el, {
      idComercio,
      eventName,
      source: 'web',
      municipio: municipio || null,
      dedupeKey: `perfil:${eventName}:${idComercio}`,
      dedupeMs: 1200,
    });
  }
}

async function cargarRedesSociales() {
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    redesContainer?.classList.add('hidden');
    return;
  }

  const { data, error } = await supabase
    .from('Comercios')
    .select('facebook, instagram, tiktok, whatsapp, email, webpage, municipio')
    .eq('id', idComercio)
    .maybeSingle();

  if (error || !data) {
    console.error('Error cargando redes sociales:', error);
    redesContainer?.classList.add('hidden');
    return;
  }

  const municipio = data.municipio || null;

  const facebookHref = normalizeExternalUrl(data.facebook);
  const instagramHref = normalizeExternalUrl(data.instagram);
  const tiktokHref = normalizeExternalUrl(data.tiktok);
  const whatsappHref = normalizeWhatsapp(data.whatsapp);
  const webHref = normalizeExternalUrl(data.webpage);

  bindSocialLink('linkFacebook', facebookHref, 'click_facebook', municipio);
  bindSocialLink('linkInstagram', instagramHref, 'click_instagram', municipio);
  bindSocialLink('linkTikTok', tiktokHref, 'click_tiktok', municipio);
  bindSocialLink('linkWhatsapp', whatsappHref, 'click_whatsapp', municipio);
  bindSocialLink('linkWeb', webHref, 'click_webpage', municipio);

  const emailEl = document.getElementById('linkEmail');
  const emailValue = toCleanText(data.email);
  let hasEmail = false;
  if (emailEl) {
    if (emailValue) {
      emailEl.classList.remove('hidden');
      emailEl.setAttribute('href', `mailto:${emailValue}`);
      hasEmail = true;
    } else {
      emailEl.classList.add('hidden');
      emailEl.removeAttribute('href');
    }
  }

  const hasAnyRed = Boolean(facebookHref || instagramHref || tiktokHref || whatsappHref || webHref || hasEmail);
  redesContainer?.classList.toggle('hidden', !hasAnyRed);
}

void cargarRedesSociales();
