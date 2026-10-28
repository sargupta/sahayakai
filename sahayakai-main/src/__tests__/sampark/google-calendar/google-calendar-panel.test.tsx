/**
 * The Google Calendar page in jsdom with its API client mocked: each connection
 * state reads plainly (not set up, not connected, connected, reconnect needed), mock
 * mode is labelled, events are listed by day with repeats marked, an event opens its
 * details with "this event / the whole series", and disconnect asks first.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock('@/context/language-context', () => ({
    ...jest.requireActual('@/context/language-context'),
    useLanguage: () => ({ t: (k: string) => k, language: 'English', isLoaded: true }),
}));
jest.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('next/navigation', () => ({ usePathname: () => '/sampark/hillview-demo/calendar/google', useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('@/lib/api/sampark-google-calendar', () => ({
    getGoogleCalendarStatus: jest.fn(),
    startGoogleCalendarConnect: jest.fn(),
    disconnectGoogleCalendar: jest.fn(),
    listGoogleCalendars: jest.fn(),
    selectGoogleCalendar: jest.fn(),
    listGoogleEvents: jest.fn(),
    getGoogleEvent: jest.fn(),
    createGoogleEvent: jest.fn(),
    updateGoogleEvent: jest.fn(),
    cancelGoogleEvent: jest.fn(),
    syncGoogleCalendarNow: jest.fn(),
}));

import { GoogleCalendarPanel } from '@/components/sampark/calendar/google-calendar-panel';
import type { GoogleCalendarStatus, SchoolCalendarEvent } from '@/lib/sampark/google-calendar/types';

const api = jest.requireMock('@/lib/api/sampark-google-calendar') as Record<string, jest.Mock>;

const status = (over: Partial<GoogleCalendarStatus> = {}): GoogleCalendarStatus => ({
    configured: true,
    mode: 'mock',
    missing: [],
    state: 'connected',
    accountLabel: 'school.admin@mock-google.test',
    calendar: { id: 'cal-1', summary: 'Hillview School', timeZone: 'Asia/Kolkata' },
    connectedAt: '2026-10-28T06:00:00.000Z',
    connectedBy: 'admin-uid',
    lastSyncedAt: '2026-10-28T06:00:00.000Z',
    lastError: null,
    push: { active: false, reason: 'no_public_url' },
    ...over,
});

const now = new Date();
const at = (day: number, hourUtc: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hourUtc)).toISOString();
const ev = (over: Partial<SchoolCalendarEvent>): SchoolCalendarEvent => ({
    id: 'e1', calendarId: 'cal-1', summary: 'Sports day', description: '', location: 'Ground', status: 'confirmed', allDay: false,
    start: at(20, 3), end: at(20, 6), timeZone: 'Asia/Kolkata', repeat: null, repeatText: null, recurringEventId: null, htmlLink: null, updated: null, ...over,
});

beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.listGoogleCalendars.mockResolvedValue({ calendars: [{ id: 'cal-1', summary: 'Hillview School', timeZone: 'Asia/Kolkata', primary: true, selected: true }, { id: 'cal-2', summary: 'PTM schedule', timeZone: 'Asia/Kolkata', primary: false, selected: false }] });
    api.listGoogleEvents.mockImplementation(async (_o: string, from: Date, to: Date) => ({
        timeZone: 'Asia/Kolkata', calendarId: 'cal-1', from: from.toISOString(), to: to.toISOString(),
        events: [ev({}), ev({ id: 'm_1', summary: 'Staff meeting', start: at(22, 4), end: at(22, 5), recurringEventId: 'm' })],
    }));
});

describe('GoogleCalendarPanel', () => {
    it('explains a server without an OAuth client and offers no connect button', async () => {
        api.getGoogleCalendarStatus.mockResolvedValue(status({ configured: false, mode: null, state: 'unconfigured', missing: ['GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET'], calendar: null, accountLabel: null }));
        render(<GoogleCalendarPanel orgId="hillview-demo" />);
        expect(await screen.findByText('Not set up on this server')).toBeInTheDocument();
        expect(screen.getByText('GOOGLE_CALENDAR_CLIENT_ID')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Connect Google Calendar/ })).not.toBeInTheDocument();
    });

    it('when not connected, Connect asks the server for the consent URL (no token in the browser)', async () => {
        api.getGoogleCalendarStatus.mockResolvedValue(status({ state: 'disconnected', calendar: null, accountLabel: null }));
        api.startGoogleCalendarConnect.mockReturnValue(new Promise(() => undefined));
        render(<GoogleCalendarPanel orgId="hillview-demo" />);
        fireEvent.click(await screen.findByRole('button', { name: /Connect Google Calendar/ }));
        expect(api.startGoogleCalendarConnect).toHaveBeenCalledWith('hillview-demo');
        expect(await screen.findByText('Connecting…')).toBeInTheDocument();
        expect(api.listGoogleEvents).not.toHaveBeenCalled();
    });

    it('when connected: labels mock mode, lists owned calendars and the month’s events by day', async () => {
        api.getGoogleCalendarStatus.mockResolvedValue(status());
        render(<GoogleCalendarPanel orgId="hillview-demo" />);
        expect(await screen.findByText('Connected')).toBeInTheDocument();
        expect(screen.getByText('Local mock Google.')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByLabelText('School calendar')).not.toBeDisabled());
        expect(within(screen.getByLabelText('School calendar')).getAllByRole('option')).toHaveLength(2);
        expect(await screen.findByRole('button', { name: /Sports day/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Staff meeting.*repeating/ })).toBeInTheDocument();
        expect(screen.getByText(/no public HTTPS address/)).toBeInTheDocument();
    });

    it('an occurrence of a series asks whether to change this event or the whole series', async () => {
        api.getGoogleCalendarStatus.mockResolvedValue(status());
        api.getGoogleEvent.mockResolvedValue(ev({ id: 'm', summary: 'Staff meeting', repeat: { freq: 'WEEKLY', interval: 1, ends: { type: 'count', count: 4 } } }));
        render(<GoogleCalendarPanel orgId="hillview-demo" />);
        fireEvent.click(await screen.findByRole('button', { name: /Staff meeting.*repeating/ }));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByRole('radio', { name: 'This event only' })).toBeChecked();
        expect(within(dialog).getByRole('radio', { name: 'All events in the series' })).toBeInTheDocument();
        expect(await within(dialog).findByText('Repeats every week, 4 times')).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel event' }));
        expect(within(dialog).getByRole('alert')).toHaveTextContent('Cancel this event?');
        expect(api.cancelGoogleEvent).not.toHaveBeenCalled();
    });

    it('reconnect needed: says so and offers Reconnect; disconnect asks first', async () => {
        api.getGoogleCalendarStatus.mockResolvedValue(status({ state: 'reconnect_required', lastError: { code: 'GCAL_RECONNECT_REQUIRED', message: 'Google access expired or was revoked.', at: '2026-10-28T06:00:00.000Z' } }));
        render(<GoogleCalendarPanel orgId="hillview-demo" />);
        expect(await screen.findByText('Reconnect needed')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reconnect/ })).toBeInTheDocument();
        expect(api.listGoogleEvents).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
        expect(await screen.findByRole('alertdialog')).toHaveTextContent('Disconnect Google Calendar?');
        expect(api.disconnectGoogleCalendar).not.toHaveBeenCalled();
    });
});
