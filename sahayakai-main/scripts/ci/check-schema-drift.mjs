#!/usr/bin/env node
/**
 * CI gate: schema drift between freshly-dumped schemas and committed
 * baselines. Counts constraint-bearing fields per agent and fails if
 * drift > THRESHOLD per agent.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const arg = process.argv.find((a) => a.startsWith('--threshold='));
const THRESHOLD = arg ? parseInt(arg.split('=')[1], 10) : 10;

const PAIRS = [
  { label: 'zod-baseline',     committed: path.join(ROOT, 'qa', 'baseline-schemas'),  fresh: path.join(ROOT, 'qa', 'baseline-schemas-fresh') },
  { label: 'pydantic-sidecar', committed: path.join(ROOT, 'qa', 'sidecar-schemas'),   fresh: path.join(ROOT, 'qa', 'sidecar-schemas-fresh') },
];

function countConstraints(node, acc = { count: 0 }) {
  if (!node || typeof node !== 'object') return acc;
  for (const [k, v] of Object.entries(node)) {
    if (['enum', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern'].includes(k)) acc.count += 1;
    if ((k === 'anyOf' || k === 'oneOf') && Array.isArray(v)) acc.count += v.length;
    if (v && typeof v === 'object') countConstraints(v, acc);
  }
  return acc;
}

async function readJsonOrNull(p) { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return null; } }
async function listAgents(dir) { try { return (await fs.readdir(dir)).filter((f) => f.endsWith('.json')); } catch { return []; } }

let totalFailures = 0;
const report = [];

for (const pair of PAIRS) {
  const agents = await listAgents(pair.committed);
  if (agents.length === 0) { report.push(`[${pair.label}] no committed schemas at ${pair.committed} — skipping`); continue; }
  const freshExists = await fs.access(pair.fresh).then(() => true).catch(() => false);
  if (!freshExists) { report.push(`[${pair.label}] no fresh dump at ${pair.fresh} — SKIPPING`); continue; }
  for (const file of agents) {
    const committed = await readJsonOrNull(path.join(pair.committed, file));
    const fresh = await readJsonOrNull(path.join(pair.fresh, file));
    if (!committed || !fresh) { report.push(`[${pair.label}] ${file}: missing`); continue; }
    const a = countConstraints(committed).count;
    const b = countConstraints(fresh).count;
    const drift = Math.abs(a - b);
    const status = drift > THRESHOLD ? 'FAIL' : 'OK';
    if (status === 'FAIL') totalFailures += 1;
    report.push(`[${pair.label}] ${file}: committed=${a} fresh=${b} drift=${drift} ${status}`);
  }
}

console.log(`Schema drift report (threshold=${THRESHOLD} constraints / agent):`);
for (const line of report) console.log('  ' + line);

if (totalFailures > 0) { console.error(`\nFAIL: ${totalFailures} agent(s) exceeded drift threshold.`); process.exit(1); }
console.log('\nPASS: all agents within drift threshold.');
