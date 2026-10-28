/**
 * The school calendar in jsdom, the calendar API mocked with events from every
 * source: they render together, the summary shows the server's counts, filters hide
 * and show by type and status, a campaign opens its details with a link to the
 * campaign page (not edited here), a callback opens the callback dialog, and the
 * error state can be retried.
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

import { campaignCallsEvent, callbackEvent, holidayEvents, schoolEvents, summarise } from '@/lib/sampark/calendar/events';
import type { CallbackView } from '@/lib/sampark/callbacks/types';
import { SchoolCalendar } from '@/components/sampark/calendar/school-calendar';

import { campaign } from '../engine/_fixtures';

const api = jest.requireMock('@/lib/api/sampark-calendar') as { loadCalendar: jest.Mock };
const IST = 'Asia/Kolkata';
const now = new Date();
const inDays = (d: number, hourUtc = 6) => {
    const x = new Date(now.getTime() + d * 86_400_000);
    x.setUTCHours(hourUtc, 0, 0, 0);
    return x.toISOString();
};
const dateOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date(iso));

function cb(over: Partial<CallbackView> = {}): CallbackView {
    return {
        id: 'cb1', orgId: 'hillview-demo', guardianId: 'g1', studentId: 's1', riyaPurpose: 'ptm_invitation', facts: null, campaignId: 'c1',
        announcement: 'PTM on Saturday', scheduledAt: inDays(0), timeZone: IST, candidates: [], status: 'scheduled', version: 1, queueAt: null,
        attempts: 0, riyaCallId: null, lastError: null, source: 'staff', sourceCallId: null, requestedText: null, note: null, createdBy: 'admin',
        approvedBy: 'admin', createdAt: now.toISOString(), updatedAt: now.toISOString(), cancelledBy: null, completedAt: null,
        guardianDisplayName: 'Meena Demo', studentDisplayName: 'Asha Demo', guardianPhoneLast4: '0101', callState: null, ...over,
    };
}

function response() {
    const camp = campaign({ id: 'camp1', facts: { kind: 'ptm_invite', date: dateOf(inDays(2)), time: { hour: 10, minute: 0 }, venueId: 'hall' }, notBefore: inDays(1), expiresAt: inDays(2), counts: { guardians: 30, blocked: 2, queued: 28, inFlight: 0, heardKeyFact: 0, confirmedYes: 0, declinedOrOther: 0, noAnswer: 0, failed: 0, optOuts: 0 } });
    const events = [
        callbackEvent(cb(), IST)!,
        callbackEvent(cb({ id: 'cb2', status: 'cancelled', guardianDisplayName: 'Ravi Parent' }), IST)!,
        campaignCallsEvent(camp, IST)!,
        ...schoolEvents([camp], IST, now),
        ...holidayEvents({ orgId: 'hillview-demo', holidays: [dateOf(inDays(3))] }, IST),
    ].sort((a, b) => a.start.localeCompare(b.start));
    return {
        timeZone: IST, from: inDays(-40), to: inDays(40), events, awaitingApproval: [],
        summary: summarise(events, 0), sources: { callbacks: true, campaigns: true, holidays: true }, people: { admin: 'Principal Rao', 'dev-user-123': 'Principal Rao' },
    };
}

beforeEach(() => api.loadCalendar.mockReset());

describe('SchoolCalendar', () => {
    it('shows every source together, with the period summary', async () => {
        api.loadCalendar.mockImplementation(async (_org: string, from: Date, to: Date) => ({ ...response(), from: from.toISOString(), to: to.toISOString() }));
        render(<SchoolCalendar orgId="hillview-demo" />);
        const summary = await screen.findByRole('region', { name: 'Summary for this period' });
        // 1 scheduled callback + 28 campaign families; the cancelled one is not counted.
        expect(within(summary).getByText('29')).toBeInTheDocument();
        await waitFor(() => expect(screen.getAllByRole('button', { name: /Campaign calls/ }).length).toBeGreaterThan(0));
        expect(screen.getAllByRole('button', { name: /School event/ }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('button', { name: /Holiday/ }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('button', { name: /Meena Demo/ }).length).toBeGreaterThan(0);
    });

    it('filters by type and by status', async () => {
        api.loadCalendar.mockImplementation(async (_org: string, from: Date, to: Date) => ({ ...response(), from: from.toISOString(), to: to.toISOString() }));
        render(<SchoolCalendar orgId="hillview-demo" />);
        const types = await screen.findByRole('group', { name: 'Event types' });
        await waitFor(() => expect(screen.getAllByRole('button', { name: /, Campaign calls,/ }).length).toBeGreaterThan(0));
        fireEvent.click(within(types).getByRole('button', { name: /Campaign calls/ }));
        expect(within(types).getByRole('button', { name: /Campaign calls/ })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryAllByRole('button', { name: /, Campaign calls,/ })).toHaveLength(0);
        fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'cancelled' } });
        const grid = within(document.querySelector('section[aria-labelledby="calendar-heading"]') as HTMLElement);
        expect(grid.getAllByRole('button', { name: /Ravi Parent, cancelled/ }).length).toBeGreaterThan(0);
        expect(grid.queryAllByRole('button', { name: /Meena Demo, scheduled/ })).toHaveLength(0);
    });

    it('a campaign opens its details and links to its page instead of editing it here', async () => {
        api.loadCalendar.mockImplementation(async (_org: string, from: Date, to: Date) => ({ ...response(), from: from.toISOString(), to: to.toISOString() }));
        render(<SchoolCalendar orgId="hillview-demo" />);
        await waitFor(() => expect(screen.getAllByRole('button', { name: /, Campaign calls,/ }).length).toBeGreaterThan(0));
        fireEvent.click(screen.getAllByRole('button', { name: /, Campaign calls,/ })[0]);
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText(/30 · queued 28/)).toBeInTheDocument();
        // Created by and approved by.
        expect(within(dialog).getAllByText('Principal Rao')).toHaveLength(2);
        expect(within(dialog).getByRole('link', { name: /Open campaign/ })).toHaveAttribute('href', '/sampark/hillview-demo/campaigns/camp1');
    });

    it('a callback opens the callback dialog with who scheduled it', async () => {
        api.loadCalendar.mockImplementation(async (_org: string, from: Date, to: Date) => ({ ...response(), from: from.toISOString(), to: to.toISOString() }));
        render(<SchoolCalendar orgId="hillview-demo" />);
        await waitFor(() => expect(screen.getAllByRole('button', { name: /Meena Demo, scheduled/ }).length).toBeGreaterThan(0));
        fireEvent.click(screen.getAllByRole('button', { name: /Meena Demo, scheduled/ })[0]);
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Principal Rao')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Change time' })).toBeInTheDocument();
    });

    it('shows a retryable error', async () => {
        api.loadCalendar.mockRejectedValue(new Error('down'));
        render(<SchoolCalendar orgId="hillview-demo" />);
        expect((await screen.findAllByRole('button', { name: /try again|retry/i })).length).toBeGreaterThan(0);
    });
});
