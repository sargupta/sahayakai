/**
 * The console's landing numbers (SamparkOverview): school, whether the calling
 * window is open right now (routine purposes — ptm_invite is the reference
 * routine spec) and today's band, guardians by language and consent, today's
 * calls (IST), the campaign to show first, what is coming up, active campaigns,
 * the last import and the school's pause. `school.liveDialAvailable` says whether
 * this deployment can place Test-mode calls at all; only the test phone's last
 * four digits are ever included.
 *
 * TODAY BY MODE (H9). A closure rehearsed in Test mode rings one staff phone; if
 * it were counted with real calls the principal would read "families heard" when
 * no family was called. So each of today's calls lands in exactly one bucket:
 *   rehearsal.practice  the simulated carrier: no phone rang at all;
 *   rehearsal.test      a real carrier ringing the school's own test phone;
 *   today               a real carrier ringing a guardian — the only calls that
 *                       reached a family (a record from before phase 2a, with no
 *                       destination, rang the guardian).
 * `familyTrend` is the same family bucket over the last 7 IST days.
 *
 * ACTIVITY BY MODE (dashboard gate). The charts and the feed — `hours`,
 * `todayByLanguage`, `recent`, `trend` — show the bucket of the school's CURRENT
 * mode (`activityMode`): live → the family bucket, test → the test bucket,
 * practice → the practice bucket. They never mix buckets, so a Test-mode screen
 * can say "Test calls by hour" and mean exactly that, and never present a
 * rehearsal as a family reached.
 *
 * Everything is computed from the records loaded here (≤1000 calls, guardians,
 * preferences, suppressions, ≤200 campaigns, the latest import), plus one intent
 * read per recent call that may be waiting to retry (at most 8).
 */

import { purposeSpec } from '@/lib/sampark/catalogue';
import { callHeardKeyFact, callOutcomeClass } from '@/lib/sampark/call-outcome';
import { addDays, istInstant, istParts, isDateString } from '@/lib/sampark/policy/ist';
import { effectiveRoutineWindow, samparkWindowVerdict } from '@/lib/sampark/policy/window';
import {
    PARENT_LANGUAGES,
    type Campaign,
    type CampaignStatus,
    type HourActivity,
    type ParentLanguage,
    type RecentCall,
    type SamparkCall,
    type SamparkLiveCampaign,
    type SamparkMode,
    type SamparkOverview,
    type SamparkSchool,
    type TodayCallCounts,
    type TrendDay,
    type UpcomingItem,
} from '@/types/sampark';
import { effectiveLanguage, isActiveSuppression } from '@/server/sampark/guardians';
import { liveDialBlocker } from '@/server/sampark/carrier';
import type { SamparkCtx } from '@/server/sampark/http';
import { getSchoolOrThrow } from '@/server/sampark/school';

const ACTIVE_CAMPAIGN: CampaignStatus[] = ['rendering', 'scheduled', 'dispatching'];

/** How many calls the overview reads (newest first). Older calls are outside every number here. */
export const OVERVIEW_CALL_LIMIT = 1000;
export const TREND_DAYS = 7;
export const RECENT_LIMIT = 8;
export const UPCOMING_LIMIT = 5;

type Bucket = 'family' | 'practice' | 'test';

/** Which of the overview's buckets a call belongs to (see TODAY BY MODE). Exported for the gate. */
export function callBucket(call: Pick<SamparkCall, 'carrier' | 'destination'>): Bucket {
    if (call.carrier === 'simulated') return 'practice';
    return call.destination === 'test_phone' ? 'test' : 'family';
}

/** The bucket the activity charts and feed show in each school mode (see ACTIVITY BY MODE). Exported for the gate. */
export function activityBucket(mode: SamparkMode): Bucket {
    return mode === 'live' ? 'family' : mode;
}

function countCalls(calls: SamparkCall[]): TodayCallCounts {
    return {
        calls: calls.length,
        heardKeyFact: calls.filter(callHeardKeyFact).length,
        confirmedYes: calls.filter((c) => c.outcome.confirmed).length,
        optOuts: calls.filter((c) => c.outcome.optOut !== 'none').length,
    };
}

/** IST date of an ISO instant, memoised for one overview (each call's date is needed up to three times). */
function istDateMemo(): (iso: string) => string {
    const seen = new Map<string, string>();
    return (iso) => {
        let date = seen.get(iso);
        if (date === undefined) {
            date = istParts(new Date(iso)).date;
            seen.set(iso, date);
        }
        return date;
    };
}

/** Calls per IST hour: every hour of the routine band, widened to any hour that had a call (an early emergency closure). */
function hourActivity(calls: SamparkCall[], band: { startHour: number; endHour: number }): HourActivity[] {
    const byHour = new Map<number, HourActivity>();
    for (const c of calls) {
        const hour = istParts(new Date(c.createdAt)).hour;
        const slot = byHour.get(hour) ?? { hour, calls: 0, heard: 0 };
        slot.calls += 1;
        if (callHeardKeyFact(c)) slot.heard += 1;
        byHour.set(hour, slot);
    }
    const seen = [...byHour.keys()];
    const from = Math.min(band.startHour, ...seen);
    const to = Math.max(band.endHour - 1, ...seen);
    const out: HourActivity[] = [];
    for (let hour = from; hour <= to; hour++) out.push(byHour.get(hour) ?? { hour, calls: 0, heard: 0 });
    return out;
}

function languageActivity(calls: SamparkCall[]): Record<ParentLanguage, { calls: number; heard: number }> {
    const out = Object.fromEntries(PARENT_LANGUAGES.map((l) => [l, { calls: 0, heard: 0 }])) as Record<ParentLanguage, { calls: number; heard: number }>;
    for (const c of calls) {
        const slot = out[c.language];
        if (!slot) continue;
        slot.calls += 1;
        if (callHeardKeyFact(c)) slot.heard += 1;
    }
    return out;
}

/**
 * One TrendDay per date. A day is `complete` unless the read hit OVERVIEW_CALL_LIMIT and
 * the day is on or before the oldest call read: older calls of that day were not loaded.
 */
function trendOf(calls: SamparkCall[], days: string[], oldestLoaded: string | null, istDateOf: (iso: string) => string): TrendDay[] {
    const out = new Map(days.map((date) => [date, { date, calls: 0, heard: 0, confirmed: 0, optOuts: 0, complete: true } as TrendDay]));
    for (const c of calls) {
        const day = out.get(istDateOf(c.createdAt));
        if (!day) continue;
        day.calls += 1;
        if (callHeardKeyFact(c)) day.heard += 1;
        if (c.outcome.confirmed) day.confirmed += 1;
        if (c.outcome.optOut !== 'none') day.optOuts += 1;
    }
    for (const day of out.values()) day.complete = oldestLoaded === null || day.date > oldestLoaded;
    return days.map((d) => out.get(d)!);
}

/** Today's routine band as instants, or null on an off-day, a school holiday, or an empty window. */
function windowToday(school: SamparkSchool, now: Date): SamparkOverview['windowToday'] {
    const band = effectiveRoutineWindow(school.callingWindow);
    const p = istParts(now);
    const offDays = Array.isArray(school.callingWindow?.offDays) ? school.callingWindow.offDays : [0];
    if (band.startHour >= band.endHour) return null;
    if ((school.holidays ?? []).includes(p.date) || offDays.includes(p.weekday)) return null;
    return { opensAt: istInstant(p.date, band.startHour).toISOString(), closesAt: istInstant(p.date, band.endHour).toISOString() };
}

/** Prefer a campaign calling now, then one scheduled, then the newest one preparing audio. */
function pickLiveCampaign(campaigns: Campaign[]): SamparkLiveCampaign | null {
    const newestFirst = [...campaigns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const c =
        newestFirst.find((x) => x.status === 'dispatching') ??
        newestFirst.find((x) => x.status === 'scheduled') ??
        newestFirst.find((x) => x.status === 'rendering');
    if (!c) return null;
    return {
        id: c.id,
        purpose: c.purpose,
        status: c.status,
        facts: c.facts,
        audience: c.audience,
        expiresAt: c.expiresAt,
        counts: c.counts,
        renderProgress: c.renderProgress,
        mode: c.mode ?? null,
        holdReason: c.holdReason ?? null,
    };
}

/** Runs of consecutive holidays from today on, and active campaigns' dates, soonest first. */
function upcomingItems(school: SamparkSchool, campaigns: Campaign[], today: string): UpcomingItem[] {
    const items: UpcomingItem[] = [];
    const holidays = [...new Set(school.holidays ?? [])].filter((d) => isDateString(d) && d >= today).sort();
    let run: Extract<UpcomingItem, { kind: 'holidays' }> | null = null;
    for (const date of holidays) {
        if (run && addDays(run.to, 1) === date) {
            run.to = date;
            run.days += 1;
        } else {
            run = { kind: 'holidays', from: date, to: date, days: 1 };
            items.push(run);
        }
    }
    for (const c of campaigns) {
        if (!ACTIVE_CAMPAIGN.includes(c.status) || c.facts.date < today) continue;
        items.push({ kind: 'campaign', date: c.facts.date, campaignId: c.id, purpose: c.purpose, status: c.status, facts: c.facts });
    }
    const dateOf = (i: UpcomingItem) => (i.kind === 'holidays' ? i.from : i.date);
    return items.sort((a, b) => dateOf(a).localeCompare(dateOf(b)) || a.kind.localeCompare(b.kind)).slice(0, UPCOMING_LIMIT);
}

export async function getOverview(ctx: SamparkCtx, orgId: string): Promise<SamparkOverview> {
    const school = await getSchoolOrThrow(ctx, orgId);
    const now = ctx.clock.now();
    const verdict = samparkWindowVerdict(school, purposeSpec('ptm_invite'), now);

    const [guardians, suppressions, calls, campaigns, lastImport] = await Promise.all([
        ctx.repo.listGuardians(orgId),
        ctx.repo.listSuppressions(orgId),
        ctx.repo.listCalls(orgId, { limit: OVERVIEW_CALL_LIMIT }),
        ctx.repo.listCampaigns(orgId, 200),
        ctx.repo.getLatestImportRun(orgId),
    ]);
    const active = guardians.filter((g) => g.active);
    const prefs = await ctx.repo.getPreferences(orgId, active.map((g) => g.id));
    const activeSuppressions = suppressions.filter(isActiveSuppression);
    const suppressed = new Set(activeSuppressions.map((s) => s.phoneHash));
    const askedToStop = new Set(activeSuppressions.filter((s) => s.source !== 'carrier_invalid_number').map((s) => s.phoneHash));

    const byLanguage: Record<ParentLanguage | 'unknown', number> = { English: 0, Hindi: 0, Bengali: 0, Nepali: 0, unknown: 0 };
    let withNoticesConsent = 0;
    let suppressedCount = 0;
    let askedToStopCount = 0;
    for (const g of active) {
        const p = prefs.get(g.id);
        byLanguage[effectiveLanguage(g, p) ?? 'unknown'] += 1;
        if (p?.consent.notices?.status === 'granted') withNoticesConsent += 1;
        if (suppressed.has(g.phoneHash)) suppressedCount += 1;
        if (askedToStop.has(g.phoneHash)) askedToStopCount += 1;
    }

    const istDateOf = istDateMemo();
    const today = istParts(now).date;
    const todays = calls.filter((c) => istDateOf(c.createdAt) === today);
    const inBucket = (list: SamparkCall[], bucket: Bucket) => list.filter((c) => callBucket(c) === bucket);

    // The trend reaches back TREND_DAYS IST days; if the read was cut off, the oldest day read may be short.
    const trendDays = Array.from({ length: TREND_DAYS }, (_, i) => addDays(today, i - (TREND_DAYS - 1)));
    const oldestLoaded = calls.length >= OVERVIEW_CALL_LIMIT
        ? calls.reduce((min, c) => (c.createdAt < min ? c.createdAt : min), calls[0].createdAt)
        : null;
    const oldestDay = oldestLoaded ? istDateOf(oldestLoaded) : null;

    const activityMode = school.mode;
    const activity = inBucket(todays, activityBucket(activityMode));
    const recent = await recentCalls(ctx, orgId, activity, new Map(guardians.map((g) => [g.id, g.displayName])));

    return {
        school: {
            orgId: school.orgId,
            displayName: school.displayName,
            mode: school.mode,
            isDemo: school.isDemo,
            callingWindow: school.callingWindow,
            crm: school.crm,
            liveDialAvailable: liveDialBlocker() === null,
            testPhoneLast4: school.testPhoneLast4 ?? null,
        },
        windowOpenNow: verdict.allowed,
        nextWindowOpensAt: verdict.allowed ? null : verdict.nextAllowedAt?.toISOString() ?? null,
        windowToday: windowToday(school, now),
        asOf: now.toISOString(),
        guardians: { total: active.length, byLanguage, withNoticesConsent, suppressed: suppressedCount, askedToStop: askedToStopCount },
        numbersFlagged: activeSuppressions.filter((s) => s.source === 'carrier_invalid_number').length,
        today: countCalls(inBucket(todays, 'family')),
        familyTrend: trendOf(inBucket(calls, 'family'), trendDays, oldestDay, istDateOf),
        rehearsal: { practice: countCalls(inBucket(todays, 'practice')), test: countCalls(inBucket(todays, 'test')) },
        activityMode,
        hours: hourActivity(activity, effectiveRoutineWindow(school.callingWindow)),
        todayByLanguage: languageActivity(activity),
        recent,
        trend: trendOf(inBucket(calls, activityBucket(activityMode)), trendDays, oldestDay, istDateOf),
        liveCampaign: pickLiveCampaign(campaigns),
        upcoming: upcomingItems(school, campaigns, today),
        pause: school.pause ?? null,
        activeCampaigns: campaigns.filter((c) => ACTIVE_CAMPAIGN.includes(c.status)).length,
        lastImport: lastImport
            ? { id: lastImport.id, status: lastImport.status, finishedAt: lastImport.finishedAt, counts: lastImport.counts }
            : null,
    };
}

/**
 * The newest RECENT_LIMIT of `calls`, for the feed. A call that rang out or failed may be
 * waiting to retry: its intent is read (one point read each, at most RECENT_LIMIT) and the
 * retry time shown only while this call is still the intent's latest.
 */
async function recentCalls(ctx: SamparkCtx, orgId: string, calls: SamparkCall[], names: Map<string, string>): Promise<RecentCall[]> {
    const newest = [...calls]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.attempt - a.attempt || a.id.localeCompare(b.id))
        .slice(0, RECENT_LIMIT);
    return Promise.all(
        newest.map(async (c) => {
            const outcomeClass = callOutcomeClass(c);
            let retryAt: string | null = null;
            if (outcomeClass === 'no_answer' || outcomeClass === 'failed') {
                const intent = await ctx.repo.getIntent(orgId, c.intentId);
                if (intent && intent.status === 'retry_wait' && intent.lastCallId === c.id) retryAt = intent.notBefore;
            }
            return {
                id: c.id,
                createdAt: c.createdAt,
                guardianDisplayName: names.get(c.guardianId) ?? 'Unknown guardian',
                phoneLast4: c.phoneLast4,
                purpose: c.purpose,
                language: c.language,
                campaignId: c.campaignId,
                state: c.state,
                outcome: c.outcome,
                outcomeClass,
                destination: c.destination ?? 'guardian',
                carrier: c.carrier,
                retryAt,
            };
        }),
    );
}
