#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());
const appDir = path.join(projectRoot, 'app');

function fail(message) {
  console.error(`[mobile-public][route-check] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[mobile-public][route-check] ${message}`);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(abs) : [abs];
  });
}

function toRoute(filePath) {
  let rel = path.relative(appDir, filePath).replace(/\\/g, '/');
  if (rel === '_layout.tsx') return null;

  if (rel.endsWith('/index.tsx')) {
    rel = rel.slice(0, -'/index.tsx'.length);
  } else {
    rel = rel.replace(/\.tsx$/, '');
  }

  const route = `/${rel}`.replace(/\/+/g, '/');
  return route === '/index' ? '/' : route;
}

function routeToRegex(route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withDynamic = escaped.replace(/\\\[[^\]]+\\\]/g, '[^/]+');
  return new RegExp(`^${withDynamic}$`);
}

function normalizeTarget(target) {
  const base = String(target || '').trim().split('?')[0]?.split('#')[0] || '';
  return base.replace(/\/$/, '') || '/';
}

function main() {
  if (!existsSync(appDir)) {
    fail(`Missing app directory at ${appDir}`);
  }

  const files = walk(appDir).filter((file) => file.endsWith('.tsx'));
  const routes = files.map(toRoute).filter(Boolean);
  const staticRoutes = new Set(routes.filter((route) => !route.includes('[')));
  const dynamicRoutes = routes.filter((route) => route.includes('[')).map((route) => routeToRegex(route));

  const linkRegex = /router\.(?:push|replace)\(\s*(['"`])([^'"`]+)\1/g;
  const pathnameRegex = /pathname\s*:\s*(['"`])([^'"`]+)\1/g;
  const unresolved = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');

    const evaluateTarget = (rawTarget) => {
      if (!rawTarget.startsWith('/')) return;

      const target = normalizeTarget(rawTarget);
      const staticMatch = staticRoutes.has(target);
      const dynamicMatch = dynamicRoutes.some((regex) => regex.test(target));

      if (!staticMatch && !dynamicMatch) {
        unresolved.push({
          file: path.relative(projectRoot, file),
          target: rawTarget,
        });
      }
    };

    let match;
    while ((match = linkRegex.exec(source))) {
      evaluateTarget(match[2]);
    }

    while ((match = pathnameRegex.exec(source))) {
      evaluateTarget(match[2]);
    }
  }

  if (unresolved.length > 0) {
    for (const item of unresolved) {
      console.error(`[mobile-public][route-check] Unresolved route ${item.target} in ${item.file}`);
    }
    fail(`Found ${unresolved.length} unresolved route reference(s).`);
  }

  info(`OK (${routes.length} routes scanned, no unresolved references).`);
}

main();
