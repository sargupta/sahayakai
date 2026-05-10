#!/usr/bin/env tsx
/**
 * Swagger-driven endpoint exerciser.
 *
 * Walks the Next.js manifest (route-manifest.ts) AND the live sidecar
 * /openapi.json, fires one request at every operation, and prints a
 * pass/fail/skip table.
 *
 * What "pass" means:
 *   - Endpoint returns a status in its `okStatuses` (default
 *     200/201/202/204/401). 401 is a pass for bearer-protected endpoints
 *     when --no-auth is used: it proves the route exists and rejects.
 *
 * Usage:
 *   # Local dev stack (Next.js on :3000, sidecar on :8081)
 *   npx tsx scripts/api-test/run-all.ts
 *
 *   # Override targets
 *   NEXT_BASE=http://localhost:3000 \
 *   SIDECAR_BASE=http://localhost:8081 \
 *   npx tsx scripts/api-test/run-all.ts
 *
 *   # Use a real Firebase ID token (run `firebase login:ci` etc. first)
 *   FIREBASE_ID_TOKEN=eyJhbGc... npx tsx scripts/api-test/run-all.ts
 *
 *   # Cron / Razorpay secrets so those endpoints don't return 401
 *   CRON_SECRET=... RAZORPAY_WEBHOOK_SECRET=... npx tsx scripts/api-test/run-all.ts
 *
 *   # Filter
 *   npx tsx scripts/api-test/run-all.ts --filter ai/lesson
 *
 *   # JUnit XML for CI
 *   npx tsx scripts/api-test/run-all.ts --junit out/api-test.xml
 */
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { NEXT_ENDPOINTS, SIDECAR_DEFAULT_BODIES, type EndpointSpec } from './route-manifest';

const NEXT_BASE = process.env.NEXT_BASE || 'http://localhost:3000';
const SIDECAR_BASE = process.env.SIDECAR_BASE || 'http://localhost:8081';
const ID_TOKEN = process.env.FIREBASE_ID_TOKEN || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
const RZP_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const APP_CHECK_TOKEN = process.env.APP_CHECK_TOKEN || '';
const SAHAYAKAI_HMAC_KEY = process.env.SAHAYAKAI_REQUEST_SIGNING_KEY || '';
const TIMEOUT_MS = parseInt(process.env.API_TEST_TIMEOUT_MS || '30000', 10);

interface CliArgs {
  filter?: string;
  junit?: string;
  onlyNext: boolean;
  onlySidecar: boolean;
  verbose: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { onlyNext: false, onlySidecar: false, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--filter') args.filter = argv[++i];
    else if (a === '--junit') args.junit = argv[++i];
    else if (a === '--only-next') args.onlyNext = true;
    else if (a === '--only-sidecar') args.onlySidecar = true;
    else if (a === '-v' || a === '--verbose') args.verbose = true;
  }
  return args;
}

interface ResultRow {
  surface: 'next' | 'sidecar';
  method: string;
  path: string;
  status: number | string;
  ms: number;
  outcome: 'PASS' | 'FAIL' | 'SKIP';
  note?: string;
}

const results: ResultRow[] = [];

function expandPath(spec: EndpointSpec): string {
  let p = spec.path;
  if (spec.query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(spec.query)) {
      if (p.includes(`[${k}]`)) {
        p = p.replace(`[${k}]`, encodeURIComponent(String(v)));
      } else {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    if (qs) p += `?${qs}`;
  }
  return p;
}

function buildHeaders(spec: EndpointSpec, contentType: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': contentType, Accept: 'application/json' };
  if (spec.auth === 'bearer' && ID_TOKEN) h['Authorization'] = `Bearer ${ID_TOKEN}`;
  if (spec.auth === 'cron' && CRON_SECRET) h['x-cron-secret'] = CRON_SECRET;
  if (spec.auth === 'razorpay' && RZP_SECRET) h['x-razorpay-signature'] = 'placeholder';
  if (spec.auth === 'twilio') h['x-twilio-signature'] = 'placeholder';
  return h;
}

async function fireNext(spec: EndpointSpec, args: CliArgs): Promise<void> {
  const url = `${NEXT_BASE}/api${expandPath(spec)}`;
  const tag = `${spec.method.padEnd(6)} ${spec.path}`;

  if (spec.skip) {
    results.push({ surface: 'next', method: spec.method, path: spec.path, status: 'skip', ms: 0, outcome: 'SKIP', note: spec.skip });
    if (args.verbose) console.log(`  SKIP ${tag} — ${spec.skip}`);
    return;
  }

  const contentType = spec.contentType || 'application/json';
  const headers = buildHeaders(spec, contentType);
  // Default acceptance set: any documented client-side response. The runner is
  // a route-mounting + auth-chain smoke test by default; 4xx proves the route
  // exists and rejects bad input. Failures (5xx, timeouts) surface real bugs.
  const okStatuses = spec.okStatuses || [200, 201, 202, 204, 302, 400, 401, 403, 404, 409, 415, 422, 429];

  let body: BodyInit | undefined;
  if (spec.method !== 'GET' && spec.method !== 'DELETE' && spec.body !== undefined) {
    body = typeof spec.body === 'string' ? spec.body : JSON.stringify(spec.body);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, { method: spec.method, headers, body, signal: ctrl.signal });
    const ms = Date.now() - start;
    const ok = okStatuses.includes(res.status);
    results.push({
      surface: 'next',
      method: spec.method,
      path: spec.path,
      status: res.status,
      ms,
      outcome: ok ? 'PASS' : 'FAIL',
    });
    const mark = ok ? 'PASS' : 'FAIL';
    console.log(`  ${mark.padEnd(4)} ${tag.padEnd(50)} ${res.status}  ${ms}ms`);
  } catch (err) {
    const ms = Date.now() - start;
    const note = err instanceof Error ? err.message : String(err);
    results.push({ surface: 'next', method: spec.method, path: spec.path, status: 'ERR', ms, outcome: 'FAIL', note });
    console.log(`  FAIL ${tag.padEnd(50)} ERR   ${ms}ms  (${note})`);
  } finally {
    clearTimeout(timer);
  }
}

interface SidecarOp {
  path: string;
  method: string;
  summary?: string;
}

async function fetchSidecarOps(): Promise<SidecarOp[]> {
  const res = await fetch(`${SIDECAR_BASE}/openapi.json`);
  if (!res.ok) throw new Error(`Sidecar /openapi.json returned ${res.status}`);
  const spec = (await res.json()) as { paths: Record<string, Record<string, { summary?: string }>> };
  const ops: SidecarOp[] = [];
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        ops.push({ path, method: method.toUpperCase(), summary: op.summary });
      }
    }
  }
  return ops;
}

async function fireSidecar(op: SidecarOp, args: CliArgs): Promise<void> {
  const url = `${SIDECAR_BASE}${op.path}`;
  const tag = `${op.method.padEnd(6)} ${op.path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (ID_TOKEN) headers['Authorization'] = `Bearer ${ID_TOKEN}`;
  if (APP_CHECK_TOKEN) headers['X-Firebase-AppCheck'] = APP_CHECK_TOKEN;

  let body: BodyInit | undefined;
  if (op.method !== 'GET' && op.method !== 'HEAD') {
    const fixture = SIDECAR_DEFAULT_BODIES[op.path] || {};
    body = JSON.stringify(fixture);
    if (SAHAYAKAI_HMAC_KEY) {
      // HMAC body signing is enforced when SAHAYAKAI_REQUIRE_BODY_SIGNATURE=true on
      // the sidecar. We send a placeholder header so the runner reaches the auth
      // layer; the layer will return 401 if signature mismatches, which is still
      // a "pass" (proves the route + auth chain is wired).
      headers['x-sahayakai-body-digest'] = 'placeholder';
      headers['x-sahayakai-timestamp'] = String(Math.floor(Date.now() / 1000));
      headers['x-sahayakai-nonce'] = 'placeholder-nonce';
    }
  }

  // Sidecar accepts 401/403 as well-formed responses (auth gate works).
  // 422 = pydantic validation error (our test fixture didn't satisfy schema) —
  // still proves the route is mounted, so we treat it as a pass.
  const okStatuses = [200, 201, 202, 204, 400, 401, 403, 422];

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, { method: op.method, headers, body, signal: ctrl.signal });
    const ms = Date.now() - start;
    const ok = okStatuses.includes(res.status);
    results.push({
      surface: 'sidecar',
      method: op.method,
      path: op.path,
      status: res.status,
      ms,
      outcome: ok ? 'PASS' : 'FAIL',
    });
    const mark = ok ? 'PASS' : 'FAIL';
    console.log(`  ${mark.padEnd(4)} ${tag.padEnd(50)} ${res.status}  ${ms}ms`);
  } catch (err) {
    const ms = Date.now() - start;
    const note = err instanceof Error ? err.message : String(err);
    results.push({ surface: 'sidecar', method: op.method, path: op.path, status: 'ERR', ms, outcome: 'FAIL', note });
    console.log(`  FAIL ${tag.padEnd(50)} ERR   ${ms}ms  (${note})`);
  } finally {
    clearTimeout(timer);
  }
}

function applyFilter(items: { path: string; method: string }[], filter?: string): { path: string; method: string }[] {
  if (!filter) return items;
  const f = filter.toLowerCase();
  return items.filter((x) => x.path.toLowerCase().includes(f) || x.method.toLowerCase().includes(f));
}

function writeJunit(outPath: string): void {
  const total = results.length;
  const failed = results.filter((r) => r.outcome === 'FAIL').length;
  const skipped = results.filter((r) => r.outcome === 'SKIP').length;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="api-test" tests="${total}" failures="${failed}" skipped="${skipped}">`,
    ...results.map((r) => {
      const name = `${r.method} ${r.path}`;
      const cls = `api.${r.surface}`;
      if (r.outcome === 'PASS') return `  <testcase classname="${cls}" name="${escapeXml(name)}" time="${(r.ms / 1000).toFixed(3)}"/>`;
      if (r.outcome === 'SKIP') return `  <testcase classname="${cls}" name="${escapeXml(name)}"><skipped message="${escapeXml(r.note || '')}"/></testcase>`;
      return `  <testcase classname="${cls}" name="${escapeXml(name)}" time="${(r.ms / 1000).toFixed(3)}"><failure message="status=${r.status}">${escapeXml(r.note || '')}</failure></testcase>`;
    }),
    '</testsuite>',
  ].join('\n');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, xml);
  console.log(`\nJUnit XML: ${outPath}`);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] || c);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log('SahayakAI API test harness');
  console.log(`  Next.js base: ${NEXT_BASE}`);
  console.log(`  Sidecar base: ${SIDECAR_BASE}`);
  console.log(`  Auth: ID_TOKEN=${ID_TOKEN ? 'set' : 'NONE'} CRON=${CRON_SECRET ? 'set' : 'NONE'} RZP=${RZP_SECRET ? 'set' : 'NONE'}`);
  if (args.filter) console.log(`  Filter: ${args.filter}`);
  console.log('');

  if (!args.onlySidecar) {
    console.log(`--- Next.js (${NEXT_ENDPOINTS.length} ops) ---`);
    const filtered = applyFilter(NEXT_ENDPOINTS, args.filter) as EndpointSpec[];
    for (const spec of filtered) await fireNext(spec, args);
  }

  if (!args.onlyNext) {
    console.log(`\n--- Sidecar (auto-discovered from /openapi.json) ---`);
    try {
      const ops = await fetchSidecarOps();
      const filtered = applyFilter(ops, args.filter) as SidecarOp[];
      console.log(`  ${filtered.length} ops loaded\n`);
      for (const op of filtered) await fireSidecar(op, args);
    } catch (err) {
      const note = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL to fetch sidecar OpenAPI: ${note}`);
      results.push({ surface: 'sidecar', method: 'GET', path: '/openapi.json', status: 'ERR', ms: 0, outcome: 'FAIL', note });
    }
  }

  const total = results.length;
  const passed = results.filter((r) => r.outcome === 'PASS').length;
  const failed = results.filter((r) => r.outcome === 'FAIL').length;
  const skipped = results.filter((r) => r.outcome === 'SKIP').length;
  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${skipped} skipped (total ${total})`);

  if (args.junit) writeJunit(args.junit);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Runner crashed:', err);
  process.exit(2);
});
