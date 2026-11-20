/**
 * The SamparkAI calendar: one typed event shape over the records that genuinely
 * carry a scheduled time. Pure (no I/O): the server loads the records for a range
 * and maps them here; tests drive these functions directly.
 *
 * Sources and what each event means:
 *   callback / scheduled_call   sampark_callbacks — one Riya call to one family at
 *                               scheduledAt (a parent's request, or staff-scheduled).
 *   campaign_calls              sampark_campaigns — the calls a notice campaign makes,
 *                               from notBefore (or approval) until expiresAt. One
 *                               event per campaign; its families are counted, not
 *                               listed, so a campaign is never counted twice.
 *   school_event                the PTM / event / closure a campaign is about (its
 *                               facts' date and time). Several campaigns about the
 *                               same event share ONE event.
 *   holiday                     the school's holidays: no routine calls that day.
 *
 * Not events: immediate Riya calls and attendance calls (no future time), per-family
 * campaign intents (counted inside their campaign), and draft campaigns (unapproved,
 * so nothing is scheduled). Every event keeps its record ids; the key is unique per
 * (type, record), so merging sources can never duplicate one.
 */

import type { CallbackView } from '@/lib/sampark/callbacks/types';
import { zonedParts, zonedToUtc } from '@/lib/sampark/callbacks/time';
import type { RiyaPurpose } from '@/lib/sampark/conversation/riya-purposes';
import type { Campaign, CampaignStatus, PurposeId, SamparkSchool } from '@/types/sampark';

export const CALENDAR_EVENT_TYPES = ['callback', 'scheduled_call', 'campaign_calls', 'school_event', 'holiday'] as const;
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

/** Call-bearing types: the ones whose events are parent calls. */
export const CALL_EVENT_TYPES: readonly CalendarEventType[] = ['callback', 'scheduled_call', 'campaign_calls'];

export const CALENDAR_STATUSES = [
    'needs_approval', // a parent's request waiting for a person
    'preparing',      // a campaign's audio is being prepared
    'scheduled',
    'in_progress',
    'on_hold',        // a campaign that cannot dial right now (mode changed, school paused)
    'completed',
    'failed',
    'missed',
    'cancelled',
    'upcoming',       // a school event still ahead
    'past',           // a school event already held
    'no_calls',       // a holiday
] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export interface CalendarFamily {
    guardianId: string;
    studentId: string;
    guardianDisplayName: string | null;
    studentDisplayName: string | null;
    guardianPhoneLast4: string | null;
}

export interface CalendarCampaignSummary {
    id: string;
    status: CampaignStatus;
    sections: { grade: number; section: string }[];
    families: number;
    queued: number;
    inFlight: number;
    heardKeyFact: number;
    noAnswer: number;
    failed: number;
    blocked: number;
}

export type CalendarManage =
    | { kind: 'callback'; callbackId: string }
    /** SamparkAI-relative path of the page that manages this record. */
    | { kind: 'link'; path: string; label: 'campaign' | 'settings' };

export interface CalendarEvent {
    /** Unique per (type, record): `${type}:${id}`. */
    key: string;
    type: CalendarEventType;
    status: CalendarStatus;
    /** The source record's own status, unchanged. */
    sourceStatus: string;
    /** UTC instants. All-day events start at midnight in the school's zone. */
    start: string;
    end: string;
    allDay: boolean;
    /** YYYY-MM-DD of `start` in the school's zone. */
    date: string;
    /** Notice purpose (campaigns, school events) or Riya purpose (callbacks). */
    purpose: PurposeId | RiyaPurpose | null;
    /** Parent calls this event stands for (callbacks 1, a campaign its families, others 0). */
    callCount: number;
    needsAction: boolean;
    /** Why it is on the calendar / what blocks it, in short machine words or the parent's words. */
    reason: string | null;
    family: CalendarFamily | null;
    campaign: CalendarCampaignSummary | null;
    /** Campaigns behind a school event (several campaigns can announce one PTM). */
    campaignIds: string[];
    /** Record ids, unchanged. */
    source: { collection: 'sampark_callbacks' | 'sampark_campaigns' | 'sampark_schools'; id: string };
    createdBy: string | null;
    approvedBy: string | null;
    facts: Campaign['facts'] | null;
    manage: CalendarManage | null;
    /** The callback itself, for the callback dialogs. */
    callback: CallbackView | null;
}

export interface CalendarSummary {
    /** Distinct events in the range by type and status. */
    byType: Record<CalendarEventType, number>;
    byStatus: Partial<Record<CalendarStatus, number>>;
    /**
     * Parent calls in the range that are scheduled, under way or done: callbacks (1 each)
     * plus campaign families. Not counted: requests awaiting approval, cancelled, failed, missed.
     */
    plannedCalls: number;
    /** Callbacks awaiting a person, including requests with no time yet. */
    awaitingApproval: number;
    completed: number;
    cancelled: number;
    failedOrMissed: number;
    needsAction: number;
}

const DAY_MS = 86_400_000;

function dateIn(at: Date, tz: string): string {
    const p = zonedParts(at, tz);
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function midnight(date: string, tz: string): Date {
    const [y, m, d] = date.split('-').map(Number);
    return zonedToUtc({ year: y, month: m, day: d, hour: 0, minute: 0 }, tz);
}

const CALLBACK_STATUS: Record<CallbackView['status'], CalendarStatus> = {
    proposed: 'needs_approval',
    scheduled: 'scheduled',
    running: 'in_progress',
    completed: 'completed',
    failed: 'failed',
    missed: 'missed',
    cancelled: 'cancelled',
};

/** A callback with a time. Proposals without one are not placed on a date (see needsTime). */
export function callbackEvent(cb: CallbackView, tz: string): CalendarEvent | null {
    if (!cb.scheduledAt) return null;
    const start = new Date(cb.scheduledAt);
    const type: CalendarEventType = cb.source === 'conversation' ? 'callback' : 'scheduled_call';
    const status = CALLBACK_STATUS[cb.status];
    return {
        key: `${type}:${cb.id}`,
        type,
        status,
        sourceStatus: cb.status,
        start: start.toISOString(),
        end: new Date(start.getTime() + 15 * 60_000).toISOString(),
        allDay: false,
        date: dateIn(start, tz),
        purpose: cb.riyaPurpose,
        callCount: 1,
        needsAction: status === 'needs_approval' || status === 'failed' || status === 'missed',
        reason: cb.lastError?.code ?? cb.requestedText ?? cb.note ?? null,
        family: {
            guardianId: cb.guardianId,
            studentId: cb.studentId,
            guardianDisplayName: cb.guardianDisplayName,
            studentDisplayName: cb.studentDisplayName,
            guardianPhoneLast4: cb.guardianPhoneLast4,
        },
        campaign: null,
        campaignIds: [],
        source: { collection: 'sampark_callbacks', id: cb.id },
        createdBy: cb.createdBy,
        approvedBy: cb.approvedBy,
        facts: null,
        manage: { kind: 'callback', callbackId: cb.id },
        callback: cb,
    };
}

function campaignStatus(c: Campaign): CalendarStatus {
    switch (c.status) {
        case 'rendering': return 'preparing';
        case 'render_failed': return 'failed';
        case 'scheduled': return c.holdReason ? 'on_hold' : 'scheduled';
        case 'dispatching': return c.holdReason ? 'on_hold' : 'in_progress';
        case 'completed': return 'completed';
        case 'cancelled': return 'cancelled';
        default: return 'scheduled';
    }
}

function campaignSummary(c: Campaign): CalendarCampaignSummary {
    const n = c.counts;
    return {
        id: c.id,
        status: c.status,
        sections: c.audience.sections,
        families: n.guardians,
        queued: n.queued,
        inFlight: n.inFlight,
        heardKeyFact: n.heardKeyFact,
        noAnswer: n.noAnswer,
        failed: n.failed,
        blocked: n.blocked,
    };
}

/** A campaign's calls. Drafts are not scheduled (nobody approved them) and are left out. */
export function campaignCallsEvent(c: Campaign, tz: string): CalendarEvent | null {
    if (c.status === 'draft') return null;
    const startIso = c.notBefore ?? c.approvedAt;
    if (!startIso) return null;
    const start = new Date(startIso);
    const end = new Date(Math.max(start.getTime(), new Date(c.expiresAt).getTime()));
    const status = campaignStatus(c);
    return {
        key: `campaign_calls:${c.id}`,
        type: 'campaign_calls',
        status,
        sourceStatus: c.status,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        date: dateIn(start, tz),
        purpose: c.purpose,
        // Families the campaign will call: everyone in the audience who is not blocked.
        callCount: Math.max(0, c.counts.guardians - c.counts.blocked),
        needsAction: status === 'failed' || status === 'on_hold',
        reason: c.holdReason ?? (c.status === 'render_failed' ? 'render_failed' : null),
        family: null,
        campaign: campaignSummary(c),
        campaignIds: [c.id],
        source: { collection: 'sampark_campaigns', id: c.id },
        createdBy: c.createdBy,
        approvedBy: c.approvedBy,
        facts: c.facts,
        manage: { kind: 'link', path: `/${encodeURIComponent(c.orgId)}/campaigns/${encodeURIComponent(c.id)}`, label: 'campaign' },
        callback: null,
    };
}

/** The school events campaigns announce, one per real event (merged across campaigns). */
export function schoolEvents(campaigns: Campaign[], tz: string, now: Date): CalendarEvent[] {
    const byKey = new Map<string, CalendarEvent>();
    for (const c of campaigns) {
        if (c.status === 'draft' || c.status === 'cancelled') continue;
        const f = c.facts;
        const timed = f.kind !== 'emergency_closure';
        const [y, m, d] = f.date.split('-').map(Number);
        const start = timed
            ? zonedToUtc({ year: y, month: m, day: d, hour: f.time.hour, minute: f.time.minute }, tz)
            : midnight(f.date, tz);
        const end = timed ? new Date(start.getTime() + 60 * 60_000) : new Date(midnight(f.date, tz).getTime() + DAY_MS);
        const id = timed ? `${f.kind}:${f.date}:${f.time.hour}:${f.time.minute}:${f.venueId}${f.kind === 'event_invite' ? `:${f.eventType}` : ''}` : `${f.kind}:${f.date}`;
        const existing = byKey.get(id);
        if (existing) {
            existing.campaignIds = [...new Set([...existing.campaignIds, c.id])].sort();
            continue;
        }
        byKey.set(id, {
            key: `school_event:${id}`,
            type: 'school_event',
            status: end.getTime() <= now.getTime() ? 'past' : 'upcoming',
            sourceStatus: c.status,
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: !timed,
            date: f.date,
            purpose: c.purpose,
            callCount: 0,
            needsAction: false,
            reason: null,
            family: null,
            campaign: null,
            campaignIds: [c.id],
            source: { collection: 'sampark_campaigns', id: c.id },
            createdBy: c.createdBy,
            approvedBy: c.approvedBy,
            facts: f,
            manage: { kind: 'link', path: `/${encodeURIComponent(c.orgId)}/campaigns/${encodeURIComponent(c.id)}`, label: 'campaign' },
            callback: null,
        });
    }
    return [...byKey.values()];
}

/** One all-day event per school holiday. */
export function holidayEvents(school: Pick<SamparkSchool, 'orgId' | 'holidays'>, tz: string): CalendarEvent[] {
    return [...new Set(school.holidays ?? [])].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).map((date) => {
        const start = midnight(date, tz);
        return {
            key: `holiday:${date}`,
            type: 'holiday' as const,
            status: 'no_calls' as const,
            sourceStatus: 'holiday',
            start: start.toISOString(),
            end: new Date(start.getTime() + DAY_MS).toISOString(),
            allDay: true,
            date,
            purpose: null,
            callCount: 0,
            needsAction: false,
            reason: null,
            family: null,
            campaign: null,
            campaignIds: [],
            source: { collection: 'sampark_schools' as const, id: school.orgId },
            createdBy: null,
            approvedBy: null,
            facts: null,
            manage: { kind: 'link' as const, path: `/${encodeURIComponent(school.orgId)}/settings`, label: 'settings' as const },
            callback: null,
        };
    });
}

/** Events overlapping [from, to), one per key, in time order. */
export function inRange(events: CalendarEvent[], from: Date, to: Date): CalendarEvent[] {
    const seen = new Map<string, CalendarEvent>();
    for (const e of events) {
        if (new Date(e.end).getTime() <= from.getTime() || new Date(e.start).getTime() >= to.getTime()) continue;
        if (!seen.has(e.key)) seen.set(e.key, e);
    }
    return [...seen.values()].sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
}

export function summarise(events: CalendarEvent[], timelessProposals: number): CalendarSummary {
    const byType = Object.fromEntries(CALENDAR_EVENT_TYPES.map((t) => [t, 0])) as Record<CalendarEventType, number>;
    const byStatus: Partial<Record<CalendarStatus, number>> = {};
    let plannedCalls = 0;
    let awaitingApproval = timelessProposals;
    let completed = 0;
    let cancelled = 0;
    let failedOrMissed = 0;
    let needsAction = timelessProposals;
    const seen = new Set<string>();
    for (const e of events) {
        if (seen.has(e.key)) continue;
        seen.add(e.key);
        byType[e.type] += 1;
        byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
        if (e.needsAction) needsAction += 1;
        if (!CALL_EVENT_TYPES.includes(e.type)) continue;
        if (e.status === 'needs_approval') awaitingApproval += 1;
        if (e.status === 'completed') completed += 1;
        if (e.status === 'cancelled') cancelled += 1;
        if (e.status === 'failed' || e.status === 'missed') failedOrMissed += 1;
        if (!['needs_approval', 'cancelled', 'failed', 'missed'].includes(e.status)) plannedCalls += e.callCount;
    }
    return { byType, byStatus, plannedCalls, awaitingApproval, completed, cancelled, failedOrMissed, needsAction };
}
