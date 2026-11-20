#!/usr/bin/env node
/**
 * Route smoke test for a LOCAL dev server (development login cookie only).
 *
 *   node scripts/qa/route-smoke.mjs --base http://localhost:3100 [--org hillview-demo]
 *
 * Discovers every page route from src/app (route groups stripped), fills dynamic segments with
 * seeded demo ids, then GETs each with the development-only `auth-token=dev-token` cookie and
 * reports the status. A route PASSES on 200 or a same-site redirect (3xx); 4xx/5xx FAIL. Some
 * dynamic routes are expected to 404 for unknown ids and are listed as such. Refuses any base
 * that is not localhost (the dev cookie must never be sent to a deployed host).
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const BASE = opt('base', 'http://localhost:3100');
const ORG = opt('org', 'hillview-demo');
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE)) {
    console.error('refusing: --base must be a local dev server');
    process.exit(2);
}

const APP_DIR = join(process.cwd(), 'src', 'app');
function pages(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) pages(p, out);
        else if (name === 'page.tsx' || name === 'page.ts') out.push(p);
    }
    return out;
}
const FILL = { '[orgId]': ORG, '[id]': 'does-not-exist', '[classId]': 'does-not-exist', '[uid]': 'dev-user-123' };
const EXPECT_404 = /does-not-exist/;
const routes = [...new Set(pages(APP_DIR).map((f) => {
    const rel = relative(APP_DIR, f).split(sep).slice(0, -1).filter((s) => !/^\(.*\)$/.test(s));
    return '/' + rel.map((s) => FILL[s] ?? s).join('/');
}))].filter((r) => !/\[/.test(r)).sort();

const results = [];
for (const r of routes) {
    const t = Date.now();
    let status = 0;
    try {
        const res = await fetch(BASE + r, { redirect: 'manual', headers: { cookie: 'auth-token=dev-token' }, signal: AbortSignal.timeout(180_000) });
        status = res.status;
        await res.arrayBuffer();
    } catch (e) {
        status = -1;
    }
    const expected404 = EXPECT_404.test(r) && status === 404;
    const ok = (status >= 200 && status < 400) || expected404;
    results.push({ r, status, ms: Date.now() - t, ok, note: expected404 ? 'expected 404 (unknown id)' : '' });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${String(status).padStart(4)}  ${String(Date.now() - t).padStart(6)}ms  ${r}${expected404 ? '  (expected 404 for unknown id)' : ''}`);
}
const c = (f) => results.filter(f).length;
console.log(`\n${results.length} routes: ${c((x) => x.status === 200)} x 200, ${c((x) => x.status >= 300 && x.status < 400)} redirects, ${c((x) => x.note)} expected 404, ${c((x) => !x.ok)} failing`);
process.exit(c((x) => !x.ok) ? 1 : 0);
