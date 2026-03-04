#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());
const repoRoot = path.resolve(projectRoot, '../..');
const reportsDir = path.join(repoRoot, 'docs', 'qa-reports');

function fail(message) {
  console.error(`[mobile-public][qa-report:validate] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[mobile-public][qa-report:validate] ${message}`);
}

function getLatestReportFile() {
  if (!existsSync(reportsDir)) {
    fail('Missing docs/qa-reports directory.');
  }

  const candidates = readdirSync(reportsDir)
    .filter((name) => /^mobile-public-parity-\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort();

  if (candidates.length === 0) {
    fail('No mobile-public parity reports found in docs/qa-reports.');
  }

  return path.join(reportsDir, candidates[candidates.length - 1]);
}

function hasCheckedLine(source, text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^- \\[(?:x|X)\\] ${escaped}$`, 'm');
  return re.test(source);
}

function hasUncheckedLine(source, text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^- \\[ \\] ${escaped}$`, 'm');
  return re.test(source);
}

function main() {
  const reportFile = getLatestReportFile();
  const source = readFileSync(reportFile, 'utf8');
  const rel = path.relative(repoRoot, reportFile);

  const requiredTechnical = [
    '`npm --prefix apps/mobile-public run qa:smoke`',
    '`npm --prefix apps/mobile-public run qa:parity`',
  ];

  for (const item of requiredTechnical) {
    if (!hasCheckedLine(source, item)) {
      fail(`Technical gate not checked in ${rel}: ${item}`);
    }
  }

  const passLine = 'PASS Bloque 2.4';
  const failLine = 'FAIL Bloque 2.4 (detallar blockers arriba)';
  const passChecked = hasCheckedLine(source, passLine);
  const failChecked = hasCheckedLine(source, failLine);

  if (!passChecked && !failChecked) {
    fail(`Decision not set in ${rel}. Mark PASS or FAIL.`);
  }
  if (passChecked && failChecked) {
    fail(`Invalid decision in ${rel}. PASS and FAIL are both checked.`);
  }
  if (failChecked) {
    fail(`Report is marked FAIL in ${rel}.`);
  }

  const functionalSectionMatch = source.match(/## Functional matrix([\s\S]*?)## Findings/);
  if (!functionalSectionMatch) {
    fail(`Could not find "Functional matrix" section in ${rel}.`);
  }

  const functionalSection = functionalSectionMatch[1];
  const pendingInFunctional = functionalSection.match(/^- \[ \] .+$/gm) || [];
  if (pendingInFunctional.length > 0) {
    fail(
      `Functional matrix still has ${pendingInFunctional.length} pending checkbox(es) in ${rel}.`
    );
  }

  info(`OK (${rel} is complete and marked PASS).`);
}

main();
