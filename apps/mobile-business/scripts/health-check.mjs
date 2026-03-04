#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

function fail(message) {
  console.error(`[mobile-business][health] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[mobile-business][health] ${message}`);
}

function checkEnvFile() {
  const envPath = path.join(projectRoot, '.env');
  if (!existsSync(envPath)) {
    fail('Missing .env file in apps/mobile-business.');
  }

  const raw = readFileSync(envPath, 'utf8');
  const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

  for (const key of required) {
    const match = raw.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm'));
    if (!match) fail(`Missing ${key} in .env.`);
    const value = String(match[1] || '').trim().replace(/^['"]|['"]$/g, '');
    if (!value) fail(`${key} is empty in .env.`);
  }

  info('Env keys present.');
}

function checkBabelConfig() {
  const babelPath = path.join(projectRoot, 'babel.config.js');
  if (!existsSync(babelPath)) {
    fail('Missing babel.config.js.');
  }
  const raw = readFileSync(babelPath, 'utf8');
  if (raw.includes('expo-router/babel')) {
    fail('babel.config.js still uses deprecated expo-router/babel plugin.');
  }
  info('Babel config OK.');
}

function checkCoreFiles() {
  const requiredPaths = [
    'app/_layout.tsx',
    'app/index.tsx',
    'app/login.tsx',
    'app/pedidos.tsx',
    'app/perfil/index.tsx',
    'src/config/env.ts',
    'src/lib/supabase.ts',
  ];

  for (const relPath of requiredPaths) {
    const absPath = path.join(projectRoot, relPath);
    if (!existsSync(absPath)) {
      fail(`Missing required file: ${relPath}`);
    }
  }

  info('Core files present.');
}

function main() {
  info('Starting checks...');
  checkEnvFile();
  checkBabelConfig();
  checkCoreFiles();
  info('All checks passed.');
}

main();
