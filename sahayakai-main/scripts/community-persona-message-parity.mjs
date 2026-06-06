// community-persona-message parity harness.
//
// Drives /api/community/persona-pulse on preview with one persona per
// supported language and three distinct contexts per language (33 cells
// total). After a settle window, queries the Firestore shadow_diffs
// subcollection for community-persona-message and persists both genkit
// and sidecar payloads into qa/baseline-runs-normalized/ + qa/sidecar-runs/
// so scripts/score-parity.mjs can score them.
//
// Auth: gcloud auth application-default login (no impersonation needed).

import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main';
const BASE = process.env.PREVIEW_BASE || 'https://sahayakai-preview-zwydpvyuca-as.a.run.app';
const PROJECT_ID = 'sahayakai-b4248';
const WEB_API_KEY = 'AIzaSyBKgCKW4e6YpM4HHIgAhwhJwmyQ0wRGCtw';
const UID = process.env.SIDECAR_UID || 'community-persona-parity';
const DATE_BUCKET = new Date().toISOString().slice(0, 10);
const AGENT = 'community-persona-message';

const SIDECAR_DIR = path.join(ROOT, 'qa/sidecar-runs', AGENT);
const BASELINE_DIR = path.join(ROOT, 'qa/baseline-runs-normalized', AGENT);
const STATE_DIR = path.join(ROOT, 'qa/results/lane-F/phase2-state');
fs.mkdirSync(SIDECAR_DIR, { recursive: true });
fs.mkdirSync(BASELINE_DIR, { recursive: true });
fs.mkdirSync(STATE_DIR, { recursive: true });

const ARGS = process.argv.slice(2);
const SKIP_TRAFFIC = ARGS.includes('--skip-traffic');
const SKIP_EXTRACT = ARGS.includes('--skip-extract');

// Language → personaId mapping. Each language gets exactly one persona;
// we vary recentMessages contexts to produce 3 cells per language.
const LANG_PERSONA = [
    { lang: 'en', personaId: 'persona_sneha_reddy' },
    { lang: 'hi', personaId: 'persona_rajesh_kumar' },
    { lang: 'bn', personaId: 'persona_anjali_banerjee' },
    { lang: 'ta', personaId: 'persona_lakshmi_iyer' },
    { lang: 'te', personaId: 'persona_padma_rao' },
    { lang: 'mr', personaId: 'persona_sushma_patil' },
    { lang: 'gu', personaId: 'persona_bhavna_shah' },
    { lang: 'kn', personaId: 'persona_vasanta_devi' },
    { lang: 'ml', personaId: 'persona_reshma_pillai' },
    { lang: 'pa', personaId: 'persona_gurpreet_singh' },
    { lang: 'or', personaId: 'persona_sanjukta_mohanty' },
];

// Three context variations per language. The dispatcher buckets on uid,
// not on persona/context, so all 33 calls (same uid) take the same
// dispatch path — which at shadow@100 means: genkit serves the user-facing
// response AND the sidecar is fired in parallel, producing one
// shadow_diff doc per call.
const CONTEXTS = [
    {
        ctxId: 'tip',
        recentMessages: [
            {
                authorName: 'Priya Mehta',
                text: 'Has anyone tried using small group activities for revision?',
            },
        ],
        mode: 'auto',
    },
    {
        ctxId: 'ncert',
        recentMessages: [
            {
                authorName: 'Rakesh Verma',
                text: 'How are you covering the NCERT chapter on fractions for Class 5?',
            },
            {
                authorName: 'Sunita Sharma',
                text: 'I use story-based examples — kids remember better.',
            },
        ],
        mode: 'auto',
    },
    {
        ctxId: 'fresh',
        recentMessages: [],
        mode: 'fresh',
    },
];

// 11 × 3 = 33 cells.
const CELLS = [];
for (const { lang, personaId } of LANG_PERSONA) {
    for (const ctx of CONTEXTS) {
        CELLS.push({
            fname: `${lang}-${personaId.replace('persona_', '')}-${ctx.ctxId}.json`,
            lang,
            personaId,
            ctxId: ctx.ctxId,
            recentMessages: ctx.recentMessages,
            mode: ctx.mode,
        });
    }
}

console.log(`community-persona-message parity harness`);
console.log(`  date bucket: ${DATE_BUCKET}`);
console.log(`  base:        ${BASE}`);
console.log(`  uid:         ${UID}`);
console.log(`  cells:       ${CELLS.length}`);

const app = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
    serviceAccountId: 'firebase-adminsdk-fbsvc@sahayakai-b4248.iam.gserviceaccount.com',
});
const db = admin.firestore();

let idToken = null;
async function mintIdToken() {
    const ct = await app.auth().createCustomToken(UID, { planType: 'premium' });
    const r = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: ct, returnSecureToken: true }),
        },
    );
    const j = await r.json();
    if (!j.idToken) throw new Error('mint failed: ' + JSON.stringify(j));
    return j.idToken;
}

const RATE_DELAY_MS = 1500;
const CALL_TIMEOUT_MS = 60_000;
const BACKOFF_MS = [15_000, 30_000];

async function rawCall(body) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), CALL_TIMEOUT_MS);
    const t0 = Date.now();
    try {
        const r = await fetch(BASE + '/api/community/persona-pulse', {
            method: 'POST',
            signal: ctl.signal,
            headers: {
                Authorization: `Bearer ${idToken}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        const txt = await r.text();
        return { status: r.status, body: txt, ms: Date.now() - t0 };
    } catch (e) {
        return { status: 0, body: String(e), ms: Date.now() - t0 };
    } finally {
        clearTimeout(to);
    }
}

async function callCell(cell) {
    const body = {
        personaId: cell.personaId,
        recentMessages: cell.recentMessages,
        mode: cell.mode,
    };
    let res = await rawCall(body);
    if (res.status === 401) {
        idToken = await mintIdToken();
        res = await rawCall(body);
    }
    let bi = 0;
    while ((res.status === 503 || res.status === 429 || res.status === 502) && bi < BACKOFF_MS.length) {
        await new Promise(r => setTimeout(r, BACKOFF_MS[bi++]));
        res = await rawCall(body);
    }
    return res;
}

async function driveTraffic() {
    console.log(`\n=== TRAFFIC ===`);
    idToken = await mintIdToken();
    const ledger = [];
    let n = 0;
    for (const cell of CELLS) {
        n++;
        const t0 = Date.now();
        const res = await callCell(cell);
        const t1 = Date.now();
        let parsed = null;
        try { parsed = JSON.parse(res.body); } catch { /* */ }
        const ok = res.status === 200 && parsed && typeof parsed.message === 'string';
        ledger.push({
            fname: cell.fname,
            lang: cell.lang,
            personaId: cell.personaId,
            ctxId: cell.ctxId,
            t0_ms: t0,
            t1_ms: t1,
            status: res.status,
            message: ok ? parsed.message : null,
            error: ok ? null : (parsed?.error || res.body?.slice(0, 200)),
        });
        const tag = ok ? `OK ${parsed.message?.slice(0, 40)}…` : `FAIL(${res.status})`;
        console.log(`  (${n}/${CELLS.length}) ${cell.lang} ${cell.ctxId} → ${tag} ${t1 - t0}ms`);
        if (ok) {
            // Write genkit baseline (the message returned to the user is the
            // genkit message in shadow mode).
            fs.writeFileSync(
                path.join(BASELINE_DIR, cell.fname),
                JSON.stringify({ message: parsed.message }, null, 2),
            );
        }
        const wait = Math.max(0, RATE_DELAY_MS - (t1 - t0));
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
    }
    fs.writeFileSync(
        path.join(STATE_DIR, `${AGENT}-traffic-ledger.json`),
        JSON.stringify({
            agent: AGENT,
            dateBucket: DATE_BUCKET,
            startedAt: ledger[0]?.t0_ms,
            finishedAt: ledger[ledger.length - 1]?.t1_ms,
            ledger,
        }, null, 2),
    );
    const okCount = ledger.filter(l => l.status === 200).length;
    console.log(`  baseline-ok cells: ${okCount} / ${ledger.length}`);
    return ledger;
}

async function extractSidecar() {
    console.log(`\n=== EXTRACT ===`);
    const ledgerPath = path.join(STATE_DIR, `${AGENT}-traffic-ledger.json`);
    if (!fs.existsSync(ledgerPath)) {
        throw new Error(`no ledger at ${ledgerPath}`);
    }
    const { ledger, startedAt } = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    const lowerBound = new Date(startedAt - 5_000);

    // shadow_diffs land under `agent_shadow_diffs/{date}/community-persona-message`.
    // Settle window so writes catch up.
    console.log(`  settling 30s for Firestore writes…`);
    await new Promise(r => setTimeout(r, 30_000));

    const ref = db.collection('agent_shadow_diffs').doc(DATE_BUCKET).collection(AGENT);
    const snap = await ref
        .where('createdAt', '>=', lowerBound)
        .orderBy('createdAt', 'asc')
        .get();

    const docs = snap.docs.filter(d => d.data().uid === UID).map(d => {
        const data = d.data();
        const created = data.createdAt;
        return {
            id: d.id,
            createdAt_ms: created?.toMillis ? created.toMillis() : Date.parse(created),
            sidecar: data.sidecar,
            sidecarOk: data.sidecarOk,
            sidecarError: data.sidecarError,
        };
    });
    console.log(`  fetched ${docs.length} shadow_diff docs from Firestore`);

    const matched = [];
    const missing = [];
    const used = new Set();
    for (const row of ledger) {
        if (row.status !== 200) {
            missing.push({ ...row, reason: 'preview-non-200' });
            continue;
        }
        const lo = row.t0_ms - 1_000;
        const hi = row.t1_ms + 30_000;
        const cands = docs.filter(d => !used.has(d.id) && d.createdAt_ms >= lo && d.createdAt_ms <= hi);
        if (cands.length === 0) {
            missing.push({ ...row, reason: 'no-firestore-doc' });
            continue;
        }
        cands.sort((a, b) => Math.abs(a.createdAt_ms - row.t1_ms) - Math.abs(b.createdAt_ms - row.t1_ms));
        const pick = cands[0];
        used.add(pick.id);
        if (!pick.sidecarOk || pick.sidecar == null) {
            missing.push({ ...row, reason: `sidecar-not-ok(${pick.sidecarError ?? 'null-payload'})`, docId: pick.id });
            continue;
        }
        const ENVELOPE_META = new Set(['sidecarVersion', 'latencyMs', 'modelUsed', 'groundingUsed']);
        const cleaned = {};
        for (const [k, v] of Object.entries(pick.sidecar)) {
            if (!ENVELOPE_META.has(k)) cleaned[k] = v;
        }
        fs.writeFileSync(path.join(SIDECAR_DIR, row.fname), JSON.stringify(cleaned, null, 2));
        matched.push({ ...row, docId: pick.id });
    }
    const report = {
        agent: AGENT,
        total: ledger.length,
        matched: matched.length,
        missing: missing.length,
        missingDetails: missing,
    };
    fs.writeFileSync(path.join(STATE_DIR, `${AGENT}-extract-report.json`), JSON.stringify(report, null, 2));
    console.log(`  matched=${matched.length} missing=${missing.length} total=${ledger.length}`);
    return report;
}

if (!SKIP_TRAFFIC) {
    await driveTraffic();
}
if (!SKIP_EXTRACT) {
    await extractSidecar();
}
process.exit(0);
