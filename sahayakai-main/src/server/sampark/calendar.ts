/**
 * GET /api/sampark/[orgId]/calendar behind the route shell: every genuinely
 * scheduled item for one school in [from, to), mapped by src/lib/sampark/calendar/events.ts.
 *
 * What is read, and why it stays small:
 *   - callbacks: the range query on scheduledAt plus open proposals (existing indexed
 *     reads in callbacks.ts) — only when Riya is on for this deployment;
 *   - campaigns: the school's most recent 200 (a school runs tens, not thousands;
 *     their calls are counted on the campaign, never loaded);
 *   - the school record (holidays).
 * No call history is read. Read-only: changes go through the callback and campaign
 * routes, which keep every existing check.
 */

import { z } from 'zod';

import {
    callbackEvent,
    campaignCallsEvent,
    holidayEvents,
    inRange,
    schoolEvents,
    summarise,
    type CalendarEvent,
    type CalendarSummary,
} from '@/lib/sampark/calendar/events';
import { DEFAULT_CALLBACK_TIME_ZONE } from '@/lib/sampark/callbacks/time';
import type { CallbackView } from '@/lib/sampark/callbacks/types';
import type { Clock, SamparkRepo } from '@/lib/sampark/ports';
import { callbackDeps, listCallbacks, type CallbackDeps } from '@/server/sampark/callbacks';
import { riyaEnabled } from '@/server/sampark/conversation';
import { badRequest } from '@/server/sampark/errors';
import { getSchoolOrThrow } from '@/server/sampark/school';
import { getDb } from '@/lib/firebase-admin';

const Instant = z.string().datetime({ offset: true });
export const CalendarQuerySchema = z.object({ from: Instant, to: Instant });

/** Longest range one request may ask for (a month view is at most 6 weeks). */
export const MAX_CALENDAR_RANGE_MS = 62 * 24 * 60 * 60_000;
const CAMPAIGN_LIMIT = 200;

export interface CalendarResponse {
    timeZone: string;
    from: string;
    to: string;
    events: CalendarEvent[];
    /** Parents' requests waiting for a person, whatever their time (and those with none). */
    awaitingApproval: CallbackView[];
    summary: CalendarSummary;
    /** Which sources this deployment can show (callbacks need Riya). */
    sources: { callbacks: boolean; campaigns: true; holidays: true };
    /** Display names of the people who created or approved the events (uid → name). */
    people: Record<string, string>;
}

export interface CalendarDeps {
    repo: SamparkRepo;
    clock: Clock;
    env?: Record<string, string | undefined>;
    /** Built only when Riya is on; injected by tests. */
    callbackDeps?: () => Promise<CallbackDeps>;
    /** uid → display name; defaults to the users/{uid} profiles. */
    displayNames?: (uids: string[]) => Promise<Record<string, string>>;
}

async function profileNames(uids: string[]): Promise<Record<string, string>> {
    if (uids.length === 0) return {};
    const db = await getDb();
    const snaps = await Promise.all(uids.map((uid) => db.collection('users').doc(uid).get()));
    const out: Record<string, string> = {};
    snaps.forEach((snap, i) => {
        const name = snap.exists ? (snap.data() as { displayName?: unknown }).displayName : undefined;
        if (typeof name === 'string' && name.trim()) out[uids[i]] = name.trim().slice(0, 80);
    });
    return out;
}

export async function loadCalendar(deps: CalendarDeps, orgId: string, fromIso: string, toIso: string): Promise<CalendarResponse> {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (!(to.getTime() > from.getTime())) throw badRequest('INVALID_RANGE', '`to` must be after `from`');
    if (to.getTime() - from.getTime() > MAX_CALENDAR_RANGE_MS) throw badRequest('RANGE_TOO_LONG', 'Ask for at most 62 days at a time');

    const env = deps.env ?? process.env;
    const school = await getSchoolOrThrow({ repo: deps.repo, clock: deps.clock }, orgId);
    const tz = DEFAULT_CALLBACK_TIME_ZONE; // Sampark schools keep IST calling windows and IST dates.
    const now = deps.clock.now();

    const withCallbacks = env.SAMPARK_ENABLED === 'true' && riyaEnabled(env);
    const [campaigns, callbackListing] = await Promise.all([
        deps.repo.listCampaigns(orgId, CAMPAIGN_LIMIT),
        withCallbacks
            ? (deps.callbackDeps ? deps.callbackDeps() : callbackDeps({ repo: deps.repo, clock: deps.clock })).then((cd) => listCallbacks(cd, orgId, from.toISOString(), to.toISOString()))
            : Promise.resolve({ callbacks: [] as CallbackView[], proposed: [] as CallbackView[] }),
    ]);

    const all: CalendarEvent[] = [];
    for (const cb of callbackListing.callbacks) {
        const e = callbackEvent(cb, tz);
        if (e) all.push(e);
    }
    for (const c of campaigns) {
        const e = campaignCallsEvent(c, tz);
        if (e) all.push(e);
    }
    all.push(...schoolEvents(campaigns, tz, now), ...holidayEvents(school, tz));

    const events = inRange(all, from, to);
    const inRangeKeys = new Set(events.map((e) => e.key));
    // Requests outside the range (or with no time) still count as waiting — once.
    const awaitingApproval = callbackListing.proposed;
    const outsideRange = awaitingApproval.filter((p) => {
        const e = callbackEvent(p, tz);
        return !e || !inRangeKeys.has(e.key);
    }).length;

    const uids = [...new Set([...events, ...awaitingApproval.map((cb) => ({ createdBy: cb.createdBy, approvedBy: cb.approvedBy }))]
        .flatMap((e) => [e.createdBy, e.approvedBy])
        .filter((u): u is string => typeof u === 'string' && u !== 'riya' && u !== 'system'))].slice(0, 50);
    const people = await (deps.displayNames ?? profileNames)(uids).catch(() => ({}));

    return {
        timeZone: tz,
        from: from.toISOString(),
        to: to.toISOString(),
        events,
        awaitingApproval,
        summary: summarise(events, outsideRange),
        sources: { callbacks: withCallbacks, campaigns: true, holidays: true },
        people,
    };
}
