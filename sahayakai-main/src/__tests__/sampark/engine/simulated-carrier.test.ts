/**
 * @jest-environment node
 */
import { applyCallEvent } from '@/lib/sampark/dispatch/state';
import { createSimulatedCarrier } from '@/lib/sampark/dispatch/simulated-carrier';
import { hashId } from '@/lib/sampark/intents';
import type { PlaceCallRequest, PlaceCallResult } from '@/lib/sampark/ports';
import type { PurposeId, SamparkCall } from '@/types/sampark';

function req(id: string, purpose: PurposeId = 'ptm_invite', audioSeconds = 40): PlaceCallRequest {
    const call: SamparkCall = {
        id,
        orgId: 'hillview-demo',
        intentId: `i-${id}`,
        campaignId: 'camp',
        purpose,
        guardianId: 'g',
        phoneHash: 'h',
        phoneLast4: '0000',
        language: 'Nepali',
        variant: 'default',
        attempt: 1,
        state: 'dialing',
        leaseUntil: '2026-10-07T05:32:00.000Z',
        carrier: 'simulated',
        providerCallId: null,
        outcome: { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' },
        durationSeconds: null,
        billedSeconds: null,
        costPaise: null,
        audioSeconds,
        createdAt: '2026-10-07T05:30:00.000Z',
        updatedAt: '2026-10-07T05:30:00.000Z',
        endedAt: null,
        failureReason: null,
    };
    return { call, destinationE164: '+915000000001', audioSeconds };
}

type Fate = 'failed' | 'busy' | 'no_answer' | 'key' | 'full' | 'partway';

function fateOf(r: PlaceCallResult, audio = 40): { fate: Fate; digits: string } {
    if (!r.ok) return { fate: 'failed', digits: '' };
    const hangup = r.events.find((e) => e.type === 'hangup');
    if (!hangup || hangup.type !== 'hangup') throw new Error('no hangup');
    const digits = r.events.map((e) => (e.type === 'digit' ? e.digit : '')).join('');
    if (hangup.cause === 'busy') return { fate: 'busy', digits };
    if (hangup.cause === 'no_answer') return { fate: 'no_answer', digits };
    if (digits) return { fate: 'key', digits };
    return { fate: hangup.durationSeconds >= 0.9 * audio ? 'full' : 'partway', digits };
}

const ids = Array.from({ length: 1000 }, (_, i) => hashId(`call-${i}`));

describe('createSimulatedCarrier', () => {
    it('is a simulated carrier', () => {
        expect(createSimulatedCarrier().kind).toBe('simulated');
    });

    it('is deterministic per call id and seed', async () => {
        const a = createSimulatedCarrier({ seed: 's1' });
        const b = createSimulatedCarrier({ seed: 's1' });
        for (const id of ids.slice(0, 50)) expect(await a.place(req(id))).toEqual(await b.place(req(id)));
    });

    it('a different seed gives different fates', async () => {
        const a = createSimulatedCarrier({ seed: 's1' });
        const b = createSimulatedCarrier({ seed: 's2' });
        const fa = await Promise.all(ids.slice(0, 100).map(async (id) => fateOf(await a.place(req(id))).fate));
        const fb = await Promise.all(ids.slice(0, 100).map(async (id) => fateOf(await b.place(req(id))).fate));
        expect(fa).not.toEqual(fb);
    });

    it('never touches the network', async () => {
        const fetchSpy = jest.fn();
        const original = (globalThis as { fetch?: unknown }).fetch;
        (globalThis as { fetch?: unknown }).fetch = fetchSpy;
        try {
            const c = createSimulatedCarrier();
            for (const id of ids.slice(0, 100)) await c.place(req(id));
        } finally {
            (globalThis as { fetch?: unknown }).fetch = original;
        }
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('matches the outcome distribution within ±5 points over 1,000 calls', async () => {
        const c = createSimulatedCarrier();
        const results = await Promise.all(ids.map(async (id) => fateOf(await c.place(req(id)))));
        const pct = (n: number, of = results.length) => (100 * n) / of;
        const count = (f: Fate) => results.filter((r) => r.fate === f).length;

        const answered = results.filter((r) => ['key', 'full', 'partway'].includes(r.fate));
        expect(Math.abs(pct(answered.length) - 72)).toBeLessThanOrEqual(5);
        expect(Math.abs(pct(count('no_answer')) - 18)).toBeLessThanOrEqual(5);
        expect(Math.abs(pct(count('busy')) - 6)).toBeLessThanOrEqual(5);
        expect(Math.abs(pct(count('failed')) - 4)).toBeLessThanOrEqual(5);

        const keyed = answered.filter((r) => r.fate === 'key');
        expect(Math.abs(pct(keyed.length, answered.length) - 55)).toBeLessThanOrEqual(5);
        expect(Math.abs(pct(answered.filter((r) => r.fate === 'full').length, answered.length) - 25)).toBeLessThanOrEqual(5);
        expect(Math.abs(pct(answered.filter((r) => r.fate === 'partway').length, answered.length) - 20)).toBeLessThanOrEqual(5);

    });

    it('splits key presses 1 ≈ 70 / 2 ≈ 22 / 99 ≈ 4 / 9 ≈ 4 within ±3 points (10,000 calls — key-pressers are only ~40% of calls)', async () => {
        const c = createSimulatedCarrier();
        const many = Array.from({ length: 10_000 }, (_, i) => hashId(`call-${i}`));
        const digits = (await Promise.all(many.map(async (id) => fateOf(await c.place(req(id)))))).filter((r) => r.fate === 'key').map((r) => r.digits);
        const k = (d: string) => (100 * digits.filter((x) => x === d).length) / digits.length;
        expect(Math.abs(k('1') - 70)).toBeLessThanOrEqual(3);
        expect(Math.abs(k('2') - 22)).toBeLessThanOrEqual(3);
        expect(Math.abs(k('99') - 4)).toBeLessThanOrEqual(3);
        expect(Math.abs(k('9') - 4)).toBeLessThanOrEqual(3);
    });

    it('some part-way listeners hang up inside the first 5 seconds (early hang-up is reachable)', async () => {
        const c = createSimulatedCarrier();
        const durations = (await Promise.all(ids.map((id) => c.place(req(id)))))
            .flatMap((r) => (r.ok ? r.events : []))
            .filter((e) => e.type === 'hangup' && e.cause === 'completed')
            .map((e) => (e.type === 'hangup' ? e.durationSeconds : 0));
        expect(durations.some((d) => d < 5)).toBe(true);
    });

    it('place failures are ok:false and retryable', async () => {
        const c = createSimulatedCarrier();
        const failures = (await Promise.all(ids.map((id) => c.place(req(id))))).filter((r) => !r.ok);
        expect(failures.length).toBeGreaterThan(0);
        for (const f of failures) expect(f).toEqual({ ok: false, reason: expect.any(String), retryable: true });
    });

    it('events are chronological, after createdAt, and billed in 60 s units only when answered', async () => {
        const c = createSimulatedCarrier();
        for (const id of ids.slice(0, 300)) {
            const r = await c.place(req(id));
            if (!r.ok) continue;
            const times = r.events.map((e) => Date.parse(e.at));
            expect(times[0]).toBeGreaterThan(Date.parse('2026-10-07T05:30:00.000Z'));
            for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
            const hangup = r.events[r.events.length - 1];
            expect(hangup.type).toBe('hangup');
            if (hangup.type !== 'hangup') continue;
            if (hangup.cause === 'completed') {
                expect(hangup.billedSeconds % 60).toBe(0);
                expect(hangup.billedSeconds).toBeGreaterThanOrEqual(hangup.durationSeconds);
                expect(hangup.billedSeconds).toBeGreaterThanOrEqual(60);
            } else {
                expect(hangup.billedSeconds).toBe(0);
            }
            expect(r.events[0]).toEqual({ type: 'placed', at: expect.any(String), providerCallId: r.providerCallId });
        }
    });

    it('its lifecycles always reduce to a terminal call with a heard level consistent with the audio', async () => {
        const c = createSimulatedCarrier();
        for (const id of ids.slice(0, 300)) {
            const request = req(id, 'ptm_invite', 30);
            const r = await c.place(request);
            if (!r.ok) continue;
            const final = r.events.reduce(applyCallEvent, request.call);
            expect(['completed', 'no_answer', 'busy']).toContain(final.state);
            const f = fateOf(r, 30).fate;
            if (f === 'full') expect(final.outcome.heard).toBe('full');
            if (f === 'partway') expect(['partial', 'early_hangup']).toContain(final.outcome.heard);
            if (f === 'no_answer' || f === 'busy') expect(final.outcome.heard).toBe('none');
        }
    });

    it('never presses 2 on a purpose whose menu has no key 2 (emergency closure)', async () => {
        const c = createSimulatedCarrier();
        const digits = (await Promise.all(ids.map((id) => c.place(req(id, 'emergency_closure'))))).map((r) => fateOf(r).digits);
        expect(digits.some((d) => d.includes('2'))).toBe(false);
        expect(digits.some((d) => d === '1')).toBe(true);
    });
});
