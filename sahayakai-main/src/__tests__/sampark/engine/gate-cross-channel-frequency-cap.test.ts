/**
 * @jest-environment node
 *
 * Class gate — the frequency cap counts BOTH channels.
 *
 * Bug class: a family's calls are split across two stores (recorded notices in sampark_calls,
 * Riya conversations in sampark_conversation_calls). Any place that feeds the gate's
 * `recentCallsToPhone` from one store alone lets the family exceed FREQUENCY_CAP routine calls
 * a month. The Riya path counted notices, but the notice dispatcher, campaign materialisation and
 * the campaign preview did not count Riya calls (audit gap 1).
 *
 * The gate has two halves:
 *   1. behaviour: Riya calls block a notice at dispatch and at materialisation; emergency, Practice
 *      and test-phone Riya calls do not count;
 *   2. source: outside the repositories and policy/recent-calls.ts, nothing counts calls to a phone
 *      from the notice store alone, and every production materialise/dispatch wiring passes the
 *      conversation repo — so a new call site cannot quietly reintroduce the gap.
 */
import fs from 'node:fs';
import path from 'node:path';

import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import { emptyRiyaVariables } from '@/lib/sampark/conversation/riya-purposes';
import type { ConversationCall } from '@/lib/sampark/conversation/types';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import { FREQUENCY_CAP } from '@/lib/sampark/policy/gate';
import { countRoutineCallsToPhone } from '@/lib/sampark/policy/recent-calls';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';

import { campaign, DEFAULT_OPTS, deps, ORG, school, scriptedCarrier, seedFamilies, testClock } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const DAY = 24 * 3600_000;
const idFor = (campaignId: string, gid: string) => intentIdFor(campaignDedupeKey(campaignId, gid));

let seq = 0;
function riyaCall(phoneHash: string, at: Date, over: Partial<ConversationCall> = {}): ConversationCall {
    seq += 1;
    const iso = at.toISOString();
    return {
        id: `riya-${seq}`, orgId: ORG, provider: 'elevenlabs', mode: 'test', destination: 'guardian', riyaPurpose: 'ptm_invitation', purpose: 'ptm_invite',
        guardianId: 'g001', studentId: 's001', phoneHash, phoneLast4: '0001', language: 'English', variables: emptyRiyaVariables('ptm_invitation'),
        announcement: 'x', factsHash: `f${seq}`, state: 'completed', leaseUntil: iso, providerConversationId: `conv_${seq}`, providerCallId: null,
        agentId: null, agentPhoneNumberId: null, durationSeconds: 40, providerStatus: 'done', terminationReason: null, failureReason: null,
        callSuccessful: 'success', dataCollection: {}, stopRequested: false, transcript: null, transcriptExpiresAt: null, appliedEvents: [], lastEventAt: null,
        reviewedAt: null, reviewedBy: null, reviewNote: null, createdBy: 'u', createdAt: iso, updatedAt: iso, endedAt: iso,
        ...over,
    };
}

async function seedRiya(calls: ReturnType<typeof createMemoryConversationRepo>, list: ConversationCall[]) {
    for (const c of list) await calls.createCallIfAbsent(c);
}

describe('countRoutineCallsToPhone', () => {
    it('adds notice and Riya calls; leaves out emergency, Practice and other-phone Riya calls', async () => {
        const repo = createMemorySamparkRepo();
        const calls = createMemoryConversationRepo();
        const now = testClock().now();
        const since = new Date(now.getTime() - 30 * DAY);
        await seedRiya(calls, [
            riyaCall('hash:g001', new Date(now.getTime() - 1 * DAY)),
            riyaCall('hash:g001', new Date(now.getTime() - 2 * DAY)),
            riyaCall('hash:g001', new Date(now.getTime() - 3 * DAY), { purpose: 'emergency_closure', riyaPurpose: 'emergency_closure' }),
            riyaCall('hash:g001', new Date(now.getTime() - 4 * DAY), { provider: 'simulated' }),
            riyaCall('hash:g001', new Date(now.getTime() - 40 * DAY)), // outside the window
            riyaCall('hash:test-phone', new Date(now.getTime() - 1 * DAY), { destination: 'test_phone' }),
        ]);
        const notice = jest.spyOn(repo, 'countCallsToPhoneSince').mockResolvedValue(1);
        expect(await countRoutineCallsToPhone({ notice: repo, conversation: calls }, ORG, 'hash:g001', since)).toBe(3);
        expect(notice).toHaveBeenCalledWith(ORG, 'hash:g001', since, true);
    });
});

describe('notice engine counts Riya calls', () => {
    it('dispatch: a family with FREQUENCY_CAP recent Riya calls gets no notice', async () => {
        const repo = createMemorySamparkRepo();
        const calls = createMemoryConversationRepo();
        const clock = testClock();
        await seedFamilies(repo, 2);
        const camp = campaign({ mode: 'practice' });
        await repo.createCampaign(camp);
        // Materialised before the Riya calls happened, so the intent is approved…
        await materialiseCampaignIntents({ repo, clock, conversationCalls: calls }, camp, school(), 'simulated');
        // …then Riya rang g001 four times this month.
        await seedRiya(calls, Array.from({ length: FREQUENCY_CAP }, (_, i) => riyaCall('hash:g001', new Date(clock.now().getTime() - (i + 1) * DAY))));
        const carrier = scriptedCarrier(() => 'full');
        await runDispatchTick(deps(repo, clock, carrier, { conversationCalls: calls }), DEFAULT_OPTS);
        expect(await repo.getIntent(ORG, idFor(camp.id, 'g001'))).toMatchObject({ status: 'blocked', blockReason: 'frequency_cap' });
        expect(carrier.requests.map((r) => r.call.guardianId)).toEqual(['g002']);
    });

    it('dispatch: one Riya call under the cap still lets the notice through', async () => {
        const repo = createMemorySamparkRepo();
        const calls = createMemoryConversationRepo();
        const clock = testClock();
        await seedFamilies(repo, 1);
        const camp = campaign({ mode: 'practice' });
        await repo.createCampaign(camp);
        await materialiseCampaignIntents({ repo, clock, conversationCalls: calls }, camp, school(), 'simulated');
        await seedRiya(calls, Array.from({ length: FREQUENCY_CAP - 1 }, (_, i) => riyaCall('hash:g001', new Date(clock.now().getTime() - (i + 1) * DAY))));
        const carrier = scriptedCarrier(() => 'full');
        await runDispatchTick(deps(repo, clock, carrier, { conversationCalls: calls }), DEFAULT_OPTS);
        expect(carrier.requests.map((r) => r.call.guardianId)).toEqual(['g001']);
    });

    it('materialise: the intent is created blocked', async () => {
        const repo = createMemorySamparkRepo();
        const calls = createMemoryConversationRepo();
        const clock = testClock();
        await seedFamilies(repo, 2);
        await seedRiya(calls, Array.from({ length: FREQUENCY_CAP }, (_, i) => riyaCall('hash:g002', new Date(clock.now().getTime() - (i + 1) * DAY))));
        const camp = campaign({ mode: 'practice' });
        await repo.createCampaign(camp);
        const res = await materialiseCampaignIntents({ repo, clock, conversationCalls: calls }, camp, school(), 'simulated');
        expect(res.blocked).toEqual({ frequency_cap: 1 });
        expect(await repo.getIntent(ORG, idFor(camp.id, 'g002'))).toMatchObject({ status: 'blocked', blockReason: 'frequency_cap' });
    });
});

// ── Source half: no new single-store count, no unwired call site ────────────

const SRC = path.resolve(__dirname, '../../..');

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : sourceFiles(p);
        return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
    });
}

const rel = (p: string) => path.relative(SRC, p).split(path.sep).join('/');
const FILES = sourceFiles(SRC).map((p) => ({ file: rel(p), text: fs.readFileSync(p, 'utf8') }));

describe('source gate', () => {
    it('only the repositories and policy/recent-calls.ts call countCallsToPhoneSince', () => {
        const allowed = new Set(['lib/sampark/policy/recent-calls.ts', 'lib/sampark/ports.ts', 'lib/sampark/repo/memory.ts', 'lib/sampark/repo/firestore.ts']);
        const offenders = FILES.filter((f) => /\.countCallsToPhoneSince\(/.test(f.text) && !allowed.has(f.file)).map((f) => f.file);
        expect(offenders).toEqual([]);
    });

    it('every production materialiseCampaignIntents call passes the conversation repo', () => {
        const sites = FILES.flatMap((f) =>
            [...f.text.matchAll(/materialiseCampaignIntents\(([\s\S]{0,200}?)\)/g)]
                .filter(() => f.file !== 'lib/sampark/audience.ts')
                .map((m) => ({ file: f.file, args: m[1] })),
        );
        expect(sites.length).toBeGreaterThan(0);
        expect(sites.filter((s) => !s.args.includes('conversationCalls')).map((s) => s.file)).toEqual([]);
    });

    it('the jobs and the campaign preview resolve the conversation repo (never "none")', () => {
        const text = (file: string) => FILES.find((f) => f.file === file)?.text ?? '';
        expect(text('server/sampark/jobs.ts').match(/conversationCalls: await conversationCallsOf\(deps\)/g)).toHaveLength(2);
        expect(text('server/sampark/campaigns.ts')).toMatch(/conversationCallsOf\(ctx\)\.then\(\(calls\) => calls\.listCalls\(/);
        // NO_CONVERSATION_CALLS is for unit tests of the engine only.
        const prod = FILES.filter((f) => f.file !== 'lib/sampark/policy/recent-calls.ts' && f.file !== 'lib/sampark/audience.ts' && f.text.includes('NO_CONVERSATION_CALLS'));
        expect(prod.map((f) => f.file)).toEqual([]);
    });
});
