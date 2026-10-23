/**
 * The ONE question every parent call asks before it dials (Sampark + MCP
 * integration brief, Step 2):
 *
 *     may this school call this number now, for this kind of call?
 *
 * The answer is `allowed`, or a named reason:
 *
 *   opted_out          the school's suppression list holds this number (a keypad 9,
 *                      the office, a dead number) and it applies to this kind of call
 *   frequency_cap      FREQUENCY_CAP routine calls to this number in FREQUENCY_WINDOW_DAYS
 *                      already, counting every path (Sampark campaigns, teachers, integrations)
 *   outside_hours      routine calls: 10:00–19:00 IST (routine-hours.ts, decision 2);
 *                      emergency closures (D4) only: 06:00–21:00 IST (window.ts)
 *   policy_unavailable the check could not read what it needs (no phone pepper, the store
 *                      failed, a number it cannot normalise). FAIL CLOSED: never dial.
 *
 * The order is Sampark's gate order (policy/gate.ts rules 4, 14, 15): the first that
 * fires is reported, so the reason is always the most fundamental one.
 *
 * Neutral on purpose: it is not Sampark's alone. It reads Sampark's suppression list
 * by keyed phone hash (hashPhone), so the teacher path never needs Sampark's
 * encrypted numbers, and it counts Sampark's own calls plus the shared contact
 * ledger (`contact_ledger`, written by every non-Sampark path via recordContact).
 *
 * A teacher with no school (orgId null) has no school opt-out list; the hours and
 * the per-number cap still apply.
 *
 * Every path that can start a carrier call goes through `checkContact` — enforced
 * by src/__tests__/contact-policy/gate-every-dial-checks-contact-policy.test.ts.
 */

import { EMERGENCY_END_HOUR, EMERGENCY_START_HOUR } from '@/lib/sampark/policy/window';
import { ROUTINE_END_CEILING_HOUR, ROUTINE_START_FLOOR_HOUR } from '@/lib/sampark/policy/routine-hours';
import { FREQUENCY_CAP, FREQUENCY_WINDOW_MS } from '@/lib/sampark/policy/gate';
import { hashPhone, normalizeIndianPhone } from '@/lib/sampark/phone';
import type { Suppression } from '@/types/sampark';

/** Routine: everything except an emergency closure. Only Sampark's D4 is 'emergency'. */
export type ContactKind = 'routine' | 'emergency';
/** What started the call. Sampark's campaign calls are recorded in its own call log. */
export type ContactSource = 'campaign' | 'teacher' | 'integration';
export type ContactDenial = 'opted_out' | 'frequency_cap' | 'outside_hours' | 'policy_unavailable';

/** One placed call, in the shared ledger. No number: the keyed hash only. */
export interface ContactRecord {
    /** Deterministic per placed call (e.g. `teacher_<outreachId>`): a retried write never counts twice. */
    id: string;
    orgId: string | null;
    phoneHash: string;
    kind: ContactKind;
    source: Exclude<ContactSource, 'campaign'>;
    /** ISO instant the call was placed. */
    at: string;
}

/** What the check reads. SamparkRepo implements it (repo/memory.ts, repo/firestore.ts). */
export interface ContactPolicyStore {
    getSuppression(orgId: string, phoneHash: string): Promise<Suppression | null>;
    /** Sampark's own real calls to this hash at this school since `since` (emergencies excluded when asked). */
    countCallsToPhoneSince(orgId: string, phoneHash: string, since: Date, excludeEmergency: boolean): Promise<number>;
    /** Ledger entries of this kind for this hash since `since`, from every school and none. */
    countContactsToPhoneSince(phoneHash: string, since: Date, kind: ContactKind): Promise<number>;
    /** Create-only. Returns false (and changes nothing) if `entry.id` is already recorded. */
    recordContact(entry: ContactRecord): Promise<boolean>;
}

export interface ContactCheckInput {
    /** The school the call is made for; null for a teacher who belongs to none. */
    orgId: string | null;
    /** The number that will ring, or its keyed hash when the caller only holds the hash (Sampark). */
    phone: { e164: string } | { hash: string };
    kind: ContactKind;
    at: Date;
    /**
     * Sampark's dispatcher has already counted every routine contact in the window (its own calls,
     * less this intent's earlier attempts, plus the ledger). It passes that total so the two cannot
     * disagree; every other caller leaves it out and the check counts.
     */
    routineContactsInWindow?: number;
}

export type ContactDecision =
    | { allowed: true; phoneHash: string }
    | { allowed: false; reason: ContactDenial; message: string; nextAllowedAt: Date | null; phoneHash: string | null };

const IST = 'Asia/Kolkata';

function istHourMinute(at: Date): { hour: number; minute: number } {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
    return { hour: get('hour') % 24, minute: get('minute') };
}

const hh = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/** The band a kind of call may start in: [start, end) IST hours. */
export function contactHours(kind: ContactKind): { startHour: number; endHour: number } {
    return kind === 'emergency'
        ? { startHour: EMERGENCY_START_HOUR, endHour: EMERGENCY_END_HOUR }
        : { startHour: ROUTINE_START_FLOOR_HOUR, endHour: ROUTINE_END_CEILING_HOUR };
}

/** Next instant the band opens, stepping whole minutes so it is right in any server zone. */
function nextOpening(from: Date, startHour: number): Date {
    const cursor = new Date(from.getTime());
    cursor.setUTCSeconds(0, 0);
    for (let i = 0; i < 24 * 60 + 1; i++) {
        cursor.setTime(cursor.getTime() + 60_000);
        const { hour, minute } = istHourMinute(cursor);
        if (hour === startHour && minute === 0) return cursor;
    }
    return from;
}

/** Hours alone, with no I/O: for screens that explain the rule and for the routes' first refusal. */
export function contactHoursVerdict(kind: ContactKind, at: Date): { allowed: true } | { allowed: false; message: string; nextAllowedAt: Date } {
    const { startHour, endHour } = contactHours(kind);
    const { hour } = istHourMinute(at);
    if (hour >= startHour && hour < endHour) return { allowed: true };
    const what = kind === 'emergency' ? 'Emergency notices' : 'Routine calls to parents';
    return {
        allowed: false,
        message: `${what} are only placed between ${hh(startHour)} and ${hh(endHour)} IST, so this call was not placed. Calling reopens at ${hh(startHour)} IST.`,
        nextAllowedAt: nextOpening(at, startHour),
    };
}

/** Same rule as Sampark's gate (suppressionApplies): 'all' always, 'routine' for routine calls; a reversed one never. */
function suppressionBlocks(s: Suppression | null, kind: ContactKind): boolean {
    if (!s || s.officeVerification === 'reversed') return false;
    return s.scope === 'all' || (s.scope === 'routine' && kind === 'routine');
}

export async function checkContact(input: ContactCheckInput, store: ContactPolicyStore): Promise<ContactDecision> {
    let phoneHash: string | null = null;
    const deny = (reason: ContactDenial, message: string, nextAllowedAt: Date | null = null): ContactDecision =>
        ({ allowed: false, reason, message, nextAllowedAt, phoneHash });
    try {
        if ('hash' in input.phone) {
            phoneHash = input.phone.hash;
        } else {
            const e164 = normalizeIndianPhone(input.phone.e164);
            if (!e164) return deny('policy_unavailable', 'The parent number on record could not be checked, so this call was not placed.');
            phoneHash = hashPhone(e164);
        }
        if (typeof phoneHash !== 'string' || phoneHash.length === 0) return deny('policy_unavailable', 'The parent number on record could not be checked, so this call was not placed.');

        // Gate rule 4: the school's opt-out list.
        if (input.orgId && suppressionBlocks(await store.getSuppression(input.orgId, phoneHash), input.kind)) {
            return deny('opted_out', 'This family asked the school to stop these calls, so this call was not placed.');
        }

        // Gate rule 14: the frequency cap, routine calls only, every path counted.
        if (input.kind === 'routine') {
            let count = input.routineContactsInWindow;
            if (count === undefined) {
                const since = new Date(input.at.getTime() - FREQUENCY_WINDOW_MS);
                const [sampark, ledger] = await Promise.all([
                    input.orgId ? store.countCallsToPhoneSince(input.orgId, phoneHash, since, true) : Promise.resolve(0),
                    store.countContactsToPhoneSince(phoneHash, since, 'routine'),
                ]);
                count = sampark + ledger;
            }
            if (!Number.isFinite(count)) return deny('policy_unavailable', 'Recent calls to this family could not be counted, so this call was not placed.');
            if (count >= FREQUENCY_CAP) {
                return deny('frequency_cap', `This family has already had ${FREQUENCY_CAP} routine calls in the last 30 days, so this call was not placed.`);
            }
        }

        // Gate rule 15: hours.
        const hours = contactHoursVerdict(input.kind, input.at);
        if (!hours.allowed) return deny('outside_hours', hours.message, hours.nextAllowedAt);

        return { allowed: true, phoneHash };
    } catch {
        return deny('policy_unavailable', 'The calling rules could not be checked just now, so this call was not placed.');
    }
}

declare const clearanceBrand: unique symbol;
/**
 * Proof that `checkContact` allowed this call. Only `clearanceFor` makes one, so a function that
 * dials and takes a ContactClearance cannot be reached without the check (the structural gate
 * accepts a dialling function whose signature requires one).
 */
export interface ContactClearance {
    readonly [clearanceBrand]: true;
    readonly orgId: string | null;
    readonly phoneHash: string;
    readonly kind: ContactKind;
    readonly at: Date;
}

export function clearanceFor(input: Pick<ContactCheckInput, 'orgId' | 'kind' | 'at'>, decision: ContactDecision): ContactClearance | null {
    if (!decision.allowed) return null;
    return { orgId: input.orgId, phoneHash: decision.phoneHash, kind: input.kind, at: input.at } as ContactClearance;
}

/**
 * Write the placed call to the shared ledger so every path's cap counts it. Idempotent by
 * `entry.id`: a retried request or a replayed callback never counts a call twice.
 */
export async function recordContact(entry: ContactRecord, store: Pick<ContactPolicyStore, 'recordContact'>): Promise<boolean> {
    return store.recordContact(entry);
}
