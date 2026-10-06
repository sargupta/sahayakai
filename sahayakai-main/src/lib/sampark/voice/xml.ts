/**
 * The call-control XML a Sampark notice call runs on (contract §4, plan §5.1).
 *
 * A notice call is pre-rendered audio plus one keypad step, so the whole call
 * flow is three documents:
 *
 *   answer      <Gather><Play>message + menu</Play></Gather> <Play>no_input</Play> <Hangup/>
 *   key 1/2/…   <Play>confirmation</Play> <Hangup/>
 *   key 9       <Gather><Play>opt_out_confirm</Play></Gather> <Play>opt_out_done</Play> <Hangup/>
 *
 * Vobiz starts the Gather's `executionTimeout` only after the nested Play ends,
 * and with no key pressed it carries on with the next element — which is why
 * the "nothing pressed" outcome is spelled out after each Gather instead of
 * being left to a second webhook. In the opt-out document that next element is
 * `opt_out_done`: a 9 that is never confirmed is still applied (plan §5.1), so
 * the parent is told it was.
 *
 * Pure builders. Every interpolated value — URLs carry `&` in their query
 * strings and a signed token in `t` — goes through `escapeXml`, attribute or
 * text alike, so no value can close an element or open a new one.
 */

import { escapeXml } from '@/lib/vobiz/answer-xml';

const PROLOG = '<?xml version="1.0" encoding="UTF-8"?>';

/** Vobiz accepts an executionTimeout of 5–60 seconds. */
export const GATHER_TIMEOUT_MIN_SECONDS = 5;
export const GATHER_TIMEOUT_MAX_SECONDS = 60;

/** End the call now. Returned for every refusal, so a call in flight always hangs up cleanly. */
export const EMPTY_HANGUP_XML = `${PROLOG}<Response><Hangup/></Response>`;

function clampTimeout(seconds: number): number {
    const n = Number.isFinite(seconds) ? Math.round(seconds) : GATHER_TIMEOUT_MIN_SECONDS;
    return Math.min(GATHER_TIMEOUT_MAX_SECONDS, Math.max(GATHER_TIMEOUT_MIN_SECONDS, n));
}

function play(url: string): string {
    return `<Play>${escapeXml(url)}</Play>`;
}

/** One key, DTMF only, `finishOnKey="none"` so '#' is a key like any other rather than "submit". */
function gather(actionUrl: string, timeoutSeconds: number, promptUrl: string): string {
    return (
        `<Gather action="${escapeXml(actionUrl)}" method="POST" inputType="dtmf" numDigits="1" ` +
        `executionTimeout="${clampTimeout(timeoutSeconds)}" finishOnKey="none">` +
        play(promptUrl) +
        '</Gather>'
    );
}

function document(body: string): string {
    return `${PROLOG}<Response>${body}</Response>`;
}

/** The answer document: the message (with its menu) inside the keypad Gather, then the no-input goodbye. */
export function noticeAnswerXml(o: { messageAudioUrl: string; gatherUrl: string; noInputAudioUrl: string; timeoutSeconds: number }): string {
    return document(gather(o.gatherUrl, o.timeoutSeconds, o.messageAudioUrl) + play(o.noInputAudioUrl) + '<Hangup/>');
}

/** Play one clip and end the call (a confirmation, the opt-out goodbye, or the no-input goodbye). */
export function playThenHangupXml(audioUrl: string): string {
    return document(play(audioUrl) + '<Hangup/>');
}

/** After a 9: ask for a second 9; with no second key the opt-out still stands, so `opt_out_done` plays either way. */
export function optOutConfirmXml(o: { promptAudioUrl: string; gatherUrl: string; doneAudioUrl: string; timeoutSeconds: number }): string {
    return document(gather(o.gatherUrl, o.timeoutSeconds, o.promptAudioUrl) + play(o.doneAudioUrl) + '<Hangup/>');
}
