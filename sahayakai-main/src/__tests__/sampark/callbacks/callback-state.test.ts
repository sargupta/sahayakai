/** @jest-environment node */
/** The callback state machine: every allowed and refused transition, pure. */

import { z } from 'zod';

import { CALLBACK_LEASE_MS, cancel, claim, complete, fail, isClaimable, reschedule, retryOrFail, runIdempotencyKey } from '@/lib/sampark/callbacks/state';
import type { CallbackStatus, SamparkCallback } from '@/lib/sampark/callbacks/types';

const NOW = new Date('2026-10-07T05:30:00Z');

function cb(over: Partial<SamparkCallback> = {}): SamparkCallback {
    return {
        id: 'c1', orgId: 'o1', guardianId: 'g1', studentId: 's1', riyaPurpose: 'ptm_invitation', facts: null, campaignId: 'k1',
        announcement: 'hello', scheduledAt: '2026-10-07T05:30:00.000Z', timeZone: 'Asia/Kolkata', candidates: [],
        status: 'scheduled', version: 1, queueAt: '2026-10-07T05:30:00.000Z', attempts: 0, lease: null, riyaCallId: null, lastError: null,
        source: 'staff', sourceCallId: null, requestedText: null, note: null, createdBy: 'u', approvedBy: 'u',
        createdAt: '2026-10-07T05:00:00.000Z', updatedAt: '2026-10-07T05:00:00.000Z', cancelledBy: null, completedAt: null,
        ...over,
    };
}

describe('claim', () => {
    it('claims a due scheduled callback and leases it', () => {
        const r = claim(cb(), { holder: 'w', now: NOW });
        expect(r.kind).toBe('claimed');
        if (r.kind === 'claimed') expect(r.next).toMatchObject({ status: 'running', attempts: 1, lease: { holder: 'w' } });
    });
    it('skips one not yet due, a proposal, and terminal records', () => {
        expect(claim(cb({ queueAt: '2026-10-07T06:00:00.000Z' }), { holder: 'w', now: NOW }).kind).toBe('skip');
        for (const status of ['proposed', 'completed', 'failed', 'missed', 'cancelled'] as CallbackStatus[]) {
            expect(claim(cb({ status, queueAt: status === 'proposed' ? null : null }), { holder: 'w', now: NOW }).kind).toBe('skip');
        }
    });
    it('a live lease is not claimable; an expired one is, keeping the attempt count', () => {
        const running = cb({ status: 'running', attempts: 1, lease: { holder: 'dead', until: new Date(NOW.getTime() + 1000).toISOString() }, queueAt: new Date(NOW.getTime() + 1000).toISOString() });
        expect(isClaimable(running, NOW)).toBe(false);
        const later = new Date(NOW.getTime() + CALLBACK_LEASE_MS);
        const r = claim(running, { holder: 'w2', now: later });
        expect(r.kind).toBe('claimed');
        if (r.kind === 'claimed') expect(r.next).toMatchObject({ attempts: 1, lease: { holder: 'w2' } });
    });
    it('first run more than an hour late → missed', () => {
        expect(claim(cb(), { holder: 'w', now: new Date(NOW.getTime() + 61 * 60_000) }).kind).toBe('missed');
    });
});

describe('finishing a run', () => {
    const running = () => (claim(cb(), { holder: 'w', now: NOW }) as { next: SamparkCallback }).next;
    it('only the lease holder can complete or fail it', () => {
        expect(complete(running(), { holder: 'other', now: NOW, riyaCallId: 'x' })).toBeNull();
        expect(fail(running(), { holder: 'other', now: NOW, code: 'X', message: 'x' })).toBeNull();
        expect(complete(running(), { holder: 'w', now: NOW, riyaCallId: 'x' })).toMatchObject({ status: 'completed', queueAt: null, riyaCallId: 'x' });
    });
    it('retries with a growing delay, then fails', () => {
        const r = retryOrFail(running(), { holder: 'w', now: NOW, code: 'BUSY', message: 'busy' });
        expect(r).toMatchObject({ status: 'scheduled', lastError: { code: 'BUSY' } });
        expect(new Date(r!.queueAt!).getTime()).toBeGreaterThan(NOW.getTime());
        const exhausted = { ...running(), attempts: 4 };
        expect(retryOrFail(exhausted, { holder: 'w', now: NOW, code: 'BUSY', message: 'busy' })).toMatchObject({ status: 'failed' });
    });
});

describe('people', () => {
    it('reschedule bumps the version, clears errors and needs the current version', () => {
        const at = new Date('2026-10-08T06:00:00Z');
        const r = reschedule(cb({ status: 'failed', lastError: { code: 'X', message: 'x', at: '' } }), { scheduledAt: at, timeZone: 'Asia/Kolkata', announcement: 'hi', uid: 'u2', now: NOW, expectedVersion: 1 });
        expect(r).toMatchObject({ ok: true, next: { status: 'scheduled', version: 2, lastError: null, approvedBy: 'u2', queueAt: at.toISOString() } });
        expect(reschedule(cb(), { scheduledAt: at, timeZone: 'Asia/Kolkata', announcement: 'hi', uid: 'u', now: NOW, expectedVersion: 0 })).toEqual({ ok: false, code: 'CALLBACK_CHANGED' });
    });
    it('nothing changes a running, completed or cancelled callback', () => {
        const at = new Date('2026-10-08T06:00:00Z');
        expect(reschedule(cb({ status: 'running' }), { scheduledAt: at, timeZone: 'Asia/Kolkata', announcement: 'h', uid: 'u', now: NOW })).toEqual({ ok: false, code: 'CALLBACK_IN_PROGRESS' });
        expect(cancel(cb({ status: 'running' }), { uid: 'u', now: NOW })).toEqual({ ok: false, code: 'CALLBACK_IN_PROGRESS' });
        expect(cancel(cb({ status: 'completed' }), { uid: 'u', now: NOW })).toEqual({ ok: false, code: 'CALLBACK_NOT_OPEN' });
        expect(reschedule(cb({ status: 'cancelled' }), { scheduledAt: at, timeZone: 'Asia/Kolkata', announcement: 'h', uid: 'u', now: NOW })).toEqual({ ok: false, code: 'CALLBACK_NOT_OPEN' });
    });
});

describe('runIdempotencyKey', () => {
    it('is a stable, valid uuid for the same input and differs per version', () => {
        const a = runIdempotencyKey('0123456789abcdef0123456789abcdef');
        expect(z.string().uuid().safeParse(a).success).toBe(true);
        expect(runIdempotencyKey('0123456789abcdef0123456789abcdef')).toBe(a);
        expect(runIdempotencyKey('fedcba9876543210fedcba9876543210')).not.toBe(a);
    });
});
