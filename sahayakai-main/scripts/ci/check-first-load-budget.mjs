#!/usr/bin/env node
/**
 * First-load JS budget gate. Sums the app-build-manifest chunks for a route
 * and fails if they exceed the budget. Run AFTER `next build`.
 *   node scripts/ci/check-first-load-budget.mjs --route / --budget-kb 660
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = process.argv.slice(2);
const route = args[args.indexOf('--route') + 1] ?? '/';
const budgetKb = Number(args[args.indexOf('--budget-kb') + 1] ?? 660);

const manifestPath = '.next/app-build-manifest.json';
if (!fs.existsSync(manifestPath)) {
    console.error(`missing ${manifestPath} — run next build first`);
    process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const key = route === '/' ? '/page' : `${route.replace(/\/$/, '')}/page`;
const files = manifest.pages?.[key];
if (!files) {
    console.error(`route ${key} not in app-build-manifest (keys: ${Object.keys(manifest.pages ?? {}).slice(0, 5).join(', ')}…)`);
    process.exit(2);
}
let total = 0;
for (const f of files.filter((f) => f.endsWith('.js'))) {
    total += fs.statSync(path.join('.next', f)).size;
}
const kb = Math.round(total / 1024);
console.log(`first-load JS for ${route}: ${kb} kB (budget ${budgetKb} kB, ${files.length} chunks)`);
if (kb > budgetKb) {
    console.error(`::error::first-load JS budget exceeded: ${kb} kB > ${budgetKb} kB for ${route}. Reduce or consciously raise the budget in test.yml with a justification.`);
    process.exit(1);
}
