/**
 * The demo calendar: SamparkAI's own calendar events (src/lib/sampark/calendar/
 * events.ts) built from the demo school's campaigns, callbacks and holidays.
 * Campaign calls, school events and holidays go through the real builders;
 * callbacks become the same CalendarEvent shape `callbackEvent` produces.
 */

import { campaignCallsEvent, holidayEvents, schoolEvents, type CalendarEvent, type CalendarStatus } from '@/lib/sampark/calendar/events';
import { DEFAULT_CALLBACK_TIME_ZONE } from '@/lib/sampark/callbacks/time';
import type { CallbackStatus } from '@/lib/sampark/callbacks/types';
import { DEMO_SCHOOL_ID, studentById } from './school';
import type { DemoCallback, DemoCampaign } from './types';

export const DEMO_TZ = DEFAULT_CALLBACK_TIME_ZONE;

const CALLBACK_STATUS: Record<CallbackStatus, CalendarStatus> = {
    proposed: 'needs_approval',
    scheduled: 'scheduled',
    running: 'in_progress',
    completed: 'completed',
    failed: 'failed',
    missed: 'missed',
    cancelled: 'cancelled',
};

function dateIn(at: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: DEMO_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

export function demoCallbackEvent(cb: DemoCallback): CalendarEvent | null {
    if (!cb.scheduledAt) return null;
    const start = new Date(cb.scheduledAt);
    const student = studentById(cb.studentId);
    const status = CALLBACK_STATUS[cb.status];
    return {
        key: `callback:${cb.id}`,
        type: cb.source === 'parent_request' ? 'callback' : 'scheduled_call',
        status,
        sourceStatus: cb.status,
        start: start.toISOString(),
        end: new Date(start.getTime() + 15 * 60_000).toISOString(),
        allDay: false,
        date: dateIn(start),
        purpose: null,
        callCount: 1,
        needsAction: status === 'needs_approval' || status === 'failed' || status === 'missed',
        reason: cb.note,
        family: student
            ? { guardianId: `${student.id}-g`, studentId: student.id, guardianDisplayName: student.guardian.name, studentDisplayName: student.name, guardianPhoneLast4: student.guardian.phoneLast4 }
            : null,
        campaign: null,
        campaignIds: [],
        source: { collection: 'sampark_callbacks', id: cb.id },
        createdBy: cb.createdBy.name,
        approvedBy: null,
        facts: null,
        manage: { kind: 'callback', callbackId: cb.id },
        callback: null,
    };
}

export function demoCalendarEvents(input: { callbacks: DemoCallback[]; campaigns: DemoCampaign[]; holidays: string[]; now: Date }): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    for (const cb of input.callbacks) {
        const e = demoCallbackEvent(cb);
        if (e) events.push(e);
    }
    for (const c of input.campaigns) {
        const e = campaignCallsEvent(c, DEMO_TZ);
        if (e) events.push(e);
    }
    events.push(...schoolEvents(input.campaigns, DEMO_TZ, input.now));
    events.push(...holidayEvents({ orgId: DEMO_SCHOOL_ID, holidays: input.holidays }, DEMO_TZ));
    return events.sort((a, b) => a.start.localeCompare(b.start));
}
