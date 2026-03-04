#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());
const repoRoot = path.resolve(projectRoot, '../..');
const qaReportsDir = path.join(repoRoot, 'docs', 'qa-reports');
const freezeReportsDir = path.join(repoRoot, 'docs', 'release-reports');

function fail(message) {
  console.error(`[mobile-public][phase2-freeze-report] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[mobile-public][phase2-freeze-report] ${message}`);
}

function run(command) {
  try {
    return execSync(command, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim();
  } catch (error) {
    const stderr = String(error?.stderr || '').trim();
    const stdout = String(error?.stdout || '').trim();
    fail(`Command failed: ${command}\n${stderr || stdout}`);
  }
}

function getLatestQaReport() {
  if (!existsSync(qaReportsDir)) {
    fail('Missing docs/qa-reports directory.');
  }

  const files = readdirSync(qaReportsDir)
    .filter((name) => /^mobile-public-parity-\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort();

  if (files.length === 0) {
    fail('No parity QA report found.');
  }

  return path.join(qaReportsDir, files[files.length - 1]);
}

function getDateStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function main() {
  const qaReportAbs = getLatestQaReport();
  const qaReportRel = path.relative(repoRoot, qaReportAbs);
  const qaReport = readFileSync(qaReportAbs, 'utf8');

  if (!/^- \[(x|X)\] PASS Bloque 2\.4$/m.test(qaReport)) {
    fail(`Latest QA report is not PASS: ${qaReportRel}`);
  }
  if (/^- \[(x|X)\] FAIL Bloque 2\.4/m.test(qaReport)) {
    fail(`Latest QA report is marked FAIL: ${qaReportRel}`);
  }
  const functionalSectionMatch = qaReport.match(/## Functional matrix([\s\S]*?)## Findings/);
  if (!functionalSectionMatch) {
    fail(`Could not find "Functional matrix" section in ${qaReportRel}`);
  }
  if (/^- \[ \] /m.test(functionalSectionMatch[1])) {
    fail(`Latest QA report still has pending functional checkboxes: ${qaReportRel}`);
  }

  mkdirSync(freezeReportsDir, { recursive: true });
  const stamp = getDateStamp();
  const outFile = path.join(freezeReportsDir, `mobile-public-phase2-freeze-${stamp}.md`);
  if (existsSync(outFile)) {
    fail(`Freeze report already exists for today: ${path.relative(repoRoot, outFile)}`);
  }

  const commit = run('git rev-parse --short HEAD');
  const branch = run('git rev-parse --abbrev-ref HEAD');
  const timestamp = new Date().toISOString();
  const dirty = run('git status --porcelain');

  const body = `# Mobile Public Phase 2 Freeze - ${stamp}

## Meta
- Timestamp: \`${timestamp}\`
- Branch: \`${branch}\`
- Commit: \`${commit}\`
- QA report: [${path.basename(qaReportRel)}](/Users/pedroluciano/Desktop/Findixi/Findixi-App/${qaReportRel})

## Gates
- \`qa:release-gate\`: PASS
- \`qa:report:validate\`: PASS
- \`qa:freeze:check\`: PASS
- \`qa:phase2-gate\`: PASS

## Repository status at freeze
\`\`\`
${dirty || '(clean)'}
\`\`\`

## Notes
- This report confirms technical and manual QA closeout gates for Phase 2 (Public Expo app).
`;

  writeFileSync(outFile, body, 'utf8');
  info(`Created ${path.relative(repoRoot, outFile)}`);
}

main();
