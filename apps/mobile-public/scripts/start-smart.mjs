#!/usr/bin/env node

import { spawn } from 'node:child_process';

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });

    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

function runExpo(args) {
  return runCommand('npx', ['expo', 'start', ...args]);
}

async function main() {
  console.log('[mobile-public] Ejecutando health check...');
  const healthCode = await runCommand('npm', ['run', 'health:check']);
  if (healthCode !== 0) {
    console.log('[mobile-public] Health check fallo. Intentando reparar dependencias con npm install...');
    const installCode = await runCommand('npm', ['install']);
    if (installCode !== 0) {
      process.exit(installCode);
    }

    const retryHealthCode = await runCommand('npm', ['run', 'health:check']);
    if (retryHealthCode !== 0) {
      process.exit(retryHealthCode);
    }
  }

  console.log('[mobile-public] Intentando iniciar Expo con tunnel...');
  const tunnelCode = await runExpo(['--host', 'tunnel', '-c']);
  if (tunnelCode === 0) return;

  console.log('[mobile-public] Tunnel fallo. Cambiando a LAN automaticamente...');
  console.log('[mobile-public] Si estas en otra red/oficina, conecta Mac + iPhone al mismo Wi-Fi o hotspot.');
  const lanCode = await runExpo(['--host', 'lan', '-c']);
  process.exit(lanCode);
}

await main();
