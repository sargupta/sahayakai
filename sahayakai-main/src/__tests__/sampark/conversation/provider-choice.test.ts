/** @jest-environment node */
/**
 * The calling-provider choice at the SahayakAI → SamparkAI boundary: which pages need it, how
 * the server reads it, and that it really routes the call (not just a label), per session,
 * without touching the school or another user, and without skipping a gate.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import crypto from 'node:crypto';

import { createMemoryCallbackRepo } from '@/lib/sampark/callbacks/repo';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import { RIYA_PURPOSES } from '@/lib/sampark/conversation/riya-purposes';
import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import {
    needsProviderChoice,
    parseProviderChoice,
    providerChoiceFromCookieHeader,
    PROVIDER_COOKIE,
    safeNext,
    skipChooserTarget,
    switchProviderHref,
} from '@/lib/sampark/provider-choice';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { _resetVobizKeyCacheForTest } from '@/lib/vobiz/tokens';
import { samparkEntryUrl } from '@/lib/products';
import { previewRiyaCall, providerOptions, riyaAvailability, startRiyaCall, type RiyaDeps } from '@/server/sampark/conversation';
import type { SamparkSchool } from '@/types/sampark';

import { guardian, prefs, school, student, testClock } from '../engine/_fixtures';
import { setPhoneEnv } from '../server/_helpers';

describe('which pages need a provider choice', () => {
    it.each([
        ['/sampark/workspace', true],
        ['/sampark/demo', true],
        ['/sampark/demo/teacher/classes', true],
        ['/sampark/hillview-demo/riya', true],
        ['/sampark/sargvision-local/settings', true],
        ['/sampark', false], // the public website
        ['/sampark/choose-provider', false],
        ['/attendance', false],
        ['/', false],
    ])('%s → %s', (path, expected) => {
        expect(needsProviderChoice(path)).toBe(expected);
    });

    it('reads only a valid choice from the cookie header', () => {
        expect(providerChoiceFromCookieHeader(`a=1; ${PROVIDER_COOKIE}=vobiz; b=2`)).toBe('vobiz');
        expect(providerChoiceFromCookieHeader(`${PROVIDER_COOKIE}=elevenlabs`)).toBe('elevenlabs');
        expect(providerChoiceFromCookieHeader(`${PROVIDER_COOKIE}=twilio`)).toBeNull();
        expect(providerChoiceFromCookieHeader(null)).toBeNull();
        expect(parseProviderChoice('VOBIZ')).toBeNull();
    });

    it('next is only ever a same-origin path', () => {
        expect(safeNext('/sampark/demo/teacher', '/x')).toBe('/sampark/demo/teacher');
        for (const bad of ['//evil.example', 'https://evil.example', '\\\\evil', 'javascript:alert(1)', '', null]) {
            expect(safeNext(bad, '/sampark/demo')).toBe('/sampark/demo');
        }
    });

    it('SahayakAI links enter SamparkAI through the chooser URL', () => {
        expect(samparkEntryUrl('/demo')).toBe('/sampark/choose-provider?next=%2Fsampark%2Fdemo');
        expect(samparkEntryUrl('/workspace')).toBe('/sampark/choose-provider?next=%2Fsampark%2Fworkspace');
    });
});

describe('the chooser does not re-ask an answered question', () => {
    const q = (s: string) => new URLSearchParams(s);
    it('no stored choice → the chooser shows', () => {
        expect(skipChooserTarget(q('next=%2Fsampark%2Fdemo%2Fteacher'), null)).toBeNull();
    });
    it('stored choice → continue straight to next (query kept)', () => {
        expect(skipChooserTarget(q('next=%2Fsampark%2Fdemo%2Fteacher%3Ffrom%3Dsahayak'), 'vobiz')).toBe('/sampark/demo/teacher?from=sahayak');
    });
    it('explicit Switch always shows the cards', () => {
        expect(skipChooserTarget(q('next=%2Fsampark%2Fdemo&switch=1'), 'elevenlabs')).toBeNull();
        expect(switchProviderHref('/sampark/choose-provider', '/sampark/demo')).toBe('/sampark/choose-provider?next=%2Fsampark%2Fdemo&switch=1');
    });
    it('never redirects off-origin or back into the chooser', () => {
        expect(skipChooserTarget(q('next=%2F%2Fevil.example'), 'vobiz')).toBeNull();
        expect(skipChooserTarget(q('next=https%3A%2F%2Fevil.example'), 'vobiz')).toBeNull();
        expect(skipChooserTarget(q('next=%2Fsampark%2Fchoose-provider%3Fnext%3D%2Fx'), 'vobiz')).toBeNull();
        expect(skipChooserTarget(q(''), 'vobiz')).toBeNull();
    });
});

// ── routing ─────────────────────────────────────────────────────────────────────

const ORG = 'hillview-demo';
const TEST_PHONE = '+919800000001'; // test-only
const PTM: RiyaFacts = { purpose: 'ptm_invitation', date: '2026-10-10', time: { hour: 10, minute: 0 } };
const env = (): Record<string, string | undefined> => ({
    SAMPARK_ENABLED: 'true',
    SAMPARK_ELEVENLABS_ENABLED: 'true',
    SAMPARK_RIYA_PURPOSES: RIYA_PURPOSES.join(','),
    SAMPARK_LIVE_DIAL_ENABLED: 'true',
    SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod',
    SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: TEST_PHONE,
    ELEVENLABS_API_KEY: 'sk_test_not_a_real_key_0123456789',
    ELEVENLABS_AGENT_ID: 'agent_2401m4zy4gyaev48rz65wfmf5yr2',
    ELEVENLABS_AGENT_PHONE_NUMBER_ID: 'phnum_0000testtesttesttesttest00',
    ELEVENLABS_SOURCE_AGENT_ID: 'agent_0000sourcesourcesourcesource00',
    ELEVENLABS_WEBHOOK_SECRET: 'whsec_test_only',
    SAMPARK_VOBIZ_RIYA_ENABLED: 'true',
    VOBIZ_AUTH_ID: 'MA_TEST_ONLY',
    VOBIZ_AUTH_TOKEN: 'tok_test_only',
    VOBIZ_FROM_NUMBER: '+918000000000',
    SAMPARK_PUBLIC_BASE_URL: 'https://sampark.example.test',
    VOBIZ_STREAM_BASE_URL: 'https://bridge.example.test',
    SAHAYAKAI_REQUEST_SIGNING_KEY: 'test-signing-key-not-real-0123456789',
});

/** Answers whichever provider is called: ElevenLabs (conversation_id) or Vobiz (request_uuid). */
const providerFetch = () => jest.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('api.vobiz.ai')) return new Response(JSON.stringify({ request_uuid: crypto.randomUUID() }), { status: 201 });
    return new Response(JSON.stringify({ success: true, conversation_id: `conv_${crypto.randomUUID().slice(0, 8)}`, sip_call_id: 'sip' }), { status: 200 });
});

async function setup(schoolDefault: 'elevenlabs' | 'vobiz') {
    setPhoneEnv();
    process.env.SAHAYAKAI_REQUEST_SIGNING_KEY = 'test-signing-key-not-real-0123456789';
    _resetVobizKeyCacheForTest();
    process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
    const repo = createMemorySamparkRepo();
    const calls = createMemoryConversationRepo();
    await repo.upsertSchool(school({ mode: 'test', testPhoneEnc: encryptPhone(TEST_PHONE), testPhoneHash: hashPhone(TEST_PHONE), testPhoneLast4: '0001', conversationProvider: schoolDefault }));
    await repo.upsertStudents(ORG, [student('s1', { spokenFirstName: { English: 'Asha' }, guardianIds: ['g1'] })]);
    await repo.upsertGuardians(ORG, [guardian('g1', { phoneEnc: encryptPhone('+919811111111'), phoneHash: hashPhone('+919811111111'), phoneLast4: '1111', phoneClass: 'mobile', crmLanguage: 'English', studentIds: ['s1'] })]);
    await repo.upsertPreferences([prefs('g1', { notices: 'granted', progress: 'granted', recorded_conversation: 'granted' })]);
    const fetchImpl = providerFetch();
    const deps: RiyaDeps = { repo, calls, callbacks: createMemoryCallbackRepo(), clock: testClock(new Date('2026-10-07T05:30:00Z')), env: env(), http: { fetchImpl: fetchImpl as unknown as typeof fetch } };
    return { deps, repo, calls, fetchImpl };
}

async function startWith(deps: RiyaDeps, choice: 'elevenlabs' | 'vobiz' | null) {
    const d = { ...deps, providerChoice: choice };
    const preview = await previewRiyaCall(d, ORG, { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: PTM });
    return startRiyaCall(d, ORG, 'admin', { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: PTM, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: preview.announcement ?? 'x' });
}

afterEach(() => { delete process.env.SAMPARK_LIVE_DIAL_ENABLED; });

describe('the session choice routes the call on the server', () => {
    it('Vobiz chosen → the Vobiz API is dialled and the record says vobiz', async () => {
        const { deps, fetchImpl } = await setup('elevenlabs');
        const r = await startWith(deps, 'vobiz');
        expect(r.call.provider).toBe('vobiz');
        expect(String(fetchImpl.mock.calls[0][0])).toContain('api.vobiz.ai');
        expect(r.call.providerConversationId).toMatch(/^vobiz:/);
    });

    it('ElevenLabs chosen → the ElevenLabs API is dialled and the record says elevenlabs', async () => {
        const { deps, fetchImpl } = await setup('vobiz');
        const r = await startWith(deps, 'elevenlabs');
        expect(r.call.provider).toBe('elevenlabs');
        expect(String(fetchImpl.mock.calls[0][0])).not.toContain('api.vobiz.ai');
        expect(r.call.providerConversationId).toMatch(/^conv_/);
    });

    it('switching providers keeps each call with the provider it used (no mixing)', async () => {
        const { deps, calls } = await setup('elevenlabs');
        const a = await startWith(deps, 'vobiz');
        await deps.repo.releaseLock(`riya:${ORG}`, a.call.id);
        await calls.mutateCall(ORG, a.call.id, (c) => ({ ...c, state: 'completed' }));
        const b = await startWith(deps, 'elevenlabs');
        expect((await calls.getCall(ORG, a.call.id))?.provider).toBe('vobiz');
        expect((await calls.getCall(ORG, b.call.id))?.provider).toBe('elevenlabs');
    });

    it('no session choice → the school default; a choice never changes the school', async () => {
        const { deps, repo } = await setup('vobiz');
        expect((await startWith(deps, null)).call.provider).toBe('vobiz');
        expect((await repo.getSchool(ORG))?.conversationProvider).toBe('vobiz');
    });

    it('a choice cannot bypass a gate: an unconfigured provider is a blocker, never a dial', async () => {
        const { deps, fetchImpl, repo } = await setup('elevenlabs');
        const noVobiz = { ...deps, env: { ...env(), VOBIZ_STREAM_BASE_URL: undefined }, providerChoice: 'vobiz' as const };
        const preview = await previewRiyaCall(noVobiz, ORG, { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: PTM });
        expect(preview.ok).toBe(false);
        expect(preview.refusals[0]).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', blocker: 'VOBIZ_UNCONFIGURED' });
        expect(fetchImpl).not.toHaveBeenCalled();
        const a = riyaAvailability((await repo.getSchool(ORG)) as SamparkSchool, noVobiz.env, new Date(), 'vobiz');
        expect(a.selectedProvider).toBe('vobiz');
        expect(a.blocker).toBe('VOBIZ_UNCONFIGURED');
    });

    it('the chooser offers only configured providers (names of missing settings only)', () => {
        const opts = providerOptions({ ...env(), VOBIZ_AUTH_TOKEN: undefined });
        expect(opts.find((o) => o.id === 'elevenlabs')?.available).toBe(true);
        expect(opts.find((o) => o.id === 'vobiz')).toMatchObject({ available: false });
        expect(JSON.stringify(opts)).not.toMatch(/tok_test_only|sk_test/);
    });
});
