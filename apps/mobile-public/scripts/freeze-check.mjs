#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

function fail(message) {
  console.error(`[mobile-public][freeze-check] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[mobile-public][freeze-check] ${message}`);
}

function read(relativePath) {
  const abs = path.join(projectRoot, relativePath);
  if (!existsSync(abs)) {
    fail(`Missing file: ${relativePath}`);
  }
  return readFileSync(abs, 'utf8');
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.expo' || entry.name === '.metro') return [];
      return walk(abs);
    }
    return [abs];
  });
}

function ensureContains(source, snippet, fileLabel) {
  if (!source.includes(snippet)) {
    fail(`${fileLabel} missing required snippet: ${snippet}`);
  }
}

function ensureNotContains(source, snippet, fileLabel) {
  if (source.includes(snippet)) {
    fail(`${fileLabel} contains forbidden snippet: ${snippet}`);
  }
}

function checkEnvAndSupabaseClient() {
  const envSource = read('src/config/env.ts');
  ensureContains(envSource, 'EXPO_PUBLIC_SUPABASE_URL', 'src/config/env.ts');
  ensureContains(envSource, 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'src/config/env.ts');
  ensureContains(envSource, 'throw new Error', 'src/config/env.ts');

  const supabaseSource = read('src/lib/supabase.ts');
  ensureContains(supabaseSource, "from '../config/env'", 'src/lib/supabase.ts');
  ensureContains(supabaseSource, 'SUPABASE_URL', 'src/lib/supabase.ts');
  ensureContains(supabaseSource, 'SUPABASE_ANON_KEY', 'src/lib/supabase.ts');
  ensureNotContains(supabaseSource, 'process.env.EXPO_PUBLIC_SUPABASE_URL', 'src/lib/supabase.ts');
  ensureNotContains(supabaseSource, 'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY', 'src/lib/supabase.ts');
  ensureNotContains(supabaseSource, 'FALLBACK_KEY', 'src/lib/supabase.ts');
}

function checkNoHardcodedJwtLikeSecrets() {
  const files = walk(projectRoot).filter((file) => /\.(ts|tsx|js|mjs|json|md)$/.test(file));
  const jwtLike = /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g;
  const findings = [];

  for (const file of files) {
    const rel = path.relative(projectRoot, file);
    if (
      rel.startsWith('node_modules_stale_') ||
      rel.startsWith('node_modules/') ||
      rel.includes('/node_modules/')
    ) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    if (jwtLike.test(source)) {
      findings.push(rel);
    }
  }

  if (findings.length > 0) {
    fail(`Potential hardcoded JWT-like token(s) found in: ${findings.slice(0, 6).join(', ')}`);
  }
}

function checkRequiredDocsAndScripts() {
  const requiredPaths = [
    'scripts/health-check.mjs',
    'scripts/i18n-check.mjs',
    'scripts/route-check.mjs',
    'scripts/parity-check.mjs',
    'scripts/qa-report-validate.mjs',
  ];

  for (const rel of requiredPaths) {
    const abs = path.join(projectRoot, rel);
    if (!existsSync(abs)) {
      fail(`Missing required QA script: ${rel}`);
    }
  }
}

function main() {
  info('Starting freeze readiness checks...');
  checkEnvAndSupabaseClient();
  checkNoHardcodedJwtLikeSecrets();
  checkRequiredDocsAndScripts();
  info('All checks passed.');
}

main();
