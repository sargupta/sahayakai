/**
 * Isolated hotel-guest calling policy for AtithiVani post-stay feedback calls (SP-10).
 *
 * Rules (kept completely separate from school-call rules in `../policy/gate.ts`):
 *   1. Calling window: 09:00–20:00 IST (`ATITHI_START_HOUR` .. `ATITHI_END_HOUR`).
 *   2. First call must start within 12 hours of checkout (`ATITHI_FIRST_CALL_MAX_HOURS`).
 *   3. At most 2 calls per guest after checkout (`ATITHI_MAX_ATTEMPTS`).
 *   4. Respects opt-out suppression and test-phone allow-listing (`+917384273605`).
 */

import { addDays, istInstant, istParts } from '@/lib/sampark/policy/ist';

import type { AtithiGuestStay, AtithiPolicyVerdict } from './types';

export const ATITHI_START_HOUR = 9;
export const ATITHI_END_HOUR = 20;
export const ATITHI_FIRST_CALL_MAX_HOURS = 12;
export const ATITHI_MAX_ATTEMPTS = 2;
export const ATITHI_DEFAULT_TEST_PHONE = '+917384273605';

const E164_INDIAN_OR_INTL = /^\+[1-9]\d{9,14}$/;

export interface AtithiPolicyOptions {
    now: Date;
    testMode?: boolean;
    allowedTestPhones?: readonly string[];
}

function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    return digits ? `+${digits}` : '';
}

export function nextAtithiWindowOpen(at: Date): Date {
    const p = istParts(at);
    const openDate = p.hour < ATITHI_START_HOUR ? p.date : addDays(p.date, 1);
    return istInstant(openDate, ATITHI_START_HOUR, 0);
}

export function evaluateAtithiPolicy(stay: AtithiGuestStay, opts: AtithiPolicyOptions): AtithiPolicyVerdict {
    const { now, testMode = true, allowedTestPhones = [ATITHI_DEFAULT_TEST_PHONE] } = opts;

    if (stay.optedOut) {
        return { kind: 'block', reason: 'suppressed' };
    }

    const normalized = normalizePhone(stay.phoneE164);
    if (!E164_INDIAN_OR_INTL.test(normalized)) {
        return { kind: 'block', reason: 'invalid_number' };
    }

    if (testMode) {
        const allowSet = new Set(allowedTestPhones.map(normalizePhone));
        if (!allowSet.has(normalized)) {
            return { kind: 'block', reason: 'test_phone_only' };
        }
    }

    if (stay.attemptCount >= ATITHI_MAX_ATTEMPTS) {
        return { kind: 'block', reason: 'max_attempts_reached' };
    }

    const checkoutMs = Date.parse(stay.checkedOutAt);
    if (!Number.isFinite(checkoutMs)) {
        return { kind: 'block', reason: 'checkout_window_expired' };
    }

    const firstCallDeadlineMs = checkoutMs + ATITHI_FIRST_CALL_MAX_HOURS * 60 * 60 * 1000;
    if (stay.attemptCount === 0 && now.getTime() > firstCallDeadlineMs) {
        return { kind: 'block', reason: 'checkout_window_expired' };
    }

    const p = istParts(now);
    const inWindow = p.hour >= ATITHI_START_HOUR && p.hour < ATITHI_END_HOUR;
    if (!inWindow) {
        const nextOpen = nextAtithiWindowOpen(now);
        if (stay.attemptCount === 0 && nextOpen.getTime() > firstCallDeadlineMs) {
            return { kind: 'block', reason: 'checkout_window_expired' };
        }
        return {
            kind: 'defer',
            until: nextOpen,
            reason: `AtithiVani calls run between 09:00 and 20:00 IST (current IST hour: ${String(p.hour).padStart(2, '0')}:00).`,
        };
    }

    return { kind: 'allow', language: stay.language };
}
