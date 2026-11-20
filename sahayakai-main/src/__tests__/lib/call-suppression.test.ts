/**
 * Do-not-call helper. The digest fixture is shared with
 * sahayakai-agents/tests/unit/test_telephony_opt_out_persistence.py — if the
 * two hashes ever diverge, a parent's opt-out is written under one key and
 * looked up under another, and the parent is called again.
 */

import {
    phoneSuppressionId,
    isParentOptedOut,
    refuseIfParentOptedOut,
    SUPPRESSION_COLLECTION,
} from '@/lib/call-suppression';
import { NextResponse } from 'next/server';
import { createFakeDb, lastJsonBody } from '../helpers/fake-attendance-db';

// A made-up number from the +9198000001xx test range, never a real family's.
const FIXTURE_PHONE = '+919800000101';
const FIXTURE_DIGEST = '1775163af1a0b1e46b138f7908ca90c7faa36273ae53b36a40640bba2b0ba8bd';

describe('phoneSuppressionId', () => {
    it('matches the digest the Python bridge computes for the same number', () => {
        expect(phoneSuppressionId(FIXTURE_PHONE)).toBe(FIXTURE_DIGEST);
    });

    it('never contains the raw number', () => {
        expect(phoneSuppressionId(FIXTURE_PHONE)).not.toContain('9800000101');
    });
});

const jsonSpy = jest.spyOn(NextResponse, 'json');

describe('refuseIfParentOptedOut', () => {
    it('returns null when the number is not suppressed', async () => {
        const db = createFakeDb({});
        expect(await isParentOptedOut(db, FIXTURE_PHONE)).toBe(false);
        expect(await refuseIfParentOptedOut(db, FIXTURE_PHONE)).toBeNull();
    });

    it('returns 409 PARENT_OPTED_OUT with teacher-friendly text when suppressed', async () => {
        const db = createFakeDb({
            [SUPPRESSION_COLLECTION]: { [FIXTURE_DIGEST]: { reason: 'opt_out' } },
        });
        const res = await refuseIfParentOptedOut(db, FIXTURE_PHONE);
        expect(res?.status).toBe(409);
        const body = lastJsonBody(jsonSpy);
        expect(body.code).toBe('PARENT_OPTED_OUT');
        expect(body.error).toMatch(/asked not to be called/i);
    });

    it('fails closed (503, no dial) when the lookup errors', async () => {
        const db = {
            collection: () => ({ doc: () => ({ get: async () => { throw new Error('boom'); } }) }),
        } as any;
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const res = await refuseIfParentOptedOut(db, FIXTURE_PHONE);
        expect(res?.status).toBe(503);
        expect(lastJsonBody(jsonSpy).code).toBe('SUPPRESSION_CHECK_FAILED');
    });
});
