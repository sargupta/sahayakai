/**
 * Google Calendar for a SamparkAI school: the shapes shared by the server, the
 * routes and the browser. Nothing here holds a token.
 *
 * Ownership: ONE Google connection per school (tenant), made and managed by an org
 * admin of that school (the same `requireOrgAdmin` rule as every Sampark route).
 * Every admin of the school sees and edits the school's chosen calendar; no other
 * school can reach it. Teachers do not connect personal calendars here.
 *
 * Calendar events are NOT callbacks: nothing in this module creates, triggers or
 * cancels a phone call. See docs/sampark/GOOGLE_CALENDAR.md.
 */

import { z } from 'zod';

import { isValidTimeZone } from '@/lib/sampark/callbacks/time';

/** Minimum scopes: events on calendars the account owns, and the list of its calendars. */
export const GOOGLE_CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events.owned',
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
] as const;

export const GOOGLE_CALENDAR_CALLBACK_PATH = '/api/sampark/google-calendar/oauth/callback';
export const GOOGLE_CALENDAR_NOTIFY_PATH = '/api/sampark/google-calendar/notifications';

export type ConnectionState = 'unconfigured' | 'disconnected' | 'connected' | 'reconnect_required' | 'error';
export type GoogleCalendarMode = 'google' | 'mock';

export interface GoogleCalendarStatus {
    /** False when the deployment has no OAuth client (or no token key): nothing can connect. */
    configured: boolean;
    /** 'mock' only in local development: no real Google account is involved. */
    mode: GoogleCalendarMode | null;
    /** What is missing when not configured (variable names only, never values). */
    missing: string[];
    state: ConnectionState;
    /** The Google account's primary calendar id (normally its address). */
    accountLabel: string | null;
    calendar: { id: string; summary: string; timeZone: string } | null;
    connectedAt: string | null;
    connectedBy: string | null;
    lastSyncedAt: string | null;
    lastError: { code: string; message: string; at: string } | null;
    push:
        | { active: true; expiresAt: string }
        | { active: false; reason: 'no_public_url' | 'not_connected' | 'not_started' | 'failed' };
}

export interface CalendarChoice {
    id: string;
    summary: string;
    timeZone: string;
    primary: boolean;
    selected: boolean;
}

export const REPEAT_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type RepeatFrequency = (typeof REPEAT_FREQUENCIES)[number];

export interface RepeatRule {
    freq: RepeatFrequency;
    interval: number;
    ends: { type: 'never' } | { type: 'count'; count: number } | { type: 'until'; date: string };
}

/** One event as the app shows it. `start`/`end` are instants for timed events, dates for all-day. */
export interface SchoolCalendarEvent {
    id: string;
    calendarId: string;
    summary: string;
    description: string;
    location: string;
    status: 'confirmed' | 'tentative' | 'cancelled';
    allDay: boolean;
    /** Timed: ISO instant. All-day: YYYY-MM-DD. */
    start: string;
    /** Timed: ISO instant. All-day: YYYY-MM-DD, INCLUSIVE (Google's exclusive end minus a day). */
    end: string;
    timeZone: string;
    /** The rule of a series master; null for single events and for occurrences. */
    repeat: RepeatRule | null;
    /** A recurrence this app cannot edit (e.g. BYDAY lists); shown, not editable here. */
    repeatText: string | null;
    /** Set on an occurrence of a series. */
    recurringEventId: string | null;
    htmlLink: string | null;
    updated: string | null;
}

const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const TimeKey = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM');

export const RepeatRuleSchema = z
    .object({
        freq: z.enum(REPEAT_FREQUENCIES),
        interval: z.number().int().min(1).max(99),
        ends: z.discriminatedUnion('type', [
            z.object({ type: z.literal('never') }).strict(),
            z.object({ type: z.literal('count'), count: z.number().int().min(1).max(730) }).strict(),
            z.object({ type: z.literal('until'), date: DateKey }).strict(),
        ]),
    })
    .strict();

export const EventInputSchema = z
    .object({
        summary: z.string().trim().min(1).max(200),
        description: z.string().max(4000).default(''),
        location: z.string().max(500).default(''),
        allDay: z.boolean(),
        startDate: DateKey,
        startTime: TimeKey.optional(),
        endDate: DateKey,
        endTime: TimeKey.optional(),
        timeZone: z.string().refine(isValidTimeZone, 'unknown time zone'),
        repeat: RepeatRuleSchema.nullable().default(null),
    })
    .strict();
export type EventInput = z.infer<typeof EventInputSchema>;

/** Create: a client-made request id makes a retried create return the same event. */
export const CreateEventSchema = EventInputSchema.extend({
    requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'invalid requestId'),
}).strict();
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

/** Which part of a series an edit or cancel applies to. */
export const EventScopeSchema = z.enum(['this', 'series']);
export type EventScope = z.infer<typeof EventScopeSchema>;
