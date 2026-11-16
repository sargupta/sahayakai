/**
 * The Sampark dispatcher (plan §4⑦) — the ONLY module that asks a carrier to
 * place a call (class gate 2), and the one that guarantees a parent is never
 * called twice for the same thing (class gate 3).
 *
 * One tick:
 *   1. Single-flight: take the 'sampark-dispatch' lease (55 s) or return at once.
 *   2. Sweep, for every school: an open call (dialing, ringing or in progress)
 *      past its lease is marked 'unknown' and its intent 'needs_review'. It is
 *      NEVER re-dialled — a process may have died after the carrier accepted the
 *      call, or the carrier's hangup callback was lost, so the only safe move is
 *      to hand it to a person. The sweep stamps `settledAt`, so a hangup that
 *      arrives afterwards cannot settle the intent into a retry. It also repairs
 *      any call that ended more than 5 minutes ago but was never settled, so no
 *      intent stays 'dialing' for ever (settle.ts `repairUnsettledCall`).
 *   3. Per school (an error in one school never stops the others):
 *        - refuse the school outright in live mode (phase 2a dials parents never),
 *          and in test mode without a test phone;
 *        - skip the school if its in-flight calls (counted from records) are at the
 *          cap — in test mode the cap is 1, so a test campaign rings the school's
 *          test phone one call at a time;
 *        - for each due intent: D4 variant from the IST calendar (none → expired);
 *          past expiresAt → expired; evaluateGate at stage 'dispatch'
 *          (block → blocked, defer → notBefore = next opening);
 *        - allow → build the call record and CLAIM it (intent approved/retry_wait → dialing,
 *          call written with a lease) in one transaction BEFORE contacting the carrier;
 *        - only on 'claimed': resolve the destination, carrier.place, then
 *            simulated carrier (whole lifecycle returned as events): feed every event
 *              through the pure reducer, store the call, settleCall (settle.ts);
 *            real carrier (no events): record 'placed' and extend the lease to
 *              REAL_CALL_LEASE_MS through repo.mutateCall — the voice webhooks may
 *              already be moving the call on — and leave the intent 'dialing' for
 *              the hangup webhook to settle;
 *        - recompute campaign counts; 'scheduled' → 'dispatching' on the first claim;
 *          'completed' once every intent is terminal.
 *   4. Release the lease (always).
 *
 * DESTINATION (phase 2a contract §3). Practice mode rings the guardian (the
 * simulated carrier, so nothing rings). Test mode rings ONLY the school's test
 * phone: the call record carries `destination: 'test_phone'` and the TEST
 * phone's hash and last four, so a rehearsal can neither count towards a
 * parent's frequency cap nor suppress a parent. The gate still rehearses the
 * guardian's rules, including the frequency cap on the guardian's own hash.
 *
 * If the carrier call throws, we cannot know whether the phone rang, so the call
 * is left in 'dialing' for the sweep — never retried. If the destination cannot
 * be resolved, the carrier was provably never contacted, so the call is marked
 * 'failed' and the intent follows the ordinary retry rule.
 *
 * HARDENING (7 Oct 2026, docs/sampark/HARDENING_CONTRACT.md stream A):
 *   - Holds (H2, H3). A campaign dials only while the school is still in the mode
 *     it was approved in (`campaign.mode`; missing = 'mode_not_pinned', different =
 *     'mode_changed'), and nothing dials while the school is paused ('school_paused':
 *     every purpose for scope 'all', all but emergency closures for 'routine'). A
 *     held intent is never dialled and keeps its status and attempts; the campaign carries
 *     the reason in `holdReason`, written (and audited) only when it changes, and cleared
 *     when the condition clears. The sweep and the repair run whatever the hold.
 *     Due intents are listed oldest first, so a held campaign's intents would sit at the
 *     front of every tick's list and starve every newer campaign (a Practice campaign held
 *     after the school moved to Test would block the Test campaign). A held intent is
 *     therefore PARKED: its notBefore moves to HOLD_PARKED_NOT_BEFORE, out of the due list.
 *     On resume the campaign's parked intents are due again at once; a held campaign past
 *     its expiry has its waiting intents expired, so it completes.
 *   - Of record (H6). The gate is given only the intent's children who are still
 *     active and still list this guardian (or another guardian on the same number)
 *     in `guardianIds`. None left → blocked 'student_inactive' (every child left or is
 *     gone) or 'not_guardian_of_record'.
 *   - Carrier requeue (H7). A capacity refusal (PlaceCallResult.requeue) is settled
 *     through settle.ts's requeue path: the attempt is not spent, and the next dial
 *     of the same attempt carries `requeue` and a new call id (callIdFor), so its
 *     claim never collides with the refused call's record.
 */

import { logger } from '@/lib/logger';
import { purposeSpec } from '@/lib/sampark/catalogue';
import { chooseClosureVariant, istDateString } from '@/lib/sampark/closure';
import { finishCampaign, repairUnsettledCall, SETTLE_REPAIR_GRACE_MS, settleCall } from '@/lib/sampark/dispatch/settle';
import { applyCallEvent, isTerminal } from '@/lib/sampark/dispatch/state';
import { callIdFor } from '@/lib/sampark/intents';
import { evaluateGate, FREQUENCY_WINDOW_MS } from '@/lib/sampark/policy/gate';
import { pauseStopsPurpose } from '@/lib/sampark/policy/pause';
import { addDays, isDateString, istInstant } from '@/lib/sampark/policy/ist';
import { EMERGENCY_START_HOUR } from '@/lib/sampark/policy/window';
import type { Carrier, Clock, SamparkRepo } from '@/lib/sampark/ports';
import type {
    BlockReason,
    CallDestination,
    Campaign,
    CampaignHoldReason,
    Intent,
    IntentStatus,
    PurposeId,
    SamparkCall,
    SamparkGuardian,
    SamparkSchool,
    SamparkStudent,
} from '@/types/sampark';

export { recomputeCampaignCounts } from '@/lib/sampark/dispatch/counts';

export const DISPATCH_LOCK_NAME = 'sampark-dispatch';
export const DISPATCH_LOCK_TTL_MS = 55_000;
/**
 * How long a call placed on a real carrier may stay open before the sweep hands it to a
 * person. Ring (30 s) + a notice with its menu is a few minutes; the hangup webhook
 * normally settles the call long before this.
 */
export const REAL_CALL_LEASE_MS = 15 * 60_000;
/** Calls in flight per school in test mode: the school's one test phone rings one call at a time. */
export const TEST_MODE_MAX_IN_FLIGHT = 1;
/** Sent to the carrier when the rendered audio length is unknown (the call record keeps null). */
const DEFAULT_AUDIO_SECONDS = 40;
const LOG_CONTEXT = 'SAMPARK_DISPATCH';

export interface DispatchDeps {
    repo: SamparkRepo;
    clock: Clock;
    holder: string;
    carrierFor(school: SamparkSchool): Carrier;
    /**
     * The number to dial, decrypted only now: the guardian's in practice mode, the school's
     * test phone in test mode. `kind` must match the destination the call was claimed for,
     * or the carrier is never contacted.
     */
    destinationFor(school: SamparkSchool, guardian: SamparkGuardian): Promise<DialDestination>;
    /** Seconds of message+menu audio for this intent's language/variant (from rendered clips); null if unknown. */
    audioSecondsFor(school: SamparkSchool, intent: Intent, variant: 'default' | 'today' | 'tomorrow'): Promise<number | null>;
}

export interface DialDestination {
    e164: string;
    kind: CallDestination;
}

export interface DispatchOptions {
    maxDialsPerSchoolPerTick: number;
    maxInFlightPerSchool: number;
    leaseMs: number;
}

/**
 * `skipped` counts work not attempted this tick: the whole tick when the lease
 * is held elsewhere, a school at its in-flight cap, and an intent that could
 * not be claimed (another dispatcher got there first) or whose campaign is not
 * yet dispatchable.
 */
export interface DispatchReport {
    schools: number;
    dialed: number;
    deferred: number;
    blocked: number;
    skipped: number;
    swept: number;
    errors: string[];
}

function errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

/** Campaign statuses whose intents may be dialled. */
const DISPATCHABLE_CAMPAIGN: ReadonlySet<Campaign['status']> = new Set(['scheduled', 'dispatching']);

// ── Holds (H2, H3) ──────────────────────────────────────────────────────────

/**
 * The notBefore of an intent parked by a hold: never due, so it leaves the due list (which is
 * ordered oldest first) to the campaigns that can dial. Set on a held intent the first time the
 * dispatcher sees it due; cleared (back to null, due at once) when its campaign resumes.
 */
export const HOLD_PARKED_NOT_BEFORE = '9999-12-31T23:59:59.999Z';

/** Intent statuses still waiting to be dialled. */
const WAITING_STATUSES: ReadonlySet<IntentStatus> = new Set(['approved', 'retry_wait']);

/**
 * Why this campaign may not dial right now, or null. The mode checks come first: they hold the
 * campaign whatever else happens, so after a pause is lifted the reason the console shows is
 * still the true one.
 */
export function campaignHoldReason(school: Pick<SamparkSchool, 'mode' | 'pause'>, campaign: Pick<Campaign, 'mode' | 'purpose'>): CampaignHoldReason | null {
    if (!campaign.mode) return 'mode_not_pinned';
    if (campaign.mode !== school.mode) return 'mode_changed';
    if (pauseStopsPurpose(school.pause, campaign.purpose)) return 'school_paused';
    return null;
}

/**
 * Store the campaign's hold reason when it changed, and only then, with an audit entry
 * ('campaign.hold' or 'campaign.resume'). Every tick re-evaluates every dispatchable campaign,
 * so writing unconditionally would rewrite and re-audit each held campaign once a minute.
 */
async function syncCampaignHold(repo: SamparkRepo, orgId: string, campaign: Campaign, hold: CampaignHoldReason | null, now: Date): Promise<void> {
    const previous = campaign.holdReason ?? null;
    if (previous === hold) return;
    const nowIso = now.toISOString();
    if (!hold) await unparkCampaignIntents(repo, orgId, campaign.id, nowIso);
    await repo.updateCampaign(orgId, campaign.id, { holdReason: hold, updatedAt: nowIso });
    campaign.holdReason = hold;
    await repo.appendAudit(orgId, {
        at: nowIso,
        actor: 'dispatcher',
        action: hold ? 'campaign.hold' : 'campaign.resume',
        target: `campaign/${campaign.id}`,
        detail: hold ? { reason: hold, from: previous } : { from: previous },
    });
}

/** Resume: every intent a hold parked is due again now. Compare-and-set, so a cancel racing it wins. */
async function unparkCampaignIntents(repo: SamparkRepo, orgId: string, campaignId: string, nowIso: string): Promise<void> {
    for (const intent of await repo.listIntentsByCampaign(orgId, campaignId)) {
        if (!WAITING_STATUSES.has(intent.status) || intent.notBefore !== HOLD_PARKED_NOT_BEFORE) continue;
        await repo.updateIntentIf(orgId, intent.id, { status: intent.status, lastCallId: intent.lastCallId }, { notBefore: null, updatedAt: nowIso });
    }
}

/** Park one held intent (see HOLD_PARKED_NOT_BEFORE). Status, attempts and history are untouched. */
async function parkIntent(repo: SamparkRepo, orgId: string, intent: Intent, nowIso: string): Promise<void> {
    if (intent.notBefore === HOLD_PARKED_NOT_BEFORE) return;
    await repo.updateIntentIf(orgId, intent.id, { status: intent.status, lastCallId: intent.lastCallId }, { notBefore: HOLD_PARKED_NOT_BEFORE, updatedAt: nowIso });
}

/** A held campaign past its expiry can never dial again: expire what is still waiting, so it completes. */
async function expireHeldCampaign(repo: SamparkRepo, orgId: string, campaignId: string, nowIso: string): Promise<void> {
    for (const intent of await repo.listIntentsByCampaign(orgId, campaignId)) {
        if (!WAITING_STATUSES.has(intent.status)) continue;
        await repo.updateIntentIf(orgId, intent.id, { status: intent.status, lastCallId: intent.lastCallId }, { status: 'expired', updatedAt: nowIso });
    }
}

// ── Sweep ────────────────────────────────────────────────────────────────────

async function sweepSchool(deps: DispatchDeps, orgId: string, now: Date, touched: Set<string>): Promise<number> {
    const { repo } = deps;
    const expired = await repo.listExpiredOpenCalls(orgId, now);
    const nowIso = now.toISOString();
    let swept = 0;
    for (const listed of expired) {
        let sweptNow = false;
        // Transactional: a hangup webhook racing the sweep either lands first (the call is
        // terminal and is left alone) or finds it 'unknown' (and the reducer ignores it).
        const stored = await repo.mutateCall(orgId, listed.id, (call) => {
            sweptNow = false; // a transaction may run this more than once; only the last run counts
            if (isTerminal(call.state) || Date.parse(call.leaseUntil) > now.getTime()) return null;
            sweptNow = true;
            return {
                ...call,
                state: 'unknown',
                updatedAt: nowIso,
                failureReason: call.failureReason ?? `lease_expired_in_${call.state}`,
                // The sweep IS this call's settlement (intent → needs_review): no later
                // hangup may settle the intent into a retry and re-dial.
                settledAt: call.settledAt ?? nowIso,
            };
        });
        if (!stored) continue;
        if (stored.campaignId) touched.add(stored.campaignId);
        if (!sweptNow) {
            // The hangup won the race; make sure it was settled (a no-op if the webhook did it).
            if (isTerminal(stored.state)) await settleCall(deps, orgId, stored.id, { recompute: false });
            continue;
        }
        swept += 1;
        const intent = await repo.getIntent(orgId, stored.intentId);
        if (intent && intent.status === 'dialing') {
            await repo.updateIntent(orgId, intent.id, { status: 'needs_review', updatedAt: nowIso });
        }
        await repo.appendAudit(orgId, {
            at: nowIso,
            actor: 'dispatcher',
            action: 'call.swept_unknown',
            target: `call/${stored.id}`,
            detail: { intentId: stored.intentId, attempt: stored.attempt, from: listed.state },
        });
    }

    // Repair: an ended call whose settlement never completed (every hangup retry failed after
    // the call was recorded, or the process died mid-settle) would leave its intent 'dialing'
    // for ever and its campaign never complete.
    const unsettled = await repo.listUnsettledEndedCalls(orgId, new Date(now.getTime() - SETTLE_REPAIR_GRACE_MS), 50);
    for (const call of unsettled) {
        const result = await repairUnsettledCall(deps, orgId, call.id);
        if (result === 'noop') continue;
        if (call.campaignId) touched.add(call.campaignId);
        await repo.appendAudit(orgId, {
            at: nowIso,
            actor: 'dispatcher',
            action: 'call.settle_repaired',
            target: `call/${call.id}`,
            detail: { intentId: call.intentId, result },
        });
    }
    return swept;
}

// ── Per-school dispatch ─────────────────────────────────────────────────────

/** Whose phone this school's calls ring, and (for the test phone) the identity recorded on the call. */
type DialPlan = { destination: 'guardian' } | { destination: 'test_phone'; phoneHash: string; phoneLast4: string };

/**
 * Practice → the guardian (on the simulated carrier). Test → the school's test phone, recorded
 * under the TEST phone's hash and last four. Live, or any mode this release does not know →
 * refused: phase 2a never dials a parent on a real carrier.
 */
function dialPlanFor(school: SamparkSchool): { plan: DialPlan } | { refused: string } {
    if (school.mode === 'practice') return { plan: { destination: 'guardian' } };
    if (school.mode === 'test') {
        if (!school.testPhoneHash || !school.testPhoneLast4) {
            return { refused: 'TEST_PHONE_MISSING: the school is in test mode without a test phone; nothing was dialled' };
        }
        return { plan: { destination: 'test_phone', phoneHash: school.testPhoneHash, phoneLast4: school.testPhoneLast4 } };
    }
    return { refused: `LIVE_MODE_NOT_AVAILABLE: mode '${school.mode}' cannot dial in this release; nothing was dialled` };
}

interface SchoolContext {
    deps: DispatchDeps;
    opts: DispatchOptions;
    school: SamparkSchool;
    plan: DialPlan;
    carrier: Carrier;
    now: Date;
    report: DispatchReport;
    touched: Set<string>;
    campaigns: Map<string, Campaign | null>;
    students: Map<string, SamparkStudent> | null;
}

async function campaignFor(ctx: SchoolContext, campaignId: string): Promise<Campaign | null> {
    if (!ctx.campaigns.has(campaignId)) {
        ctx.campaigns.set(campaignId, await ctx.deps.repo.getCampaign(ctx.school.orgId, campaignId));
    }
    return ctx.campaigns.get(campaignId) ?? null;
}

async function studentsFor(ctx: SchoolContext, ids: string[]): Promise<SamparkStudent[]> {
    if (!ctx.students) {
        const all = await ctx.deps.repo.listStudents(ctx.school.orgId);
        ctx.students = new Map(all.map((s) => [s.id, s]));
    }
    return ids.map((id) => ctx.students!.get(id)).filter((s): s is SamparkStudent => !!s);
}

/**
 * The intent's children this call may still be about (H6): active, and still listing this
 * guardian in `guardianIds`, or another active guardian with the same number. The second case
 * is the bundle merged by phone number (one call per family, H6 audience side): one guardian
 * id speaks for every child whose record names the same mobile under another id, and those
 * children's flags must still reach the gate. When none remain, the block reason says why.
 */
async function studentsOfRecord(
    ctx: SchoolContext,
    intent: Intent,
    guardian: SamparkGuardian,
): Promise<{ students: SamparkStudent[] } | { blocked: BlockReason }> {
    const found = await studentsFor(ctx, intent.studentIds);
    const active = found.filter((s) => s.active);
    const otherIds = [...new Set(active.flatMap((s) => s.guardianIds ?? []).filter((id) => id !== guardian.id))].sort();
    const sameNumber = new Set(
        otherIds.length
            ? (await ctx.deps.repo.listGuardians(ctx.school.orgId, otherIds))
                  .filter((g) => g.active && g.phoneHash === guardian.phoneHash)
                  .map((g) => g.id)
            : [],
    );
    const students = active.filter((s) => (s.guardianIds ?? []).some((id) => id === guardian.id || sameNumber.has(id)));
    if (students.length > 0) return { students };
    // Every child on the intent has left (or is gone from the snapshot) → student_inactive;
    // some child is still at the school, but no longer this guardian's → not_guardian_of_record.
    return { blocked: active.length === 0 ? 'student_inactive' : 'not_guardian_of_record' };
}

async function setIntentStatus(ctx: SchoolContext, intent: Intent, status: IntentStatus, extra: Partial<Intent> = {}): Promise<void> {
    await ctx.deps.repo.updateIntent(ctx.school.orgId, intent.id, { status, updatedAt: ctx.now.toISOString(), ...extra });
    if (intent.campaignId) ctx.touched.add(intent.campaignId);
}

async function markDispatching(ctx: SchoolContext, campaign: Campaign | null): Promise<void> {
    if (!campaign || campaign.status !== 'scheduled') return;
    await ctx.deps.repo.updateCampaign(ctx.school.orgId, campaign.id, { status: 'dispatching', updatedAt: ctx.now.toISOString() });
    campaign.status = 'dispatching';
}

/** Returns true if a dial slot was consumed (the intent was claimed). */
async function processIntent(ctx: SchoolContext, intent: Intent): Promise<boolean> {
    const { deps, school, now, report } = ctx;
    const orgId = school.orgId;

    const campaign = intent.campaignId ? await campaignFor(ctx, intent.campaignId) : null;
    if (intent.campaignId) {
        if (!campaign || campaign.status === 'cancelled') {
            await setIntentStatus(ctx, intent, 'cancelled');
            return false;
        }
        if (!DISPATCHABLE_CAMPAIGN.has(campaign.status)) {
            report.skipped += 1;
            return false;
        }
    }

    // Past its expiry an intent can never be dialled, held or not, so it is closed even while held.
    if (now.getTime() > Date.parse(intent.expiresAt)) {
        await setIntentStatus(ctx, intent, 'expired');
        return false;
    }

    // Holds (H2, H3): nothing is dialled; the intent is parked out of the due list until the
    // hold clears, so it cannot starve other campaigns, and its status and attempts are untouched.
    const hold = campaign ? campaignHoldReason(school, campaign) : pauseStopsPurpose(school.pause, intent.purpose) ? 'school_paused' : null;
    if (campaign) await syncCampaignHold(deps.repo, orgId, campaign, hold, now);
    if (hold) {
        if (campaign) await parkIntent(deps.repo, orgId, intent, now.toISOString());
        report.skipped += 1;
        return false;
    }

    const spec = purposeSpec(intent.purpose);

    // D4: the audio variant is chosen now, from the IST calendar; no variant = the closure day is over (or not yet near).
    let variant: SamparkCall['variant'] = 'default';
    if (intent.purpose === 'emergency_closure') {
        const facts = campaign?.facts;
        const closureDate = facts && facts.kind === 'emergency_closure' ? facts.date : null;
        const chosen = closureDate ? chooseClosureVariant(closureDate, now) : null;
        if (!chosen) {
            if (closureDate && isDateString(closureDate) && istDateString(now) < addDays(closureDate, -1)) {
                // Too early: only 'today' / 'tomorrow' audio exists, so wait for the day before the closure.
                await deps.repo.updateIntent(orgId, intent.id, {
                    notBefore: istInstant(addDays(closureDate, -1), EMERGENCY_START_HOUR, 0).toISOString(),
                    updatedAt: now.toISOString(),
                });
                report.deferred += 1;
                return false;
            }
            await setIntentStatus(ctx, intent, 'expired');
            return false;
        }
        variant = chosen;
    }
    if (intent.attempts >= intent.maxAttempts) {
        await setIntentStatus(ctx, intent, 'done');
        return false;
    }

    const guardian = await deps.repo.getGuardian(orgId, intent.guardianId);
    if (!guardian) {
        // Tombstoned in the CRM since materialisation: fail closed.
        await setIntentStatus(ctx, intent, 'blocked', { blockReason: 'crm_do_not_contact' });
        report.blocked += 1;
        return false;
    }
    const ofRecord = await studentsOfRecord(ctx, intent, guardian);
    if ('blocked' in ofRecord) {
        // A child who left, or a guardian no longer of record, is never dialled (H6).
        await setIntentStatus(ctx, intent, 'blocked', { blockReason: ofRecord.blocked });
        report.blocked += 1;
        return false;
    }
    const { students } = ofRecord;
    const preferences = (await deps.repo.getPreferences(orgId, [guardian.id])).get(guardian.id) ?? null;
    const { plan } = ctx;
    const suppression = await deps.repo.getSuppression(orgId, guardian.phoneHash);
    // The cap is counted on the GUARDIAN's number even in test mode, so a test campaign rehearses
    // the real rule. This intent's own earlier attempts must not count against its own retries —
    // but only real guardian calls are in the count to take back out: test calls carry the test
    // phone's hash, and simulated (Practice) calls are never counted at all (H1).
    const ownAttemptsInCount = plan.destination === 'guardian' && ctx.carrier.kind !== 'simulated' ? intent.attempts : 0;
    const recentCallsToPhone = spec.emergency
        ? 0
        : Math.max(
              0,
              (await deps.repo.countCallsToPhoneSince(orgId, guardian.phoneHash, new Date(now.getTime() - FREQUENCY_WINDOW_MS), true)) -
                  ownAttemptsInCount,
          );

    const verdict = evaluateGate({
        school,
        spec,
        guardian,
        students,
        preferences,
        suppression,
        recentCallsToPhone,
        carrierKind: ctx.carrier.kind,
        now,
        stage: 'dispatch',
        destination: plan.destination,
    });

    if (verdict.kind === 'block') {
        await setIntentStatus(ctx, intent, 'blocked', { blockReason: verdict.reason });
        report.blocked += 1;
        return false;
    }
    if (verdict.kind === 'defer') {
        if (verdict.until.getTime() > Date.parse(intent.expiresAt)) {
            await setIntentStatus(ctx, intent, 'expired');
        } else {
            await deps.repo.updateIntent(orgId, intent.id, { notBefore: verdict.until.toISOString(), updatedAt: now.toISOString() });
            report.deferred += 1;
        }
        return false;
    }

    // ── allow: claim BEFORE the carrier is contacted ────────────────────────
    const attempt = intent.attempts + 1;
    // A requeued attempt (H7) is dialled again under the next requeue's call id; 0 = today's id.
    const requeue = intent.carrierRequeues ?? 0;
    const audioSeconds = await deps.audioSecondsFor(school, intent, variant);
    const nowIso = now.toISOString();
    const call: SamparkCall = {
        id: callIdFor(intent.id, attempt, requeue),
        orgId,
        intentId: intent.id,
        campaignId: intent.campaignId,
        purpose: intent.purpose,
        guardianId: guardian.id,
        // A test call is recorded against the test phone, never the guardian (contract §1a).
        phoneHash: plan.destination === 'test_phone' ? plan.phoneHash : guardian.phoneHash,
        phoneLast4: plan.destination === 'test_phone' ? plan.phoneLast4 : guardian.phoneLast4,
        destination: plan.destination,
        // The language the audio was rendered in at materialisation.
        language: intent.language,
        variant,
        attempt,
        state: 'dialing',
        leaseUntil: new Date(now.getTime() + ctx.opts.leaseMs).toISOString(),
        carrier: ctx.carrier.kind,
        providerCallId: null,
        outcome: { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' },
        durationSeconds: null,
        billedSeconds: null,
        costPaise: null,
        audioSeconds,
        createdAt: nowIso,
        updatedAt: nowIso,
        endedAt: null,
        failureReason: null,
        // Explicit null (not absent) so the repair sweep's `settledAt == null` query can find it.
        settledAt: null,
        requeue,
    };

    const claim = await deps.repo.claimIntentForDial(orgId, intent.id, call, now);
    if (claim !== 'claimed') {
        report.skipped += 1;
        return false;
    }
    if (intent.campaignId) ctx.touched.add(intent.campaignId);
    await markDispatching(ctx, campaign);

    let target: DialDestination;
    try {
        target = await deps.destinationFor(school, guardian);
    } catch (e) {
        // The carrier was never contacted, so this attempt is a clean failure.
        await failBeforeDial(ctx, call, `destination_unavailable: ${errorMessage(e)}`, true);
        report.errors.push(`${orgId}/${intent.id}: destination unavailable: ${errorMessage(e)}`);
        return true;
    }
    if (target.kind !== plan.destination) {
        // Fail closed: e.g. a guardian's number offered for a test-mode call. Never dialled.
        await failBeforeDial(ctx, call, 'destination_mismatch', false);
        report.errors.push(`${orgId}/${intent.id}: destination mismatch: expected ${plan.destination}, got ${target.kind}`);
        return true;
    }

    // From here on a thrown error means we cannot know whether the phone rang: leave the call
    // in 'dialing' (the caller catches) so the sweep hands it to a person. Never retried.
    report.dialed += 1;
    const result = await ctx.carrier.place({ call, destinationE164: target.e164, audioSeconds: audioSeconds ?? DEFAULT_AUDIO_SECONDS });

    let retryable = true;
    let requeueRefused = false;
    let current: SamparkCall | null;
    if (!result.ok) {
        current = applyCallEvent(call, { type: 'place_failed', at: nowIso, reason: result.reason });
        retryable = result.retryable || result.requeue === true;
        requeueRefused = result.requeue === true;
        await deps.repo.updateCall(orgId, call.id, current);
    } else if (result.events.length > 0) {
        // The simulated carrier: the whole lifecycle, up front, through the same reducer webhooks use.
        current = applyCallEvent(call, { type: 'placed', at: nowIso, providerCallId: result.providerCallId });
        for (const event of result.events) current = applyCallEvent(current, event);
        await deps.repo.updateCall(orgId, call.id, current);
    } else {
        // A real carrier: the call is ringing somewhere and its webhooks may already be arriving.
        current = await recordRealPlacement(ctx, call, result.providerCallId);
        if (!current) {
            report.errors.push(`${orgId}/${intent.id}: call record missing after place`);
            return true;
        }
    }

    // A call still open (a real carrier's) leaves the intent 'dialing' for the hangup webhook to settle.
    // A capacity refusal settles through the requeue path, which does not spend the attempt (H7).
    if (isTerminal(current.state)) await settleCall(deps, orgId, call.id, { retryable, requeue: requeueRefused, recompute: false });
    return true;
}

/** The carrier was provably never contacted: record the failure and settle it like any other. */
async function failBeforeDial(ctx: SchoolContext, call: SamparkCall, reason: string, retryable: boolean): Promise<void> {
    const failed = applyCallEvent(call, { type: 'place_failed', at: ctx.now.toISOString(), reason });
    await ctx.deps.repo.updateCall(ctx.school.orgId, call.id, failed);
    await settleCall(ctx.deps, ctx.school.orgId, call.id, { retryable, recompute: false });
}

/**
 * After a real carrier accepted the call: record its id and extend the lease so the sweep
 * leaves the call alone until REAL_CALL_LEASE_MS. Transactional, because the ring, answer
 * or even hangup webhook can land before this does: a call already ringing or in progress
 * is never moved back to 'dialing', and an ended call is not touched at all.
 */
async function recordRealPlacement(ctx: SchoolContext, call: SamparkCall, providerCallId: string): Promise<SamparkCall | null> {
    const nowIso = ctx.now.toISOString();
    const leaseUntil = new Date(ctx.now.getTime() + REAL_CALL_LEASE_MS).toISOString();
    return ctx.deps.repo.mutateCall(ctx.school.orgId, call.id, (current) => {
        if (isTerminal(current.state)) return null;
        const next = applyCallEvent(current, { type: 'placed', at: nowIso, providerCallId });
        next.updatedAt = current.updatedAt > nowIso ? current.updatedAt : nowIso;
        next.leaseUntil = leaseUntil;
        return next;
    });
}

async function finishCampaigns(repo: SamparkRepo, orgId: string, campaignIds: Iterable<string>, now: Date): Promise<void> {
    for (const campaignId of campaignIds) await finishCampaign(repo, orgId, campaignId, now);
}

async function dispatchSchool(deps: DispatchDeps, opts: DispatchOptions, school: SamparkSchool, now: Date, report: DispatchReport, touched: Set<string>): Promise<void> {
    const orgId = school.orgId;

    // Campaigns that are scheduled or dispatching get their completion checked every tick,
    // including ones with nothing due (e.g. every intent was blocked at materialisation).
    // Their hold reason is brought up to date here too, so a held campaign shows why even
    // when none of its intents is due, and even when the school cannot dial at all.
    const campaigns = new Map<string, Campaign | null>();
    for (const c of await deps.repo.listCampaigns(orgId, 200)) {
        if (!DISPATCHABLE_CAMPAIGN.has(c.status)) continue;
        touched.add(c.id);
        campaigns.set(c.id, c);
        try {
            const hold = campaignHoldReason(school, c);
            await syncCampaignHold(deps.repo, orgId, c, hold, now);
            if (hold && now.getTime() > Date.parse(c.expiresAt)) await expireHeldCampaign(deps.repo, orgId, c.id, now.toISOString());
        } catch (e) {
            // Bookkeeping only: processIntent re-checks the hold before anything is dialled.
            report.errors.push(`${orgId}/${c.id}: hold update failed: ${errorMessage(e)}`);
        }
    }

    try {
        const dial = dialPlanFor(school);
        if ('refused' in dial) {
            // Nothing is claimed: the intents stay as they are and no carrier is constructed.
            report.errors.push(`${orgId}: ${dial.refused}`);
            return;
        }
        const maxInFlight = dial.plan.destination === 'test_phone'
            ? Math.min(opts.maxInFlightPerSchool, TEST_MODE_MAX_IN_FLIGHT)
            : opts.maxInFlightPerSchool;
        const inFlight = await deps.repo.countNonTerminalCalls(orgId);
        if (inFlight >= maxInFlight) {
            report.skipped += 1;
            return;
        }
        let budget = Math.min(opts.maxDialsPerSchoolPerTick, maxInFlight - inFlight);
        if (budget <= 0) return;

        const carrier = deps.carrierFor(school);
        const ctx: SchoolContext = { deps, opts, school, plan: dial.plan, carrier, now, report, touched, campaigns, students: null };
        const due = await deps.repo.listDueIntents(orgId, now, Math.min(500, budget * 5));

        for (const intent of due) {
            if (budget <= 0) break;
            try {
                if (await processIntent(ctx, intent)) budget -= 1;
            } catch (e) {
                // One intent's failure (including a crash straight after its claim) never stops the rest.
                report.errors.push(`${orgId}/${intent.id}: ${errorMessage(e)}`);
                logger.warn('Sampark intent dispatch failed', LOG_CONTEXT, { orgId, intentId: intent.id, error: errorMessage(e) });
                if (intent.campaignId) touched.add(intent.campaignId);
            }
        }
    } finally {
        await finishCampaigns(deps.repo, orgId, touched, now);
    }
}

/**
 * Single-flight (repo.acquireLock('sampark-dispatch')), sweep expired open calls → 'unknown' (intent → 'needs_review'),
 * then per school: listDueIntents → evaluateGate(stage 'dispatch') → claimIntentForDial → carrier.place → either feed
 * the simulated carrier's events through applyCallEvent and settleCall (intent done | retry_wait | expired, keypad
 * suppressions), or record a real carrier's placement and leave settling to its hangup webhook → campaign counts.
 */
export async function runDispatchTick(deps: DispatchDeps, opts: DispatchOptions): Promise<DispatchReport> {
    const report: DispatchReport = { schools: 0, dialed: 0, deferred: 0, blocked: 0, skipped: 0, swept: 0, errors: [] };
    const now = deps.clock.now();

    if (!(await deps.repo.acquireLock(DISPATCH_LOCK_NAME, deps.holder, now, DISPATCH_LOCK_TTL_MS))) {
        report.skipped += 1;
        return report;
    }

    try {
        const schools = await deps.repo.listSchools();
        report.schools = schools.length;
        const touchedBySchool = new Map<string, Set<string>>(schools.map((s) => [s.orgId, new Set<string>()]));

        for (const school of schools) {
            try {
                report.swept += await sweepSchool(deps, school.orgId, now, touchedBySchool.get(school.orgId)!);
            } catch (e) {
                report.errors.push(`${school.orgId}: sweep failed: ${errorMessage(e)}`);
                logger.error('Sampark sweep failed', e, LOG_CONTEXT, { orgId: school.orgId });
            }
        }

        for (const school of schools) {
            try {
                await dispatchSchool(deps, opts, school, now, report, touchedBySchool.get(school.orgId)!);
            } catch (e) {
                report.errors.push(`${school.orgId}: ${errorMessage(e)}`);
                logger.error('Sampark school dispatch failed', e, LOG_CONTEXT, { orgId: school.orgId });
            }
        }
    } finally {
        try {
            await deps.repo.releaseLock(DISPATCH_LOCK_NAME, deps.holder);
        } catch (e) {
            report.errors.push(`releaseLock failed: ${errorMessage(e)}`);
        }
    }

    if (report.dialed || report.swept || report.errors.length) {
        logger.info('Sampark dispatch tick', LOG_CONTEXT, { ...report, errors: report.errors.length });
    }
    return report;
}
