// Hit the lesson-plan staging sidecar directly to re-verify Odia parity
// after the writer-prompt fix. Bypasses Next.js dispatcher / shadow mode.
//
// Writes the response into qa/sidecar-runs/lesson-plan/or-<cell>.json
// in the same shape extractSidecar() in phase2-collect-sidecar.mjs uses,
// so score-parity.mjs can re-grade with no changes.
//
// Auth: GoogleAuth ID token against the staging service audience.
// Requires either ADC + invoker permission, or running on a machine
// where you can mint an ID token for the staging audience.
//
// Usage:
//   node scripts/lesson-plan-odia-direct-sidecar.mjs

import fs from 'fs';
import path from 'path';
import { GoogleAuth } from 'google-auth-library';

const STAGING_URL = process.env.SIDECAR_URL || 'https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app';
const AUDIENCE = STAGING_URL;
const ROOT = '/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main';
const SIDECAR_ROOT = path.join(ROOT, 'qa/sidecar-runs/lesson-plan');

const CELLS = [
    { id: 'g3-math-fractions', gradeLabel: 'Class 3', subject: 'Mathematics', topic: 'Fractions' },
    { id: 'g3-science-watercycle', gradeLabel: 'Class 3', subject: 'Science', topic: 'Water Cycle' },
];

const auth = new GoogleAuth();
const tokenClient = await auth.getIdTokenClient(AUDIENCE);

const ENVELOPE_META = new Set(['sidecarVersion', 'latencyMs', 'modelUsed', 'groundingUsed']);

for (const cell of CELLS) {
    console.log(`\n→ or-${cell.id}`);
    const body = {
        userId: 'parity-odia-reverify',
        topic: cell.topic,
        subject: cell.subject,
        gradeLevels: [cell.gradeLabel],
        language: 'Odia',
        resourceLevel: 'medium',
        difficultyLevel: 'standard',
        useRuralContext: false,
    };
    const t0 = Date.now();
    let resp;
    try {
        resp = await tokenClient.request({
            url: STAGING_URL + '/v1/lesson-plan/generate',
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            data: body,
            timeout: 120_000,
        });
    } catch (e) {
        console.log(`  request failed: ${e.message}`);
        if (e.response?.data) console.log(`  body: ${JSON.stringify(e.response.data).slice(0, 400)}`);
        continue;
    }
    const dur = Date.now() - t0;
    console.log(`  status=${resp.status} latency=${dur}ms`);
    const payload = resp.data;
    const cleaned = {};
    for (const [k, v] of Object.entries(payload)) {
        if (!ENVELOPE_META.has(k)) cleaned[k] = v;
    }
    const out = path.join(SIDECAR_ROOT, `or-${cell.id}.json`);
    fs.writeFileSync(out, JSON.stringify(cleaned, null, 2));
    console.log(`  wrote ${out}`);
    const primary = (cleaned.title || '') + '\n' + (cleaned.objectives || []).join('\n');
    const latin = [...primary].filter(c => /[A-Za-z]/.test(c)).length;
    const oriya = [...primary].filter(c => c >= '଀' && c <= '୿').length;
    console.log(`  primary: latin=${latin} oriya=${oriya}`);
    console.log(`  title: ${cleaned.title}`);
    for (const o of cleaned.objectives || []) console.log(`  obj: ${o}`);
}
