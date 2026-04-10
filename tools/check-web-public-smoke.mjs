import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(resolve(ROOT, relPath), 'utf8');
}

function fail(message) {
  console.error(`[web-public][smoke] FAIL: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`[web-public][smoke] OK: ${message}`);
}

function count(text, token) {
  if (!token) return 0;
  return text.split(token).length - 1;
}

function run() {
  const indexHtml = read('public/index.html');
  const supabaseClient = read('public/shared/supabaseClient.js');
  const categoriasIndex = read('public/js/categoriasIndex.js');
  const areasIndex = read('public/js/areasIndex.js');
  const especialesBanner = read('public/js/especialesBanner.js');
  const publicNetlifyToml = read('public/netlify.toml');

  if (/\bawait\s+fetchRuntimeSupabaseConfig\s*\(/.test(supabaseClient)) {
    fail('Se detecto await fetchRuntimeSupabaseConfig() al nivel modulo en public/shared/supabaseClient.js (rompe compatibilidad movil).');
  } else {
    ok('No hay top-level await de runtime config en supabaseClient.');
  }

  const comidaCalls = count(indexHtml, 'renderComidaCarousel("comidaCarousel")');
  const jangueoCalls = count(indexHtml, 'renderJangueoCarousel("jangueoCarousel")');
  const eventosCalls = count(indexHtml, 'renderEventosCarousel("eventosCarousel")');
  const i18nCalls = count(indexHtml, 'if (window.initI18n) window.initI18n();');

  if (comidaCalls !== 1) fail(`renderComidaCarousel esperado 1, encontrado ${comidaCalls}.`);
  else ok('renderComidaCarousel inicializa una sola vez en index.');

  if (jangueoCalls !== 1) fail(`renderJangueoCarousel esperado 1, encontrado ${jangueoCalls}.`);
  else ok('renderJangueoCarousel inicializa una sola vez en index.');

  if (eventosCalls !== 1) fail(`renderEventosCarousel esperado 1, encontrado ${eventosCalls}.`);
  else ok('renderEventosCarousel inicializa una sola vez en index.');

  if (i18nCalls > 1) fail(`initI18n duplicado en index (${i18nCalls} apariciones).`);
  else ok('initI18n sin duplicados en index.');

  const hasApiRedirect = /from\s*=\s*["']\/api\/\*["']/.test(publicNetlifyToml)
    && /to\s*=\s*["']\/\.netlify\/functions\/:splat["']/.test(publicNetlifyToml);

  if (!hasApiRedirect) {
    fail('public/netlify.toml no tiene redirect valido de /api/* -> /.netlify/functions/:splat.');
  } else {
    ok('Redirect de funciones valido en public/netlify.toml.');
  }

  const requiresSafeInit = [
    ['public/js/categoriasIndex.js', categoriasIndex],
    ['public/js/areasIndex.js', areasIndex],
    ['public/js/especialesBanner.js', especialesBanner],
  ];

  for (const [file, content] of requiresSafeInit) {
    if (!/document\.readyState\s*===\s*['"]loading['"]/.test(content)) {
      fail(`${file} no contiene init seguro por readyState (riesgo de no inicializar en movil).`);
    } else {
      ok(`${file} contiene init seguro por readyState.`);
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error('[web-public][smoke] Resultado: FAIL');
    process.exit(process.exitCode);
  }

  console.log('[web-public][smoke] Resultado: PASS');
}

run();
