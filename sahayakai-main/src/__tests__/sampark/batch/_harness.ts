/**
 * Shared fixtures for the class-wide batch tests: an in-memory school with roster families, a
 * mocked Vobiz REST API that records every dial, and helpers that deliver Vobiz hangups and signed
 * bridge reports through the SAME public handlers production uses. Nothing here reaches a network.
 */

import crypto from 'node:crypto';

import { createMemoryBatchRepo } from '@/lib/sampark/batch/repo';
import { BATCH_PURPOSES, INDIVIDUAL_ONLY_PURPOSES, isBatchablePurpose } from '@/lib/sampark/batch/reasons';
import { isRetryable } from '@/lib/sampark/batch/state';
import { createMemoryCallbackRepo } from '@/lib/sampark/callbacks/repo';
import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import { RIYA_PURPOSES } from '@/lib/sampark/conversation/riya-purposes';
import { signBridgeBody, vobizRiyaRef } from '@/lib/sampark/conversation/vobiz-provider';
import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import type { AuditEntry } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { SARGVISION_ORG_ID } from '@/lib/sampark/sargvision';
import { _resetVobizKeyCacheForTest, mintVobizToken, VOBIZ_DOMAINS } from '@/lib/vobiz/tokens';
import {
    actOnBatch,
    advanceBatch,
    batchAttemptKey,
    createBatch,
    getBatch,
    listBatchClasses,
    listBatches,
    previewBatch,
    runBatchTick,
    type BatchCreateInput,
    type BatchDeps,
} from '@/server/sampark/batch-calls';
import { previewRiyaCall, riyaCallId, startRiyaCall } from '@/server/sampark/conversation';
import { SamparkServiceError } from '@/server/sampark/errors';
import { handleVobizRiyaContext, handleVobizRiyaEvent, handleVobizRiyaStatus } from '@/server/sampark/vobiz-riya';
import type { SamparkGuardian, SamparkSchool } from '@/types/sampark';

import { guardian, prefs, school, student, testClock, type TestClock } from '../engine/_fixtures';
import { setPhoneEnv } from '../server/_helpers';


export const WED_11_IST = new Date('2026-10-07T05:30:00Z');
export const WED_21_IST = new Date('2026-10-07T15:30:00Z');
export const ADMIN = 'admin-uid';
export const TEACHER_7A = 'teacher-7a';
export const KEY = 'test-signing-key-not-real-0123456789';
export const HOLIDAY: RiyaFacts = { purpose: 'holiday_notice', dates: ['2026-10-19'] };
export const EXAM: RiyaFacts = { purpose: 'exam_schedule_notice', entries: [{ subject: 'mathematics', date: '2026-11-02', time: { hour: 9, minute: 30 } }] };

// Test-only numbers (not real people): +9198000100NN for family NN.
export const phoneOf = (n: number) => `+91980001${String(1000 + n).slice(1)}`;
export const pad = (n: number) => String(n).padStart(2, '0');

export interface Family { n: number; name?: string; phone?: string | null; invalid?: boolean; optOut?: 'suppressed' | 'crm' | 'consent_denied' | 'no_recording_consent'; language?: 'English' | 'Hindi'; grade?: number; section?: string }

export interface Setup {
    deps: BatchDeps;
    repo: ReturnType<typeof createMemorySamparkRepo>;
    calls: ReturnType<typeof createMemoryConversationRepo>;
    batches: ReturnType<typeof createMemoryBatchRepo>;
    callbacks: ReturnType<typeof createMemoryCallbackRepo>;
    clock: TestClock;
    fetchImpl: jest.Mock;
    dials: { to: string; answerUrl: string; at: number; timeLimit?: number }[];
    audits: AuditEntry[];
    /** Wake-ups the scheduler asked for (no real timers in tests). */
    wakes: { campaignId: string; at: string }[];
    env: Record<string, string | undefined>;
    org: string;
}

export function baseEnv(): Record<string, string | undefined> {
    return { SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'true', SAMPARK_RIYA_PURPOSES: RIYA_PURPOSES.join(',') };
}

/** Local Sargvision roster on Vobiz: each family's own allow-listed number rings (mocked here). */
export function vobizRosterEnv(allowed: string[], over: Record<string, string | undefined> = {}): Record<string, string | undefined> {
    return {
        ...baseEnv(),
        NODE_ENV: 'test',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        SAMPARK_LIVE_DIAL_ENABLED: 'true',
        SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod',
        SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: allowed.join(','),
        SAMPARK_RIYA_TEST_DAILY_CAP: '5',
        SAMPARK_VOBIZ_RIYA_ENABLED: 'true',
        VOBIZ_AUTH_ID: 'MA_TEST_ONLY',
        VOBIZ_AUTH_TOKEN: 'tok_test_only',
        VOBIZ_FROM_NUMBER: '+918000000000',
        SAMPARK_PUBLIC_BASE_URL: 'https://sampark.example.test',
        VOBIZ_STREAM_BASE_URL: 'https://bridge.example.test',
        SAHAYAKAI_REQUEST_SIGNING_KEY: KEY,
        SAMPARK_BATCH_REAL_CALLS: 'true',
        SAMPARK_BATCH_DIAL_GAP_SECONDS: '0',
        ...over,
    };
}

/**
 * Programmable Vobiz behaviour for one test: the next Make Call answers (429 with an optional
 * Retry-After, 5xx, network error), and what a read-only call lookup returns per CallUUID.
 */
export interface VobizScript {
    /** Responses for the next Make Call requests, consumed in order; then 201. */
    next: ({ status: 429; retryAfter?: number } | { status: 500 } | { status: 'network' })[];
    /** Lookup body per CallUUID; default: still in progress. 'down' → network error; 404 → not found. */
    lookup: Map<string, Record<string, unknown> | 'down' | 404>;
}

export function vobizScript(): VobizScript {
    return { next: [], lookup: new Map() };
}

/**
 * A Vobiz 429. Built by hand because jest.setup's Response polyfill drops headers; this keeps a
 * lower-cased header map, which is what `Headers.get` reads in production.
 */
export function rateLimited(retryAfter?: number): Response {
    const body = JSON.stringify({ error: "you've been rate limited. please try after sometime" });
    return {
        ok: false, status: 429,
        headers: new Map(retryAfter ? [['retry-after', String(retryAfter)]] : []),
        json: async () => JSON.parse(body), text: async () => body,
    } as unknown as Response;
}

/** A Vobiz REST mock: every dial is recorded and gets its own CallUUID; `reject` numbers get a 400. */
export function vobizMock(dials: Setup['dials'], reject: Set<string> = new Set(), script: VobizScript = vobizScript(), clock?: { now: () => Date }) {
    let n = 0;
    return jest.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST' && /\/Call\/$/.test(url)) {
            const body = JSON.parse(String(init.body)) as { to: string; answer_url: string; time_limit?: number };
            const to = `+${body.to}`;
            dials.push({ to, answerUrl: body.answer_url, at: clock?.now().getTime() ?? 0, timeLimit: body.time_limit });
            if (reject.has(to)) return new Response(JSON.stringify({ error: 'invalid destination number' }), { status: 400 });
            const scripted = script.next.shift();
            if (scripted?.status === 429) return rateLimited(scripted.retryAfter);
            if (scripted?.status === 500) return new Response('{}', { status: 500 });
            if (scripted?.status === 'network') throw new TypeError('fetch failed');
            n += 1;
            return new Response(JSON.stringify({ request_uuid: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, message: 'call queued' }), { status: 201 });
        }
        // Read-only call lookups (Check status): scripted per uuid, default not ended yet.
        const uuid = /\/Call\/([^/]+)\/$/.exec(url)?.[1] ?? '';
        const l = script.lookup.get(decodeURIComponent(uuid));
        if (l === 'down') throw new TypeError('fetch failed');
        if (l === 404) return new Response('{}', { status: 404 });
        return new Response(JSON.stringify(l ?? { call_status: 'in-progress' }), { status: 200 });
    });
}

export async function setup(opts: {
    families?: Family[];
    count?: number;
    provider?: 'practice' | 'vobiz-roster' | 'elevenlabs-roster' | 'vobiz-test-phone';
    allow?: 'all' | number[];
    env?: Record<string, string | undefined>;
    reject?: string[];
    at?: Date;
    concurrency?: number;
    script?: VobizScript;
} = {}): Promise<Setup> {
    setPhoneEnv();
    process.env.SAHAYAKAI_REQUEST_SIGNING_KEY = KEY;
    _resetVobizKeyCacheForTest();
    const provider = opts.provider ?? 'practice';
    const families: Family[] = opts.families ?? Array.from({ length: opts.count ?? 30 }, (_, i) => ({ n: i + 1 }));
    const org = provider === 'practice' ? 'hillview-demo' : SARGVISION_ORG_ID;
    const allowed = (opts.allow ?? 'all') === 'all' ? families.map((f) => f.phone ?? phoneOf(f.n)) : (opts.allow as number[]).map(phoneOf);
    let env = provider === 'practice' ? baseEnv() : vobizRosterEnv(allowed);
    if (provider === 'elevenlabs-roster') env = { ...env, ELEVENLABS_API_KEY: 'sk_test_not_a_real_key_0123456789', ELEVENLABS_AGENT_ID: 'agent_2401m4zy4gyaev48rz65wfmf5yr2', ELEVENLABS_AGENT_PHONE_NUMBER_ID: 'phnum_0000testtesttesttesttest00', ELEVENLABS_SOURCE_AGENT_ID: 'agent_0000sourcesourcesourcesource00', ELEVENLABS_WEBHOOK_SECRET: 'whsec_test_only' };
    if (opts.concurrency) env.SAMPARK_BATCH_MAX_CONCURRENCY = String(opts.concurrency);
    env = { ...env, ...opts.env };
    process.env.SAMPARK_LIVE_DIAL_ENABLED = env.SAMPARK_LIVE_DIAL_ENABLED; // evaluateGate reads it from process.env

    const repo = createMemorySamparkRepo();
    const calls = createMemoryConversationRepo();
    const batches = createMemoryBatchRepo();
    const callbacks = createMemoryCallbackRepo();
    const clock = testClock(opts.at ?? WED_11_IST);
    const testPhone = '+919800000001';
    const s: Partial<SamparkSchool> = {
        orgId: org,
        mode: provider === 'practice' ? 'practice' : 'test',
        holidays: ['2026-10-19', '2026-10-20'],
        conversationProvider: provider === 'elevenlabs-roster' ? 'elevenlabs' : 'vobiz',
        ...(provider === 'vobiz-test-phone' ? { orgId: 'hillview-demo', testPhoneEnc: encryptPhone(testPhone), testPhoneHash: hashPhone(testPhone), testPhoneLast4: '0001' } : {}),
    };
    const schoolOrg = s.orgId as string;
    await repo.upsertSchool(school(s));
    const students = families.map((f) => ({
        ...student(`s${pad(f.n)}`, { grade: f.grade ?? 7, section: f.section ?? 'A', spokenFirstName: { English: f.name ?? `Kid${pad(f.n)}` }, displayName: f.name ?? `Kid${pad(f.n)}`, guardianIds: f.phone === null ? [] : [`g${pad(f.n)}`] }),
        orgId: schoolOrg,
    }));
    await repo.upsertStudents(schoolOrg, students);
    const guardians: SamparkGuardian[] = families.filter((f) => f.phone !== null).map((f) => {
        const phone = f.phone ?? phoneOf(f.n);
        return {
            ...guardian(`g${pad(f.n)}`, {
                displayName: `Parent${pad(f.n)}`,
                phoneEnc: f.invalid ? '' : encryptPhone(phone),
                phoneHash: f.invalid ? '' : hashPhone(phone),
                phoneLast4: phone.slice(-4),
                phoneClass: f.invalid ? 'invalid' : 'mobile',
                crmLanguage: f.language ?? 'English',
                crmDoNotContact: f.optOut === 'crm',
                studentIds: [`s${pad(f.n)}`],
            }),
            orgId: schoolOrg,
        };
    });
    await repo.upsertGuardians(schoolOrg, guardians);
    await repo.upsertPreferences(families.filter((f) => f.phone !== null).map((f) => ({
        ...prefs(`g${pad(f.n)}`, {
            notices: f.optOut === 'consent_denied' ? 'denied' : 'granted',
            progress: 'granted',
            recorded_conversation: f.optOut === 'no_recording_consent' ? 'unknown' : 'granted',
        }),
        orgId: schoolOrg,
    })));
    for (const f of families.filter((x) => x.optOut === 'suppressed')) {
        await repo.upsertSuppression({ orgId: schoolOrg, phoneHash: hashPhone(f.phone ?? phoneOf(f.n)), phoneLast4: '0000', scope: 'routine', source: 'conversation_request', officeVerification: 'confirmed', createdAt: '2026-10-01T00:00:00.000Z', callId: null } as never);
    }
    const audits: AuditEntry[] = [];
    const original = repo.appendAudit.bind(repo);
    repo.appendAudit = async (o, entry) => { audits.push(entry); await original(o, entry); };
    const dials: Setup['dials'] = [];
    const fetchImpl = vobizMock(dials, new Set(opts.reject ?? []), opts.script ?? vobizScript(), clock);
    const wakes: Setup['wakes'] = [];
    const deps: BatchDeps = {
        repo, calls, callbacks, clock, wallClock: clock, env, http: { fetchImpl: fetchImpl as unknown as typeof fetch },
        batches,
        canManageClass: async (_o, uid, grade, section) => uid === ADMIN || (uid === TEACHER_7A && grade === 7 && section === 'A'),
        isOrgAdmin: async (_o, uid) => uid === ADMIN,
        scheduleWake: (_o, campaignId, at) => { wakes.push({ campaignId, at: at.toISOString() }); },
    };
    return { deps, repo, calls, batches, callbacks, clock, fetchImpl, dials, audits, env, org: schoolOrg, wakes };
}

export async function createFrom(t: Setup, over: Partial<BatchCreateInput> = {}, uid = ADMIN) {
    const req = { grade: 7, section: 'A', reason: 'holiday_announcement' as const, facts: HOLIDAY, excluded: [], ...over };
    const { grade, section, reason, facts, excluded } = req;
    const preview = await previewBatch(t.deps, t.org, uid, { grade, section, reason, facts, excluded });
    return createBatch(t.deps, t.org, uid, {
        ...req,
        requestKey: crypto.randomUUID(),
        confirmedRecipientCount: preview.totals.eligible,
        confirmedSampleAnnouncement: preview.sampleAnnouncement ?? 'x',
        confirmRealCalls: preview.realCalls,
        ...over,
    });
}

export async function code(p: Promise<unknown>): Promise<string> {
    try {
        await p;
        return 'OK';
    } catch (e) {
        return e instanceof SamparkServiceError ? e.code : String(e);
    }
}

export async function drain(t: Setup, id: string, passes = 20) {
    for (let i = 0; i < passes; i += 1) {
        const c = await advanceBatch(t.deps, t.org, id);
        if (c && !c.open) return c;
    }
    return t.batches.get(t.org, id);
}

/** Bridge report for one placed call (signed exactly as the bridge signs it). */
export async function bridgeEvent(t: Setup, callId: string, over: Record<string, unknown> = {}) {
    const call = await t.calls.getCall(t.org, callId);
    const uuid = (call?.providerConversationId ?? 'vobiz:x').slice(6);
    const body = JSON.stringify({
        ref: vobizRiyaRef(t.org, callId), callUuid: uuid, eventTimestamp: Math.floor(t.clock.now().getTime() / 1000),
        status: 'done', durationSeconds: 45, terminationReason: 'parent_ended', callSuccessful: 'success',
        dataCollection: { recipient_confirmed: 'yes', good_time_to_talk: 'yes' },
        transcript: [{ role: 'agent', message: `Holiday line for ${call?.variables.student_name}` }, { role: 'user', message: `Thanks, noted for ${call?.variables.student_name}` }],
        ...over,
    });
    return handleVobizRiyaEvent(t.deps, body, signBridgeBody(KEY, body, Math.floor(t.clock.now().getTime() / 1000)));
}

export async function hangup(t: Setup, callId: string, cause: string) {
    const tok = (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_STATUS, vobizRiyaRef(t.org, callId))).token;
    return handleVobizRiyaStatus(t.deps, tok, 'hangup', { CallUUID: 'x', HangupCause: cause });
}

/** Completes every in-flight batch call with a normal bridge report. */
export async function completeInFlight(t: Setup) {
    for (const c of t.calls.calls.values()) if (c.state === 'initiated') await bridgeEvent(t, c.id);
}

