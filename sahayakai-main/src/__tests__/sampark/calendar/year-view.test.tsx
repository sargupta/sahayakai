/**
 * Year view: the year is loaded through the same calendar API in six two-month
 * chunks (each inside its 62-day limit), events land on their own dates in the
 * school's zone, an event that spans a chunk boundary is counted once, filters
 * apply, and a date or month opens the Day / Month view.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/context/language-context', () => ({
    ...jest.requireActual('@/context/language-context'),
    useLanguage: () => ({ t: (k: string) => k, language: 'English', isLoaded: true }),
}));
jest.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('next/navigation', () => ({ usePathname: () => '/sampark/hillview-demo/calendar', useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('@/components/sampark/school-context', () => ({ useSamparkSchool: () => ({ orgId: 'hillview-demo', school: null }) }));
jest.mock('@/lib/api/sampark-calendar', () => ({ loadCalendar: jest.fn() }));
jest.mock('@/lib/api/sampark-callbacks', () => ({
    listCallbackSources: jest.fn(async () => []),
    previewCallback: jest.fn(), createCallback: jest.fn(), previewCallbackChange: jest.fn(),
    changeCallbackTime: jest.fn(), cancelCallback: jest.fn(), parseCallbackTime: jest.fn(),
    getCallbackWithHistory: jest.fn(async () => ({ callback: null, history: [] })),
}));

import { yearChunks } from '@/components/sampark/callbacks/callback-dates';
import { SchoolCalendar } from '@/components/sampark/calendar/school-calendar';
import { callbackEvent, campaignCallsEvent, holidayEvents, inRange, schoolEvents, summarise, type CalendarEvent } from '@/lib/sampark/calendar/events';
import type { CallbackView } from '@/lib/sampark/callbacks/types';

import { campaign } from '../engine/_fixtures';

const api = jest.requireMock('@/lib/api/sampark-calendar') as { loadCalendar: jest.Mock };
const IST = 'Asia/Kolkata';
const NEXT_YEAR = new Date().getUTCFullYear() + 1;
const Y = String(NEXT_YEAR);

function cb(over: Partial<CallbackView>): CallbackView {
    return {
        id: 'cb', orgId: 'hillview-demo', guardianId: 'g1', studentId: 's1', riyaPurpose: 'ptm_invitation', facts: null, campaignId: 'c1',
        announcement: 'x', scheduledAt: `${Y}-03-10T06:00:00.000Z`, timeZone: IST, candidates: [], status: 'scheduled', version: 1, queueAt: null,
        attempts: 0, riyaCallId: null, lastError: null, source: 'staff', sourceCallId: null, requestedText: null, note: null, createdBy: 'admin',
        approvedBy: 'admin', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', cancelledBy: null, completedAt: null,
        guardianDisplayName: 'Meena Demo', studentDisplayName: 'Asha Demo', guardianPhoneLast4: '0101', callState: null, ...over,
    };
}

function allEvents(): CalendarEvent[] {
    // Campaign calls from 28 Feb to 2 Mar: they span the Jan–Feb / Mar–Apr chunk boundary.
    const spanning = campaign({ id: 'span', facts: { kind: 'ptm_invite', date: `${Y}-03-02`, time: { hour: 10, minute: 0 }, venueId: 'hall' }, notBefore: `${Y}-02-28T05:00:00.000Z`, expiresAt: `${Y}-03-02T04:00:00.000Z` });
    const nov = campaign({ id: 'nov', facts: { kind: 'event_invite', eventType: 'sports_day', date: `${Y}-11-20`, time: { hour: 9, minute: 0 }, venueId: 'ground' }, status: 'draft', approvedAt: null });
    return [
        callbackEvent(cb({ id: 'mar' }), IST)!,
        // 23:30 IST on 31 Dec is still 31 Dec in the school's zone (18:00 UTC).
        callbackEvent(cb({ id: 'dec', scheduledAt: `${Y}-12-31T18:00:00.000Z`, status: 'failed' }), IST)!,
        campaignCallsEvent(spanning, IST)!,
        ...schoolEvents([spanning, campaign({ id: 'sports', facts: { kind: 'event_invite', eventType: 'sports_day', date: `${Y}-11-20`, time: { hour: 9, minute: 0 }, venueId: 'ground' } })], IST, new Date()),
        ...holidayEvents({ orgId: 'hillview-demo', holidays: [`${Y}-08-15`] }, IST),
        ...(campaignCallsEvent(nov, IST) ? [campaignCallsEvent(nov, IST)!] : []),
    ];
}

beforeEach(() => {
    api.loadCalendar.mockReset();
    api.loadCalendar.mockImplementation(async (_org: string, from: Date, to: Date) => {
        const events = inRange(allEvents(), from, to);
        return {
            timeZone: IST, from: from.toISOString(), to: to.toISOString(), events, awaitingApproval: [], summary: summarise(events, 0),
            sources: { callbacks: true, campaigns: true, holidays: true }, people: {},
        };
    });
});

async function openYear() {
    render(<SchoolCalendar orgId="hillview-demo" />);
    const views = await screen.findByRole('radiogroup', { name: 'Calendar view' });
    fireEvent.click(within(views).getByRole('radio', { name: 'Year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: Y })).toBeInTheDocument());
    await screen.findByRole('list', { name: `Months of ${Y}` });
}

const day = (label: RegExp) => screen.getByRole('button', { name: label });

describe('yearChunks', () => {
    it('covers the year exactly, contiguous, each chunk within 62 days', () => {
        const chunks = yearChunks(2028, IST); // a leap year
        expect(chunks).toHaveLength(6);
        expect(chunks[0].from.toISOString()).toBe('2027-12-31T18:30:00.000Z'); // 1 Jan 2028 00:00 IST
        expect(chunks[5].to.toISOString()).toBe('2028-12-31T18:30:00.000Z');
        for (let i = 0; i < chunks.length; i += 1) {
            expect(chunks[i].to.getTime() - chunks[i].from.getTime()).toBeLessThanOrEqual(62 * 86_400_000);
            if (i > 0) expect(chunks[i].from.getTime()).toBe(chunks[i - 1].to.getTime());
        }
    });
});

describe('Year view', () => {
    it('loads the year through the calendar API in six chunks', async () => {
        await openYear();
        const yearCalls = api.loadCalendar.mock.calls.filter(([, from]) => (from as Date).toISOString().startsWith(String(NEXT_YEAR - 1)) || (from as Date).toISOString().startsWith(Y));
        const ranges = new Set(yearCalls.map(([, f, t]) => `${(f as Date).toISOString()}|${(t as Date).toISOString()}`));
        for (const c of yearChunks(NEXT_YEAR, IST)) expect(ranges).toContain(`${c.from.toISOString()}|${c.to.toISOString()}`);
    });

    it('marks every source on its own date, in IST', async () => {
        await openYear();
        expect(day(/10 March: 1 items — Scheduled call/)).toBeInTheDocument();
        expect(day(/28 February: 1 items — Campaign calls/)).toBeInTheDocument();
        expect(day(/2 March: 1 items — School event/)).toBeInTheDocument();
        expect(day(/15 August: 1 items — Holiday/)).toBeInTheDocument();
        expect(day(/20 November: 1 items — School event/)).toBeInTheDocument();
        expect(day(/31 December: 1 items — Scheduled call, needs your action/)).toBeInTheDocument();
        expect(day(/11 March: nothing scheduled/)).toBeInTheDocument();
        // A draft campaign is not scheduled: nothing else on 20 November.
        expect(screen.getByRole('button', { name: /Open November .*: 1 items/ })).toBeInTheDocument();
    });

    it('counts a chunk-spanning campaign once in the year summary', async () => {
        await openYear();
        const summary = screen.getByRole('region', { name: 'Summary for this period' });
        // Two callbacks (10 Mar, 31 Dec); campaign calls: 1, even though two chunks returned it.
        expect(within(summary).getByText('2 callbacks · 1 campaigns')).toBeInTheDocument();
        expect(within(within(summary).getByText('Failed or missed').parentElement as HTMLElement).getByText('1')).toBeInTheDocument();
    });

    it('applies the type filter to the year', async () => {
        await openYear();
        fireEvent.click(within(screen.getByRole('group', { name: 'Event types' })).getByRole('button', { name: /Holiday/ }));
        expect(day(/15 August: nothing scheduled/)).toBeInTheDocument();
    });

    it('a date opens the Day view and a month opens the Month view', async () => {
        await openYear();
        fireEvent.click(day(/10 March: 1 items/));
        await waitFor(() => expect(screen.getByRole('radio', { name: 'Day' })).toHaveAttribute('aria-checked', 'true'));
        expect(screen.getByRole('heading', { level: 2, name: /10 March/ })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('radio', { name: 'Year' }));
        await screen.findByRole('list', { name: `Months of ${Y}` });
        fireEvent.click(screen.getByRole('button', { name: /Open August/ }));
        await waitFor(() => expect(screen.getByRole('radio', { name: 'Month' })).toHaveAttribute('aria-checked', 'true'));
        expect(screen.getByRole('heading', { level: 2, name: `August ${Y}` })).toBeInTheDocument();
    });

    it('moves between years', async () => {
        await openYear();
        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        await waitFor(() => expect(screen.getByRole('heading', { name: String(NEXT_YEAR - 1) })).toBeInTheDocument());
    });
});
