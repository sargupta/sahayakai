/**
 * Typed client for the school's Google Calendar routes
 * (/api/sampark/[orgId]/google-calendar/**). No token ever reaches the browser: the
 * server holds the Google grant and these calls act on the school's behalf.
 */

import { apiFetch } from '@/lib/api/client';
import type { GoogleEventsResponse } from '@/server/sampark/google-calendar';
import type { CalendarChoice, CreateEventInput, EventInput, EventScope, GoogleCalendarStatus, SchoolCalendarEvent } from '@/lib/sampark/google-calendar/types';

export type { CalendarChoice, CreateEventInput, EventInput, EventScope, GoogleCalendarStatus, GoogleEventsResponse, SchoolCalendarEvent };

const base = (orgId: string) => `/api/sampark/${encodeURIComponent(orgId)}/google-calendar`;

export const getGoogleCalendarStatus = (orgId: string, opts: { signal?: AbortSignal } = {}) =>
    apiFetch<GoogleCalendarStatus>(base(orgId), { signal: opts.signal });

export const startGoogleCalendarConnect = (orgId: string) => apiFetch<{ authUrl: string }>(`${base(orgId)}/connect`, { method: 'POST', body: {} });

export const disconnectGoogleCalendar = (orgId: string) => apiFetch<{ disconnected: true; revoked: boolean }>(base(orgId), { method: 'DELETE' });

export const listGoogleCalendars = (orgId: string) => apiFetch<{ calendars: CalendarChoice[] }>(`${base(orgId)}/calendars`);

export const selectGoogleCalendar = (orgId: string, calendarId: string) =>
    apiFetch<GoogleCalendarStatus>(`${base(orgId)}/calendars`, { method: 'PUT', body: { calendarId } });

export function listGoogleEvents(orgId: string, from: Date, to: Date, opts: { signal?: AbortSignal } = {}) {
    const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    return apiFetch<GoogleEventsResponse>(`${base(orgId)}/events?${qs.toString()}`, { signal: opts.signal });
}

export const getGoogleEvent = (orgId: string, eventId: string) => apiFetch<SchoolCalendarEvent>(`${base(orgId)}/events/${encodeURIComponent(eventId)}`);

export const createGoogleEvent = (orgId: string, input: CreateEventInput) =>
    apiFetch<{ event: SchoolCalendarEvent; created: boolean }>(`${base(orgId)}/events`, { method: 'POST', body: input });

export const updateGoogleEvent = (orgId: string, eventId: string, event: EventInput, scope: EventScope) =>
    apiFetch<SchoolCalendarEvent>(`${base(orgId)}/events/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: { event, scope } });

export const cancelGoogleEvent = (orgId: string, eventId: string, scope: EventScope) =>
    apiFetch<{ cancelled: true; alreadyCancelled: boolean }>(`${base(orgId)}/events/${encodeURIComponent(eventId)}?scope=${scope}`, { method: 'DELETE' });

export const syncGoogleCalendarNow = (orgId: string) =>
    apiFetch<{ full: boolean; changed: number; removed: number }>(`${base(orgId)}/sync`, { method: 'POST', body: {} });
