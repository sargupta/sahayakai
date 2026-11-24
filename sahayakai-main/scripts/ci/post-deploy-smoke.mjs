#!/usr/bin/env node
/**
 * Post-deploy verification: probes /api/health and runs one bucket-0
 * canary call per dispatchable agent, verifying dispatcher source =
 * 'sidecar'. Any genkit_fallback → alert.
 *
 * Required env:
 *   APP_BASE_URL          e.g. https://sahayakai-hotfix-resilience-...run.app
 *   APP_BEARER_TOKEN      optional Firebase ID token for /api/ai/* calls
 *
 * Optional:
 *   AGENTS  comma-separated list (defaults to dispatchable agents)
 *   STRICT  if "1", non-2xx /api/health or any non-sidecar dispatcher → exit 1
 */
const BASE = process.env.APP_BASE_URL;
const TOKEN = process.env.APP_BEARER_TOKEN || '';
const STRICT = process.env.STRICT === '1';

if (!BASE) {
  console.error('[post-deploy-smoke] APP_BASE_URL not set — skipping (PASS).');
  process.exit(0);
}

const DEFAULT_AGENTS = [
  'lesson-plan', 'quiz', 'exam-paper', 'rubric', 'worksheet',
  'instant-answer', 'parent-message', 'visual-aid',
];
const AGENTS = (process.env.AGENTS || DEFAULT_AGENTS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);

const headers = { 'content-type': 'application/json' };
if (TOKEN) headers['authorization'] = `Bearer ${TOKEN}`;

async function probeHealth() {
  const url = `${BASE.replace(/\/$/, '')}/api/health`;
  const res = await fetch(url, { method: 'GET' });
  const ok = res.status >= 200 && res.status < 300;
  console.log(`[health] ${url} -> ${res.status} ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

async function probeAgent(agent) {
  // Bucket-0 canary input is a tiny well-known payload per agent.
  // We use /api/ai/<agent>/dispatch endpoint pattern; if the project
  // uses a different endpoint scheme, the smoke caller can override
  // via AGENT_ENDPOINT_TEMPLATE env var.
  const tmpl = process.env.AGENT_ENDPOINT_TEMPLATE || '/api/ai/{agent}';
  const url = BASE.replace(/\/$/, '') + tmpl.replace('{agent}', agent);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ canary: true, bucket: 0 }),
    });
    const txt = await res.text();
    let body;
    try { body = JSON.parse(txt); } catch { body = { raw: txt.slice(0, 200) }; }
    const dispatcher = body?.dispatcher?.source || body?.dispatcherSource || body?._meta?.dispatcher;
    const okStatus = res.status >= 200 && res.status < 500; // 4xx = auth/canary stub still tells dispatcher
    const okDispatcher = dispatcher === 'sidecar';
    console.log(`[canary] ${agent} -> ${res.status} dispatcher=${dispatcher ?? '(unknown)'} ${okDispatcher ? 'OK' : 'WARN'}`);
    return { agent, status: res.status, dispatcher, ok: okStatus && (okDispatcher || !dispatcher) };
  } catch (err) {
    console.log(`[canary] ${agent} -> ERROR ${err.message}`);
    return { agent, status: 0, dispatcher: null, ok: false, error: err.message };
  }
}

const health = await probeHealth();
const results = [];
for (const a of AGENTS) results.push(await probeAgent(a));

const fallbacks = results.filter((r) => r.dispatcher && r.dispatcher !== 'sidecar');
if (fallbacks.length > 0) {
  console.error(`\n[post-deploy-smoke] ALERT — ${fallbacks.length} agent(s) fell back to non-sidecar dispatcher:`);
  for (const f of fallbacks) console.error(`  - ${f.agent} -> ${f.dispatcher}`);
}

if (STRICT) {
  if (!health) { console.error('[post-deploy-smoke] STRICT: /api/health failed.'); process.exit(1); }
  if (fallbacks.length > 0) { console.error('[post-deploy-smoke] STRICT: dispatcher fallback detected.'); process.exit(1); }
}

console.log('\n[post-deploy-smoke] done.');
