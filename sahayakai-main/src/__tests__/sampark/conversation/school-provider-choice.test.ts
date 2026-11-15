/** @jest-environment node */
/**
 * Each school chooses its calling provider (ElevenLabs Calls or Vobiz Calls) by budget.
 *
 * Covers: the stored choice and its audit, refusing a provider the deployment has not set up,
 * the enable step taking a provider, the price/estimate maths (never a made-up price), the
 * ElevenLabs class-wide batch switch and its limits, and recorded-call consent per provider.
 * Routing (every path follows the school; a session/source-call choice only on a demo
 * deployment) is covered in provider-choice.test.ts.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { batchCapacity } from '@/lib/sampark/batch/schedule';
import { RIYA_VOBIZ_HARD_END_MS } from '@/lib/sampark/conversation/vobiz-provider';
import { estimateMonthlyInr, formatInr, providerPrice } from '@/lib/sampark/provider-pricing';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { elevenLabsBatchesEnabled, realCallHardEndMs } from '@/server/sampark/batch-calls';
import { recordingConsentRequired } from '@/server/sampark/conversation';
import { SamparkServiceError } from '@/server/sampark/errors';
import { assertProviderAvailable, changeSchoolProvider, getSchoolProvider } from '@/server/sampark/provider-setting';
import { EnableSchoolSchema, enableSchool } from '@/server/sampark/school';

import { guardian, school, testClock } from '../engine/_fixtures';

const ORG = 'hillview-demo';

/** Both providers configured (test-only values). */
const fullEnv = (): Record<string, string | undefined> => ({
    SAMPARK_ENABLED: 'true',
    SAMPARK_ELEVENLABS_ENABLED: 'true',
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
    SAMPARK_PRICE_INR_PER_MIN_ELEVENLABS: '9',
    SAMPARK_PRICE_INR_PER_MIN_VOBIZ: '4',
    SAMPARK_PRICE_AS_OF: '2026-11-15',
});

async function ctxWith(overrides: Parameters<typeof school>[0] = {}) {
    const repo = createMemorySamparkRepo();
    await repo.upsertSchool(school(overrides));
    await repo.upsertGuardians(ORG, [guardian('g1'), guardian('g2'), guardian('g3')]);
    return { repo, clock: testClock(new Date('2026-11-15T05:30:00Z')) };
}

describe("the school's provider setting", () => {
    it('shows the default (ElevenLabs) as not chosen yet, with prices and the families on record', async () => {
        const ctx = await ctxWith();
        const v = await getSchoolProvider(ctx, ORG, fullEnv());
        expect(v.provider).toBe('elevenlabs');
        expect(v.chosen).toBe(false);
        expect(v.estimateDefaults).toEqual({ families: 3, callsPerFamilyPerMonth: 2, minutesPerCall: 2 });
        expect(v.options.map((o) => [o.id, o.available, o.price.inrPerMinute])).toEqual([['elevenlabs', true, 9], ['vobiz', true, 4]]);
        expect(v.demoChooser).toBe(false);
        // Never a configuration value, only names (and here not even those).
        expect(JSON.stringify(v)).not.toMatch(/tok_test_only|sk_test|MA_TEST_ONLY|whsec/);
    });

    it('an admin switching to Vobiz is stored for the school and audited with from/to', async () => {
        const ctx = await ctxWith();
        const v = await changeSchoolProvider(ctx, ORG, 'admin-1', 'vobiz', fullEnv());
        expect(v).toMatchObject({ provider: 'vobiz', chosen: true });
        expect((await ctx.repo.getSchool(ORG))?.conversationProvider).toBe('vobiz');
        const audit = await ctx.repo.listAuditFor(ORG, `school/${ORG}`, 10);
        expect(audit).toEqual(expect.arrayContaining([expect.objectContaining({ actor: 'admin-1', action: 'school.conversation_provider', detail: { from: 'elevenlabs', to: 'vobiz' } })]));
    });

    it('explicitly choosing the default is recorded (the school has now decided); repeating it changes nothing', async () => {
        const ctx = await ctxWith();
        expect((await changeSchoolProvider(ctx, ORG, 'admin-1', 'elevenlabs', fullEnv())).chosen).toBe(true);
        expect((await ctx.repo.getSchool(ORG))?.conversationProvider).toBe('elevenlabs');
        const before = (await ctx.repo.listAuditFor(ORG, `school/${ORG}`, 10)).length;
        await changeSchoolProvider(ctx, ORG, 'admin-1', 'elevenlabs', fullEnv());
        expect((await ctx.repo.listAuditFor(ORG, `school/${ORG}`, 10)).length).toBe(before);
    });

    it('a provider this deployment has not set up is refused and nothing is stored', async () => {
        const ctx = await ctxWith();
        const env = { ...fullEnv(), VOBIZ_STREAM_BASE_URL: undefined };
        await expect(changeSchoolProvider(ctx, ORG, 'admin-1', 'vobiz', env)).rejects.toMatchObject({ code: 'PROVIDER_NOT_AVAILABLE' });
        expect((await ctx.repo.getSchool(ORG))?.conversationProvider ?? null).toBeNull();
        expect(() => assertProviderAvailable('vobiz', env)).toThrow(SamparkServiceError);
        expect(() => assertProviderAvailable('elevenlabs', env)).not.toThrow();
    });
});

describe('switching on school calls with a chosen provider', () => {
    it('the enable step accepts a provider and the new school records it (audited)', async () => {
        const repo = createMemorySamparkRepo();
        const ctx = { repo, clock: testClock(new Date('2026-11-15T05:30:00Z')) };
        const input = EnableSchoolSchema.parse({ displayName: 'Hillview', conversationProvider: 'vobiz' });
        const s = await enableSchool(ctx, ORG, 'admin-1', { displayName: input.displayName, isDemo: false, conversationProvider: input.conversationProvider });
        expect(s).toMatchObject({ mode: 'practice', conversationProvider: 'vobiz' });
        const audit = await repo.listAuditFor(ORG, `school/${ORG}`, 10);
        expect(audit[0]).toMatchObject({ action: 'school.enable', detail: { isDemo: false, conversationProvider: 'vobiz' } });
    });

    it('without a provider the school is created exactly as before (default, not chosen)', async () => {
        const repo = createMemorySamparkRepo();
        const s = await enableSchool({ repo, clock: testClock(new Date()) }, ORG, 'admin-1', { displayName: 'Hillview', isDemo: false });
        expect('conversationProvider' in s).toBe(false);
    });

    it('rejects an unknown provider name at the door', () => {
        expect(EnableSchoolSchema.safeParse({ displayName: 'Hillview', conversationProvider: 'twilio' }).success).toBe(false);
    });
});

describe('prices and the monthly estimate', () => {
    it('reads prices from the deployment; a missing or bad value is null, never a guess', () => {
        expect(providerPrice('vobiz', fullEnv())).toEqual({ inrPerMinute: 4, asOf: '2026-11-15' });
        for (const bad of ['', '0', '-3', 'abc', '5000']) {
            expect(providerPrice('vobiz', { SAMPARK_PRICE_INR_PER_MIN_VOBIZ: bad }).inrPerMinute).toBeNull();
        }
        expect(providerPrice('elevenlabs', { SAMPARK_PRICE_AS_OF: 'yesterday' }).asOf).toBeNull();
    });

    it('families × calls × minutes × price, rounded to the rupee; no price → no estimate', () => {
        expect(estimateMonthlyInr({ families: 500, callsPerFamilyPerMonth: 2, minutesPerCall: 2 }, 9)).toBe(18_000);
        expect(estimateMonthlyInr({ families: 500, callsPerFamilyPerMonth: 2, minutesPerCall: 2 }, null)).toBeNull();
        expect(formatInr(1_80_000)).toBe('₹1,80,000');
    });

    it('a typo cannot produce an absurd figure: inputs are clamped to their bounds', () => {
        expect(estimateMonthlyInr({ families: -10, callsPerFamilyPerMonth: 2, minutesPerCall: 2 }, 9)).toBe(0);
        expect(estimateMonthlyInr({ families: 10, callsPerFamilyPerMonth: 2, minutesPerCall: 500 }, 1)).toBe(10 * 2 * 15);
        expect(estimateMonthlyInr({ families: Number.NaN, callsPerFamilyPerMonth: 2, minutesPerCall: 2 }, 9)).toBe(0);
    });
});

describe('class-wide batches on ElevenLabs', () => {
    it('stay refused until the operator switches them on', () => {
        expect(elevenLabsBatchesEnabled({})).toBe(false);
        expect(elevenLabsBatchesEnabled({ SAMPARK_BATCH_ELEVENLABS_ENABLED: 'true' })).toBe(true);
    });

    it('are held to the lower of the Vobiz channels and the ElevenLabs plan (calls leave via the Vobiz trunk)', () => {
        const env = { SAMPARK_BATCH_MAX_CONCURRENCY: '3', SAMPARK_VOBIZ_MAX_CONCURRENT_CALLS: '2', SAMPARK_ELEVENLABS_MAX_CONCURRENT_CALLS: '1' };
        expect(batchCapacity(env, 'elevenlabs')).toMatchObject({ effective: 1, provider: 1, source: 'provider' });
        // The ElevenLabs plan limit never constrains a Vobiz batch.
        expect(batchCapacity(env, 'vobiz')).toMatchObject({ effective: 2, provider: 2 });
        expect(batchCapacity({ SAMPARK_VOBIZ_MAX_CONCURRENT_CALLS: '1', SAMPARK_ELEVENLABS_MAX_CONCURRENT_CALLS: '3' }, 'elevenlabs').effective).toBe(1);
    });

    it('recover a stuck call on the ElevenLabs time limit, not Vobiz\'s', () => {
        expect(realCallHardEndMs({}, 'vobiz')).toBe(RIYA_VOBIZ_HARD_END_MS);
        expect(realCallHardEndMs({}, 'elevenlabs')).toBe((30 + 600) * 1000 + 3 * 60_000);
        expect(realCallHardEndMs({ SAMPARK_ELEVENLABS_MAX_CALL_SECONDS: '300' }, 'elevenlabs')).toBe((30 + 300) * 1000 + 3 * 60_000);
        // Out-of-range settings fall back to the default.
        expect(realCallHardEndMs({ SAMPARK_ELEVENLABS_MAX_CALL_SECONDS: '5' }, 'elevenlabs')).toBe((30 + 600) * 1000 + 3 * 60_000);
    });
});

describe('recorded-call consent per provider', () => {
    it('by default both providers ask for it (nothing relaxed until someone decides)', () => {
        expect(recordingConsentRequired({}, 'elevenlabs')).toBe(true);
        expect(recordingConsentRequired({}, 'vobiz')).toBe(true);
        expect(recordingConsentRequired({}, 'simulated')).toBe(true);
    });

    it('Vobiz stores no audio: confirming that exempts Vobiz only, never ElevenLabs', () => {
        const env = { SAMPARK_VOBIZ_NOT_RECORDED_CONFIRMED: 'true' };
        expect(recordingConsentRequired(env, 'vobiz')).toBe(false);
        expect(recordingConsentRequired(env, 'elevenlabs')).toBe(true);
    });

    it('the existing deployment-wide confirmation still covers both', () => {
        const env = { SAMPARK_RIYA_RECORDING_OFF_CONFIRMED: 'true' };
        expect(recordingConsentRequired(env, 'vobiz')).toBe(false);
        expect(recordingConsentRequired(env, 'elevenlabs')).toBe(false);
    });
});
