/**
 * The Sampark call-state reducer (plan §4⑨): pure, forward-only, and never
 * leaves a terminal state.
 *
 *   dialing → ringing → in_progress → {completed | no_answer | busy | failed | unknown | cancelled}
 *
 * Every carrier event — the simulated carrier's up-front lifecycle now, real
 * carrier webhooks in phase 2 — goes through `applyCallEvent`. An event that
 * would move a call backwards (a late 'ringing' after 'answered'), or that
 * arrives after the call ended, is ignored rather than trusted, so replayed or
 * reordered webhooks can never resurrect a call or rewrite its outcome.
 *
 * Keys are interpreted against the purpose's menu from the catalogue: key 1
 * sets `confirmed` only if the menu offers key 1, key 2 sets `declined` only if
 * it offers key 2 (on D4 a 2 is an invalid key), and 9 is the opt-out — "99"
 * anywhere in the digits is a confirmed opt-out, a lone 9 a requested one
 * (applied anyway, office verifies; plan §5.1).
 */

import { purposeSpec, type MenuSpec } from '@/lib/sampark/catalogue';
import type { CallEvent, CallOutcome, CallState, HeardLevel, SamparkCall } from '@/types/sampark';
import { TERMINAL_CALL_STATES } from '@/types/sampark';

/** Below this many seconds of listening, the listener hung up before the message could land. */
export const EARLY_HANGUP_SECONDS = 5;
/** Share of the audio that counts as having heard it all. */
export const FULL_LISTEN_RATIO = 0.9;
/** With no audio length known, this much listening counts as full. */
export const FULL_LISTEN_FALLBACK_SECONDS = 20;

export function isTerminal(state: CallState): boolean {
    return (TERMINAL_CALL_STATES as readonly CallState[]).includes(state);
}

export function classifyHeard(durationSeconds: number | null, audioSeconds: number | null): HeardLevel {
    if (durationSeconds === null || durationSeconds === undefined || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
        return 'none';
    }
    if (durationSeconds < EARLY_HANGUP_SECONDS) return 'early_hangup';
    if (audioSeconds === null || audioSeconds === undefined || !Number.isFinite(audioSeconds) || audioSeconds <= 0) {
        return durationSeconds >= FULL_LISTEN_FALLBACK_SECONDS ? 'full' : 'partial';
    }
    return durationSeconds < FULL_LISTEN_RATIO * audioSeconds ? 'partial' : 'full';
}

/** 0 dialing, 1 ringing, 2 in_progress, 3 terminal. */
function rank(state: CallState): number {
    if (isTerminal(state)) return 3;
    if (state === 'in_progress') return 2;
    if (state === 'ringing') return 1;
    return 0;
}

function menuFor(call: SamparkCall): MenuSpec | null {
    try {
        return purposeSpec(call.purpose).menu;
    } catch {
        return null;
    }
}

function interpretDigits(outcome: CallOutcome, digit: string, menu: MenuSpec | null): CallOutcome {
    const digits = outcome.digits + digit;
    const next: CallOutcome = { ...outcome, digits };
    if (!menu) return next;
    // The last action key wins: a parent who pressed 2 then 1 changed their mind.
    if (digit === '1' && menu.key1 !== null) {
        next.confirmed = true;
        next.declined = false;
    } else if (digit === '2' && menu.key2 !== null) {
        next.declined = true;
        next.confirmed = false;
    }
    if (menu.optOut && digits.includes('9')) {
        next.optOut = digits.includes('99') ? 'confirmed' : 'requested';
    }
    return next;
}

function copy(call: SamparkCall): SamparkCall {
    return { ...call, outcome: { ...call.outcome } };
}

export function applyCallEvent(call: SamparkCall, event: CallEvent): SamparkCall {
    const next = copy(call);
    if (isTerminal(call.state)) return next;

    switch (event.type) {
        case 'placed':
            if (!next.providerCallId) next.providerCallId = event.providerCallId;
            next.updatedAt = event.at;
            return next;

        case 'place_failed':
            next.state = 'failed';
            next.failureReason = event.reason;
            next.endedAt = event.at;
            next.updatedAt = event.at;
            next.billedSeconds = 0;
            next.outcome.heard = 'none';
            return next;

        case 'ringing':
            if (rank(next.state) >= 1) return next;
            next.state = 'ringing';
            next.updatedAt = event.at;
            return next;

        case 'answered':
            if (rank(next.state) >= 2) return next;
            next.state = 'in_progress';
            next.updatedAt = event.at;
            return next;

        case 'digit': {
            if (typeof event.digit !== 'string' || !/^[0-9*#]$/.test(event.digit)) return next;
            // A key press proves the call was answered, even if 'answered' was lost.
            if (rank(next.state) < 2) next.state = 'in_progress';
            next.outcome = interpretDigits(next.outcome, event.digit, menuFor(call));
            next.updatedAt = event.at;
            return next;
        }

        case 'hangup': {
            const answered = event.cause === 'completed';
            next.state = event.cause;
            next.durationSeconds = answered ? Math.max(0, event.durationSeconds) : null;
            next.billedSeconds = Math.max(0, event.billedSeconds ?? 0);
            next.endedAt = event.at;
            next.updatedAt = event.at;
            next.outcome.heard = classifyHeard(next.durationSeconds, next.audioSeconds);
            if (event.cause === 'failed' && !next.failureReason) next.failureReason = 'carrier_failed';
            return next;
        }

        default:
            return next;
    }
}
