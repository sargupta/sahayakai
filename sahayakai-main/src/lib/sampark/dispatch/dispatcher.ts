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
 *      arrives afterwards cannot settle the intent into a retry.
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
 */

import { logger } from '@/lib/logger';
import { purposeSpec } from '@/lib/sampark/catalogue';
import { chooseClosureVariant, istDateString } from '@/lib/sampark/closure';
import { settleCall, finishCampaign } from '@/lib/sampark/dispatch/settle';
import { applyCallEvent, isTerminal } from '@/lib/sampark/dispatch/state';
import { callIdFor } from '@/lib/sampark/intents';
import { evaluateGate, FREQUENCY_WINDOW_MS } from '@/lib/sampark/policy/gate';
import { addDays, isDateString, istInstant } from '@/lib/sampark/policy/ist';
import { EMERGENCY_START_HOUR } from '@/lib/sampark/policy/window';
import type { Carrier, Clock, SamparkRepo } from '@/lib/sampark/ports';
import type {
    CallDestination,
    Campaign,
    Intent,
    IntentStatus,
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
    if (now.getTime() > Date.parse(intent.expiresAt)) {
        await setIntentStatus(ctx, intent, 'expired');
        return false;
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
    const students = await studentsFor(ctx, intent.studentIds);
    const preferences = (await deps.repo.getPreferences(orgId, [guardian.id])).get(guardian.id) ?? null;
    const { plan } = ctx;
    const suppression = await deps.repo.getSuppression(orgId, guardian.phoneHash);
    // The cap is counted on the GUARDIAN's number even in test mode, so a test campaign rehearses
    // the real rule. This intent's own earlier attempts must not count against its own retries —
    // but only guardian calls are recorded under the guardian's hash (test calls carry the test
    // phone's), so only then are they in the count to take back out.
    const ownAttemptsInCount = plan.destination === 'guardian' ? intent.attempts : 0;
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
    const audioSeconds = await deps.audioSecondsFor(school, intent, variant);
    const nowIso = now.toISOString();
    const call: SamparkCall = {
        id: callIdFor(intent.id, attempt),
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
    let current: SamparkCall | null;
    if (!result.ok) {
        current = applyCallEvent(call, { type: 'place_failed', at: nowIso, reason: result.reason });
        retryable = result.retryable;
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
    if (isTerminal(current.state)) await settleCall(deps, orgId, call.id, { retryable, recompute: false });
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
    for (const c of await deps.repo.listCampaigns(orgId, 200)) {
        if (DISPATCHABLE_CAMPAIGN.has(c.status)) touched.add(c.id);
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
        const ctx: SchoolContext = { deps, opts, school, plan: dial.plan, carrier, now, report, touched, campaigns: new Map(), students: null };
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
