/**
 * Do-not-call helper. The digest fixture is shared with
 * sahayakai-agents/tests/unit/test_telephony_opt_out_persistence.py — if the
 * two hashes ever diverge, a parent's opt-out is written under one key and
 * looked up under another, and the parent is called again.
 */

import {
    keyedPhoneSuppressionId,
    legacyPhoneSuppressionId,
    phoneSuppressionIds,
    isParentOptedOut,
    refuseIfParentOptedOut,
    SUPPRESSION_COLLECTION,
} from '@/lib/call-suppression';
import { NextResponse } from 'next/server';
import { createFakeDb, lastJsonBody } from '../helpers/fake-attendance-db';

// A made-up number from the +9198000001xx test range, never a real family's.
const FIXTURE_PHONE = '+919800000101';
const FIXTURE_DIGEST = '1775163af1a0b1e46b138f7908ca90c7faa36273ae53b36a40640bba2b0ba8bd';
const FIXTURE_PEPPER = 'test-pepper-not-a-secret';
const FIXTURE_KEYED_DIGEST = '9960b183c2a155b03dfad2caddfd303b611cb1f67265828fb07fc862934cc409';

const savedPepper = process.env.SAMPARK_PHONE_PEPPER;
beforeEach(() => { process.env.SAMPARK_PHONE_PEPPER = FIXTURE_PEPPER; });
afterAll(() => {
    if (savedPepper === undefined) delete process.env.SAMPARK_PHONE_PEPPER;
    else process.env.SAMPARK_PHONE_PEPPER = savedPepper;
});

describe('suppression ids', () => {
    it('match the digests the Python bridge computes for the same number', () => {
        expect(legacyPhoneSuppressionId(FIXTURE_PHONE)).toBe(FIXTURE_DIGEST);
        expect(keyedPhoneSuppressionId(FIXTURE_PHONE, FIXTURE_PEPPER)).toBe(FIXTURE_KEYED_DIGEST);
    });

    it('look up the keyed id first, then the old one, so entries from before the change still count', () => {
        expect(phoneSuppressionIds(FIXTURE_PHONE)).toEqual([FIXTURE_KEYED_DIGEST, FIXTURE_DIGEST]);
    });

    it('fall back to the old id alone when no pepper is configured', () => {
        delete process.env.SAMPARK_PHONE_PEPPER;
        expect(phoneSuppressionIds(FIXTURE_PHONE)).toEqual([FIXTURE_DIGEST]);
    });

    it('never contain the raw number', () => {
        for (const id of phoneSuppressionIds(FIXTURE_PHONE)) expect(id).not.toContain('9800000101');
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

    it('refuses a number opted out under the new keyed id', async () => {
        const db = createFakeDb({
            [SUPPRESSION_COLLECTION]: { [FIXTURE_KEYED_DIGEST]: { reason: 'opt_out' } },
        });
        expect(await isParentOptedOut(db, FIXTURE_PHONE)).toBe(true);
        expect((await refuseIfParentOptedOut(db, FIXTURE_PHONE))?.status).toBe(409);
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
