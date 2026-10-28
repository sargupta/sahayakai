/** @jest-environment node */
/**
 * The calendar event layer (src/lib/sampark/calendar/events.ts): each source maps to
 * the right type, date and status; future months land on their own dates; ranges
 * filter by overlap; nothing is counted twice; drafts and immediate calls are not
 * events; IST dates and times convert correctly.
 */

import {
    callbackEvent,
    campaignCallsEvent,
    holidayEvents,
    inRange,
    schoolEvents,
    summarise,
    type CalendarEvent,
} from '@/lib/sampark/calendar/events';
import type { CallbackView } from '@/lib/sampark/callbacks/types';
import type { Campaign } from '@/types/sampark';

import { campaign } from '../engine/_fixtures';

const IST = 'Asia/Kolkata';
const NOW = new Date('2026-10-28T05:30:00Z'); // Wed 28 Oct, 11:00 IST

function cb(over: Partial<CallbackView> = {}): CallbackView {
    return {
        id: 'cb1', orgId: 'hillview-demo', guardianId: 'g1', studentId: 's1', riyaPurpose: 'ptm_invitation', facts: null, campaignId: 'c1',
        announcement: 'hello', scheduledAt: '2026-10-28T11:30:00.000Z', timeZone: IST, candidates: [], status: 'scheduled', version: 1,
        queueAt: '2026-10-28T11:30:00.000Z', attempts: 0, riyaCallId: null, lastError: null, source: 'staff', sourceCallId: null,
        requestedText: null, note: null, createdBy: 'admin', approvedBy: 'admin', createdAt: '2026-10-27T00:00:00.000Z',
        updatedAt: '2026-10-27T00:00:00.000Z', cancelledBy: null, completedAt: null,
        guardianDisplayName: 'Meena', studentDisplayName: 'Asha', guardianPhoneLast4: '0101', callState: null,
        ...over,
    };
}

const counts = (over: Partial<Campaign['counts']> = {}): Campaign['counts'] => ({
    guardians: 40, blocked: 4, queued: 36, inFlight: 0, heardKeyFact: 0, confirmedYes: 0, declinedOrOther: 0, noAnswer: 0, failed: 0, optOuts: 0, ...over,
});

const ptm = (date: string, hour = 10): Campaign['facts'] => ({ kind: 'ptm_invite', date, time: { hour, minute: 0 }, venueId: 'hall' });

describe('callbacks', () => {
    it('a staff-scheduled call and a parent callback are distinct types, each one call', () => {
        const staff = callbackEvent(cb(), IST)!;
        const parent = callbackEvent(cb({ id: 'cb2', source: 'conversation', status: 'proposed', approvedBy: null }), IST)!;
        expect(staff).toMatchObject({ type: 'scheduled_call', status: 'scheduled', date: '2026-10-28', callCount: 1, key: 'scheduled_call:cb1', manage: { kind: 'callback', callbackId: 'cb1' } });
        expect(parent).toMatchObject({ type: 'callback', status: 'needs_approval', needsAction: true });
    });

    it('a request with no time is not placed on a date', () => {
        expect(callbackEvent(cb({ status: 'proposed', scheduledAt: null }), IST)).toBeNull();
    });

    it('maps every callback status', () => {
        const map = (status: CallbackView['status']) => callbackEvent(cb({ status }), IST)!.status;
        expect(['scheduled', 'running', 'completed', 'failed', 'missed', 'cancelled'].map((s) => map(s as CallbackView['status'])))
            .toEqual(['scheduled', 'in_progress', 'completed', 'failed', 'missed', 'cancelled']);
    });

    it('dates follow IST, not UTC (22:00 UTC is the next day in India)', () => {
        expect(callbackEvent(cb({ scheduledAt: '2026-10-28T20:00:00.000Z' }), IST)!.date).toBe('2026-10-29');
    });
});

describe('campaigns', () => {
    it('campaign calls start at notBefore, run to expiry and count the families who will be called', () => {
        const c = campaign({ id: 'c-nov', facts: ptm('2026-11-20'), notBefore: '2026-11-18T04:30:00.000Z', expiresAt: '2026-11-20T04:30:00.000Z', counts: counts() });
        const e = campaignCallsEvent(c, IST)!;
        expect(e).toMatchObject({ type: 'campaign_calls', date: '2026-11-18', start: '2026-11-18T04:30:00.000Z', end: '2026-11-20T04:30:00.000Z', callCount: 36, status: 'scheduled' });
        expect(e.manage).toEqual({ kind: 'link', path: '/hillview-demo/campaigns/c-nov', label: 'campaign' });
    });

    it('without notBefore they start when approved', () => {
        expect(campaignCallsEvent(campaign({ notBefore: null, approvedAt: '2026-10-27T06:00:00.000Z' }), IST)!.start).toBe('2026-10-27T06:00:00.000Z');
    });

    it('drafts are not scheduled: no event', () => {
        expect(campaignCallsEvent(campaign({ status: 'draft', approvedAt: null }), IST)).toBeNull();
        expect(schoolEvents([campaign({ status: 'draft' })], IST, NOW)).toEqual([]);
    });

    it('status: preparing, on hold, failed audio, in progress, completed, cancelled', () => {
        const s = (over: Partial<Campaign>) => campaignCallsEvent(campaign(over), IST)!.status;
        expect(s({ status: 'rendering' })).toBe('preparing');
        expect(s({ status: 'scheduled', holdReason: 'school_paused' })).toBe('on_hold');
        expect(s({ status: 'render_failed' })).toBe('failed');
        expect(s({ status: 'dispatching' })).toBe('in_progress');
        expect(s({ status: 'completed' })).toBe('completed');
        expect(s({ status: 'cancelled' })).toBe('cancelled');
    });

    it('the PTM itself is a school event at its IST time; two campaigns about it make ONE event', () => {
        const a = campaign({ id: 'a', facts: ptm('2026-11-21', 10), audience: { sections: [{ grade: 7, section: 'A' }] } });
        const b = campaign({ id: 'b', facts: ptm('2026-11-21', 10), audience: { sections: [{ grade: 7, section: 'B' }] } });
        const events = schoolEvents([a, b], IST, NOW);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: 'school_event', date: '2026-11-21', start: '2026-11-21T04:30:00.000Z', allDay: false, status: 'upcoming', campaignIds: ['a', 'b'], callCount: 0 });
    });

    it('a closure is an all-day event from IST midnight; a cancelled campaign announces nothing', () => {
        const closure = campaign({ id: 'cl', purpose: 'emergency_closure', facts: { kind: 'emergency_closure', date: '2026-10-30', reason: 'rain_landslide', busesRunning: false } });
        const [e] = schoolEvents([closure, campaign({ id: 'x', status: 'cancelled', facts: ptm('2026-11-01') })], IST, NOW);
        expect(e).toMatchObject({ allDay: true, date: '2026-10-30', start: '2026-10-29T18:30:00.000Z', end: '2026-10-30T18:30:00.000Z' });
        expect(schoolEvents([campaign({ status: 'cancelled' })], IST, NOW)).toEqual([]);
    });

    it('a school event already held is past', () => {
        expect(schoolEvents([campaign({ facts: ptm('2026-10-20') })], IST, NOW)[0].status).toBe('past');
    });
});

describe('holidays', () => {
    it('one all-day event per holiday, duplicates in the list ignored', () => {
        const events = holidayEvents({ orgId: 'o', holidays: ['2026-11-14', '2026-11-14', 'bad'] }, IST);
        expect(events.map((e) => e.key)).toEqual(['holiday:2026-11-14']);
        expect(events[0]).toMatchObject({ status: 'no_calls', allDay: true, manage: { kind: 'link', path: '/o/settings', label: 'settings' } });
    });
});

describe('ranges and counts', () => {
    const october = { from: new Date('2026-09-30T18:30:00Z'), to: new Date('2026-10-31T18:30:00Z') };
    const november = { from: new Date('2026-10-31T18:30:00Z'), to: new Date('2026-11-30T18:30:00Z') };

    function sample(): CalendarEvent[] {
        return [
            callbackEvent(cb({ id: 'oct' }), IST)!,
            callbackEvent(cb({ id: 'nov', scheduledAt: '2026-11-25T06:00:00.000Z' }), IST)!,
            callbackEvent(cb({ id: 'done', status: 'completed' }), IST)!,
            callbackEvent(cb({ id: 'gone', status: 'cancelled' }), IST)!,
            callbackEvent(cb({ id: 'miss', status: 'missed' }), IST)!,
            callbackEvent(cb({ id: 'ask', source: 'conversation', status: 'proposed' }), IST)!,
            campaignCallsEvent(campaign({ id: 'c-nov', facts: ptm('2026-11-20'), notBefore: '2026-11-18T04:30:00.000Z', expiresAt: '2026-11-20T04:30:00.000Z', counts: counts() }), IST)!,
            ...holidayEvents({ orgId: 'o', holidays: ['2026-11-14'] }, IST),
        ];
    }

    it('next month’s calls appear in next month, on their dates, and not in this month', () => {
        const nov = inRange(sample(), november.from, november.to);
        expect(nov.map((e) => `${e.key}@${e.date}`)).toEqual(['holiday:2026-11-14@2026-11-14', 'campaign_calls:c-nov@2026-11-18', 'scheduled_call:nov@2026-11-25']);
        expect(inRange(sample(), october.from, october.to).some((e) => e.date.startsWith('2026-11'))).toBe(false);
    });

    it('an event spanning the range edge is included (overlap), and each key once', () => {
        const spanning = campaignCallsEvent(campaign({ id: 'span', notBefore: '2026-10-31T10:00:00.000Z', expiresAt: '2026-11-02T10:00:00.000Z' }), IST)!;
        const got = inRange([spanning, spanning], november.from, november.to);
        expect(got.map((e) => e.key)).toEqual(['campaign_calls:span']);
    });

    it('summaries count each event once, families for campaigns, and requests with no time', () => {
        const events = inRange(sample(), october.from, new Date('2026-11-30T18:30:00Z'));
        const s = summarise([...events, ...events], 2); // duplicates in input must not double count
        expect(s.byType).toMatchObject({ scheduled_call: 5, callback: 1, campaign_calls: 1, holiday: 1, school_event: 0 });
        // oct + nov + done (1 each) + campaign families (36); proposed, cancelled, missed not counted.
        expect(s.plannedCalls).toBe(3 + 36);
        expect(s).toMatchObject({ awaitingApproval: 1 + 2, completed: 1, cancelled: 1, failedOrMissed: 1 });
        expect(s.needsAction).toBe(2 /* proposed + missed */ + 2 /* timeless */);
    });
});
