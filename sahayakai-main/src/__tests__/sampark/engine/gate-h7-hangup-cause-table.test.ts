/**
 * @jest-environment node
 *
 * CLASS GATE H7 — every carrier hangup cause maps to (call state, retryable,
 * number flag), and a dead number is never dialled again (EDGE_CASES.md §2 gap 7,
 * telephony D01–D10).
 *
 * Before the hardening sprint UNALLOCATED_NUMBER and its kind settled as an
 * ordinary failure: retried twice more, and dialled again by the next campaign.
 * The class: the table below is the contract's table, row for row; the webhook
 * parser, the reducer and settling all read it; and a number the carrier reports
 * dead is suppressed for EVERY purpose, emergency included, until the office
 * corrects it.
 *
 *   - The exported table equals the contract's, and the parser maps each raw cause
 *     (any case) to its state; an unknown cause keeps the old behaviour.
 *   - Through the real hangup path (parser → reducer → settleCall) each cause ends
 *     the intent as its row says, and only the invalid-number rows suppress.
 *   - After an invalid number, no purpose's gate allows that phone, at either
 *     stage, and the intent is never retried.
 *   - A test-phone or simulated call only audits; an effective suppression is
 *     never weakened.
 */
import { isDialable, PURPOSE_CATALOGUE, purposeSpec } from '@/lib/sampark/catalogue';
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { settleCall } from '@/lib/sampark/dispatch/settle';
import { applyCallEvent } from '@/lib/sampark/dispatch/state';
import { callIdFor } from '@/lib/sampark/intents';
import { evaluateGate } from '@/lib/sampark/policy/gate';
import type { AuditEntry } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { HANGUP_CAUSE_TABLE, hangupCauseFromVobiz, hangupEventFromVobiz, type HangupCause } from '@/lib/sampark/voice/vobiz-events';
import type { CallDestination, CarrierKind, Intent, PurposeId, SamparkCall, Suppression } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, guardian, ORG, prefs, school, scriptedCarrier, seedFamilies, student, testClock, WED_11_IST } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

type Row = { cause: HangupCause; retryable: boolean; invalidNumber: boolean };
const row = (cause: HangupCause, retryable: boolean, invalidNumber = false): Row => ({ cause, retryable, invalidNumber });

/** docs/sampark/HARDENING_CONTRACT.md, stream A, A4 — verbatim. */
const CONTRACT: Record<string, Row> = {
    NORMAL_CLEARING: row('completed', true),
    USER_BUSY: row('busy', true),
    NO_ANSWER: row('no_answer', true),
    NO_USER_RESPONSE: row('no_answer', true),
    TIMEOUT: row('no_answer', true),
    ALLOTTED_TIMEOUT: row('no_answer', true),
    SUBSCRIBER_ABSENT: row('no_answer', true),
    CALL_REJECTED: row('failed', true),
    ORIGINATOR_CANCEL: row('failed', true),
    NORMAL_CIRCUIT_CONGESTION: row('failed', true),
    SWITCH_CONGESTION: row('failed', true),
    NETWORK_OUT_OF_ORDER: row('failed', true),
    NORMAL_TEMPORARY_FAILURE: row('failed', true),
    RECOVERY_ON_TIMER_EXPIRE: row('failed', true),
    NO_ROUTE_DESTINATION: row('failed', true),
    UNALLOCATED_NUMBER: row('failed', false, true),
    INVALID_NUMBER_FORMAT: row('failed', false, true),
    NUMBER_CHANGED: row('failed', false, true),
    INCOMPATIBLE_DESTINATION: row('failed', false),
};
const CAUSES = Object.keys(CONTRACT);
const INVALID = CAUSES.filter((c) => CONTRACT[c].invalidNumber);

const T0 = WED_11_IST;
const iso = (offsetMs = 0) => new Date(T0.getTime() + offsetMs).toISOString();

/**
 * One approved PTM intent for g001, claimed with a call on `carrier` to `destination`, then
 * hung up through exactly what the status webhook does: parse the form, apply it through the
 * reducer, settle. Returns what settling left behind.
 */
async function hangUpWith(form: Record<string, string>, opts: { carrier?: CarrierKind; destination?: CallDestination; attempt?: number; existing?: Suppression } = {}) {
    const repo = createMemorySamparkRepo();
    const clock = testClock(T0);
    const audits: AuditEntry[] = [];
    const append = repo.appendAudit.bind(repo);
    jest.spyOn(repo, 'appendAudit').mockImplementation(async (orgId, entry) => {
        audits.push(entry);
        await append(orgId, entry);
    });
    if (opts.existing) await repo.upsertSuppression(opts.existing);
    const attempt = opts.attempt ?? 1;
    const intent: Intent = {
        id: 'intent-g001', dedupeKey: 'campaign:camp-ptm:guardian:g001', orgId: ORG, campaignId: null, purpose: 'ptm_invite',
        guardianId: 'g001', studentIds: ['s001'], language: 'Nepali', status: 'approved', blockReason: null,
        attempts: attempt - 1, maxAttempts: 3, notBefore: null, expiresAt: '2027-12-31T00:00:00.000Z', lastCallId: null,
        createdAt: iso(), updatedAt: iso(),
    };
    await repo.createIntentIfAbsent(intent);
    const destination = opts.destination ?? 'guardian';
    const call: SamparkCall = {
        id: callIdFor(intent.id, attempt), orgId: ORG, intentId: intent.id, campaignId: null, purpose: 'ptm_invite', guardianId: 'g001',
        phoneHash: destination === 'test_phone' ? 'hash:test-phone' : 'hash:g001', phoneLast4: '0001', destination, language: 'Nepali',
        variant: 'default', attempt, state: 'dialing', leaseUntil: iso(15 * 60_000), carrier: opts.carrier ?? 'vobiz', providerCallId: 'req-1',
        outcome: { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' }, durationSeconds: null, billedSeconds: null,
        costPaise: null, audioSeconds: 40, createdAt: iso(), updatedAt: iso(), endedAt: null, failureReason: null, settledAt: null, requeue: 0,
    };
    expect(await repo.claimIntentForDial(ORG, intent.id, call, T0)).toBe('claimed');
    clock.advance(60_000);
    const event = hangupEventFromVobiz(form, clock.now().toISOString());
    await repo.mutateCall(ORG, call.id, (c) => applyCallEvent(c, event));
    expect(await settleCall({ repo, clock }, ORG, call.id)).toBe('settled');
    return { repo, clock, audits, call: (await repo.getCall(ORG, call.id))!, intent: (await repo.getIntent(ORG, intent.id))! };
}

describe('class gate H7 — the cause table', () => {
    it('is the contract table, row for row, and nothing else', () => {
        expect(HANGUP_CAUSE_TABLE).toEqual(CONTRACT);
    });

    it.each(CAUSES)('%s: the parser maps it (any case) to its state, with or without a duration', (cause) => {
        for (const raw of [cause, cause.toLowerCase()]) {
            for (const Duration of ['0', '25']) expect(hangupCauseFromVobiz({ HangupCause: raw, Duration })).toBe(CONTRACT[cause].cause);
        }
    });
});

describe('class gate H7 — each cause through the real hangup path', () => {
    it.each(CAUSES)('%s → the call state, the intent and the number flag its row says', async (cause) => {
        const expected = CONTRACT[cause];
        const answered = expected.cause === 'completed';
        const { repo, call, intent, audits } = await hangUpWith({ HangupCause: cause, Duration: answered ? '45' : '0' });
        expect(call).toMatchObject({ state: expected.cause, hangupCause: cause });
        // Answered and heard in full → done. Otherwise the row decides: retryable → retry_wait, not → done.
        const status = answered || !expected.retryable ? 'done' : 'retry_wait';
        expect(intent).toMatchObject({ status, attempts: 1, carrierRequeues: 0 });
        const suppression = await repo.getSuppression(ORG, 'hash:g001');
        if (expected.invalidNumber) {
            expect(suppression).toMatchObject({ scope: 'all', source: 'carrier_invalid_number', officeVerification: 'pending', callId: call.id });
            expect(audits.filter((e) => e.action === 'number.flagged_invalid')).toEqual([
                expect.objectContaining({ target: 'suppression/hash:g001', detail: expect.objectContaining({ hangupCause: cause, suppressed: true }) }),
            ]);
        } else {
            expect(suppression).toBeNull();
            expect(audits.filter((e) => e.action === 'number.flagged_invalid')).toEqual([]);
        }
    });

    it('an unknown cause keeps the old behaviour: retryable, never a flag', async () => {
        for (const Duration of ['0', '45']) {
            const { repo, call, intent } = await hangUpWith({ HangupCause: 'SOMETHING_NEW', Duration });
            expect(call).toMatchObject({ state: Duration === '0' ? 'failed' : 'completed', hangupCause: 'SOMETHING_NEW' });
            expect(intent.status).toBe(Duration === '0' ? 'retry_wait' : 'done');
            expect(await repo.getSuppression(ORG, 'hash:g001')).toBeNull();
        }
        // And a callback with no cause at all.
        const { call, intent } = await hangUpWith({ Status: 'no-answer', Duration: '0' });
        expect(call.hangupCause ?? null).toBeNull();
        expect(intent.status).toBe('retry_wait');
    });

    it('a duplicated hangup settles once: one suppression, one audit', async () => {
        const { repo, clock, call, audits } = await hangUpWith({ HangupCause: 'UNALLOCATED_NUMBER' });
        expect(await settleCall({ repo, clock }, ORG, call.id)).toBe('noop');
        expect(audits.filter((e) => e.action === 'number.flagged_invalid')).toHaveLength(1);
    });
});

describe('class gate H7 — a dead number is never dialled again', () => {
    it.each(INVALID)('%s: no purpose, at either stage, allows that phone again', async (cause) => {
        const { repo } = await hangUpWith({ HangupCause: cause });
        const suppression = await repo.getSuppression(ORG, 'hash:g001');
        for (const id of Object.keys(PURPOSE_CATALOGUE) as PurposeId[]) {
            // Every purpose as if it were available, so the suppression rule — not "not yet available" — is what decides.
            const spec = { ...purposeSpec(id), status: 'available' as const };
            for (const stage of ['materialise', 'dispatch'] as const) {
                const verdict = evaluateGate({
                    school: school(), spec, guardian: guardian('g001', { studentIds: ['s001'], phoneHash: 'hash:g001' }), students: [student('s001', { guardianIds: ['g001'] })],
                    preferences: prefs('g001', { notices: 'granted', progress: 'granted' }), suppression, recentCallsToPhone: 0, carrierKind: 'simulated', now: T0, stage,
                });
                // A machine-dialable purpose is refused by the suppression; a human-only one never dials anyway.
                expect([id, stage, verdict]).toEqual([id, stage, { kind: 'block', reason: isDialable(id) ? 'suppressed' : 'human_only_purpose' }]);
            }
        }
    });

    it('the next campaign, routine or emergency, blocks the number at materialisation, and the intent is never retried', async () => {
        const { repo, clock, intent } = await hangUpWith({ HangupCause: 'UNALLOCATED_NUMBER' });
        expect(intent.status).toBe('done');
        await seedFamilies(repo, 1);
        for (const c of [
            campaign({ id: 'camp-ptm-2', mode: 'practice' }),
            campaign({ id: 'camp-d4', mode: 'practice', purpose: 'emergency_closure', facts: { kind: 'emergency_closure', date: '2026-10-07', reason: 'heavy_rain', busesRunning: false } }),
        ]) {
            await repo.createCampaign(c);
            expect((await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated')).blocked).toEqual({ suppressed: 1 });
        }
        const carrier = scriptedCarrier(() => 'full');
        for (let i = 0; i < 10; i++) {
            clock.advance(3 * 60 * 60_000);
            await runDispatchTick(deps(repo, clock, carrier), DEFAULT_OPTS);
        }
        expect(carrier.requests).toEqual([]);
    });
});

describe('class gate H7 — rehearsals only audit, and nothing is weakened', () => {
    it.each([
        ['the school’s test phone', { destination: 'test_phone' as const }],
        ['a simulated call', { carrier: 'simulated' as const }],
    ])('%s ending UNALLOCATED_NUMBER audits and suppresses nobody', async (_label, opts) => {
        const { repo, intent, audits } = await hangUpWith({ HangupCause: 'UNALLOCATED_NUMBER' }, opts);
        expect(await repo.listSuppressions(ORG)).toEqual([]);
        expect(intent.status).toBe('done'); // still not retried: the number dialled is dead
        expect(audits.filter((e) => e.action === 'number.flagged_invalid')).toEqual([
            expect.objectContaining({ detail: expect.objectContaining({ suppressed: false }) }),
        ]);
    });

    it('an effective suppression (an office-confirmed opt-out) is kept exactly as it is', async () => {
        const existing: Suppression = { orgId: ORG, phoneHash: 'hash:g001', phoneLast4: '0001', scope: 'routine', source: 'office', officeVerification: 'confirmed', createdAt: '2026-09-01T00:00:00.000Z', callId: null };
        const { repo, audits } = await hangUpWith({ HangupCause: 'NUMBER_CHANGED' }, { existing });
        expect(await repo.getSuppression(ORG, 'hash:g001')).toEqual(existing);
        expect(audits.filter((e) => e.action === 'number.flagged_invalid')).toEqual([
            expect.objectContaining({ detail: expect.objectContaining({ suppressed: false, kept: { source: 'office', scope: 'routine' } }) }),
        ]);
    });

    it('a suppression the office reversed is replaced: the carrier now says the number is dead', async () => {
        const reversed: Suppression = { orgId: ORG, phoneHash: 'hash:g001', phoneLast4: '0001', scope: 'routine', source: 'keypad', officeVerification: 'reversed', createdAt: '2026-09-01T00:00:00.000Z', callId: null };
        const { repo } = await hangUpWith({ HangupCause: 'INVALID_NUMBER_FORMAT' }, { existing: reversed });
        expect(await repo.getSuppression(ORG, 'hash:g001')).toMatchObject({ scope: 'all', source: 'carrier_invalid_number', officeVerification: 'pending' });
    });
});
