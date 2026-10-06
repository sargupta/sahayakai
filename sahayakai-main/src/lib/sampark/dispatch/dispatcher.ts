/**
 * The Sampark dispatcher (plan §4⑦) — the ONLY module that asks a carrier to
 * place a call (class gate 2), and the one that guarantees a parent is never
 * called twice for the same thing (class gate 3).
 *
 * One tick:
 *   1. Single-flight: take the 'sampark-dispatch' lease (55 s) or return at once.
 *   2. Sweep, for every school: a call still 'dialing' past its lease is marked
 *      'unknown' and its intent 'needs_review'. It is NEVER re-dialled — a
 *      process may have died after the carrier accepted the call, so the only
 *      safe move is to hand it to a person.
 *   3. Per school (an error in one school never stops the others):
 *        - skip the school if its in-flight calls (counted from records) are at the cap;
 *        - for each due intent: D4 variant from the IST calendar (none → expired);
 *          past expiresAt → expired; evaluateGate at stage 'dispatch'
 *          (block → blocked, defer → notBefore = next opening);
 *        - allow → build the call record and CLAIM it (intent approved/retry_wait → dialing,
 *          call written with a lease) in one transaction BEFORE contacting the carrier;
 *        - only on 'claimed': resolve the destination, carrier.place, feed every
 *          event through the pure reducer, store the call, settle the intent
 *          (done | retry_wait | done when attempts are exhausted), record opt-outs
 *          as suppressions;
 *        - recompute campaign counts; 'scheduled' → 'dispatching' on the first claim;
 *          'completed' once every intent is terminal.
 *   4. Release the lease (always).
 *
 * If the carrier call throws, we cannot know whether the phone rang, so the call
 * is left in 'dialing' for the sweep — never retried. If the destination cannot
 * be resolved, the carrier was provably never contacted, so the call is marked
 * 'failed' and the intent follows the ordinary retry rule.
 */

import { logger } from '@/lib/logger';
import { purposeSpec, type PurposeSpec } from '@/lib/sampark/catalogue';
import { chooseClosureVariant, istDateString } from '@/lib/sampark/closure';
import { isTerminalIntent, recomputeCampaignCounts } from '@/lib/sampark/dispatch/counts';
import { applyCallEvent, isTerminal } from '@/lib/sampark/dispatch/state';
import { callIdFor } from '@/lib/sampark/intents';
import { evaluateGate, FREQUENCY_WINDOW_MS } from '@/lib/sampark/policy/gate';
import { addDays, isDateString, istInstant } from '@/lib/sampark/policy/ist';
import { EMERGENCY_START_HOUR } from '@/lib/sampark/policy/window';
import type { Carrier, Clock, SamparkRepo } from '@/lib/sampark/ports';
import type {
    Campaign,
    Intent,
    IntentStatus,
    SamparkCall,
    SamparkGuardian,
    SamparkSchool,
    SamparkStudent,
    Suppression,
} from '@/types/sampark';

export { recomputeCampaignCounts } from '@/lib/sampark/dispatch/counts';

export const DISPATCH_LOCK_NAME = 'sampark-dispatch';
export const DISPATCH_LOCK_TTL_MS = 55_000;
/** Sent to the carrier when the rendered audio length is unknown (the call record keeps null). */
const DEFAULT_AUDIO_SECONDS = 40;
const LOG_CONTEXT = 'SAMPARK_DISPATCH';

export interface DispatchDeps {
    repo: SamparkRepo;
    clock: Clock;
    holder: string;
    carrierFor(school: SamparkSchool): Carrier;
    /** Destination to dial: guardian's decrypted number, or the school's test phone in test mode. */
    destinationFor(school: SamparkSchool, guardian: SamparkGuardian): Promise<string>;
    /** Seconds of message+menu audio for this intent's language/variant (from rendered clips); null if unknown. */
    audioSecondsFor(school: SamparkSchool, intent: Intent, variant: 'default' | 'today' | 'tomorrow'): Promise<number | null>;
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

async function sweepSchool(repo: SamparkRepo, orgId: string, now: Date, touched: Set<string>): Promise<number> {
    const expired = await repo.listExpiredOpenCalls(orgId, now);
    const nowIso = now.toISOString();
    for (const call of expired) {
        await repo.updateCall(orgId, call.id, {
            state: 'unknown',
            updatedAt: nowIso,
            failureReason: call.failureReason ?? 'lease_expired_in_dialing',
        });
        const intent = await repo.getIntent(orgId, call.intentId);
        if (intent && intent.status === 'dialing') {
            await repo.updateIntent(orgId, intent.id, { status: 'needs_review', updatedAt: nowIso });
        }
        await repo.appendAudit(orgId, {
            at: nowIso,
            actor: 'dispatcher',
            action: 'call.swept_unknown',
            target: `call/${call.id}`,
            detail: { intentId: call.intentId, attempt: call.attempt },
        });
        if (call.campaignId) touched.add(call.campaignId);
    }
    return expired.length;
}

// ── Settling an intent after its call ends ──────────────────────────────────

function settleIntent(call: SamparkCall, intent: Intent, spec: PurposeSpec, now: Date, retryable: boolean): Partial<Intent> {
    const patch: Partial<Intent> = { attempts: call.attempt, lastCallId: call.id, updatedAt: now.toISOString() };
    const reached = call.state === 'completed' && (call.outcome.heard === 'full' || call.outcome.digits.length > 0);
    if (reached || !retryable || call.attempt >= intent.maxAttempts) {
        patch.status = 'done';
        return patch;
    }
    const retryAt = new Date(now.getTime() + spec.retryAfterMinutes * 60_000);
    if (retryAt.getTime() > Date.parse(intent.expiresAt)) {
        patch.status = 'expired';
        return patch;
    }
    patch.status = 'retry_wait';
    patch.notBefore = retryAt.toISOString();
    return patch;
}

async function recordOptOut(repo: SamparkRepo, call: SamparkCall, now: Date): Promise<void> {
    if (call.outcome.optOut === 'none') return;
    const source: Suppression['source'] = call.outcome.optOut === 'confirmed' ? 'keypad' : 'keypad_unconfirmed';
    const existing = await repo.getSuppression(call.orgId, call.phoneHash);
    if (existing && existing.officeVerification !== 'reversed') {
        // An effective suppression already exists (this can only happen on an emergency call, which a
        // routine suppression does not stop). Never weaken or re-date it; the one allowed change is
        // upgrading an unconfirmed keypad opt-out to a confirmed one.
        const upgrade = existing.scope === 'routine' && existing.source === 'keypad_unconfirmed' && source === 'keypad';
        if (!upgrade) return;
    }
    const nowIso = now.toISOString();
    await repo.upsertSuppression({
        orgId: call.orgId,
        phoneHash: call.phoneHash,
        phoneLast4: call.phoneLast4,
        scope: 'routine',
        source,
        officeVerification: 'pending',
        createdAt: nowIso,
        callId: call.id,
    });
    await repo.appendAudit(call.orgId, {
        at: nowIso,
        actor: 'dispatcher',
        action: 'suppression.add',
        target: `suppression/${call.phoneHash}`,
        detail: { callId: call.id, source, scope: 'routine' },
    });
}

// ── Per-school dispatch ─────────────────────────────────────────────────────

interface SchoolContext {
    deps: DispatchDeps;
    opts: DispatchOptions;
    school: SamparkSchool;
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
    const suppression = await deps.repo.getSuppression(orgId, guardian.phoneHash);
    // This intent's own earlier attempts are calls to the same phone; they must not count against its own retries.
    const recentCallsToPhone = spec.emergency
        ? 0
        : Math.max(
              0,
              (await deps.repo.countCallsToPhoneSince(orgId, guardian.phoneHash, new Date(now.getTime() - FREQUENCY_WINDOW_MS), true)) -
                  intent.attempts,
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
        phoneHash: guardian.phoneHash,
        phoneLast4: guardian.phoneLast4,
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

    let current = call;
    let retryable = true;

    let destination: string;
    try {
        destination = await deps.destinationFor(school, guardian);
    } catch (e) {
        // The carrier was never contacted, so this attempt is a clean failure.
        current = applyCallEvent(current, { type: 'place_failed', at: nowIso, reason: `destination_unavailable: ${errorMessage(e)}` });
        await deps.repo.updateCall(orgId, call.id, current);
        await deps.repo.updateIntent(orgId, intent.id, settleIntent(current, intent, spec, now, true));
        report.errors.push(`${orgId}/${intent.id}: destination unavailable: ${errorMessage(e)}`);
        return true;
    }

    // From here on a thrown error means we cannot know whether the phone rang: leave the call
    // in 'dialing' (the caller catches) so the sweep hands it to a person. Never retried.
    report.dialed += 1;
    const result = await ctx.carrier.place({ call, destinationE164: destination, audioSeconds: audioSeconds ?? DEFAULT_AUDIO_SECONDS });

    if (result.ok) {
        current = applyCallEvent(current, { type: 'placed', at: nowIso, providerCallId: result.providerCallId });
        for (const event of result.events) current = applyCallEvent(current, event);
    } else {
        current = applyCallEvent(current, { type: 'place_failed', at: nowIso, reason: result.reason });
        retryable = result.retryable;
    }
    await deps.repo.updateCall(orgId, call.id, current);

    if (isTerminal(current.state)) {
        await deps.repo.updateIntent(orgId, intent.id, settleIntent(current, intent, spec, now, retryable));
        await recordOptOut(deps.repo, current, now);
    }
    // A non-terminal call (a real carrier reporting by webhook later) leaves the intent in 'dialing'.
    return true;
}

async function finishCampaigns(repo: SamparkRepo, orgId: string, campaignIds: Iterable<string>, now: Date): Promise<void> {
    for (const campaignId of campaignIds) {
        await recomputeCampaignCounts(repo, orgId, campaignId);
        const campaign = await repo.getCampaign(orgId, campaignId);
        if (!campaign || !DISPATCHABLE_CAMPAIGN.has(campaign.status)) continue;
        const intents = await repo.listIntentsByCampaign(orgId, campaignId);
        if (intents.every((i) => isTerminalIntent(i.status))) {
            await repo.updateCampaign(orgId, campaignId, { status: 'completed', updatedAt: now.toISOString() });
        }
    }
}

async function dispatchSchool(deps: DispatchDeps, opts: DispatchOptions, school: SamparkSchool, now: Date, report: DispatchReport, touched: Set<string>): Promise<void> {
    const orgId = school.orgId;

    // Campaigns that are scheduled or dispatching get their completion checked every tick,
    // including ones with nothing due (e.g. every intent was blocked at materialisation).
    for (const c of await deps.repo.listCampaigns(orgId, 200)) {
        if (DISPATCHABLE_CAMPAIGN.has(c.status)) touched.add(c.id);
    }

    try {
        const inFlight = await deps.repo.countNonTerminalCalls(orgId);
        if (inFlight >= opts.maxInFlightPerSchool) {
            report.skipped += 1;
            return;
        }
        let budget = Math.min(opts.maxDialsPerSchoolPerTick, opts.maxInFlightPerSchool - inFlight);
        if (budget <= 0) return;

        const carrier = deps.carrierFor(school);
        const ctx: SchoolContext = { deps, opts, school, carrier, now, report, touched, campaigns: new Map(), students: null };
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
 * Single-flight (repo.acquireLock('sampark-dispatch')), sweep expired 'dialing' → 'unknown' (intent → 'needs_review'),
 * then per school: listDueIntents → evaluateGate(stage 'dispatch') → claimIntentForDial → carrier.place → feed events
 * through applyCallEvent → update call, intent (done | retry_wait with notBefore = now + retryAfterMinutes | done when
 * attempts exhausted), suppressions (key 9 confirmed or unconfirmed-requested → scope 'routine', officeVerification
 * 'pending'), and campaign counts.
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
                report.swept += await sweepSchool(deps.repo, school.orgId, now, touchedBySchool.get(school.orgId)!);
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
