/**
 * Typed client for /api/sampark/[orgId]/callbacks. One function per route, through
 * `apiFetch` (Firebase ID token; the server checks org-admin access on every call).
 * The browser only ever schedules, moves or cancels: it never starts a call. Calls
 * are started by the server's scheduler tick at the due time.
 */

import { apiFetch } from '@/lib/api/client';
import type { CallbackTimeParse } from '@/lib/sampark/callbacks/time';
import type { CallbackView } from '@/lib/sampark/callbacks/types';
import type { RiyaPurpose } from '@/lib/sampark/conversation/riya-purposes';
import type { CallbackHistoryEntry, CallbackPreview } from '@/server/sampark/callbacks';

export type { CallbackHistoryEntry, CallbackPreview, CallbackView };

type Opts = { signal?: AbortSignal };

function path(orgId: string, rest = ''): string {
    return `/api/sampark/${encodeURIComponent(orgId)}/callbacks${rest}`;
}

export interface CallbackSource {
    callId: string;
    guardianId: string;
    studentId: string;
    guardianDisplayName: string | null;
    studentDisplayName: string | null;
    purpose: RiyaPurpose;
    announcement: string;
    state: string;
    createdAt: string;
}

/** One callback and its audit trail (newest first). */
export function getCallbackWithHistory(orgId: string, id: string, opts: Opts = {}): Promise<{ callback: CallbackView; history: CallbackHistoryEntry[] }> {
    return apiFetch(path(orgId, `/${encodeURIComponent(id)}`), { signal: opts.signal });
}

export function listCallbacks(orgId: string, from: Date, to: Date, opts: Opts = {}): Promise<{ callbacks: CallbackView[]; proposed: CallbackView[] }> {
    const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    return apiFetch(path(orgId, `?${qs.toString()}`), { signal: opts.signal });
}

export async function listCallbackSources(orgId: string, opts: Opts = {}): Promise<CallbackSource[]> {
    const res = await apiFetch<{ sources: CallbackSource[] }>(path(orgId, '/sources'), { signal: opts.signal });
    return res.sources;
}

export async function previewCallback(orgId: string, input: { sourceCallId: string; scheduledAt: string; timeZone: string }): Promise<CallbackPreview> {
    const res = await apiFetch<{ preview: CallbackPreview }>(path(orgId, '/preview'), {
        method: 'POST',
        body: { target: { sourceCallId: input.sourceCallId }, scheduledAt: input.scheduledAt, timeZone: input.timeZone },
    });
    return res.preview;
}

export function createCallback(
    orgId: string,
    input: { sourceCallId: string; scheduledAt: string; timeZone: string; requestKey: string; confirmedAnnouncement: string; note?: string },
): Promise<{ callback: CallbackView; duplicate: boolean }> {
    const { sourceCallId, ...rest } = input;
    return apiFetch(path(orgId), { method: 'POST', body: { target: { sourceCallId }, ...rest } });
}

export async function previewCallbackChange(orgId: string, id: string, scheduledAt: string, timeZone: string): Promise<CallbackPreview> {
    const res = await apiFetch<{ preview: CallbackPreview }>(path(orgId, `/${encodeURIComponent(id)}`), {
        method: 'PATCH',
        body: { action: 'preview', scheduledAt, timeZone },
    });
    return res.preview;
}

export async function changeCallbackTime(
    orgId: string,
    id: string,
    input: { action: 'reschedule' | 'confirm'; scheduledAt: string; timeZone: string; confirmedAnnouncement: string; expectedVersion: number },
): Promise<CallbackView> {
    const res = await apiFetch<{ callback: CallbackView }>(path(orgId, `/${encodeURIComponent(id)}`), { method: 'PATCH', body: input });
    return res.callback;
}

export async function cancelCallback(orgId: string, id: string, expectedVersion: number): Promise<CallbackView> {
    const res = await apiFetch<{ callback: CallbackView }>(path(orgId, `/${encodeURIComponent(id)}`), {
        method: 'PATCH',
        body: { action: 'cancel', expectedVersion },
    });
    return res.callback;
}

export interface ParsedTime {
    parse: CallbackTimeParse extends infer P ? (P extends { at: Date } ? Omit<P, 'at'> & { at: string } : P extends { candidates: Date[] } ? Omit<P, 'candidates'> & { candidates: string[] } : P) : never;
    labels: string[];
}

export function parseCallbackTime(orgId: string, text: string, timeZone: string): Promise<ParsedTime> {
    return apiFetch(path(orgId, '/parse'), { method: 'POST', body: { text, timeZone } });
}
