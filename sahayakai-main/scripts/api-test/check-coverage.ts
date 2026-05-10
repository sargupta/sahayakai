#!/usr/bin/env tsx
/**
 * Verifies that scripts/api-test/route-manifest.ts enumerates every
 * (path, method) pair found by walking src/app/api/**\/route.ts.
 *
 * Hard-fails if any route file is missing from the manifest, so adding a
 * new route without updating the manifest blocks CI.
 *
 * Usage:
 *   npx tsx scripts/api-test/check-coverage.ts
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { NEXT_ENDPOINTS } from './route-manifest';

const API_ROOT = join(process.cwd(), 'src/app/api');

interface DiscoveredOp {
  path: string;
  method: string;
  file: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry === 'route.ts') {
      out.push(full);
    }
  }
  return out;
}

function fileToPath(file: string): string {
  const rel = relative(API_ROOT, file).replace(/\/route\.ts$/, '');
  return rel ? `/${rel}` : '/';
}

function readMethods(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const fnRe = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g;
  const constRe = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*=/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(src))) set.add(m[1]);
  while ((m = constRe.exec(src))) set.add(m[1]);
  return Array.from(set);
}

function main(): void {
  const files = walk(API_ROOT).sort();
  const discovered: DiscoveredOp[] = [];
  for (const f of files) {
    const path = fileToPath(f);
    for (const method of readMethods(f)) {
      discovered.push({ path, method, file: relative(process.cwd(), f) });
    }
  }

  const key = (p: string, m: string) => `${m} ${p}`;
  const manifestSet = new Set(NEXT_ENDPOINTS.map((e) => key(e.path, e.method)));
  const discoveredSet = new Set(discovered.map((d) => key(d.path, d.method)));

  const missing = discovered.filter((d) => !manifestSet.has(key(d.path, d.method)));
  const extra = NEXT_ENDPOINTS.filter((e) => !discoveredSet.has(key(e.path, e.method)));

  console.log(`Discovered: ${discovered.length} (path, method) pairs across ${files.length} route files`);
  console.log(`Manifest:   ${NEXT_ENDPOINTS.length} entries`);

  if (missing.length) {
    console.error('\nFAIL: routes in code but missing from manifest:');
    for (const d of missing) console.error(`  ${d.method.padEnd(6)} ${d.path}   (${d.file})`);
  }
  if (extra.length) {
    console.error('\nFAIL: entries in manifest but no matching route file:');
    for (const e of extra) console.error(`  ${e.method.padEnd(6)} ${e.path}`);
  }
  if (missing.length || extra.length) {
    console.error('\nFix scripts/api-test/route-manifest.ts and re-run.');
    process.exit(1);
  }

  console.log('\nOK: every route is covered by the manifest, and the manifest has no orphan entries.');
}

main();
