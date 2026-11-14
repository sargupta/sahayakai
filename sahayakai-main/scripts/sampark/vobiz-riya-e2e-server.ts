/**
 * LOCAL e2e proof for Sampark × Vobiz (development only, never deployed, dials nothing):
 *
 *   npx tsx scripts/sampark/vobiz-riya-e2e-server.ts --port 3101 [--provider vobiz|elevenlabs]
 *
 * Runs the REAL Sampark Riya service (startRiyaCall, the Vobiz provider, the four public legs,
 * the shared reducer, callback proposals) on in-memory repos. The ONLY fake is the Vobiz REST
 * "place call" request (captured, never sent). It then:
 *   1. starts ONE Riya call through startRiyaCall for a synthetic family (Test mode, test phone);
 *   2. answers it through handleVobizRiyaAnswer and prints the bridge stream path (token-bound);
 *   3. serves GET /api/webhooks/vobiz-riya/context and POST /api/webhooks/vobiz-riya/event, so the
 *      real Python bridge fetches the variables and reports the result exactly as in production;
 *   4. GET /debug/call returns the stored call (state, answers, synopsis) and proposed callbacks.
 *
 * Needs SAHAYAKAI_REQUEST_SIGNING_KEY (the same key the bridge uses). Synthetic data only.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

import { createMemoryCallbackRepo } from '@/lib/sampark/callbacks/repo';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import { RIYA_PURPOSES, type RiyaPurpose } from '@/lib/sampark/conversation/riya-purposes';
import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import { vobizRiyaRef } from '@/lib/sampark/conversation/vobiz-provider';
import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { mintVobizToken, VOBIZ_DOMAINS } from '@/lib/vobiz/tokens';
import { previewRiyaCall, riyaAvailability, startRiyaCall, type RiyaDeps } from '@/server/sampark/conversation';
import { handleVobizRiyaAnswer, handleVobizRiyaContext, handleVobizRiyaEvent, handleVobizRiyaStatus } from '@/server/sampark/vobiz-riya';

import { guardian, prefs, school, student } from '../../src/__tests__/sampark/engine/_fixtures';

const arg = (k: string, d: string) => {
    const i = process.argv.indexOf(`--${k}`);
    return i > 0 ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', '3101'));
const PURPOSE = arg('purpose', 'ptm_invitation') as RiyaPurpose;
const ORG = 'hillview-demo';
/**
 * --real-dial: ONE real call, only to the user-authorised test number, through real Vobiz, on the
 * real clock (Sampark's own calling-hours gate applies). Needs VOBIZ_AUTH_ID/TOKEN/FROM_NUMBER,
 * E2E_PUBLIC_BASE (https tunnel to this server), E2E_BRIDGE_BASE (https tunnel to the bridge) and
 * E2E_MARKER (a file path: refuses if it exists, written BEFORE the dial, so never twice).
 */
const REAL = process.argv.includes('--real-dial');
const AUTHORISED_TEST_PHONE = '+918431339732'; // Alyssa's test number (verified against call fdec5de6)
const TEST_PHONE = REAL ? AUTHORISED_TEST_PHONE : '+919800000001'; // else synthetic, never dialled

if (!process.env.SAHAYAKAI_REQUEST_SIGNING_KEY?.trim()) throw new Error('SAHAYAKAI_REQUEST_SIGNING_KEY is required');
if (REAL) {
    for (const k of ['VOBIZ_AUTH_ID', 'VOBIZ_AUTH_TOKEN', 'VOBIZ_FROM_NUMBER', 'E2E_PUBLIC_BASE', 'E2E_BRIDGE_BASE', 'E2E_MARKER']) {
        if (!process.env[k]?.trim()) throw new Error(`${k} is required for --real-dial`);
    }
    if (fs.existsSync(process.env.E2E_MARKER!)) throw new Error('refused: a real call was already placed from this marker (no retries)');
}
process.env.SAMPARK_PII_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.SAMPARK_PHONE_PEPPER = 'local-e2e-pepper';
process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';

const env: Record<string, string | undefined> = {
    SAMPARK_ENABLED: 'true',
    SAMPARK_ELEVENLABS_ENABLED: 'true',
    SAMPARK_RIYA_PURPOSES: RIYA_PURPOSES.join(','),
    SAMPARK_LIVE_DIAL_ENABLED: 'true',
    SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod',
    SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: TEST_PHONE,
    SAMPARK_RIYA_STORE_TRANSCRIPTS: 'true',
    SAMPARK_VOBIZ_RIYA_ENABLED: 'true',
    VOBIZ_AUTH_ID: REAL ? process.env.VOBIZ_AUTH_ID : 'LOCAL_E2E_NOT_REAL',
    VOBIZ_AUTH_TOKEN: REAL ? process.env.VOBIZ_AUTH_TOKEN : 'LOCAL_E2E_NOT_REAL',
    VOBIZ_FROM_NUMBER: REAL ? process.env.VOBIZ_FROM_NUMBER : '+918000000000',
    VOBIZ_BASE_URL: process.env.VOBIZ_BASE_URL,
    SAMPARK_PUBLIC_BASE_URL: REAL ? process.env.E2E_PUBLIC_BASE : `http://127.0.0.1:${PORT}`,
    VOBIZ_STREAM_BASE_URL: REAL ? process.env.E2E_BRIDGE_BASE : 'http://127.0.0.1:8080',
    SAMPARK_RIYA_TEST_DAILY_CAP: '1',
    SAHAYAKAI_REQUEST_SIGNING_KEY: process.env.SAHAYAKAI_REQUEST_SIGNING_KEY,
};

const FACTS: Partial<Record<RiyaPurpose, RiyaFacts>> = {
    ptm_invitation: { purpose: 'ptm_invitation', date: '2026-11-14', time: { hour: 10, minute: 0 } },
    classroom_behaviour: { purpose: 'classroom_behaviour', observations: ['incomplete_classwork'] },
};

async function main() {
    const repo = createMemorySamparkRepo();
    const calls = createMemoryConversationRepo();
    const callbacks = createMemoryCallbackRepo();
    // Real dial: the real clock, so Sampark's calling-hours gate is the real one.
    const clock = REAL ? { now: () => new Date() } : { now: () => new Date('2026-11-09T06:00:00Z') }; // 11:30 IST
    const placed: unknown[] = [];
    const fakeVobiz = (async (url: string, init?: RequestInit) => {
        placed.push({ url: String(url).replace(/Account\/[^/]+/, 'Account/<id>'), body: JSON.parse(String(init?.body ?? '{}')) });
        return new Response(JSON.stringify({ request_uuid: crypto.randomUUID(), message: 'call queued (captured locally, not sent)' }), { status: 201 });
    }) as unknown as typeof fetch;
    const realVobiz = (async (url: string, init?: RequestInit) => {
        fs.writeFileSync(process.env.E2E_MARKER!, JSON.stringify({ at: new Date().toISOString() })); // before the request: never twice
        const res = await fetch(url, init);
        const text = await res.text();
        let uuid = '';
        try { uuid = String(JSON.parse(text).request_uuid ?? ''); } catch { /* unreadable */ }
        console.log(`[e2e] REAL Vobiz place -> http ${res.status} request_uuid=${uuid}`);
        fs.writeFileSync(process.env.E2E_MARKER!, JSON.stringify({ at: new Date().toISOString(), http: res.status, request_uuid: uuid }));
        return new Response(text, { status: res.status, headers: res.headers });
    }) as unknown as typeof fetch;
    const deps: RiyaDeps = { repo, calls, callbacks, clock, wallClock: { now: () => new Date() }, env, http: { fetchImpl: REAL ? realVobiz : fakeVobiz } };

    const base = school();
    await repo.upsertSchool(school({
        // "Sahayak Demo School": its opening is pre-recorded in Riya's voice (instant playback).
        spokenName: { ...base.spokenName, English: 'Sahayak Demo School' }, displayName: 'Sahayak Demo School',
        mode: 'test', testPhoneEnc: encryptPhone(TEST_PHONE), testPhoneHash: hashPhone(TEST_PHONE), testPhoneLast4: TEST_PHONE.slice(-4),
        conversationProvider: arg('provider', 'vobiz') as 'vobiz' | 'elevenlabs',
    }));
    await repo.upsertStudents(ORG, [student('s1', { spokenFirstName: { English: 'Aarav' }, guardianIds: ['g1'] })]);
    await repo.upsertGuardians(ORG, [guardian('g1', { phoneEnc: encryptPhone('+919811111111'), phoneHash: hashPhone('+919811111111'), phoneLast4: '1111', phoneClass: 'mobile', crmLanguage: 'English', studentIds: ['s1'] })]);
    await repo.upsertPreferences([prefs('g1', { notices: 'granted', progress: 'granted', recorded_conversation: 'granted' })]);

    const s = await repo.getSchool(ORG);
    const avail = riyaAvailability(s!, env);
    console.log(`[e2e] availability: provider=${avail.provider} selected=${avail.selectedProvider} blocker=${avail.blocker}`);
    const facts = FACTS[PURPOSE];
    const preview = await previewRiyaCall(deps, ORG, { purpose: PURPOSE, guardianId: 'g1', studentId: 's1', facts });
    if (!preview.ok) throw new Error(`preview refused: ${JSON.stringify(preview.refusals)}`);
    const started = await startRiyaCall(deps, ORG, 'local-admin', {
        purpose: PURPOSE, guardianId: 'g1', studentId: 's1', facts, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: preview.announcement!,
    });
    const call = started.call;
    console.log(`[e2e] call ${call.id} provider=${call.provider} state=${call.state} conv=${call.providerConversationId}`);
    if (!REAL) {
        console.log(`[e2e] captured Vobiz request (not sent): ${JSON.stringify(placed[0]).replace(/t=[^"&]+/g, 't=<token>')}`);
        const answerTok = (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_ANSWER, vobizRiyaRef(ORG, call.id))).token;
        // Vobiz answers with the same uuid it returned when the call was placed.
        const placedUuid = (call.providerConversationId ?? '').replace(/^vobiz:/, '');
        const answered = await handleVobizRiyaAnswer(deps, answerTok, placedUuid);
        const m = /<Stream[^>]*>([^<]+)<\/Stream>/.exec(answered.xml);
        const streamUrl = (m?.[1] ?? '').replace(/&amp;/g, '&');
        console.log(`[e2e] STREAM_URL=${streamUrl}`);
    }

    const readForm = async (req: http.IncomingMessage): Promise<Record<string, string>> => {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const out: Record<string, string> = {};
        for (const [k, v] of new URLSearchParams(raw)) out[k] = v.slice(0, 200);
        return out;
    };

    http.createServer(async (req, res) => {
        const u = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
        try {
            if (req.method === 'POST' && u.pathname === '/api/webhooks/vobiz-riya/answer') {
                const form = await readForm(req);
                const out = await handleVobizRiyaAnswer(deps, u.searchParams.get('t'), form.CallUUID ?? null);
                console.log(`[e2e] answer -> ${out.xml.includes('<Stream') ? 'stream' : 'hangup'}`);
                res.writeHead(out.status, { 'content-type': 'application/xml' }).end(out.xml);
                return;
            }
            if (req.method === 'POST' && u.pathname === '/api/webhooks/vobiz-riya/status') {
                const form = await readForm(req);
                await handleVobizRiyaStatus(deps, u.searchParams.get('t'), u.searchParams.get('kind'), form);
                console.log(`[e2e] status ${u.searchParams.get('kind')} cause=${form.HangupCause ?? ''}`);
                res.writeHead(200).end('OK');
                return;
            }
            if (req.method === 'GET' && u.pathname === '/api/webhooks/vobiz-riya/context') {
                const out = await handleVobizRiyaContext(deps, u.searchParams.get('t'));
                console.log(`[e2e] context -> ${out.status}`);
                res.writeHead(out.status, { 'content-type': 'application/json' }).end(JSON.stringify(out.body));
                return;
            }
            if (req.method === 'POST' && u.pathname === '/api/webhooks/vobiz-riya/event') {
                let raw = '';
                for await (const chunk of req) raw += chunk;
                const out = await handleVobizRiyaEvent(deps, raw, (req.headers['x-riya-bridge-signature'] as string) ?? null);
                console.log(`[e2e] event -> ${out.status}`);
                res.writeHead(out.status, { 'content-type': 'application/json' }).end(JSON.stringify(out.body));
                return;
            }
            if (u.pathname === '/debug/call') {
                const c = await calls.getCall(ORG, call.id);
                const proposals = await callbacks.listProposed(ORG, 10);
                res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
                    state: c?.state, provider: c?.provider, durationSeconds: c?.durationSeconds, terminationReason: c?.terminationReason,
                    callSuccessful: c?.callSuccessful, dataCollection: c?.dataCollection, stopRequested: c?.stopRequested,
                    synopsis: c?.synopsis, transcriptTurns: c?.transcript?.length ?? 0,
                    transcript: (c?.transcript ?? []).map((t) => `${t.role}: ${t.message}`),
                    callbacks: proposals.map((p) => ({ status: p.status, request: (p as unknown as { requestText?: string }).requestText ?? null })),
                }, null, 1));
                return;
            }
            res.writeHead(404).end();
        } catch (err) {
            console.error('[e2e] error', err);
            res.writeHead(500).end();
        }
    }).listen(PORT, '127.0.0.1', () => console.log(`[e2e] listening on ${PORT}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
