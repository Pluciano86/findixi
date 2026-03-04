#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());
const repoRoot = path.resolve(projectRoot, '../..');
const reportsDir = path.join(repoRoot, 'docs', 'qa-reports');

function fail(message) {
  console.error(`[mobile-public][qa-report] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[mobile-public][qa-report] ${message}`);
}

function formatDateStamp(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readCurrentCommit() {
  const headFile = path.join(repoRoot, '.git', 'HEAD');
  if (!existsSync(headFile)) return 'unknown';
  const head = readFileSync(headFile, 'utf8').trim();
  if (!head.startsWith('ref: ')) return head.slice(0, 12);
  const ref = head.replace(/^ref:\s+/, '');
  const refFile = path.join(repoRoot, '.git', ref);
  if (!existsSync(refFile)) return 'unknown';
  return readFileSync(refFile, 'utf8').trim().slice(0, 12);
}

function main() {
  const now = new Date();
  const stamp = formatDateStamp(now);
  const commit = readCurrentCommit();

  mkdirSync(reportsDir, { recursive: true });
  const fileName = `mobile-public-parity-${stamp}.md`;
  const outFile = path.join(reportsDir, fileName);

  if (existsSync(outFile)) {
    fail(`Report already exists for today: ${path.relative(repoRoot, outFile)}`);
  }

  const template = `# Mobile Public QA Report - ${stamp}

## Context
- Commit: \`${commit}\`
- Tester:
- Device:
- OS:
- Network mode: LAN / Tunnel / Hotspot
- Expo command:

## Technical gates
- [ ] \`npm --prefix apps/mobile-public run qa:smoke\`
- [ ] \`npm --prefix apps/mobile-public run qa:parity\`

## Functional matrix
1. Home (\`/\`)
- [ ] Header/footer visible + hide on scroll behavior
- [ ] Banners/carruseles/video load and interactions work

2. Comercios (\`/comercios\`)
- [ ] Filtros/switch/busqueda/orden por cercania
- [ ] Tap tarjeta abre perfil; tap telefono llama

3. Perfil comercio (\`/comercio/[id]\`)
- [ ] Horario/favorito/amenidades/maps-waze/menu
- [ ] CTA GPS abre selector y redireccion externa

4. Cerca de mi (\`/cercademi\`)
- [ ] Geolocalizacion + mapa + tarjetas
- [ ] Pin usuario visible y encima de marcadores

5. Playas (\`/playas\` + \`/playa/[id]\`)
- [ ] Filtros + clima/iconos + distancia en una linea
- [ ] Perfil playa y cercanos sin regresiones

6. Eventos y Especiales (\`/eventos\`, \`/especiales\`)
- [ ] Tarjetas, fecha/hora y multilocalidad correctas

7. Login/Usuario/Pedidos (\`/login\`, \`/usuario\`, \`/pedidos\`)
- [ ] Login email/password y opcional Google
- [ ] Perfil + favoritos + pedidos operativos

8. Legal (\`/privacy-policy\`, \`/terms-of-service\`)
- [ ] Abren y respetan idioma seleccionado

## Findings
- None / Describe:

## Decision
- [ ] PASS Bloque 2.4
- [ ] FAIL Bloque 2.4 (detallar blockers arriba)
`;

  writeFileSync(outFile, template, 'utf8');
  info(`Created ${path.relative(repoRoot, outFile)}`);
}

main();
