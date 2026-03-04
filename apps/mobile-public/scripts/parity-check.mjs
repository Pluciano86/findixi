#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

function fail(message) {
  console.error(`[mobile-public][parity-check] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[mobile-public][parity-check] ${message}`);
}

function read(relativePath) {
  const abs = path.join(projectRoot, relativePath);
  if (!existsSync(abs)) {
    fail(`Missing file: ${relativePath}`);
  }
  return readFileSync(abs, 'utf8');
}

function ensureContains(source, snippet, context) {
  if (!source.includes(snippet)) {
    fail(`${context} is missing required snippet: ${snippet}`);
  }
}

function ensureNotContains(source, snippet, context) {
  if (source.includes(snippet)) {
    fail(`${context} contains forbidden snippet: ${snippet}`);
  }
}

function main() {
  const layoutSource = read('app/_layout.tsx');
  ensureContains(layoutSource, "import { Stack } from 'expo-router';", 'app/_layout.tsx');
  ensureNotContains(layoutSource, 'Tabs', 'app/_layout.tsx');

  const requiredStackScreens = [
    'index',
    'comercios',
    'comercio/[id]',
    'cercademi',
    'playas',
    'playa/[id]',
    'eventos',
    'especiales',
    'login',
    'usuario',
    'cuenta',
    'pedidos',
    'menu/[id]',
    'privacy-policy',
    'terms-of-service',
  ];
  for (const screenName of requiredStackScreens) {
    ensureContains(layoutSource, `name="${screenName}"`, 'app/_layout.tsx');
  }

  const requiredChromeScreens = [
    'app/index.tsx',
    'app/comercios.tsx',
    'app/comercio/[id].tsx',
    'app/cercademi.tsx',
    'app/playas.tsx',
    'app/playa/[id].tsx',
    'app/eventos.tsx',
    'app/especiales.tsx',
    'app/usuario.tsx',
    'app/pedidos.tsx',
    'app/privacy-policy.tsx',
    'app/terms-of-service.tsx',
  ];
  for (const file of requiredChromeScreens) {
    const source = read(file);
    ensureContains(source, 'PublicAppChrome', file);
    ensureContains(source, '<PublicAppChrome', file);
  }

  const cuentaSource = read('app/cuenta.tsx');
  ensureContains(cuentaSource, "export { default } from './usuario';", 'app/cuenta.tsx');

  const footerSource = read('src/components/home/FooterWebStyle.tsx');
  ensureContains(footerSource, "router.push('/privacy-policy')", 'FooterWebStyle');
  ensureContains(footerSource, "router.push('/terms-of-service')", 'FooterWebStyle');
  ensureContains(footerSource, "mailto:info@findixi.com", 'FooterWebStyle');

  const outDir = path.join(projectRoot, '.qa-cache');
  mkdirSync(outDir, { recursive: true });
  info(`OK (layout/chrome/footer parity gates passed for ${requiredChromeScreens.length} screens).`);
}

main();
