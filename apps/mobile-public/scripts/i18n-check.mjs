#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());
const translationsPath = path.join(projectRoot, 'src/i18n/translations.ts');
const targetDirs = [path.join(projectRoot, 'app'), path.join(projectRoot, 'src')];

function fail(message) {
  console.error(`[mobile-public][i18n-check] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[mobile-public][i18n-check] ${message}`);
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') return [];
      return walk(abs);
    }
    return [abs];
  });
}

function getLineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function isIgnorableText(value) {
  const text = value.trim();
  if (!text) return true;
  if (text.startsWith('{') || text.endsWith('}') || text.includes('{') || text.includes('}')) return true;
  if (text.length <= 1) return true;
  if (!/[\p{L}\p{N}]/u.test(text)) return true;
  if (/^[\d\s.,:+\-/%()$#*•]+$/.test(text)) return true;
  if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(text)) return true;
  if (/^https?:\/\//i.test(text)) return true;
  return false;
}

function main() {
  if (!existsSync(translationsPath)) {
    fail(`Missing translations file at ${translationsPath}`);
  }

  const files = targetDirs
    .flatMap((dir) => walk(dir))
    .filter((file) => /\.(ts|tsx)$/.test(file));

  const translationSource = readFileSync(translationsPath, 'utf8');
  const definitionRegex = /'([^']+)'\s*:\s*'/g;
  const definedKeys = new Set();
  let defMatch;
  while ((defMatch = definitionRegex.exec(translationSource))) {
    definedKeys.add(defMatch[1]);
  }

  const keyUseRegex = /\bt\(\s*['"`]([^'"`]+)['"`]/g;
  const textNodeRegex = /<Text\b[^>]*>([^<{][^<]*)<\/Text>/g;
  const placeholderRegex = /\bplaceholder\s*=\s*["']([^"']+)["']/g;

  const usedKeys = new Set();
  const missingKeys = [];
  const hardcodedCandidates = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const rel = path.relative(projectRoot, file);

    let keyMatch;
    while ((keyMatch = keyUseRegex.exec(source))) {
      const key = keyMatch[1];
      usedKeys.add(key);
      if (!definedKeys.has(key)) {
        missingKeys.push({
          file: rel,
          line: getLineNumber(source, keyMatch.index),
          key,
        });
      }
    }

    // Soft detection: reports potential hardcoded UI text without breaking build.
    let textMatch;
    while ((textMatch = textNodeRegex.exec(source))) {
      const value = String(textMatch[1] || '').trim();
      if (isIgnorableText(value)) continue;
      hardcodedCandidates.push({
        file: rel,
        line: getLineNumber(source, textMatch.index),
        value,
      });
    }

    let placeholderMatch;
    while ((placeholderMatch = placeholderRegex.exec(source))) {
      const value = String(placeholderMatch[1] || '').trim();
      if (isIgnorableText(value)) continue;
      hardcodedCandidates.push({
        file: rel,
        line: getLineNumber(source, placeholderMatch.index),
        value: `placeholder="${value}"`,
      });
    }
  }

  if (missingKeys.length > 0) {
    for (const item of missingKeys) {
      console.error(`[mobile-public][i18n-check] Missing key "${item.key}" at ${item.file}:${item.line}`);
    }
    fail(`Found ${missingKeys.length} missing translation key reference(s).`);
  }

  info(`Translation key references OK (${usedKeys.size} used keys, all defined).`);

  if (hardcodedCandidates.length > 0) {
    const preview = hardcodedCandidates.slice(0, 15);
    info(
      `Potential hardcoded UI texts detected: ${hardcodedCandidates.length}.` +
        ' Review suggested items below (non-blocking):'
    );
    for (const item of preview) {
      console.log(`  - ${item.file}:${item.line} -> ${item.value}`);
    }
    if (hardcodedCandidates.length > preview.length) {
      console.log(`  ... and ${hardcodedCandidates.length - preview.length} more.`);
    }
  } else {
    info('No obvious hardcoded UI text candidates detected.');
  }
}

main();
