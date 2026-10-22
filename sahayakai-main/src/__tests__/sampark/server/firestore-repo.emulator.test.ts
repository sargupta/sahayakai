/** @jest-environment node */
/**
 * FirestoreSamparkRepo against the real Firestore EMULATOR — the transaction,
 * create-only and query semantics the in-memory repo can only imitate.
 *
 * Skipped unless FIRESTORE_EMULATOR_HOST is set, so CI without an emulator
 * stays green. Run locally:
 *   firebase emulators:start --only firestore   (or the emulator jar)
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx jest src/__tests__/sampark/server/firestore-repo.emulator.test.ts --coverage=false
 */

// jest.setup.ts stubs firebase-admin/firestore globally; this suite needs the real client.
jest.unmock('firebase-admin/firestore');

import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { FirestoreSamparkRepo } from '@/lib/sampark/repo/firestore';
import { PROBE_VERSION, voiceProbeKey, type VoiceProbeRecord } from '@/lib/sampark/speech/probe';
import type {
    Campaign,
    ImportRun,
    Intent,
    RenderedClip,
    SamparkCall,
    SamparkGuardian,
    SamparkSchool,
} from '@/types/sampark';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const d = HAS_EMULATOR ? describe : describe.skip;

const ORG = `org-${Date.now().toString(36)}`;
const T0 = new Date('2026-10-05T05:30:00.000Z');
const iso = (offsetMs = 0) => new Date(T0.getTime() + offsetMs).toISOString();

function school(): SamparkSchool {
    return {
        orgId: ORG,
        spokenName: { English: 'Hillview', Hindi: 'हिलव्यू', Bengali: 'হিলভিউ', Nepali: 'हिलभ्यू' },
        displayName: 'Hillview',
        mode: 'practice',
        isDemo: true,
        callingWindow: { startHour: 10, endHour: 19, offDays: [0] },
        holidays: [],
        venues: [],
        defaultLanguage: null,
        crm: null,
        emergencyBypassConsent: false,
        createdAt: iso(),
        updatedAt: iso(),
    };
}

function guardian(id: string): SamparkGuardian {
    return {
        orgId: ORG, id, displayName: `G ${id}`, relation: 'mother', phoneEnc: 'enc', phoneHash: `h-${id}`, phoneLast4: '0001',
        phoneClass: 'synthetic', studentIds: [], crmLanguage: 'Nepali', crmDoNotContact: false, active: true, crmUpdatedAt: iso(), importedAt: iso(),
    };
}

function intent(id: string, overrides: Partial<Intent> = {}): Intent {
    return {
        id, dedupeKey: `k-${id}`, orgId: ORG, campaignId: 'c1', purpose: 'ptm_invite', guardianId: 'g1', studentIds: ['s1'], language: 'Nepali',
        status: 'approved', blockReason: null, attempts: 0, maxAttempts: 3, notBefore: null, expiresAt: iso(86_400_000), lastCallId: null,
        createdAt: iso(), updatedAt: iso(), ...overrides,
    };
}

function call(id: string, overrides: Partial<SamparkCall> = {}): SamparkCall {
    return {
        id, orgId: ORG, intentId: 'i1', campaignId: 'c1', purpose: 'ptm_invite', guardianId: 'g1', phoneHash: 'h-g1', phoneLast4: '0001',
        language: 'Nepali', variant: 'default', attempt: 1, state: 'dialing', leaseUntil: iso(120_000), carrier: 'simulated', providerCallId: null,
        outcome: { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' }, durationSeconds: null, billedSeconds: null,
        costPaise: null, audioSeconds: null, createdAt: iso(), updatedAt: iso(), endedAt: null, failureReason: null, ...overrides,
    };
}

d('FirestoreSamparkRepo (emulator)', () => {
    let app: App;
    let db: Firestore;
    let repo: FirestoreSamparkRepo;

    beforeAll(() => {
        app = initializeApp({ projectId: 'demo-sampark-repo-test' }, `sampark-repo-${ORG}`);
        db = getFirestore(app);
        repo = new FirestoreSamparkRepo(db);
    });
    afterAll(async () => {
        await deleteApp(app);
    });

    it('stores the school at sampark_schools/{orgId} and lists it', async () => {
        await repo.upsertSchool(school());
        expect(await repo.getSchool(ORG)).toEqual(school());
        expect((await repo.listSchools()).map((s) => s.orgId)).toContain(ORG);
        expect((await db.collection('sampark_schools').doc(ORG).get()).exists).toBe(true);
    });

    it('writes more than one batch of guardians and reads them back by id', async () => {
        const many = Array.from({ length: 450 }, (_, i) => guardian(`g${i}`));
        await repo.upsertGuardians(ORG, many);
        expect(await repo.listGuardians(ORG)).toHaveLength(450);
        const some = await repo.listGuardians(ORG, ['g3', 'g449', 'missing', 'g3']);
        expect(some.map((g) => g.id).sort()).toEqual(['g3', 'g449']);
        expect(await repo.getGuardian(ORG, 'g10')).toMatchObject({ id: 'g10', phoneHash: 'h-g10' });
    });

    it('createIntentIfAbsent is create-only (class gate 13)', async () => {
        expect(await repo.createIntentIfAbsent(intent('i-create'))).toBe(true);
        expect(await repo.createIntentIfAbsent(intent('i-create', { status: 'blocked', language: 'Hindi' }))).toBe(false);
        expect(await repo.getIntent(ORG, 'i-create')).toMatchObject({ status: 'approved', language: 'Nepali' });
    });

    it('listDueIntents merges never-deferred and due-deferred intents, oldest first', async () => {
        const due = [
            intent('due-a', { campaignId: 'due', createdAt: iso(-3000) }),
            intent('due-b', { campaignId: 'due', status: 'retry_wait', notBefore: iso(-2000), createdAt: iso(-9000) }),
            intent('due-c', { campaignId: 'due', createdAt: iso(-1000) }),
            intent('later', { campaignId: 'due', status: 'retry_wait', notBefore: iso(60_000) }),
            intent('busy', { campaignId: 'due', status: 'dialing' }),
            intent('done', { campaignId: 'due', status: 'done' }),
        ];
        for (const i of due) await repo.createIntentIfAbsent(i);
        const list = (await repo.listDueIntents(ORG, T0, 50)).filter((i) => i.campaignId === 'due').map((i) => i.id);
        expect(list).toEqual(['due-b', 'due-a', 'due-c']);
        expect((await repo.listDueIntents(ORG, T0, 1)).length).toBe(1);
        expect((await repo.listIntentsByCampaign(ORG, 'due')).length).toBe(6);
    });

    it('claimIntentForDial claims exactly once, even when two dispatchers race (class gate 3)', async () => {
        await repo.createIntentIfAbsent(intent('i-claim', { campaignId: 'claim' }));
        const c = call('call-claim', { intentId: 'i-claim', campaignId: 'claim' });
        const results = await Promise.all([
            repo.claimIntentForDial(ORG, 'i-claim', c, T0),
            repo.claimIntentForDial(ORG, 'i-claim', c, T0),
            repo.claimIntentForDial(ORG, 'i-claim', c, T0),
        ]);
        expect(results.filter((r) => r === 'claimed')).toHaveLength(1);
        expect(await repo.getIntent(ORG, 'i-claim')).toMatchObject({ status: 'dialing', attempts: 1, lastCallId: 'call-claim' });
        expect(await repo.getCall(ORG, 'call-claim')).toMatchObject({ state: 'dialing', intentId: 'i-claim' });
        // A later attempt on the now-dialing intent is refused, and so is a deferred one.
        expect(await repo.claimIntentForDial(ORG, 'i-claim', call('call-claim-2', { attempt: 2 }), T0)).toBe('not_claimable');
        await repo.createIntentIfAbsent(intent('i-deferred', { status: 'retry_wait', notBefore: iso(60_000) }));
        expect(await repo.claimIntentForDial(ORG, 'i-deferred', call('call-deferred'), T0)).toBe('not_claimable');
        expect(await repo.getCall(ORG, 'call-deferred')).toBeNull();
        expect(await repo.claimIntentForDial(ORG, 'no-such-intent', call('call-x'), T0)).toBe('not_claimable');
    });

    it('compare-and-set intent updates and the unsettled-ended-call query work on real Firestore', async () => {
        await repo.createIntentIfAbsent(intent('i-cas'));
        await repo.claimIntentForDial(ORG, 'i-cas', call('cas1', { intentId: 'i-cas', settledAt: null }), T0);
        expect(await repo.updateIntentIf(ORG, 'i-cas', { status: 'dialing', lastCallId: 'nope' }, { status: 'done' })).toBe(false);
        const [a, b] = await Promise.all([
            repo.updateIntentIf(ORG, 'i-cas', { status: 'dialing', lastCallId: 'cas1' }, { status: 'done' }),
            repo.updateIntentIf(ORG, 'i-cas', { status: 'dialing', lastCallId: 'cas1' }, { status: 'retry_wait' }),
        ]);
        expect([a, b].filter(Boolean)).toHaveLength(1);

        await repo.updateCall(ORG, 'cas1', { state: 'no_answer', endedAt: iso(-10 * 60_000) });
        expect((await repo.listUnsettledEndedCalls(ORG, new Date(T0.getTime() - 5 * 60_000), 10)).map((c) => c.id)).toContain('cas1');
        await repo.updateCall(ORG, 'cas1', { settledAt: iso() });
        expect((await repo.listUnsettledEndedCalls(ORG, new Date(T0.getTime() - 5 * 60_000), 10)).map((c) => c.id)).not.toContain('cas1');
    });

    it('burns a single-use token exactly once, and sweeps a ringing call past its lease', async () => {
        const key = `burn-${Date.now()}`;
        expect(await repo.burnToken(key, iso(60_000))).toBe(true);
        expect(await repo.burnToken(key, iso(60_000))).toBe(false);

        await repo.createIntentIfAbsent(intent('i-ring'));
        await repo.claimIntentForDial(ORG, 'i-ring', call('ring1', { intentId: 'i-ring', leaseUntil: iso(-1000) }), T0);
        await repo.updateCall(ORG, 'ring1', { state: 'ringing' });
        expect((await repo.listExpiredOpenCalls(ORG, T0)).map((c) => c.id)).toContain('ring1');
    });

    it('call queries: expired leases, non-terminal count, per-phone count, campaign log', async () => {
        await repo.createIntentIfAbsent(intent('i-q1'));
        await repo.createIntentIfAbsent(intent('i-q2'));
        await repo.createIntentIfAbsent(intent('i-q3'));
        await repo.createIntentIfAbsent(intent('i-q4'));
        // Real-carrier calls count toward the frequency cap; a Practice (simulated) call never does (H1).
        await repo.claimIntentForDial(ORG, 'i-q1', call('q1', { intentId: 'i-q1', campaignId: 'log', phoneHash: 'h-q', carrier: 'vobiz', leaseUntil: iso(-1000), createdAt: iso(-5000) }), T0);
        await repo.claimIntentForDial(ORG, 'i-q2', call('q2', { intentId: 'i-q2', campaignId: 'log', phoneHash: 'h-q', carrier: 'vobiz', createdAt: iso(-4000) }), T0);
        await repo.claimIntentForDial(ORG, 'i-q3', call('q3', { intentId: 'i-q3', campaignId: 'log', phoneHash: 'h-q', carrier: 'vobiz', purpose: 'emergency_closure', createdAt: iso(-3000) }), T0);
        await repo.claimIntentForDial(ORG, 'i-q4', call('q4', { intentId: 'i-q4', campaignId: 'practice', phoneHash: 'h-q', carrier: 'simulated', createdAt: iso(-2000) }), T0);
        await repo.updateCall(ORG, 'q2', { state: 'completed', endedAt: iso(), failureReason: undefined });

        expect((await repo.listExpiredOpenCalls(ORG, T0)).map((c) => c.id)).toContain('q1');
        expect((await repo.listExpiredOpenCalls(ORG, T0)).map((c) => c.id)).not.toContain('q3');
        expect(await repo.countNonTerminalCalls(ORG)).toBeGreaterThanOrEqual(2);
        expect(await repo.countCallsToPhoneSince(ORG, 'h-q', new Date(T0.getTime() - 60_000), false)).toBe(3);
        expect(await repo.countCallsToPhoneSince(ORG, 'h-q', new Date(T0.getTime() - 60_000), true)).toBe(2);
        expect(await repo.countCallsToPhoneSince(ORG, 'h-q', new Date(T0.getTime() - 3500), false)).toBe(1);
        expect((await repo.listCalls(ORG, { campaignId: 'log', limit: 10 })).map((c) => c.id)).toEqual(['q3', 'q2', 'q1']);
        expect((await repo.listCalls(ORG, { limit: 2 })).length).toBe(2);
        expect(await repo.getCall(ORG, 'q2')).toMatchObject({ state: 'completed', failureReason: null });
    });

    it('single-flight lock: live lease refuses others, expiry frees it, release is holder-scoped', async () => {
        const name = `lock-${ORG}`;
        expect(await repo.acquireLock(name, 'A', T0, 55_000)).toBe(true);
        expect(await repo.acquireLock(name, 'B', new Date(T0.getTime() + 1000), 55_000)).toBe(false);
        expect(await repo.acquireLock(name, 'A', new Date(T0.getTime() + 1000), 55_000)).toBe(true); // re-entrant renew
        expect(await repo.acquireLock(name, 'B', new Date(T0.getTime() + 120_000), 55_000)).toBe(true); // expired
        await repo.releaseLock(name, 'A'); // not the holder: no effect
        expect(await repo.acquireLock(name, 'C', new Date(T0.getTime() + 121_000), 55_000)).toBe(false);
        await repo.releaseLock(name, 'B');
        expect(await repo.acquireLock(name, 'C', new Date(T0.getTime() + 122_000), 55_000)).toBe(true);
    });

    it('campaigns, imports, clips, preferences, suppressions and audit round-trip', async () => {
        const campaign = {
            id: 'camp-1', orgId: ORG, purpose: 'ptm_invite', facts: { kind: 'ptm_invite', date: '2026-10-08', time: { hour: 10, minute: 0 }, venueId: 'hall' },
            audience: { sections: [] }, status: 'draft', notBefore: null, expiresAt: iso(86_400_000), createdBy: 'u', createdAt: iso(), approvedBy: null, approvedAt: null,
            renderProgress: { done: 0, total: 0, failures: [] },
            counts: { guardians: 0, blocked: 0, queued: 0, inFlight: 0, heardKeyFact: 0, confirmedYes: 0, declinedOrOther: 0, noAnswer: 0, failed: 0, optOuts: 0 },
            updatedAt: iso(),
        } as Campaign;
        await repo.createCampaign(campaign);
        await expect(repo.createCampaign(campaign)).rejects.toThrow();
        await repo.updateCampaign(ORG, 'camp-1', { status: 'rendering', renderProgress: { done: 1, total: 2, failures: [] } });
        expect(await repo.getCampaign(ORG, 'camp-1')).toMatchObject({ status: 'rendering', renderProgress: { done: 1, total: 2 } });
        expect((await repo.listCampaigns(ORG, 5))[0].id).toBe('camp-1');

        const run = (id: string, startedAt: string): ImportRun => ({
            id, orgId: ORG, source: 'csv', startedAt, finishedAt: null, status: 'running', counts: { students: 0, guardians: 0, rejected: 0, tombstoned: 0 }, rejected: [], error: null, startedBy: 'u',
        });
        await repo.createImportRun(run('r1', iso(-1000)));
        await repo.createImportRun(run('r2', iso()));
        await repo.updateImportRun({ ...run('r2', iso()), status: 'succeeded' });
        expect(await repo.getLatestImportRun(ORG)).toMatchObject({ id: 'r2', status: 'succeeded' });

        const clip = {
            key: 'k'.repeat(40), orgId: ORG, campaignId: 'camp-1', purpose: 'ptm_invite', language: 'Nepali', variant: 'default', kind: 'message', text: 'नमस्ते',
            engine: 'gemini-tts', voice: 'Kore', model: 'm', languageCode: 'ne-NP', durationSeconds: 12.5,
            verification: { status: 'passed', transcript: 'नमस्ते', similarity: 1, checkedAt: iso() }, createdAt: iso(),
        } as RenderedClip;
        await repo.saveClip(clip);
        expect(await repo.getClip(ORG, clip.key)).toEqual(clip);
        expect(await repo.getClip('another-org', clip.key)).toBeNull();
        expect(await repo.listClipsForCampaign(ORG, 'camp-1')).toHaveLength(1);

        await repo.upsertPreferences([{ orgId: ORG, guardianId: 'g1', language: 'Hindi', consent: {} as never, updatedAt: iso(), updatedBy: 'u' }]);
        expect((await repo.getPreferences(ORG, ['g1', 'g2'])).get('g1')).toMatchObject({ language: 'Hindi' });

        await repo.upsertSuppression({ orgId: ORG, phoneHash: 'h-s', phoneLast4: '0001', scope: 'routine', source: 'keypad', officeVerification: 'pending', createdAt: iso(), callId: 'q1' });
        expect(await repo.getSuppression(ORG, 'h-s')).toMatchObject({ scope: 'routine' });
        expect(await repo.listSuppressions(ORG)).toHaveLength(1);

        await repo.appendAudit(ORG, { at: iso(), actor: 'u', action: 'campaign.approve', target: 'campaign/camp-1' });
        const audit = await db.collection('sampark_schools').doc(ORG).collection('sampark_audit').get();
        expect(audit.size).toBe(1);
    });

    it('hard-word voice probes: global sampark_voice_probes/{key}, round-trip, re-probe replaces', async () => {
        // A per-run voice name keeps this test independent of earlier runs on the same emulator.
        const speech = { engine: 'gemini-tts' as const, ttsLanguageCode: 'bn-IN', voice: `Kore-${ORG}`, model: 'gemini-x-tts', sttLanguageCode: 'bn-IN' };
        const key = voiceProbeKey(speech);
        expect(await repo.getVoiceProbe(key)).toBeNull();

        const failed: VoiceProbeRecord = {
            key, language: 'Bengali', speech, probeVersion: PROBE_VERSION, status: 'failed', checkedAt: iso(),
            recognizers: [
                { name: 'chirp_2', transcript: 'এই বৃহস্পতিবার আটি অক্টোবর', missing: ['আটই'] },
                { name: 'sarvam', transcript: 'কাল সাড়ে দশটায়', missing: ['সকাল'] },
            ],
        };
        await repo.saveVoiceProbe(failed);
        expect(await repo.getVoiceProbe(key)).toEqual(failed);
        expect((await db.collection('sampark_voice_probes').doc(key).get()).exists).toBe(true);

        const passed: VoiceProbeRecord = { ...failed, status: 'passed', checkedAt: iso(60_000), recognizers: failed.recognizers.map((r) => ({ ...r, missing: [] })) };
        await repo.saveVoiceProbe(passed);
        expect(await repo.getVoiceProbe(key)).toEqual(passed);
        expect(await repo.getVoiceProbe(voiceProbeKey({ ...speech, model: 'other-model' }))).toBeNull();
    });
});

d('slice 1 flow on the real repo (emulator)', () => {
    it('enable → import → PTM → approve → render → dispatch → call log', async () => {
        const helpers = await import('./_helpers');
        helpers.setPhoneEnv();
        const { runImport } = await import('@/lib/sampark/crm/import');
        const { enableSchool } = await import('@/server/sampark/school');
        const { approveCampaign, createCampaign } = await import('@/server/sampark/campaigns');
        const { dispatchJob, renderJob } = await import('@/server/sampark/jobs');
        const { listCallLog } = await import('@/server/sampark/calls');

        const app = initializeApp({ projectId: 'demo-sampark-flow-test' }, `sampark-flow-${ORG}`);
        try {
            const repo = new FirestoreSamparkRepo(getFirestore(app));
            const clock = helpers.testClock(helpers.MON_11_IST);
            const ctx = { repo, clock };
            const org = `flow-${ORG}`;
            await enableSchool(ctx, org, helpers.ADMIN, {
                displayName: 'Hillview',
                isDemo: true,
                spokenName: { English: 'Hillview School', Hindi: 'हिलव्यू स्कूल', Bengali: 'হিলভিউ স্কুল', Nepali: 'हिलभ्यू स्कूल' },
            });
            const langs = ['ne', 'bn', 'hi', 'en'];
            const students = langs.map((_, i) => helpers.crmStudent(`s${i}`, { guardians: [{ guardianId: `g${i}`, isPrimary: true, isGuardianOfRecord: true }] }));
            const guardians = langs.map((l, i) => helpers.crmGuardian(`g${i}`, { preferredLanguage: l }));
            const run = await runImport({ repo, clock }, org, { kind: 'rest', fetchSchool: async () => null, fetchStudents: async () => students, fetchGuardians: async () => guardians }, helpers.ADMIN);
            expect(run.status).toBe('succeeded');

            const campaign = await createCampaign(ctx, org, helpers.ADMIN, {
                purpose: 'ptm_invite',
                facts: { kind: 'ptm_invite', date: '2026-10-08', time: { hour: 10, minute: 30 }, venueId: 'school_hall' },
                audience: { sections: [] },
            });
            await approveCampaign(ctx, org, campaign.id, helpers.ADMIN);
            const speech = helpers.fakeSpeech();
            for (let i = 0; i < 4; i++) {
                await renderJob({ repo, clock, speech });
                if ((await repo.getCampaign(org, campaign.id))!.status !== 'rendering') break;
                clock.advance(60_000);
            }
            expect((await repo.getCampaign(org, campaign.id))!.status).toBe('scheduled');

            clock.advance(60_000);
            const tick = await dispatchJob({ repo, clock });
            expect(tick.errors).toEqual([]);
            expect(tick.dialed).toBe(4);
            const log = await listCallLog(ctx, org, { campaignId: campaign.id, limit: 10 });
            expect(log).toHaveLength(4);
            expect(log.every((e) => e.carrier === 'simulated' && e.studentDisplayNames.length === 1)).toBe(true);
            // Nothing the dispatcher wrote carries a full number.
            const calls = await getFirestore(app).collection('sampark_schools').doc(org).collection('sampark_calls').get();
            expect(JSON.stringify(calls.docs.map((doc) => doc.data()))).not.toContain('+915');
        } finally {
            await deleteApp(app);
        }
    });
});
