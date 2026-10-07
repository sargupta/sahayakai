/**
 * One outcome class per call, so the Today feed and a campaign's call table colour
 * and word a call the same way. Order matters: a call still on the line is
 * `on_call` whatever it has collected so far; a stop request outranks a key
 * press (it changes what the school may do next); 1 and 2 outrank "heard".
 * `heard` uses the overview's definition (H9): the whole message, or 1 or 2
 * pressed. An answered call that did neither is `hung_up`, never `heard`.
 */

import type { CallOutcomeClass, CallState, SamparkCall } from '@/types/sampark';

const OPEN_STATES: readonly CallState[] = ['dialing', 'ringing', 'in_progress'];

/** Whether a call reached a listener who heard the key fact (whole message, or pressed 1 or 2). */
export function callHeardKeyFact(call: Pick<SamparkCall, 'outcome'>): boolean {
    return call.outcome.heard === 'full' || call.outcome.confirmed || call.outcome.declined;
}

export function callOutcomeClass(call: Pick<SamparkCall, 'state' | 'outcome'>): CallOutcomeClass {
    if (OPEN_STATES.includes(call.state)) return 'on_call';
    if (call.outcome.optOut !== 'none') return 'opted_out';
    if (call.outcome.confirmed) return 'confirmed';
    if (call.outcome.declined) return 'declined';
    if (call.state === 'no_answer' || call.state === 'busy') return 'no_answer';
    if (call.state === 'completed') return callHeardKeyFact(call) ? 'heard' : 'hung_up';
    return 'failed';
}
