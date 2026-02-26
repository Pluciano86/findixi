import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sourceRoot = path.join(repoRoot, 'packages/shared/src');
const appTargets = ['public', 'comercio', 'admin'].map((app) =>
  path.join(repoRoot, app, 'shared', 'pkg')
);

for (const targetRoot of appTargets) {
  mkdirSync(targetRoot, { recursive: true });
  cpSync(sourceRoot, targetRoot, { recursive: true, force: true });
  console.log(`Synced shared package -> ${path.relative(repoRoot, targetRoot)}`);
}
