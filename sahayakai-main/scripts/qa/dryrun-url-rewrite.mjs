#!/usr/bin/env node
// DRY-RUN ONLY. Scans Firestore for stored download URLs that point at the
// old US bucket (sahayakai-b4248.firebasestorage.app) and reports what a
// bucket string-swap to sahayakai-b4248-mumbai would change. WRITES NOTHING.
//
// Token-preservation gate (runbook §5.4) PASSED → rewrite is a deterministic
// string swap of the <BUCKET> path segment; the ?token=<uuid> is identical in
// both buckets, so swapped URLs resolve.
import { getAdmin } from './lib/admin.mjs';

// The default Firebase bucket has TWO host aliases; older URLs may use either.
const OLD_ALIASES = ['sahayakai-b4248.firebasestorage.app', 'sahayakai-b4248.appspot.com'];
const NEW = 'sahayakai-b4248-mumbai';
const matchAlias = (s) => OLD_ALIASES.find((a) => s.includes(a));
const swap = (s) => { let out = s; for (const a of OLD_ALIASES) out = out.replaceAll(a, NEW); return out; };

const COMMIT = process.argv.includes('--commit'); // default: DRY-RUN

const admin = getAdmin();
const db = admin.firestore();
const pendingWrites = []; // {ref, fieldPath, newVal} collected during scan

// Top-level collections to sweep fully.
const TOP = ['users', 'organizations', 'posts', 'community_chat', 'conversations', 'groups'];
// collectionGroup sweeps (catch subcollections under any parent).
const GROUPS = ['messages', 'content'];

const fieldHits = new Map();   // jsonPath -> count
const collHits = new Map();    // collection label -> count
const aliasHits = new Map();   // which old alias -> count
let docsScanned = 0;
let urlsFound = 0;
const samples = [];

function walk(value, path, onHit) {
  if (value == null) return;
  if (typeof value === 'string') {
    const a = matchAlias(value);
    if (a) onHit(path, value, a);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, onHit));
    return;
  }
  if (typeof value === 'object') {
    // Skip Firestore sentinels/Timestamps
    if (typeof value.toDate === 'function') return;
    for (const k of Object.keys(value)) walk(value[k], path ? `${path}.${k}` : k, onHit);
  }
}

async function scanQuerySnapshot(label, snap) {
  for (const doc of snap.docs) {
    docsScanned++;
    walk(doc.data(), '', (path, url, alias) => {
      urlsFound++;
      // Normalize array indices so [0],[3]... collapse to [] for the field tally.
      const normPath = `${label}:${path.replace(/\[\d+\]/g, '[]')}`;
      fieldHits.set(normPath, (fieldHits.get(normPath) || 0) + 1);
      collHits.set(label, (collHits.get(label) || 0) + 1);
      aliasHits.set(alias, (aliasHits.get(alias) || 0) + 1);
      // Firestore dotted field path for update(). We only ever match simple
      // dotted paths in this dataset (data.storageRef, audioUrl) — assert no
      // array segments so a --commit never silently corrupts an array element.
      if (path.includes('[')) throw new Error(`array-segment field path not supported for commit: ${path}`);
      pendingWrites.push({ ref: doc.ref, fieldPath: path, newVal: swap(url) });
      if (samples.length < 8) {
        samples.push({ doc: doc.ref.path, field: path, before: url, after: swap(url) });
      }
    });
  }
}

async function main() {
  for (const c of TOP) {
    const snap = await db.collection(c).get();
    await scanQuerySnapshot(c, snap);
    process.stderr.write(`  scanned top '${c}': ${snap.size} docs\n`);
  }
  for (const g of GROUPS) {
    const snap = await db.collectionGroup(g).get();
    await scanQuerySnapshot(`group:${g}`, snap);
    process.stderr.write(`  scanned group '${g}': ${snap.size} docs\n`);
  }

  if (COMMIT && pendingWrites.length) {
    let written = 0;
    // Batched, ≤400 per batch, idempotent (re-running after a swap matches nothing).
    for (let i = 0; i < pendingWrites.length; i += 400) {
      const chunk = pendingWrites.slice(i, i + 400);
      const batch = db.batch();
      for (const w of chunk) batch.update(w.ref, { [w.fieldPath]: w.newVal });
      await batch.commit();
      written += chunk.length;
      process.stderr.write(`  committed ${written}/${pendingWrites.length}\n`);
    }
  }

  const out = {
    mode: COMMIT ? `COMMIT — ${pendingWrites.length} fields updated` : 'DRY-RUN — no writes performed',
    oldAliases: OLD_ALIASES,
    newBucket: NEW,
    docsScanned,
    urlsFound,
    byAlias: Object.fromEntries([...aliasHits.entries()].sort((a, b) => b[1] - a[1])),
    byCollection: Object.fromEntries([...collHits.entries()].sort((a, b) => b[1] - a[1])),
    byField: Object.fromEntries([...fieldHits.entries()].sort((a, b) => b[1] - a[1])),
    samples,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

main().catch((e) => { process.stderr.write(`[dryrun] ${e.stack || e}\n`); process.exit(1); });
