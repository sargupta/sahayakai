/** @jest-environment node */
/**
 * Carrier selection (contract §5) and dial destinations: practice mode gets
 * the simulated carrier; nothing else can obtain a carrier in slice 1, with or
 * without SAMPARK_LIVE_DIAL_ENABLED (class gate 4's server-side half).
 */

import { encryptPhone } from '@/lib/sampark/phone';
import type { SamparkGuardian, SamparkSchool } from '@/types/sampark';
import { carrierFor, carrierKindFor, carrierKindForDryRun } from '@/server/sampark/carrier';
import { destinationFor } from '@/server/sampark/jobs';

import { ORG, setPhoneEnv } from './_helpers';

beforeAll(setPhoneEnv);
afterEach(() => {
    delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
});

function school(mode: SamparkSchool['mode']): SamparkSchool {
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
    };
}

describe('carrier selection', () => {
    it('practice → the simulated carrier', () => {
        expect(carrierKindFor(school('practice'))).toBe('simulated');
        expect(carrierFor(school('practice')).kind).toBe('simulated');
    });

    it.each(['test', 'live'] as const)('%s → LIVE_DIAL_DISABLED, even with SAMPARK_LIVE_DIAL_ENABLED=true', (mode) => {
        expect(() => carrierFor(school(mode))).toThrow(expect.objectContaining({ code: 'LIVE_DIAL_DISABLED', status: 409 }));
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        expect(() => carrierFor(school(mode))).toThrow(expect.objectContaining({ code: 'LIVE_DIAL_DISABLED' }));
        expect(carrierKindForDryRun(school(mode))).toBe('vobiz');
    });
});

describe('destinationFor', () => {
    const guardian = { phoneEnc: '' } as SamparkGuardian;

    it('decrypts the guardian number only at dial time', async () => {
        const g = { ...guardian, phoneEnc: encryptPhone('+915000000123') };
        await expect(destinationFor(school('practice'), g)).resolves.toBe('+915000000123');
    });

    it('refuses test mode until the test-phone path exists', async () => {
        await expect(destinationFor(school('test'), { ...guardian, phoneEnc: encryptPhone('+915000000123') })).rejects.toThrow(/Test mode/);
    });
});
