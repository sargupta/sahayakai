/** @jest-environment node */
/**
 * Carrier selection (contract §5; phase 2a contract §3) and dial destinations
 * (class gate 4's server-side half):
 *
 *   practice → the simulated carrier, whatever the deployment's flags;
 *   test     → the Vobiz notice carrier only when the deployment can place real
 *              calls (flag exactly 'true', https public base, Vobiz config) AND the
 *              school has a test phone — otherwise a 409 naming the first blocker;
 *   live     → LIVE_MODE_NOT_AVAILABLE, always, in phase 2a.
 *
 * The whole matrix (mode × flag × base × config × test phone) is enumerated.
 * No carrier built here is ever asked to place a call.
 */

import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import type { SamparkGuardian, SamparkSchool } from '@/types/sampark';
import { carrierFor, carrierKindFor, carrierKindForDryRun, LIVE_MODE_NOT_AVAILABLE, TEST_PHONE_MISSING } from '@/server/sampark/carrier';
import { destinationFor } from '@/server/sampark/jobs';

import { ORG, setPhoneEnv } from './_helpers';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const ENV_KEYS = ['SAMPARK_LIVE_DIAL_ENABLED', 'SAMPARK_PUBLIC_BASE_URL', 'VOBIZ_AUTH_ID', 'VOBIZ_AUTH_TOKEN', 'VOBIZ_FROM_NUMBER', 'VOBIZ_BASE_URL'] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

beforeAll(setPhoneEnv);
beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
});
afterAll(() => {
    for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
});

const TEST_PHONE = '+919800000001';

function school(mode: SamparkSchool['mode'], overrides: Partial<SamparkSchool> = {}): SamparkSchool {
    return {
        orgId: ORG,
        spokenName: { English: 'H', Hindi: 'ह', Bengali: 'হ', Nepali: 'ह' },
        displayName: 'H',
        mode,
        isDemo: false,
        callingWindow: { startHour: 10, endHour: 19, offDays: [0] },
        holidays: [],
        venues: [],
        defaultLanguage: null,
        crm: null,
        emergencyBypassConsent: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        ...overrides,
    };
}

function withTestPhone(s: SamparkSchool): SamparkSchool {
    return { ...s, testPhoneEnc: encryptPhone(TEST_PHONE), testPhoneHash: hashPhone(TEST_PHONE), testPhoneLast4: '0001' };
}

type Base = 'missing' | 'http' | 'https';
interface Case {
    mode: SamparkSchool['mode'];
    flag: boolean;
    base: Base;
    config: boolean;
    phone: boolean;
}

function applyEnv(c: Case): void {
    if (c.flag) process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
    if (c.base === 'http') process.env.SAMPARK_PUBLIC_BASE_URL = 'http://sampark-calls.example.test';
    if (c.base === 'https') process.env.SAMPARK_PUBLIC_BASE_URL = 'https://sampark-calls.example.test';
    if (c.config) {
        process.env.VOBIZ_AUTH_ID = 'MA_TEST';
        process.env.VOBIZ_AUTH_TOKEN = 'tok';
        process.env.VOBIZ_FROM_NUMBER = '+918000000000';
    }
}

/** The contract, written independently of the implementation. */
function expected(c: Case): 'simulated' | 'vobiz' | string {
    if (c.mode === 'practice') return 'simulated';
    if (c.mode === 'live') return LIVE_MODE_NOT_AVAILABLE;
    if (!c.flag) return 'LIVE_DIAL_DISABLED';
    if (c.base !== 'https') return 'PUBLIC_BASE_URL_MISSING';
    if (!c.config) return 'CARRIER_UNCONFIGURED';
    if (!c.phone) return TEST_PHONE_MISSING;
    return 'vobiz';
}

const CASES: Case[] = [];
for (const mode of ['practice', 'test', 'live'] as const) {
    for (const flag of [false, true]) {
        for (const base of ['missing', 'http', 'https'] as const) {
            for (const config of [false, true]) {
                for (const phone of [false, true]) CASES.push({ mode, flag, base, config, phone });
            }
        }
    }
}

describe('carrier selection — the full matrix', () => {
    it('enumerates every combination', () => {
        expect(CASES).toHaveLength(72);
        expect(CASES.filter((c) => expected(c) === 'vobiz')).toEqual([{ mode: 'test', flag: true, base: 'https', config: true, phone: true }]);
    });

    it.each(CASES)('mode=$mode flag=$flag base=$base config=$config testPhone=$phone', (c) => {
        applyEnv(c);
        const s = c.phone ? withTestPhone(school(c.mode)) : school(c.mode);
        const want = expected(c);
        if (want === 'simulated' || want === 'vobiz') {
            expect(carrierKindFor(s)).toBe(want);
            expect(carrierFor(s).kind).toBe(want);
            expect(carrierKindForDryRun(s)).toBe(want);
        } else {
            expect(() => carrierKindFor(s)).toThrow(expect.objectContaining({ code: want, status: 409 }));
            expect(() => carrierFor(s)).toThrow(expect.objectContaining({ code: want, status: 409 }));
            // A dry run assumes the real carrier, so the summary shows the gate's reason instead of throwing.
            expect(carrierKindForDryRun(s)).toBe('vobiz');
        }
    });

    it('a test phone needs both the encrypted number and its hash', () => {
        applyEnv({ mode: 'test', flag: true, base: 'https', config: true, phone: true });
        const full = withTestPhone(school('test'));
        expect(() => carrierKindFor({ ...full, testPhoneEnc: null })).toThrow(expect.objectContaining({ code: TEST_PHONE_MISSING }));
        expect(() => carrierKindFor({ ...full, testPhoneHash: null })).toThrow(expect.objectContaining({ code: TEST_PHONE_MISSING }));
    });

    it('the flag must be exactly "true"', () => {
        applyEnv({ mode: 'test', flag: true, base: 'https', config: true, phone: true });
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'TRUE';
        expect(() => carrierKindFor(withTestPhone(school('test')))).toThrow(expect.objectContaining({ code: 'LIVE_DIAL_DISABLED' }));
    });
});

describe('destinationFor', () => {
    let guardian: SamparkGuardian;
    beforeAll(() => {
        guardian = { phoneEnc: encryptPhone('+919811111111') } as SamparkGuardian;
    });

    it('practice: the guardian number, decrypted only at dial time', async () => {
        const g = { ...guardian, phoneEnc: encryptPhone('+915000000123') };
        await expect(destinationFor(school('practice'), g)).resolves.toEqual({ e164: '+915000000123', kind: 'guardian' });
    });

    it('test: the school’s test phone — never the guardian', async () => {
        await expect(destinationFor(withTestPhone(school('test')), guardian)).resolves.toEqual({ e164: TEST_PHONE, kind: 'test_phone' });
    });

    it('test: refuses when the test phone is missing, or does not match the hash the call is recorded under', async () => {
        await expect(destinationFor(school('test'), guardian)).rejects.toThrow(/^TEST_PHONE_MISSING/);
        const mismatched = { ...withTestPhone(school('test')), testPhoneHash: hashPhone('+919822222222') };
        const err = await destinationFor(mismatched, guardian).then(() => null, (e: Error) => e);
        expect(err?.message).toMatch(/^TEST_PHONE_MISMATCH/);
        expect(err?.message).not.toContain('9800000001');
    });

    it('live: refused — no parent is dialled on a real carrier in phase 2a', async () => {
        await expect(destinationFor(school('live'), guardian)).rejects.toThrow(/^LIVE_MODE_NOT_AVAILABLE/);
    });
});
