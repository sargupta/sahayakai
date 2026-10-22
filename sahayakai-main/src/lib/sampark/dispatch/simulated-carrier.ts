/**
 * The simulated carrier — Practice mode's only carrier (slice 1 cannot reach a
 * real one). It contacts no network: every outcome is computed from
 * sha256(seed + call.id), so the same call always has the same fate and a test
 * or a demo can be replayed exactly.
 *
 * Outcome mix (per call, before any retry):
 *   72% answered
 *        55% press a key:  1 ≈ 70% · 2 ≈ 22% · "99" (confirmed opt-out) ≈ 4% · "9" then hang up ≈ 4%
 *        25% listen to the whole message without a key
 *        20% hang up part-way (some within the first 5 s)
 *   18% no answer · 6% busy · 4% place failed (ok: false, retryable)
 *
 * Events are the whole lifecycle, returned up front, timestamped after the
 * call's createdAt; the dispatcher feeds them through the same reducer that
 * real carrier webhooks will use. Answered calls bill in 60-second units.
 *
 * Class gate 2: only the dispatcher (and the server's carrier factory) may
 * import this module.
 */

import crypto from 'node:crypto';

import { purposeSpec } from '@/lib/sampark/catalogue';
import type { Carrier, PlaceCallRequest, PlaceCallResult } from '@/lib/sampark/ports';
import type { CallEvent } from '@/types/sampark';

const DEFAULT_SEED = 'sampark-simulated-carrier-v1';
const FALLBACK_AUDIO_SECONDS = 40;

/** Cumulative thresholds of the top-level outcome draw. */
const P_PLACE_FAILED = 0.04;
const P_BUSY = P_PLACE_FAILED + 0.06;
const P_NO_ANSWER = P_BUSY + 0.18; // remainder (72%) answered

/** Within answered calls. */
const P_KEY = 0.55;
const P_LISTEN_FULL = P_KEY + 0.25; // remainder (20%) hang up part-way

/** Within key-pressers. */
const P_KEY_1 = 0.7;
const P_KEY_2 = P_KEY_1 + 0.22;
const P_KEY_99 = P_KEY_2 + 0.04; // remainder (4%) press 9 then hang up

/** Earliest second of the call at which a simulated key can be pressed (after the greeting). */
const EARLY_KEY_FLOOR = 6;

/** A stream of uniform [0,1) draws from a sha256 digest (8 draws per digest, re-hashed when exhausted). */
function draws(material: string): () => number {
    let digest = crypto.createHash('sha256').update(material, 'utf8').digest();
    let index = 0;
    let round = 0;
    return () => {
        if (index >= 8) {
            round += 1;
            digest = crypto.createHash('sha256').update(`${material}#${round}`, 'utf8').digest();
            index = 0;
        }
        const value = digest.readUInt32BE(index * 4) / 4294967296;
        index += 1;
        return value;
    };
}

function secondsLater(baseMs: number, seconds: number): string {
    return new Date(baseMs + Math.round(seconds * 1000)).toISOString();
}

function billed(durationSeconds: number): number {
    return Math.max(1, Math.ceil(durationSeconds / 60)) * 60;
}

export function createSimulatedCarrier(opts?: { seed?: string }): Carrier {
    const seed = opts?.seed ?? DEFAULT_SEED;

    async function place(req: PlaceCallRequest): Promise<PlaceCallResult> {
        const call = req.call;
        const rnd = draws(`${seed}${call.id}`);
        const providerCallId = `sim-${crypto.createHash('sha256').update(`${seed}|provider|${call.id}`).digest('hex').slice(0, 24)}`;
        const createdMs = Date.parse(call.createdAt);
        const t0 = Number.isFinite(createdMs) ? createdMs : 0;
        const audio = req.audioSeconds > 0 ? req.audioSeconds : FALLBACK_AUDIO_SECONDS;

        const top = rnd();
        if (top < P_PLACE_FAILED) {
            return { ok: false, reason: 'SIMULATED_CARRIER_UNAVAILABLE', retryable: true };
        }

        const events: CallEvent[] = [{ type: 'placed', at: secondsLater(t0, 0.4), providerCallId }];

        if (top < P_BUSY) {
            events.push({ type: 'hangup', at: secondsLater(t0, 2 + rnd() * 3), cause: 'busy', durationSeconds: 0, billedSeconds: 0 });
            return { ok: true, providerCallId, events };
        }

        events.push({ type: 'ringing', at: secondsLater(t0, 1.2) });

        if (top < P_NO_ANSWER) {
            events.push({ type: 'hangup', at: secondsLater(t0, 1.2 + 30 + rnd() * 15), cause: 'no_answer', durationSeconds: 0, billedSeconds: 0 });
            return { ok: true, providerCallId, events };
        }

        // Answered.
        const answeredAfter = 1.2 + 3 + rnd() * 14;
        const answeredMs = t0 + Math.round(answeredAfter * 1000);
        events.push({ type: 'answered', at: new Date(answeredMs).toISOString() });

        const behaviour = rnd();
        let duration: number;

        if (behaviour < P_KEY) {
            const which = rnd();
            // Keys come in the menu, after most of the message.
            const pressAt = Math.max(EARLY_KEY_FLOOR, Math.round(audio * (0.75 + rnd() * 0.25)));
            const menu = safeMenu(call.purpose);
            let keys: string[];
            let tail: number;
            if (which < P_KEY_1) {
                keys = ['1'];
                tail = 4 + Math.round(rnd() * 4); // confirmation clip, then hang up
            } else if (which < P_KEY_2) {
                // A purpose with no key 2 (D4) treats 2 as invalid; the simulated parent presses 1 instead.
                keys = [menu?.key2 ? '2' : '1'];
                tail = 4 + Math.round(rnd() * 4);
            } else if (which < P_KEY_99) {
                keys = ['9', '9'];
                tail = 7 + Math.round(rnd() * 4); // "press 9 again", then "you will not receive these calls"
            } else {
                keys = ['9'];
                tail = 1 + Math.round(rnd() * 2); // hangs up at the confirmation prompt
            }
            let offset = pressAt;
            keys.forEach((digit, i) => {
                if (i > 0) offset += 3;
                events.push({ type: 'digit', at: new Date(answeredMs + offset * 1000).toISOString(), digit });
            });
            duration = offset + tail;
        } else if (behaviour < P_LISTEN_FULL) {
            duration = Math.round(audio + 1 + rnd() * 8);
        } else {
            // Part-way: anywhere from the greeting to just short of 85% of the audio.
            duration = Math.max(1, Math.floor(rnd() * 0.85 * audio));
        }

        events.push({
            type: 'hangup',
            at: new Date(answeredMs + duration * 1000).toISOString(),
            cause: 'completed',
            durationSeconds: duration,
            billedSeconds: billed(duration),
        });
        return { ok: true, providerCallId, events };
    }

    return { kind: 'simulated', place };
}

function safeMenu(purpose: Parameters<typeof purposeSpec>[0]) {
    try {
        return purposeSpec(purpose).menu;
    } catch {
        return null;
    }
}
