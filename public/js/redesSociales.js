import { supabase } from '../shared/supabaseClient.js';
import { bindTrackedAnchor } from '../shared/analyticsTracker.js';

const idComercio = Number(new URLSearchParams(window.location.search).get('id'));

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
  if (!Number.isFinite(idComercio) || idComercio <= 0) return;

  const { data, error } = await supabase
    .from('Comercios')
    .select('facebook, instagram, tiktok, whatsapp, email, webpage, municipio')
    .eq('id', idComercio)
    .maybeSingle();

  if (error || !data) {
    console.error('Error cargando redes sociales:', error);
    return;
  }

  const municipio = data.municipio || null;

  bindSocialLink('linkFacebook', normalizeExternalUrl(data.facebook), 'click_facebook', municipio);
  bindSocialLink('linkInstagram', normalizeExternalUrl(data.instagram), 'click_instagram', municipio);
  bindSocialLink('linkTikTok', normalizeExternalUrl(data.tiktok), 'click_tiktok', municipio);
  bindSocialLink('linkWhatsapp', normalizeWhatsapp(data.whatsapp), 'click_whatsapp', municipio);
  bindSocialLink('linkWeb', normalizeExternalUrl(data.webpage), 'click_webpage', municipio);

  const emailEl = document.getElementById('linkEmail');
  const emailValue = toCleanText(data.email);
  if (emailEl) {
    if (emailValue) {
      emailEl.classList.remove('hidden');
      emailEl.setAttribute('href', `mailto:${emailValue}`);
    } else {
      emailEl.classList.add('hidden');
      emailEl.removeAttribute('href');
    }
  }
}

void cargarRedesSociales();
