/**
 * Test-mode calling-hours override — for ONE explicitly configured test phone.
 *
 * Production calling hours (09:00–21:00 IST) are never relaxed for a parent,
 * a teacher or a campaign. This lets a developer place an authorised test call
 * to their own phone outside that window, and only when ALL of these hold:
 *
 *   - VOBIZ_TEST_HOURS_OVERRIDE=1 is set (off unless someone turns it on);
 *   - the runtime is not production (NODE_ENV !== 'production');
 *   - the outreach record is marked `testCall: true`;
 *   - the record has no campaign / batch / notice id (no bulk dialling);
 *   - the destination is in VOBIZ_TEST_HOURS_ALLOWLIST (comma-separated numbers).
 */

export interface TestOverrideRecord {
    testCall?: unknown;
    parentPhone?: unknown;
    campaignId?: unknown;
    batchId?: unknown;
    noticeId?: unknown;
}

const digits = (value: unknown): string => String(value ?? '').replace(/\D/g, '');

export function testHoursOverrideApplies(
    record: TestOverrideRecord | undefined | null,
    env: NodeJS.ProcessEnv = process.env,
): boolean {
    if (!record || env.VOBIZ_TEST_HOURS_OVERRIDE !== '1') return false;
    if (env.NODE_ENV === 'production') return false;
    if (record.testCall !== true) return false;
    if (record.campaignId || record.batchId || record.noticeId) return false;
    const phone = digits(record.parentPhone);
    if (phone.length < 10) return false;
    const allow = (env.VOBIZ_TEST_HOURS_ALLOWLIST ?? '')
        .split(',')
        .map(digits)
        .filter((n) => n.length >= 10);
    return allow.includes(phone);
}
