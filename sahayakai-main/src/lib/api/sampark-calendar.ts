/**
 * Typed client for GET /api/sampark/[orgId]/calendar (read-only). Changes go through
 * the callback client (sampark-callbacks.ts) and the campaign pages.
 */

import { apiFetch } from '@/lib/api/client';
import type { CalendarResponse } from '@/server/sampark/calendar';

export type { CalendarResponse };
export type { CalendarEvent, CalendarEventType, CalendarStatus, CalendarSummary } from '@/lib/sampark/calendar/events';

export function loadCalendar(orgId: string, from: Date, to: Date, opts: { signal?: AbortSignal } = {}): Promise<CalendarResponse> {
    const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    return apiFetch(`/api/sampark/${encodeURIComponent(orgId)}/calendar?${qs.toString()}`, { signal: opts.signal });
}
