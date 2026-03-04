#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

function fail(message) {
  console.error(`[mobile-public][health] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[mobile-public][health] ${message}`);
}

function checkEnvFile() {
  const envPath = path.join(projectRoot, '.env');
  if (!existsSync(envPath)) {
    fail('Missing .env file in apps/mobile-public.');
  }

  const raw = readFileSync(envPath, 'utf8');
  const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

  for (const key of required) {
    const match = raw.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm'));
    if (!match) fail(`Missing ${key} in .env.`);
    const value = String(match[1] || '')
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (!value) fail(`${key} is empty in .env.`);
  }

  info('Env keys present.');
}

function checkLockfiles() {
  const legacyLock = path.join(projectRoot, 'package-lock 2.json');
  if (existsSync(legacyLock)) {
    fail('Found legacy lockfile "package-lock 2.json". Remove it to avoid dependency drift.');
  }
  info('Lockfile structure OK.');
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

function checkNodeModulesLayout() {
  const nmPath = path.join(projectRoot, 'node_modules');
  if (!existsSync(nmPath)) {
    fail('node_modules not found. Run npm install first.');
  }

  // Detect duplicate directories like "@babel 2" created by broken installs.
  const entries = readdirSync(nmPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const duplicated = entries.filter((name) => /\s\d+$/.test(name));
  if (duplicated.length > 0) {
    fail(`Suspicious duplicated node_modules entries found: ${duplicated.slice(0, 8).join(', ')}`);
  }

  info('node_modules layout OK.');
}

function checkNpmTree() {
  try {
    const out = execSync('npm ls --depth=0', {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    if (/extraneous/i.test(out)) {
      fail('npm dependency tree reports extraneous packages.');
    }
  } catch (error) {
    const stdout = String(error?.stdout || '');
    const stderr = String(error?.stderr || '');
    if (/extraneous/i.test(stdout) || /extraneous/i.test(stderr)) {
      fail('npm dependency tree reports extraneous packages.');
    }
    fail(`npm ls failed.\n${stderr || stdout}`.trim());
  }

  info('npm dependency tree OK.');
}

function main() {
  info('Starting checks...');
  checkEnvFile();
  checkLockfiles();
  checkBabelConfig();
  checkNodeModulesLayout();
  checkNpmTree();
  info('All checks passed.');
}

main();
