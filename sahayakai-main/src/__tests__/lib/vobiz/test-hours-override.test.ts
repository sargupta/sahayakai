import { testHoursOverrideApplies } from '@/lib/vobiz/test-hours-override';

const ENV = {
    NODE_ENV: 'development',
    VOBIZ_TEST_HOURS_OVERRIDE: '1',
    VOBIZ_TEST_HOURS_ALLOWLIST: '+91 90000 00001',
} as unknown as NodeJS.ProcessEnv;
const TEST = { testCall: true, parentPhone: '+919000000001' };

describe('testHoursOverrideApplies', () => {
    it('applies to an allow-listed test call outside production', () => {
        expect(testHoursOverrideApplies(TEST, ENV)).toBe(true);
    });
    it('never applies in production', () => {
        expect(testHoursOverrideApplies(TEST, { ...ENV, NODE_ENV: 'production' })).toBe(false);
    });
    it('is off unless explicitly enabled', () => {
        expect(testHoursOverrideApplies(TEST, { ...ENV, VOBIZ_TEST_HOURS_OVERRIDE: '' })).toBe(false);
    });
    it('never applies to a number outside the allowlist (a parent)', () => {
        expect(testHoursOverrideApplies({ ...TEST, parentPhone: '+919000000002' }, ENV)).toBe(false);
    });
    it('needs the record itself to be a test call', () => {
        expect(testHoursOverrideApplies({ parentPhone: TEST.parentPhone }, ENV)).toBe(false);
    });
    it('never applies to a campaign, batch or notice call', () => {
        expect(testHoursOverrideApplies({ ...TEST, campaignId: 'c1' }, ENV)).toBe(false);
        expect(testHoursOverrideApplies({ ...TEST, batchId: 'b1' }, ENV)).toBe(false);
        expect(testHoursOverrideApplies({ ...TEST, noticeId: 'n1' }, ENV)).toBe(false);
    });
    it('rejects an empty allowlist and missing records', () => {
        expect(testHoursOverrideApplies(TEST, { ...ENV, VOBIZ_TEST_HOURS_ALLOWLIST: '' })).toBe(false);
        expect(testHoursOverrideApplies(undefined, ENV)).toBe(false);
    });
});
